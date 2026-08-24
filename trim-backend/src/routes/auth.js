const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { generateAccessToken } = require('../utils/jwt');
const {
  issueRefreshToken, rotateRefreshToken, revokeRefreshToken, RefreshError,
} = require('../utils/refreshTokens');
const validate = require('../middleware/validate');
const {
  registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema,
} = require('../validation/schemas');
const crypto = require('crypto');
const PasswordResetToken = require('../models/PasswordResetToken');
const { revokeAllForUser } = require('../utils/refreshTokens');
const { sendPasswordResetEmail, isConfigured } = require('../services/email');

const router = express.Router();

// Số vòng bcrypt (test rẻ, prod chậm để chống brute-force offline).
const BCRYPT_ROUNDS = process.env.NODE_ENV === 'test' ? 1 : 12;

// Ngưỡng khoá tài khoản. Có thể chỉnh qua env; mặc định 5 lần / 15 phút.
const MAX_LOGIN_ATTEMPTS = parseInt(process.env.MAX_LOGIN_ATTEMPTS, 10) || 5;
const LOCK_WINDOW_MS = (parseInt(process.env.LOCK_WINDOW_MINUTES, 10) || 15) * 60 * 1000;

// Hash GIẢ cố định, cùng cost với hash thật, để bcrypt.compare luôn tốn thời gian
// tương đương kể cả khi email không tồn tại → không lộ tồn tại tài khoản qua timing.
const DUMMY_HASH = bcrypt.hashSync('timing-safe-dummy-password', BCRYPT_ROUNDS);

// POST /api/auth/register
router.post('/register', validate(registerSchema, { replace: true }), async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      // Hướng anti-enum (a) đã chốt: giữ message thân thiện cho UX. Chống enum ĐẦY ĐỦ
      // (giấu tồn tại) DEFER sang GĐ1d (cần email verification). Mitigation hiện tại =
      // rate limit authLimiter 5/15min áp /api/auth.
      return res.status(400).json({ message: 'This email is already registered' });
    }

    const bcryptRounds = BCRYPT_ROUNDS;
    const salt = await bcrypt.genSalt(bcryptRounds);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = new User({ name, email, passwordHash });
    await user.save();

    const accessToken = generateAccessToken({ userId: user._id });
    // Refresh token: opaque ngẫu nhiên, lưu HASH ở collection RefreshToken (không phải array).
    const { raw: refreshToken } = await issueRefreshToken(user._id);

    res.status(201).json({
      accessToken,
      refreshToken,
      user: { _id: user._id, name: user.name, email: user.email, onboardingCompleted: false },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/login
router.post('/login', validate(loginSchema, { replace: true }), async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    const now = Date.now();
    const isLocked = !!(user && user.lockUntil && user.lockUntil.getTime() > now);

    // TIMING-SAFE: LUÔN chạy bcrypt.compare. Không có user → so với DUMMY_HASH (cùng cost)
    // nên thời gian phản hồi nhánh "sai email" == nhánh "sai mật khẩu".
    const passwordOk = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);

    // Thất bại nếu: không có user, HOẶC đang khoá, HOẶC sai mật khẩu.
    // Mọi nhánh thất bại trả GIỐNG HỆT nhau (401 + "Invalid credentials") — không lộ
    // tồn tại tài khoản, không lộ trạng thái khoá.
    if (!user || isLocked || !passwordOk) {
      // Chỉ đếm khi user thật, KHÔNG đang khoá, và sai mật khẩu (đúng nghĩa "login sai").
      if (user && !isLocked && !passwordOk) {
        user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
        if (user.failedLoginAttempts >= MAX_LOGIN_ATTEMPTS) {
          user.lockUntil = new Date(now + LOCK_WINDOW_MS);
          user.failedLoginAttempts = 0; // reset đếm; sau khi hết khoá được thử lại từ đầu
        }
        await user.save();
      }
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Thành công: reset mọi trạng thái khoá nếu có.
    if (user.failedLoginAttempts > 0 || user.lockUntil) {
      user.failedLoginAttempts = 0;
      user.lockUntil = null;
      await user.save();
    }

    const accessToken = generateAccessToken({ userId: user._id });
    // Login mới → family mới. Token thô chỉ trả về đây (DB lưu hash).
    const { raw: refreshToken } = await issueRefreshToken(user._id);

    res.json({
      accessToken,
      refreshToken,
      user: { _id: user._id, name: user.name, email: user.email, onboardingCompleted: user.onboardingCompleted },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/refresh — XOAY token (rotation) + reuse-detection.
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token required' });
    }

    try {
      // Trả token thô MỚI (client PHẢI lưu lại — xem interceptor api.js).
      const { raw, userId } = await rotateRefreshToken(refreshToken);
      const accessToken = generateAccessToken({ userId });
      return res.json({ accessToken, refreshToken: raw });
    } catch (err) {
      if (err instanceof RefreshError) {
        // Generic 401 cho MỌI nhánh (invalid/expired/reuse) — không lộ vì sao.
        // reuse-detection đã revoke cả family bên trong rotateRefreshToken.
        return res.status(401).json({ message: 'Invalid refresh token' });
      }
      throw err;
    }
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/logout — thu hồi token hiện tại.
router.post('/logout', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token required' });
    }

    // Opaque token → chỉ cần revoke bản ghi khớp hash. Không lộ nếu token không tồn tại.
    await revokeRefreshToken(refreshToken);

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
});

// Hash token reset — SHA-256 (token là chuỗi ngẫu nhiên entropy cao, không phải password).
const RESET_TTL_MS = 15 * 60 * 1000; // 15 phút
const hashResetToken = (raw) => crypto.createHash('sha256').update(raw).digest('hex');

// POST /api/auth/forgot-password — LUÔN 200 generic (anti-enumeration).
router.post('/forgot-password', validate(forgotPasswordSchema, { replace: true }), async (req, res, next) => {
  try {
    const { email } = req.body;
    // Chỉ thực sự gửi khi user tồn tại VÀ email đã cấu hình. Nhưng response LUÔN giống nhau.
    if (isConfigured()) {
      const user = await User.findOne({ email });
      if (user) {
        const rawToken = crypto.randomBytes(32).toString('hex');
        await PasswordResetToken.create({
          user: user._id,
          tokenHash: hashResetToken(rawToken),
          expiresAt: new Date(Date.now() + RESET_TTL_MS),
        });
        await sendPasswordResetEmail(user.email, rawToken);
      }
    }
    // Không lộ tồn tại tài khoản, không lộ email đã cấu hình hay chưa.
    return res.status(200).json({ message: 'If an account exists, a reset link has been sent.' });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/reset-password — đổi password bằng token thô.
router.post('/reset-password', validate(resetPasswordSchema, { replace: true }), async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    const record = await PasswordResetToken.findOne({ tokenHash: hashResetToken(token) });

    // Token sai HOẶC hết hạn → 400 generic (không lộ cái nào).
    if (!record || record.expiresAt.getTime() <= Date.now()) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
    const passwordHash = await bcrypt.hash(newPassword, salt);
    await User.findByIdAndUpdate(record.user, {
      passwordHash,
      failedLoginAttempts: 0,
      lockUntil: null,
    });

    // Dùng token một lần: xoá token này + mọi token reset khác của user.
    await PasswordResetToken.deleteMany({ user: record.user });
    // Buộc đăng nhập lại mọi thiết bị (mật khẩu đã đổi).
    await revokeAllForUser(record.user);

    return res.json({ message: 'Password has been reset. Please log in with your new password.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
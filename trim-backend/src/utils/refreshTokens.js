/**
 * Cấp / xoay / thu hồi refresh token — collection RefreshToken (không phải array User).
 *
 * Bảo mật:
 *   - Token thô sinh bằng crypto.randomBytes (không đoán được), CHỈ trả về client một lần.
 *   - DB chỉ lưu SHA-256 hash → rò DB cũng không tái dùng được.
 *   - Rotation: mỗi refresh cấp token mới cùng family, revoke token cũ.
 *   - Reuse-detection: trình một token đã revoke ⇒ coi bị đánh cắp ⇒ revoke cả family.
 */
const crypto = require('crypto');
const RefreshToken = require('../models/RefreshToken');

const REFRESH_TTL_DAYS = parseInt(process.env.JWT_REFRESH_EXPIRES_DAYS, 10) || 30;
const REFRESH_TTL_MS = REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000;

const hashToken = (raw) => crypto.createHash('sha256').update(raw).digest('hex');
const newRawToken = () => crypto.randomBytes(32).toString('hex');
const newFamily = () => crypto.randomBytes(16).toString('hex');

class RefreshError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'RefreshError';
    this.code = code; // 'invalid' | 'expired' | 'reuse'
  }
}

/** Cấp token mới. family=null → login mới (family mới); truyền family → rotation. */
const issueRefreshToken = async (userId, family = null) => {
  const raw = newRawToken();
  const fam = family || newFamily();
  await RefreshToken.create({
    user: userId,
    tokenHash: hashToken(raw),
    family: fam,
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
  });
  return { raw, family: fam };
};

/**
 * Xoay token: xác thực token thô → cấp token mới cùng family, revoke token cũ.
 * Ném RefreshError('reuse') và revoke CẢ FAMILY nếu phát hiện dùng lại token đã revoke.
 */
const rotateRefreshToken = async (raw) => {
  const tokenHash = hashToken(raw);
  const record = await RefreshToken.findOne({ tokenHash });
  if (!record) throw new RefreshError('Invalid refresh token', 'invalid');

  // REUSE DETECTION: token đã revoke mà còn bị trình lại ⇒ bị đánh cắp ⇒ revoke cả family.
  if (record.revokedAt) {
    await revokeFamily(record.family);
    console.warn(
      `[security] refresh reuse detected — family ${record.family} revoked (user ${record.user})`
    );
    throw new RefreshError('Refresh token reuse detected', 'reuse');
  }

  if (record.expiresAt.getTime() <= Date.now()) {
    throw new RefreshError('Refresh token expired', 'expired');
  }

  // Claim NGUYÊN TỬ: chỉ request đầu tiên revoke được token này. Nếu request thứ hai
  // (dùng lại/đua) tới sau khi đã revoke → coi như reuse → revoke family.
  const claimed = await RefreshToken.findOneAndUpdate(
    { _id: record._id, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
  if (!claimed) {
    await revokeFamily(record.family);
    console.warn(
      `[security] refresh race/reuse — family ${record.family} revoked (user ${record.user})`
    );
    throw new RefreshError('Refresh token reuse detected', 'reuse');
  }

  const issued = await issueRefreshToken(record.user, record.family);
  return { raw: issued.raw, userId: record.user, family: record.family };
};

/** Thu hồi đúng một token (logout). Không ném lỗi nếu không tìm thấy. */
const revokeRefreshToken = async (raw) => {
  await RefreshToken.updateOne(
    { tokenHash: hashToken(raw), revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
};

/** Thu hồi toàn bộ token còn hiệu lực trong một family. */
const revokeFamily = async (family) => {
  await RefreshToken.updateMany(
    { family, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
};

/** Thu hồi TẤT CẢ refresh token của một user (buộc đăng nhập lại mọi thiết bị). */
const revokeAllForUser = async (userId) => {
  await RefreshToken.updateMany(
    { user: userId, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
};

module.exports = {
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeFamily,
  revokeAllForUser,
  hashToken,
  RefreshError,
};

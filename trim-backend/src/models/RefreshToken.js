const mongoose = require('mongoose');

/**
 * RefreshToken — collection RIÊNG (không phải array trong User).
 *
 * ⚠ LỊCH SỬ REPO: TTL đặt trên field createdAt TRONG MẢNG User.refreshTokens từng khiến
 * MongoDB xoá CẢ DOCUMENT user (18 tài khoản). Vì vậy:
 *   - Đây là collection document-level: mỗi refresh token là 1 document riêng.
 *   - TTL đặt trên field Date TOP-LEVEL `expiresAt` → MongoDB chỉ xoá ĐÚNG document token
 *     hết hạn, KHÔNG đụng user. Đây là chỗ TTL DUY NHẤT được phép trong toàn repo.
 *
 * Bảo mật:
 *   - KHÔNG lưu token thô. Chỉ lưu SHA-256 hash (tokenHash). Rò DB cũng không dùng lại được.
 *   - family: nhóm mọi token xoay ra từ MỘT lần login. Dùng cho reuse-detection: trình một
 *     token đã revoke ⇒ coi như bị đánh cắp ⇒ revoke cả family.
 */
const refreshTokenSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  // SHA-256 hex của token thô. KHÔNG BAO GIỜ lưu token thô.
  tokenHash: {
    type: String,
    required: true,
    unique: true,
  },
  // id nhóm rotation (mọi token xoay từ một lần login cùng family).
  family: {
    type: String,
    required: true,
    index: true,
  },
  // TTL DUY NHẤT ĐƯỢC PHÉP: document-level, field Date top-level.
  // expires:0 => xoá document khi Date.now() >= expiresAt. KHÔNG đặt trên field array/subdoc.
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 },
  },
  // Đã thu hồi (rotation cũ, logout, hoặc reuse-detection). null = còn hiệu lực.
  revokedAt: {
    type: Date,
    default: null,
  },
}, { timestamps: true });

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);

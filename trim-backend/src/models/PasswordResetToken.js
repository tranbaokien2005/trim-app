const mongoose = require('mongoose');

/**
 * PasswordResetToken — collection RIÊNG (giống RefreshToken).
 *
 * ⚠ TTL: `expiresAt` là field Date TOP-LEVEL, document-level (`index: { expires: 0 }`).
 * MongoDB xoá ĐÚNG document token hết hạn, KHÔNG đụng user. KHÔNG đặt TTL trên array/subdoc.
 *
 * Bảo mật: KHÔNG lưu token thô — chỉ SHA-256 hash. Token thô chỉ gửi qua email một lần.
 */
const passwordResetTokenSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  tokenHash: {
    type: String,
    required: true,
    unique: true,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 },
  },
}, { timestamps: true });

module.exports = mongoose.model('PasswordResetToken', passwordResetTokenSchema);

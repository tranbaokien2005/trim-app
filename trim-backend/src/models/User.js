const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  passwordHash: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  profile: {
    dateOfBirth: Date,
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
    },
    height: Number, // in cm
    baseActivityLevel: {
      type: String,
      enum: ['sedentary', 'lightly_active', 'moderately_active', 'very_active'],
      default: 'lightly_active',
    },
    timezone: String,
  },
  currentStats: {
    weight: Number, // in kg
    bmi: Number,
    bmr: Number,      // kcal/ngày (Mifflin-St Jeor, làm tròn) — từ utils/bmr.js
    baseline: Number, // kcal/ngày (NEAT + tiêu hoá) = round(bmr * BASELINE_RATIO)
    weightUpdatedAt: Date,
  },
  goals: [{
    type: {
      type: String,
      enum: ['lose', 'gain', 'maintain'],
      required: true,
    },
    targetWeight: Number, // in kg
    startWeight: Number, // in kg
    weeklyRate: Number, // kg per week
    startDate: {
      type: Date,
      default: Date.now,
    },
    targetDate: Date,
    dailyCalorieTarget: Number,
    isActive: {
      type: Boolean,
      default: true,
    },
  }],
  settings: {
    units: {
      type: String,
      enum: ['metric', 'imperial'],
      default: 'metric',
    },
    notifications: {
      weightReminder: { type: Boolean, default: true },
      goalProgress: { type: Boolean, default: true },
      weeklyReport: { type: Boolean, default: true },
    },
  },
  subscription: {
    plan: {
      type: String,
      enum: ['free', 'premium'],
      default: 'free',
    },
    expiresAt: Date,
  },
  onboardingCompleted: {
    type: Boolean,
    default: false,
  },
  // ── Chống brute-force login (per-account lockout) ──────────────────────────
  // Số lần login sai LIÊN TIẾP. Reset về 0 khi login đúng. KHÔNG index/TTL.
  failedLoginAttempts: {
    type: Number,
    default: 0,
  },
  // Thời điểm hết khoá. Khi Date.now() < lockUntil => tài khoản đang bị khoá.
  // Field Date THƯỜNG, KHÔNG có `expires` — đây KHÔNG phải TTL, chỉ là mốc thời gian
  // đọc bằng code. (Tránh lặp lại sự cố TTL xoá document.)
  lockUntil: {
    type: Date,
    default: null,
  },
  refreshTokens: [{
    token: String,
    createdAt: {
      type: Date,
      default: Date.now,
      // KHÔNG đặt `expires` ở đây. Mongoose sẽ tạo TTL index trên
      // "refreshTokens.createdAt" — TTL trên field kiểu MẢNG khiến MongoDB
      // xoá CẢ DOCUMENT khi phần tử sớm nhất quá hạn, tức là xoá luôn user.
      // Hạn của refresh token do JWT exp lo; dọn mảng bằng code ở Giai đoạn 1.
    },
  }],
}, {
  timestamps: true,
});

// Email đã có unique index do `unique: true` trên field (dòng ~7) tự sinh.
// KHÔNG khai báo thêm `userSchema.index({ email: 1 })` — sẽ tạo index THỪA,
// trùng key với unique index và tốn chi phí ghi vô ích.

// Remove password hash from JSON output
userSchema.methods.toJSON = function() {
  const userObject = this.toObject();
  delete userObject.passwordHash;
  delete userObject.refreshTokens;
  return userObject;
};

module.exports = mongoose.model('User', userSchema);
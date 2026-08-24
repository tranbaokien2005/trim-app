const mongoose = require('mongoose');

const weightLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  weight: {
    type: Number,
    required: true,
  },
  // 'YYYY-MM-DD' — chuẩn hoá cùng kiểu với MealLog/ActivityLog (trước đây là Date).
  // Chuỗi 'YYYY-MM-DD' sort từ điển == sort thời gian, nên index {user,date:-1} vẫn đúng.
  // Cần migration cho document cũ (date kiểu Date) — xem scripts/migrate-weightdate.js.
  date: {
    type: String,
  },
  bmi: Number,
  notes: String,
  /**
   * clientId: UUID do caller sinh ra, dùng làm khoá chống trùng (idempotency).
   * Cùng { user, clientId } => cùng MỘT thao tác log, không tạo bản ghi thứ hai.
   * undefined = không tham gia chống trùng (log tạo từ trong app như trước).
   */
  clientId: { type: String, default: undefined },
  /**
   * origin: thao tác log này BẮT ĐẦU TỪ BỀ MẶT NÀO.
   * Khác hẳn field "source" ngay dưới đây — "source" nói giá trị này ở đâu ra
   * (manual / ai_parsed). Provenance dữ liệu vs. nguồn hành động: 2 trục khác nhau.
   */
  origin: {
    type: String,
    enum: ['app', 'deeplink', 'shortcut', 'widget', 'siri', 'intent'],
    default: 'app',
  },
  source: {
    type: String,
    default: 'manual',
  },
}, {
  timestamps: true,
});

// Index for user and date
weightLogSchema.index({ user: 1, date: -1 });

/**
 * Chống trùng: mỗi { user, clientId } chỉ tồn tại MỘT document.
 * Dùng partialFilterExpression, KHÔNG dùng sparse: với unique index, sparse
 * vẫn có thể va chạm ngoài ý muốn khi có nhiều document clientId: null.
 * partialFilterExpression chỉ đánh index đúng document CÓ clientId là string.
 */
weightLogSchema.index(
  { user: 1, clientId: 1 },
  { unique: true, partialFilterExpression: { clientId: { $type: 'string' } } }
);

module.exports = mongoose.model('WeightLog', weightLogSchema);
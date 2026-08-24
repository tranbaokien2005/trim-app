const mongoose = require('mongoose');
const { calcSummary } = require('../utils/logHelpers');

const activityEntrySchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String },
  durationMinutes: { type: Number, required: true, min: 0 },
  caloriesBurned: { type: Number, required: true, min: 0 },
  intensity: { type: String, enum: ['low', 'medium', 'high'] },
}, { _id: true });

const activityLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  date: { type: String, required: true }, // YYYY-MM-DD
  entries: [activityEntrySchema],
  /**
   * clientId: UUID do caller sinh ra, dùng làm khoá chống trùng (idempotency).
   * Cùng { user, clientId } => cùng MỘT thao tác log, không tạo bản ghi thứ hai.
   * undefined = không tham gia chống trùng (log tạo từ trong app như trước).
   */
  clientId: { type: String, default: undefined },
  /**
   * origin: thao tác log này BẮT ĐẦU TỪ BỀ MẶT NÀO.
   * Khác hẳn field "source" (nếu có) — "source" nói giá trị dinh dưỡng ở đâu ra
   * (manual / ai_parsed). Provenance dữ liệu vs. nguồn hành động: 2 trục khác nhau.
   */
  origin: {
    type: String,
    enum: ['app', 'deeplink', 'shortcut', 'widget', 'siri', 'intent'],
    default: 'app',
  },
  summary: {
    totalCaloriesBurned: { type: Number, default: 0 },
    totalActiveMinutes: { type: Number, default: 0 },
  },
}, { timestamps: true });

activityLogSchema.index({ user: 1, date: 1 });

/**
 * Chống trùng: mỗi { user, clientId } chỉ tồn tại MỘT document.
 * Dùng partialFilterExpression, KHÔNG dùng sparse: với unique index, sparse
 * vẫn có thể va chạm ngoài ý muốn khi có nhiều document clientId: null.
 * partialFilterExpression chỉ đánh index đúng document CÓ clientId là string.
 */
activityLogSchema.index(
  { user: 1, clientId: 1 },
  { unique: true, partialFilterExpression: { clientId: { $type: 'string' } } }
);

/**
 * Tự tính summary từ entries trước khi lưu — model là nguồn sự thật duy nhất,
 * route không phải tự cộng (giảm chỗ sai lệch). Dùng lại calcSummary đã có,
 * KHÔNG viết lại công thức. Chạy trên mọi .save() (create + update-then-save).
 */
activityLogSchema.pre('save', function () {
  this.summary = calcSummary(this.entries || []);
});

module.exports = mongoose.model('ActivityLog', activityLogSchema);

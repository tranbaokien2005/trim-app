const mongoose = require('mongoose');
const { calcTotals } = require('../utils/logHelpers');

const mealItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  calories: { type: Number, required: true, min: 0 },
  protein: { type: Number, default: 0 },
  carbs: { type: Number, default: 0 },
  fat: { type: Number, default: 0 },
  servingSize: { type: String },
  servingQuantity: { type: Number, default: 1 },
  source: { type: String, default: 'manual' },
}, { _id: true });

const mealLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  date: { type: String, required: true }, // YYYY-MM-DD
  mealType: {
    type: String,
    enum: ['breakfast', 'lunch', 'dinner', 'snack'],
    required: true,
  },
  items: [mealItemSchema],
  totals: {
    calories: { type: Number, default: 0 },
    protein: { type: Number, default: 0 },
    carbs: { type: Number, default: 0 },
    fat: { type: Number, default: 0 },
  },
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
  notes: String,
}, { timestamps: true });

mealLogSchema.index({ user: 1, date: 1 });

/**
 * Chống trùng: mỗi { user, clientId } chỉ tồn tại MỘT document.
 * Dùng partialFilterExpression, KHÔNG dùng sparse: với unique index, sparse
 * vẫn có thể va chạm ngoài ý muốn khi có nhiều document clientId: null.
 * partialFilterExpression chỉ đánh index đúng document CÓ clientId là string.
 */
mealLogSchema.index(
  { user: 1, clientId: 1 },
  { unique: true, partialFilterExpression: { clientId: { $type: 'string' } } }
);

/**
 * Tự tính totals từ items trước khi lưu — model là nguồn sự thật duy nhất,
 * route không phải tự cộng (giảm chỗ sai lệch). Dùng lại calcTotals đã có,
 * KHÔNG viết lại công thức. Chạy trên mọi .save() (create + update-then-save).
 */
mealLogSchema.pre('save', function () {
  this.totals = calcTotals(this.items || []);
});

module.exports = mongoose.model('MealLog', mealLogSchema);

const mongoose = require('mongoose');

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
  summary: {
    totalCaloriesBurned: { type: Number, default: 0 },
    totalActiveMinutes: { type: Number, default: 0 },
  },
}, { timestamps: true });

activityLogSchema.index({ user: 1, date: 1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);

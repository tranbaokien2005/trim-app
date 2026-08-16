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
  date: {
    type: Date,
    default: Date.now,
  },
  bmi: Number,
  notes: String,
  source: {
    type: String,
    default: 'manual',
  },
}, {
  timestamps: true,
});

// Index for user and date
weightLogSchema.index({ user: 1, date: -1 });

module.exports = mongoose.model('WeightLog', weightLogSchema);
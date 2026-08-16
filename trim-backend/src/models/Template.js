const mongoose = require('mongoose');

const templateMealItemSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  calories:    { type: Number, required: true, min: 0 },
  protein:     { type: Number, default: 0 },
  carbs:       { type: Number, default: 0 },
  fat:         { type: Number, default: 0 },
  servingSize: { type: String },
}, { _id: true });

const templateSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: ['meal', 'activity'],
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 1,
    maxlength: 100,
  },

  // --- meal fields (required when type === 'meal') ---
  mealType: {
    type: String,
    enum: ['breakfast', 'lunch', 'dinner', 'snack'],
  },
  items: [templateMealItemSchema],

  // --- activity fields (required when type === 'activity') ---
  activityName:    { type: String },
  durationMinutes: { type: Number, min: 1 },
  caloriesBurned:  { type: Number, min: 0 },
}, { timestamps: true });

templateSchema.index({ user: 1, type: 1 });

module.exports = mongoose.model('Template', templateSchema);

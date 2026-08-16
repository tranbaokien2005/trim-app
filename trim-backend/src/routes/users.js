const express = require('express');
const User = require('../models/User');
const WeightLog = require('../models/WeightLog');
const authenticate = require('../middleware/auth');

const router = express.Router();

// GET /api/users/me
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

// PUT /api/users/me
router.put('/me', authenticate, async (req, res, next) => {
  try {
    const allowedFields = [
      'name',
      'profile',
      'settings',
    ];

    const updates = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true }
    );

    res.json({ user });
  } catch (error) {
    next(error);
  }
});

// POST /api/users/me/complete-profile
router.post('/me/complete-profile', authenticate, async (req, res, next) => {
  try {
    const { profile, weight, goal } = req.body;
    const userId = req.user._id;

    // 1. Update user profile
    await User.findByIdAndUpdate(userId, {
      profile: {
        dateOfBirth: new Date(profile.dateOfBirth),
        gender: profile.gender,
        height: profile.height,
      },
      onboardingCompleted: true,
    });

    // 2. Create first WeightLog
    const bmi = parseFloat((weight / Math.pow(profile.height / 100, 2)).toFixed(1));
    const today = new Date().toISOString().split('T')[0];
    await WeightLog.create({
      user: userId,
      date: today,
      weight,
      bmi,
      source: 'manual',
    });

    // 3. Calculate BMR and daily calorie target
    const dob = new Date(profile.dateOfBirth);
    const age = Math.floor((Date.now() - dob) / (365.25 * 24 * 60 * 60 * 1000));
    const base = 10 * weight + 6.25 * profile.height - 5 * age;
    const bmr = profile.gender === 'male' ? Math.round(base + 5)
              : profile.gender === 'female' ? Math.round(base - 161)
              : Math.round(base - 78);

    const baseline = Math.round(bmr * 0.2);
    const tdee = bmr + baseline; // no logged activity on day 0
    const weeklyDeficit = Math.round((goal.weeklyRate || 0) * 7700 / 7);
    const dailyCalorieTarget =
      goal.type === 'lose'     ? tdee - weeklyDeficit
      : goal.type === 'gain'   ? tdee + weeklyDeficit
      : tdee;

    // 4. Set currentStats and push new goal
    const startDate = new Date();
    const targetDate = goal.type === 'maintain' || !goal.weeklyRate
      ? null
      : new Date(startDate.getTime() + (Math.abs(weight - goal.targetWeight) / goal.weeklyRate) * 7 * 24 * 60 * 60 * 1000);

    await User.findByIdAndUpdate(userId, {
      'currentStats.weight': weight,
      'currentStats.bmi': bmi,
      'currentStats.bmr': bmr,
      'currentStats.baseline': baseline,
      'currentStats.weightUpdatedAt': new Date(),
      $push: {
        goals: {
          type: goal.type,
          targetWeight: goal.targetWeight,
          startWeight: goal.startWeight,
          weeklyRate: goal.weeklyRate,
          startDate,
          targetDate,
          dailyCalorieTarget,
          isActive: true,
        },
      },
    });

    res.json({ success: true, bmr, baseline, tdee, dailyCalorieTarget });
  } catch (error) {
    next(error);
  }
});

// PUT /api/users/me/goal
router.put('/me/goal', authenticate, async (req, res, next) => {
  try {
    const { type, targetWeight, weeklyRate, startWeight } = req.body;
    const userId = req.user._id;

    const user = await User.findById(userId);
    const { height, dateOfBirth, gender } = user.profile;
    const weight = user.currentStats.weight;
    const age = Math.floor((Date.now() - new Date(dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000));

    const base = 10 * weight + 6.25 * height - 5 * age;
    const bmr = gender === 'male' ? Math.round(base + 5)
              : gender === 'female' ? Math.round(base - 161)
              : Math.round(base - 78);
    const baseline = Math.round(bmr * 0.2);
    const tdee = bmr + baseline;

    const dailyAdjustment = Math.round((weeklyRate || 0) * 7700 / 7);
    const dailyCalorieTarget =
      type === 'lose' ? tdee - dailyAdjustment
      : type === 'gain' ? tdee + dailyAdjustment
      : tdee;

    await User.findByIdAndUpdate(userId, {
      $set: { 'goals.$[].isActive': false },
    });

    const startDate = new Date();
    const weeksToGoal = type === 'maintain' || !weeklyRate
      ? 0
      : Math.abs(weight - targetWeight) / weeklyRate;
    const targetDate = type === 'maintain'
      ? null
      : new Date(startDate.getTime() + weeksToGoal * 7 * 24 * 60 * 60 * 1000);

    await User.findByIdAndUpdate(userId, {
      $push: {
        goals: {
          type,
          targetWeight: type === 'maintain' ? weight : targetWeight,
          startWeight: weight,
          weeklyRate: weeklyRate || 0,
          startDate,
          targetDate,
          dailyCalorieTarget,
          isActive: true,
        },
      },
    });

    res.json({ success: true, dailyCalorieTarget });
  } catch (error) {
    next(error);
  }
});

// POST /api/users/complete-onboarding
router.post('/complete-onboarding', authenticate, async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { onboardingCompleted: true });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
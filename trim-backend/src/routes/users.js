const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const WeightLog = require('../models/WeightLog');
const authenticate = require('../middleware/auth');
const { deleteUserData } = require('../utils/deleteUserData');
const {
  calculateAge,
  calculateBMR,
  calculateBaseline,
  calculateTDEE,
  calculateDailyTarget,
} = require('../utils/bmr');
const { getTodayInTz } = require('../utils/date');
const { syncCurrentStatsBmr } = require('../utils/logHelpers');
const { checkGoalSafety } = require('../utils/goalSafety');

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

    // Profile đổi (height/dob/gender) => BMR đổi => đồng bộ currentStats.bmr/baseline.
    if (updates.profile !== undefined) {
      await syncCurrentStatsBmr(req.user._id);
    }

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

    // 0. SAFETY GUARD (guideline 1.4.1) — chạy TRƯỚC mọi ghi DB để reject sạch, không
    //    để lại profile/weightlog mồ côi. Dùng bmr/tdee tính từ chính body.
    const guardAge = calculateAge(profile.dateOfBirth);
    const guardBmr = Math.round(calculateBMR(weight, profile.height, guardAge, profile.gender));
    const guardTdee = calculateTDEE(guardBmr);
    const unsafe = checkGoalSafety({
      goalType: goal.type,
      weeklyRate: goal.weeklyRate,
      targetWeight: goal.targetWeight,
      height: profile.height,
      gender: profile.gender,
      tdee: guardTdee,
    });
    if (unsafe) return res.status(400).json({ message: unsafe.message });

    // 1. Update user profile
    await User.findByIdAndUpdate(userId, {
      profile: {
        dateOfBirth: new Date(profile.dateOfBirth),
        gender: profile.gender,
        height: profile.height,
        timezone: profile.timezone || undefined,
      },
      onboardingCompleted: true,
    });

    // 2. Create first WeightLog
    const bmi = parseFloat((weight / Math.pow(profile.height / 100, 2)).toFixed(1));
    const today = getTodayInTz(profile.timezone);
    await WeightLog.create({
      user: userId,
      date: today,
      weight,
      bmi,
      source: 'manual',
    });

    // 3. Daily calorie target — tái dùng bmr/tdee đã tính ở guard (không tính lại).
    const bmr = guardBmr;
    const baseline = calculateBaseline(bmr);
    const tdee = guardTdee;
    const dailyCalorieTarget = calculateDailyTarget(tdee, goal.type, goal.weeklyRate);

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
    const age = calculateAge(dateOfBirth);

    const bmr = Math.round(calculateBMR(weight, height, age, gender));
    const tdee = calculateTDEE(bmr);

    // SAFETY GUARD (guideline 1.4.1) — reject TRƯỚC khi vô hiệu goal cũ / push goal mới.
    const unsafe = checkGoalSafety({
      goalType: type,
      weeklyRate,
      targetWeight,
      height,
      gender,
      tdee,
    });
    if (unsafe) return res.status(400).json({ message: unsafe.message });

    const dailyCalorieTarget = calculateDailyTarget(tdee, type, weeklyRate);

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

// DELETE /api/users/me — xoá tài khoản vĩnh viễn (App Store 5.1.1(v))
router.delete('/me', authenticate, async (req, res, next) => {
  try {
    const { password } = req.body;

    if (!password || typeof password !== 'string') {
      return res.status(400).json({ message: 'Password is required to delete your account' });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ message: 'Incorrect password' });
    }

    const deleted = await deleteUserData(user._id, { deleteUser: true });

    res.json({ message: 'Account deleted', deleted });
  } catch (error) {
    next(error);
  }
});

// POST /api/users/ai-consent — user đồng ý gửi dữ liệu cho OpenAI (guideline 5.1.2(i)).
// Idempotent: gọi nhiều lần vẫn granted=true; giữ grantedAt lần đầu.
router.post('/ai-consent', authenticate, async (req, res, next) => {
  try {
    const userId = req.user._id;
    if (!req.user.aiConsent?.granted) {
      await User.findByIdAndUpdate(userId, {
        'aiConsent.granted': true,
        'aiConsent.grantedAt': new Date(),
      });
    }
    const fresh = await User.findById(userId);
    res.json({
      granted: fresh.aiConsent.granted,
      grantedAt: fresh.aiConsent.grantedAt,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
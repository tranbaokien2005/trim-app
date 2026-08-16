const express = require('express');
const authenticate = require('../middleware/auth');
const WeightLog = require('../models/WeightLog');
const User = require('../models/User');
const { calculateBMI } = require('../utils/bmr');

const router = express.Router();
router.use(authenticate);

// POST /api/weights
router.post('/', async (req, res, next) => {
  try {
    const { weight, date, notes } = req.body;

    if (!weight || typeof weight !== 'number' || weight <= 0) {
      return res.status(400).json({ message: 'Valid weight in kg is required' });
    }

    const logDate = date ? new Date(date) : new Date();
    const bmi = req.user.profile?.height
      ? Math.round(calculateBMI(weight, req.user.profile.height) * 10) / 10
      : undefined;

    const log = new WeightLog({ user: req.user._id, weight, date: logDate, bmi, notes, source: 'manual' });
    await log.save();

    await User.findByIdAndUpdate(req.user._id, {
      'currentStats.weight': weight,
      'currentStats.bmi': bmi,
      'currentStats.weightUpdatedAt': new Date(),
    });

    res.status(201).json(log);
  } catch (error) {
    next(error);
  }
});

// GET /api/weights/latest  — must be before /:id
router.get('/latest', async (req, res, next) => {
  try {
    const log = await WeightLog.findOne({ user: req.user._id }).sort({ createdAt: -1 });
    if (!log) return res.status(404).json({ message: 'No weight logs found' });
    res.json(log);
  } catch (error) {
    next(error);
  }
});

// GET /api/weights?limit=30
router.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 30, 100);
    const logs = await WeightLog.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(limit);
    res.json(logs);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/weights/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const log = await WeightLog.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!log) return res.status(404).json({ message: 'Weight log not found' });

    const latest = await WeightLog.findOne({ user: req.user._id }).sort({ createdAt: -1 });
    if (latest) {
      await User.findByIdAndUpdate(req.user._id, {
        'currentStats.weight': latest.weight,
        'currentStats.bmi': latest.bmi,
        'currentStats.weightUpdatedAt': latest.createdAt,
      });
    } else {
      await User.findByIdAndUpdate(req.user._id, {
        $unset: { 'currentStats.weight': '', 'currentStats.bmi': '', 'currentStats.weightUpdatedAt': '' },
      });
    }

    res.json({ message: 'Deleted' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

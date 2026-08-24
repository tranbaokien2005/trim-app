const express = require('express');
const authenticate = require('../middleware/auth');
const ActivityLog = require('../models/ActivityLog');
const { getTodayInTz } = require('../utils/date');
const { parseActivityText } = require('../utils/parseText');

const router = express.Router();
router.use(authenticate);

const { calcSummary } = require('../utils/logHelpers');

// POST /api/activities/parse-text  — must be before /:id routes
router.post('/parse-text', async (req, res, next) => {
  try {
    const { text, date } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ message: 'text is required' });

    let entries;
    try {
      entries = await parseActivityText(text.trim());
    } catch (err) {
      if (err.stage === 'api')   return res.status(500).json({ message: 'AI parsing failed' });
      if (err.stage === 'parse') return res.status(500).json({ message: 'Failed to parse AI response' });
      throw err;
    }

    const totalCaloriesBurned = entries.reduce((s, e) => s + (e.caloriesBurned || 0), 0);
    res.json({ entries, totalCaloriesBurned, text: text.trim(), date: date || getTodayInTz(req.user.profile?.timezone) });
  } catch (error) {
    next(error);
  }
});

// POST /api/activities
router.post('/', async (req, res, next) => {
  try {
    const { date, entries } = req.body;

    if (!date) return res.status(400).json({ message: 'date is required (YYYY-MM-DD)' });
    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ message: 'entries array is required and must not be empty' });
    }

    for (const e of entries) {
      if (!e.name) return res.status(400).json({ message: 'Each entry requires a name' });
      if (typeof e.durationMinutes !== 'number' || e.durationMinutes < 0) {
        return res.status(400).json({ message: 'Each entry requires durationMinutes >= 0' });
      }
      if (typeof e.caloriesBurned !== 'number' || e.caloriesBurned < 0) {
        return res.status(400).json({ message: 'Each entry requires caloriesBurned >= 0' });
      }
    }

    const summary = calcSummary(entries);
    const log = new ActivityLog({ user: req.user._id, date, entries, summary });
    await log.save();
    res.status(201).json(log);
  } catch (error) {
    next(error);
  }
});

// GET /api/activities?date=YYYY-MM-DD
router.get('/', async (req, res, next) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ message: 'Query param date is required (YYYY-MM-DD)' });

    const logs = await ActivityLog.find({ user: req.user._id, date }).sort({ createdAt: 1 });
    res.json(logs);
  } catch (error) {
    next(error);
  }
});

// PUT /api/activities/:id  — update a single entry (name, caloriesBurned, durationMinutes)
router.put('/:id', async (req, res, next) => {
  try {
    const { updateEntry } = req.body;
    if (!updateEntry || !updateEntry.entryId) {
      return res.status(400).json({ message: 'updateEntry.entryId is required' });
    }

    const log = await ActivityLog.findOne({ _id: req.params.id, user: req.user._id });
    if (!log) return res.status(404).json({ message: 'Activity log not found' });

    const entry = log.entries.id(updateEntry.entryId);
    if (!entry) return res.status(404).json({ message: 'Entry not found' });

    if (updateEntry.name !== undefined) entry.name = updateEntry.name;
    if (updateEntry.caloriesBurned !== undefined) entry.caloriesBurned = updateEntry.caloriesBurned;
    if (updateEntry.durationMinutes !== undefined) entry.durationMinutes = updateEntry.durationMinutes;

    log.summary = calcSummary(log.entries);
    await log.save();
    res.json(log);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/activities/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const log = await ActivityLog.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!log) return res.status(404).json({ message: 'Activity log not found' });
    res.json({ message: 'Deleted' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

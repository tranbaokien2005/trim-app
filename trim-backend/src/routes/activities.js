const express = require('express');
const authenticate = require('../middleware/auth');
const ActivityLog = require('../models/ActivityLog');
const OpenAI = require('openai').default;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const router = express.Router();
router.use(authenticate);

const calcSummary = (entries) => ({
  totalCaloriesBurned: entries.reduce((s, e) => s + (e.caloriesBurned || 0), 0),
  totalActiveMinutes: entries.reduce((s, e) => s + (e.durationMinutes || 0), 0),
});

// POST /api/activities/parse-text  — must be before /:id routes
router.post('/parse-text', async (req, res, next) => {
  try {
    const { text, date } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ message: 'text is required' });

    let raw;
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 1000,
        messages: [
          {
            role: 'system',
            content: `You are an exercise parser. Parse activity descriptions into JSON. Return ONLY a valid JSON array, no explanation, no markdown:\n[{"name":"...","type":"cardio","durationMinutes":30,"caloriesBurned":200,"intensity":"medium","note":"One short sentence about the activity"}]\nRules: Vietnamese activity names OK, round all numbers to integers, [] if no activity found, ignore non-activity content.\nValid types: cardio, strength, daily_activity, sport, other\nValid intensities: low, medium, high\nEstimate realistic calorie burns for a 70kg adult based on activity, duration, and intensity.`,
          },
          { role: 'user', content: text.trim() },
        ],
      });
      raw = response.choices[0].message.content.trim();
    } catch (apiErr) {
      console.error('OpenAI API error:', apiErr);
      return res.status(500).json({ message: 'AI parsing failed' });
    }

    let entries;
    try {
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('No JSON array found');
      entries = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(entries)) throw new Error('Not an array');
    } catch (parseErr) {
      console.error('Parse error:', parseErr, 'Raw:', raw);
      return res.status(500).json({ message: 'Failed to parse AI response' });
    }

    const totalCaloriesBurned = entries.reduce((s, e) => s + (e.caloriesBurned || 0), 0);
    res.json({ entries, totalCaloriesBurned, text: text.trim(), date: date || new Date().toISOString().slice(0, 10) });
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

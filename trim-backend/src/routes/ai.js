const express = require('express');
const authenticate = require('../middleware/auth');
const requireAiConsent = require('../middleware/requireAiConsent');
const { parseMealPhoto } = require('../utils/parseText');
const { getTodayInTz } = require('../utils/date');

const router = express.Router();
router.use(authenticate);

// POST /api/ai/parse-photo
// Image (base64) -> meal items in the SAME shape as /api/meals/parse-text, so the
// existing AI review screen and log flow are reused as-is.
// The image is processed in memory only and never stored on the server.
router.post('/parse-photo', requireAiConsent, async (req, res, next) => {
  try {
    const { image, date } = req.body;
    if (!image || typeof image !== 'string' || !image.trim()) {
      return res.status(400).json({ message: 'image (base64) is required' });
    }
    // Accept a raw base64 string or a data URL — strip the data: prefix if present.
    const base64 = image.replace(/^data:image\/\w+;base64,/, '').trim();
    console.log(`[parse-photo] request from user=${req.user?._id} imageLen=${base64.length} (~${Math.round((base64.length * 0.75) / 1024)}KB)`);

    let items;
    try {
      items = await parseMealPhoto(base64);
    } catch (err) {
      if (err.stage === 'api')   return res.status(500).json({ message: 'AI analysis failed' });
      if (err.stage === 'parse') return res.status(500).json({ message: 'Failed to parse AI response' });
      throw err;
    }

    const totalCalories = items.reduce((sum, item) => sum + (item.calories || 0), 0);
    res.json({ items, totalCalories, date: date || getTodayInTz(req.user.profile?.timezone) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

/**
 * POST /api/quicklog — một cửa duy nhất cho mọi "log nhanh" đến từ ngoài app:
 * deep link trim://, iOS Shortcut, widget, Siri, App Intent (v1.2, viết bằng Swift).
 *
 * Hai thứ quyết định thiết kế này:
 *  1. CHỐNG TRÙNG. Back Tap rất dễ bị gõ đúp. clientId do caller sinh; cùng
 *     { user, clientId } => im lặng trả lại bản ghi cũ, KHÔNG tạo bản thứ hai,
 *     KHÔNG trả lỗi. Hai lớp bảo vệ: tra trước bằng findOne, và unique partial
 *     index bắt E11000 khi hai request đua nhau.
 *  2. ORIGIN. Ghi lại bề mặt khởi phát để sau này trả lời "App Intent có đáng
 *     hai tuần viết Swift không" bằng số liệu, không bằng cảm giác.
 *
 * Route này KHÔNG chứa logic parse riêng — nó gọi lại đúng utils/parseText.js
 * mà /api/meals/parse-text và /api/activities/parse-text đang dùng.
 */
const express = require('express');
const authenticate = require('../middleware/auth');
const MealLog = require('../models/MealLog');
const ActivityLog = require('../models/ActivityLog');
const WeightLog = require('../models/WeightLog');
const { getTodayInTz, getMealTypeInTz, isValidDateString } = require('../utils/date');
const { parseMealText, parseActivityText } = require('../utils/parseText');
const { calcTotals, calcSummary, syncCurrentStatsWeight } = require('../utils/logHelpers');
const { calculateBMI } = require('../utils/bmr');
const validate = require('../middleware/validate');
const { quicklogSchema } = require('../validation/schemas');

const router = express.Router();
router.use(authenticate);

const MODELS = { meal: MealLog, activity: ActivityLog, weight: WeightLog };
const VALID_KINDS = Object.keys(MODELS);
const VALID_ORIGINS = ['app', 'deeplink', 'shortcut', 'widget', 'siri', 'intent'];
const VALID_MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];

const duplicateResponse = (res, kind, doc) =>
  res.status(200).json({ ok: true, duplicate: true, kind, created: doc });

router.post('/', validate(quicklogSchema), async (req, res, next) => {
  try {
    const { kind, text, value, clientId, origin, mealType, date } = req.body;

    // ── Validate ────────────────────────────────────────────────────────────
    if (!kind || !VALID_KINDS.includes(kind)) {
      return res.status(400).json({ message: 'kind must be meal, activity, or weight' });
    }
    if (typeof clientId !== 'string' || !clientId.trim()) {
      return res.status(400).json({ message: 'clientId is required' });
    }
    if (origin !== undefined && !VALID_ORIGINS.includes(origin)) {
      return res.status(400).json({ message: 'origin is not a recognised surface' });
    }
    if (mealType !== undefined && !VALID_MEAL_TYPES.includes(mealType)) {
      return res.status(400).json({ message: 'mealType must be breakfast, lunch, dinner, or snack' });
    }
    if (date !== undefined && !isValidDateString(date)) {
      return res.status(400).json({ message: 'date must be YYYY-MM-DD' });
    }
    if ((kind === 'meal' || kind === 'activity') && (typeof text !== 'string' || !text.trim())) {
      return res.status(400).json({ message: 'text is required for kind meal and activity' });
    }
    if (kind === 'weight' && (typeof value !== 'number' || !(value > 0))) {
      return res.status(400).json({ message: 'Valid weight in kg is required' });
    }

    const Model = MODELS[kind];
    const cid = clientId.trim();
    const userId = req.user._id;

    // ── Lớp 1: tra trùng trước khi làm bất cứ việc gì tốn kém ───────────────
    const existing = await Model.findOne({ user: userId, clientId: cid });
    if (existing) return duplicateResponse(res, kind, existing);

    const resolvedOrigin = origin || 'deeplink';
    const timezone = req.user.profile?.timezone;
    const day = date || getTodayInTz(timezone);

    let doc;
    if (kind === 'meal') {
      let items;
      try {
        items = await parseMealText(text.trim());
      } catch (err) {
        if (err.stage === 'api') return res.status(500).json({ message: 'AI parsing failed' });
        if (err.stage === 'parse') return res.status(500).json({ message: 'Failed to parse AI response' });
        throw err;
      }
      if (!items.length) return res.status(400).json({ message: 'No food found in text' });

      doc = new MealLog({
        user: userId,
        date: day,
        mealType: mealType || getMealTypeInTz(timezone),
        items,
        totals: calcTotals(items),
        clientId: cid,
        origin: resolvedOrigin,
      });
    } else if (kind === 'activity') {
      let entries;
      try {
        entries = await parseActivityText(text.trim());
      } catch (err) {
        if (err.stage === 'api') return res.status(500).json({ message: 'AI parsing failed' });
        if (err.stage === 'parse') return res.status(500).json({ message: 'Failed to parse AI response' });
        throw err;
      }
      if (!entries.length) return res.status(400).json({ message: 'No activity found in text' });

      doc = new ActivityLog({
        user: userId,
        date: day,
        entries,
        summary: calcSummary(entries),
        clientId: cid,
        origin: resolvedOrigin,
      });
    } else {
      // weight — date giờ là chuỗi 'YYYY-MM-DD' (đã chuẩn hoá cùng 2 model kia).
      // Dùng `day` = date || getTodayInTz(timezone) đã tính ở trên.
      const bmi = req.user.profile?.height
        ? Math.round(calculateBMI(value, req.user.profile.height) * 10) / 10
        : undefined;

      doc = new WeightLog({
        user: userId,
        weight: value,
        date: day,
        bmi,
        source: 'manual',
        clientId: cid,
        origin: resolvedOrigin,
      });
    }

    // ── Lớp 2: unique index bắt race condition ──────────────────────────────
    try {
      await doc.save();
    } catch (err) {
      if (err.code === 11000) {
        const raced = await Model.findOne({ user: userId, clientId: cid });
        if (raced) return duplicateResponse(res, kind, raced);
      }
      throw err;
    }

    if (kind === 'weight') await syncCurrentStatsWeight(userId, doc.weight, doc.bmi);

    res.status(201).json({ ok: true, duplicate: false, kind, created: doc });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

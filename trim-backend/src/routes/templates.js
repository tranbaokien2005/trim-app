const express = require('express');
const mongoose = require('mongoose');
const authenticate = require('../middleware/auth');
const Template = require('../models/Template');

const router = express.Router();
router.use(authenticate);

const FREE_TEMPLATE_LIMIT = 10;
const VALID_MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validateMealData(body, res) {
  const { mealType, items } = body;
  if (!mealType || !VALID_MEAL_TYPES.includes(mealType)) {
    res.status(400).json({ message: 'mealType must be breakfast, lunch, dinner, or snack' });
    return false;
  }
  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ message: 'items array is required and must not be empty' });
    return false;
  }
  for (const item of items) {
    if (!item.name || typeof item.name !== 'string') {
      res.status(400).json({ message: 'Each item requires a name' });
      return false;
    }
    if (typeof item.calories !== 'number' || item.calories < 0) {
      res.status(400).json({ message: 'Each item requires calories >= 0' });
      return false;
    }
  }
  return true;
}

function validateActivityData(body, res) {
  const { activityName, durationMinutes, caloriesBurned } = body;
  if (!activityName || typeof activityName !== 'string') {
    res.status(400).json({ message: 'activityName is required' });
    return false;
  }
  if (typeof durationMinutes !== 'number' || durationMinutes <= 0) {
    res.status(400).json({ message: 'durationMinutes must be > 0' });
    return false;
  }
  if (typeof caloriesBurned !== 'number' || caloriesBurned < 0) {
    res.status(400).json({ message: 'caloriesBurned must be >= 0' });
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// GET /api/templates?type=meal|activity&page=1&limit=20
// ---------------------------------------------------------------------------
router.get('/', async (req, res, next) => {
  try {
    const { type, page = 1, limit = 20 } = req.query;

    const query = { user: req.user._id };
    if (type) {
      if (!['meal', 'activity'].includes(type)) {
        return res.status(400).json({ message: 'type must be meal or activity' });
      }
      query.type = type;
    }

    const skip = (Math.max(1, parseInt(page)) - 1) * Math.min(100, parseInt(limit));
    const take = Math.min(100, parseInt(limit) || 20);

    const [templates, total] = await Promise.all([
      Template.find(query).sort({ createdAt: -1 }).skip(skip).limit(take),
      Template.countDocuments(query),
    ]);

    res.json({
      templates,
      pagination: {
        total,
        page:       parseInt(page),
        limit:      take,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// POST /api/templates
// Body: { type, name, mealType?, items?, activityName?, durationMinutes?, caloriesBurned? }
// ---------------------------------------------------------------------------
router.post('/', async (req, res, next) => {
  try {
    const { type, name } = req.body;

    // --- name validation ---
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ message: 'name is required' });
    }
    if (name.trim().length > 100) {
      return res.status(400).json({ message: 'name must be 100 characters or fewer' });
    }

    // --- type validation ---
    if (!type || !['meal', 'activity'].includes(type)) {
      return res.status(400).json({ message: 'type must be meal or activity' });
    }

    // --- free-tier cap ---
    if (req.user.subscription?.plan !== 'premium') {
      const count = await Template.countDocuments({ user: req.user._id });
      if (count >= FREE_TEMPLATE_LIMIT) {
        return res.status(403).json({
          message: `Free plan is limited to ${FREE_TEMPLATE_LIMIT} templates. Upgrade to premium for unlimited templates.`,
        });
      }
    }

    // --- type-specific validation ---
    if (type === 'meal') {
      if (!validateMealData(req.body, res)) return;
    } else {
      if (!validateActivityData(req.body, res)) return;
    }

    // --- build doc ---
    const templateData = { user: req.user._id, type, name: name.trim() };

    if (type === 'meal') {
      templateData.mealType = req.body.mealType;
      templateData.items    = req.body.items;
    } else {
      templateData.activityName    = req.body.activityName;
      templateData.durationMinutes = req.body.durationMinutes;
      templateData.caloriesBurned  = req.body.caloriesBurned;
    }

    const template = new Template(templateData);
    await template.save();
    res.status(201).json(template);
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// PUT /api/templates/:id
// ---------------------------------------------------------------------------
router.put('/:id', async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Template not found' });
    }

    const template = await Template.findById(req.params.id);
    if (!template) return res.status(404).json({ message: 'Template not found' });
    if (template.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { name } = req.body;

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ message: 'name must not be empty' });
      }
      if (name.trim().length > 100) {
        return res.status(400).json({ message: 'name must be 100 characters or fewer' });
      }
      template.name = name.trim();
    }

    if (template.type === 'meal') {
      if (req.body.mealType !== undefined) {
        if (!VALID_MEAL_TYPES.includes(req.body.mealType)) {
          return res.status(400).json({ message: 'mealType must be breakfast, lunch, dinner, or snack' });
        }
        template.mealType = req.body.mealType;
      }
      if (req.body.items !== undefined) {
        if (!Array.isArray(req.body.items) || req.body.items.length === 0) {
          return res.status(400).json({ message: 'items array must not be empty' });
        }
        for (const item of req.body.items) {
          if (!item.name) return res.status(400).json({ message: 'Each item requires a name' });
          if (typeof item.calories !== 'number' || item.calories < 0) {
            return res.status(400).json({ message: 'Each item requires calories >= 0' });
          }
        }
        template.items = req.body.items;
      }
    } else {
      if (req.body.activityName !== undefined) template.activityName = req.body.activityName;
      if (req.body.durationMinutes !== undefined) {
        if (typeof req.body.durationMinutes !== 'number' || req.body.durationMinutes <= 0) {
          return res.status(400).json({ message: 'durationMinutes must be > 0' });
        }
        template.durationMinutes = req.body.durationMinutes;
      }
      if (req.body.caloriesBurned !== undefined) {
        if (typeof req.body.caloriesBurned !== 'number' || req.body.caloriesBurned < 0) {
          return res.status(400).json({ message: 'caloriesBurned must be >= 0' });
        }
        template.caloriesBurned = req.body.caloriesBurned;
      }
    }

    await template.save();
    res.json(template);
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/templates/:id
// ---------------------------------------------------------------------------
router.delete('/:id', async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Template not found' });
    }

    const template = await Template.findById(req.params.id);
    if (!template) return res.status(404).json({ message: 'Template not found' });
    if (template.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await template.deleteOne();
    res.json({ message: 'Deleted' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

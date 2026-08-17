const express = require('express');
const authenticate = require('../middleware/auth');
const MealLog = require('../models/MealLog');
const { getTodayInTz } = require('../utils/date');
const OpenAI = require('openai').default;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const router = express.Router();
router.use(authenticate);

const VALID_MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];

const toTitleCase = (str) => {
  if (!str) return '';
  return str.toLowerCase().split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

const calcTotals = (items) => ({
  calories: items.reduce((s, i) => s + (i.calories || 0), 0),
  protein: items.reduce((s, i) => s + (i.protein || 0), 0),
  carbs: items.reduce((s, i) => s + (i.carbs || 0), 0),
  fat: items.reduce((s, i) => s + (i.fat || 0), 0),
});

const FALLBACK_FOODS = [
  { name: 'Chicken Breast (grilled)', calories: 165, protein: 31, carbs: 0,  fat: 3.6, servingQty: 100, servingSize: 'g', type: 'common' },
  { name: 'Brown Rice (cooked)',      calories: 216, protein: 5,  carbs: 45, fat: 1.8, servingQty: 195, servingSize: 'g', type: 'common' },
  { name: 'Broccoli (steamed)',       calories: 55,  protein: 3.7,carbs: 11, fat: 0.6, servingQty: 156, servingSize: 'g', type: 'common' },
  { name: 'Salmon (baked)',           calories: 208, protein: 20, carbs: 0,  fat: 13,  servingQty: 100, servingSize: 'g', type: 'common' },
  { name: 'Oats (dry)',               calories: 389, protein: 17, carbs: 66, fat: 7,   servingQty: 100, servingSize: 'g', type: 'common' },
];

const nixHeaders = () => ({
  'x-app-id':  process.env.NUTRITIONIX_APP_ID  || '',
  'x-app-key': process.env.NUTRITIONIX_APP_KEY || '',
  'Content-Type': 'application/json',
});

// GET /api/meals/search?q=  — must be before /:id routes
router.get('/search', async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || !q.trim()) return res.status(400).json({ message: 'Query param q is required' });

    try {
      const params = new URLSearchParams({
        query:     q.trim(),
        api_key:   process.env.USDA_API_KEY || '',
        pageSize:  '15',
        sortBy:    'dataType.keyword',
        sortOrder: 'asc',
      });
      params.append('dataType', 'Survey (FNDDS)');
      params.append('dataType', 'SR Legacy');
      params.append('dataType', 'Branded');

      const response = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?${params}`);

      if (!response.ok) throw new Error('USDA FDC API error');

      const data = await response.json();
      const foods = data.foods || [];

      const getNutrient = (food, name) =>
        food.foodNutrients?.find(
          (n) => n.nutrientName?.toLowerCase().includes(name.toLowerCase()) &&
                 (n.unitName === 'G' || n.unitName === 'KCAL')
        )?.value || 0;

      const results = foods
        .filter((f) => {
          const cal = f.foodNutrients?.find(
            (n) => n.nutrientName === 'Energy' && n.unitName === 'KCAL'
          )?.value;
          return cal && cal > 10 && cal < 1000;
        })
        .map((f) => {
          const calories = f.foodNutrients?.find(
            (n) => n.nutrientName === 'Energy' && n.unitName === 'KCAL'
          )?.value || 0;
          return {
            name:     toTitleCase(f.description),
            brand:    f.brandOwner ? toTitleCase(f.brandOwner) : null,
            calories: Math.round(calories),
            protein:  Math.round(getNutrient(f, 'protein')),
            carbs:    Math.round(getNutrient(f, 'carbohydrate')),
            fat:      Math.round(getNutrient(f, 'total lipid')),
            servingSize: f.servingSize ? `${f.servingSize}${f.servingSizeUnit || 'g'}` : '100g',
            servingQty:  1,
          };
        })
        .filter((item, index, self) =>
          index === self.findIndex((t) => t.name.toLowerCase() === item.name.toLowerCase())
        )
        .slice(0, 10);

      return res.json({ results });
    } catch (_) {
      return res.json({ results: FALLBACK_FOODS });
    }
  } catch (error) {
    next(error);
  }
});

// POST /api/meals/search/nutrients — fetch full macros for a common food
router.post('/search/nutrients', async (req, res, next) => {
  try {
    const { foodName, servingQty } = req.body;
    if (!foodName) return res.status(400).json({ message: 'foodName is required' });

    const query = servingQty ? `${servingQty} ${foodName}` : foodName;

    const response = await fetch(
      'https://trackapi.nutritionix.com/v2/natural/nutrients',
      {
        method: 'POST',
        headers: nixHeaders(),
        body: JSON.stringify({ query }),
      }
    );

    if (!response.ok) throw new Error('Nutritionix nutrients API error');

    const data = await response.json();
    const food = data.foods?.[0];
    if (!food) return res.status(404).json({ message: 'Food not found' });

    res.json({
      name:        food.food_name,
      calories:    Math.round(food.nf_calories || 0),
      protein:     Math.round((food.nf_protein            || 0) * 10) / 10,
      carbs:       Math.round((food.nf_total_carbohydrate || 0) * 10) / 10,
      fat:         Math.round((food.nf_total_fat          || 0) * 10) / 10,
      servingQty:  food.serving_qty  || 1,
      servingSize: food.serving_unit || 'serving',
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/meals/parse-text
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
            content: `You are a nutrition parser. Parse meal descriptions into JSON. Return ONLY a valid JSON array, no explanation, no markdown:\n[{"name":"...","calories":0,"protein":0,"carbs":0,"fat":0,"servingSize":"...","nutritionNote":"One short sentence about nutrition profile, e.g. High in carbs, low protein"}]\nRules: Vietnamese portion sizes, 1 serving default, round to integers, [] if no food, ignore activities.`,
          },
          { role: 'user', content: text.trim() },
        ],
      });
      raw = response.choices[0].message.content.trim();
    } catch (apiErr) {
      console.error('OpenAI API error:', apiErr);
      return res.status(500).json({ message: 'AI parsing failed' });
    }

    let items;
    try {
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('No JSON array found');
      items = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(items)) throw new Error('Not an array');
    } catch (parseErr) {
      console.error('Parse error:', parseErr, 'Raw:', raw);
      return res.status(500).json({ message: 'Failed to parse AI response' });
    }

    const totalCalories = items.reduce((sum, item) => sum + (item.calories || 0), 0);

    res.json({ items, totalCalories, text: text.trim(), date: date || getTodayInTz(req.user.profile?.timezone) });
  } catch (error) {
    next(error);
  }
});

// POST /api/meals
router.post('/', async (req, res, next) => {
  try {
    const { date, mealType, items, notes } = req.body;

    if (!date) return res.status(400).json({ message: 'date is required (YYYY-MM-DD)' });
    if (!mealType || !VALID_MEAL_TYPES.includes(mealType)) {
      return res.status(400).json({ message: 'mealType must be breakfast, lunch, dinner, or snack' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'items array is required and must not be empty' });
    }

    const totals = calcTotals(items);
    const meal = new MealLog({ user: req.user._id, date, mealType, items, totals, notes });
    await meal.save();
    res.status(201).json(meal);
  } catch (error) {
    next(error);
  }
});

// GET /api/meals?date=YYYY-MM-DD
router.get('/', async (req, res, next) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ message: 'Query param date is required (YYYY-MM-DD)' });

    const meals = await MealLog.find({ user: req.user._id, date }).sort({ createdAt: 1 });
    res.json(meals);
  } catch (error) {
    next(error);
  }
});

// PUT /api/meals/:id  — update a single item (name + calories)
router.put('/:id', async (req, res, next) => {
  try {
    const { updateItem } = req.body;
    if (!updateItem || !updateItem.itemId) {
      return res.status(400).json({ message: 'updateItem.itemId is required' });
    }

    const meal = await MealLog.findOne({ _id: req.params.id, user: req.user._id });
    if (!meal) return res.status(404).json({ message: 'Meal not found' });

    const item = meal.items.id(updateItem.itemId);
    if (!item) return res.status(404).json({ message: 'Item not found' });

    if (updateItem.name !== undefined) item.name = updateItem.name;
    if (updateItem.calories !== undefined) item.calories = updateItem.calories;

    meal.totals = calcTotals(meal.items);
    await meal.save();
    res.json(meal);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/meals/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const meal = await MealLog.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!meal) return res.status(404).json({ message: 'Meal not found' });
    res.json({ message: 'Deleted' });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/meals/:mealId/items/:itemId
router.delete('/:mealId/items/:itemId', async (req, res, next) => {
  try {
    const meal = await MealLog.findOne({ _id: req.params.mealId, user: req.user._id });
    if (!meal) return res.status(404).json({ message: 'Meal not found' });

    const before = meal.items.length;
    meal.items = meal.items.filter((item) => item._id.toString() !== req.params.itemId);
    if (meal.items.length === before) return res.status(404).json({ message: 'Item not found' });

    meal.totals = calcTotals(meal.items);
    await meal.save();
    res.json(meal);
  } catch (error) {
    next(error);
  }
});

module.exports = router;

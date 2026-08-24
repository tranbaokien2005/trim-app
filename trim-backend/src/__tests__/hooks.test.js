/**
 * TASK 4 — pre('save') hook tự tính totals/summary cho MealLog & ActivityLog.
 *
 * Test tạo doc với items/entries nhưng KHÔNG set totals/summary thủ công.
 * Sau save(), model phải tự tính đúng. Đây là bằng chứng "model là nguồn sự thật".
 */
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

const MealLog = require('../models/MealLog');
const ActivityLog = require('../models/ActivityLog');

let mongod;
let userId;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  userId = new mongoose.Types.ObjectId();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('MealLog pre(save) totals hook', () => {
  test('totals tự tính từ items khi KHÔNG set thủ công', async () => {
    const meal = new MealLog({
      user: userId,
      date: '2026-08-24',
      mealType: 'lunch',
      items: [
        { name: 'Rice', calories: 200, protein: 4, carbs: 45, fat: 1 },
        { name: 'Chicken', calories: 300, protein: 30, carbs: 0, fat: 5 },
      ],
      // KHÔNG set totals — hook phải tự tính.
    });
    await meal.save();

    expect(meal.totals.calories).toBe(500);
    expect(meal.totals.protein).toBe(34);
    expect(meal.totals.carbs).toBe(45);
    expect(meal.totals.fat).toBe(6);
  });

  test('totals sai do caller set thủ công cũng bị hook GHI ĐÈ về giá trị đúng', async () => {
    const meal = new MealLog({
      user: userId,
      date: '2026-08-24',
      mealType: 'dinner',
      items: [{ name: 'Egg', calories: 78, protein: 6, carbs: 1, fat: 5 }],
      totals: { calories: 9999, protein: 0, carbs: 0, fat: 0 }, // sai cố ý
    });
    await meal.save();
    expect(meal.totals.calories).toBe(78); // hook ghi đè, không tin số thủ công
  });
});

describe('ActivityLog pre(save) summary hook', () => {
  test('summary tự tính từ entries khi KHÔNG set thủ công', async () => {
    const act = new ActivityLog({
      user: userId,
      date: '2026-08-24',
      entries: [
        { name: 'Running', durationMinutes: 30, caloriesBurned: 250 },
        { name: 'Walking', durationMinutes: 20, caloriesBurned: 80 },
      ],
      // KHÔNG set summary — hook phải tự tính.
    });
    await act.save();

    expect(act.summary.totalCaloriesBurned).toBe(330);
    expect(act.summary.totalActiveMinutes).toBe(50);
  });
});

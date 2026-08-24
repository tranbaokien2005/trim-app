/**
 * RUNBOOK 005 Phase 1 — safety guards + AI consent gate.
 * Mock parseText để (a) không gọi OpenAI thật, (b) assert KHÔNG chạm OpenAI khi chưa consent.
 */
jest.mock('../utils/parseText', () => ({
  parseMealText: jest.fn(),
  parseActivityText: jest.fn(),
  ParseTextError: class ParseTextError extends Error {},
}));

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const { parseMealText } = require('../utils/parseText');
const { checkGoalSafety } = require('../utils/goalSafety');

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});
afterEach(async () => {
  await User.deleteMany({});
  jest.clearAllMocks();
});

const MSG_RATE = 'For your safety, weight loss is capped at 1 kg per week. Please choose a slower rate.';
const MSG_CAL = 'This goal would set your daily calories below a safe minimum (1200 for women / 1500 for men). Please choose a gentler goal or consult a professional.';
const MSG_BMI = 'Your target weight falls below a healthy BMI. We recommend speaking with a healthcare professional before setting this goal.';

// ── P1.2 unit: checkGoalSafety (deterministic — truyền tdee trực tiếp, không phụ thuộc ngày) ──
describe('checkGoalSafety (unit)', () => {
  test('weeklyRate > 1.0 → message tốc độ', () => {
    const r = checkGoalSafety({ goalType: 'lose', weeklyRate: 1.5, targetWeight: 60, height: 170, gender: 'female', tdee: 2000 });
    expect(r?.message).toBe(MSG_RATE);
  });

  test('dailyTarget < ngưỡng theo giới → message calo (nữ 1200)', () => {
    // tdee 2000, rate 1.0 → dailyTarget 900 < 1200. targetBMI 20.8 (không dính BMI), rate=1.0 (không dính rate).
    const r = checkGoalSafety({ goalType: 'lose', weeklyRate: 1.0, targetWeight: 60, height: 170, gender: 'female', tdee: 2000 });
    expect(r?.message).toBe(MSG_CAL);
  });

  test('nam ngưỡng 1500: dailyTarget 1400 < 1500 → message calo', () => {
    // tdee 1950, rate 0.5 → dailyTarget 1400 < 1500 (nam). targetBMI 22.5 ok, rate ok.
    const r = checkGoalSafety({ goalType: 'lose', weeklyRate: 0.5, targetWeight: 65, height: 170, gender: 'male', tdee: 1950 });
    expect(r?.message).toBe(MSG_CAL);
  });

  test('target BMI < 18.5 → message BMI', () => {
    // rate 0.5, tdee 2500 → dailyTarget 1950 ≥ 1500 (nam) ok; targetBMI 45/1.7^2=15.6 < 18.5.
    const r = checkGoalSafety({ goalType: 'lose', weeklyRate: 0.5, targetWeight: 45, height: 170, gender: 'male', tdee: 2500 });
    expect(r?.message).toBe(MSG_BMI);
  });

  test('goal an toàn → null', () => {
    const r = checkGoalSafety({ goalType: 'lose', weeklyRate: 0.5, targetWeight: 65, height: 170, gender: 'female', tdee: 2200 });
    expect(r).toBeNull();
  });

  test('maintain → null (không dính rate/calo/BMI)', () => {
    const r = checkGoalSafety({ goalType: 'maintain', weeklyRate: 0, targetWeight: 70, height: 170, gender: 'male', tdee: 2400 });
    expect(r).toBeNull();
  });
});

// ── P1.2 integration: guard wired vào complete-profile ──
describe('unsafe-goal guard @ complete-profile', () => {
  const reg = async (email) => {
    const r = await request(app).post('/api/auth/register').send({ name: 'G', email, password: 'password123' });
    return r.body.accessToken;
  };
  const cp = (token, goal, over = {}) => request(app)
    .post('/api/users/me/complete-profile')
    .set({ Authorization: `Bearer ${token}` })
    .send({
      profile: { dateOfBirth: '1996-01-01', gender: 'female', height: 165 },
      weight: 82,
      goal,
      ...over,
    });

  test('weeklyRate 1.5 → 400 + message tốc độ; KHÔNG tạo goal', async () => {
    const token = await reg('rate@example.com');
    const res = await cp(token, { type: 'lose', targetWeight: 72, weeklyRate: 1.5 });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe(MSG_RATE);
    // Reject sạch: onboardingCompleted vẫn false (không ghi DB nửa chừng).
    const u = await User.findOne({ email: 'rate@example.com' });
    expect(u.onboardingCompleted).toBe(false);
    expect(u.goals.length).toBe(0);
  });

  test('target BMI thấp → 400 + message BMI', async () => {
    const token = await reg('bmi@example.com');
    // target 45kg @165cm → BMI 16.5 < 18.5
    const res = await cp(token, { type: 'lose', targetWeight: 45, weeklyRate: 0.5 });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe(MSG_BMI);
  });

  test('calo dưới ngưỡng → 400 + message calo (integration, không tạo goal)', async () => {
    const token = await reg('calo@example.com');
    // Nữ 75kg h165 → tdee ~1764; rate 1.0 (không dính guard rate) → dailyTarget 664 < 1200.
    // target 65kg → BMI 23.9 (không dính guard BMI). Chỉ guard calo fire.
    const res = await cp(token, { type: 'lose', targetWeight: 65, weeklyRate: 1.0 }, { weight: 75 });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe(MSG_CAL);
    const u = await User.findOne({ email: 'calo@example.com' });
    expect(u.onboardingCompleted).toBe(false);
    expect(u.goals.length).toBe(0);
  });

  test('goal an toàn → 200 success', async () => {
    const token = await reg('safe@example.com');
    const res = await cp(token, { type: 'lose', targetWeight: 72, weeklyRate: 0.5 });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ── P1.3 AI consent gate ──
describe('AI consent gate', () => {
  const reg = async (email) => {
    const r = await request(app).post('/api/auth/register').send({ name: 'C', email, password: 'password123' });
    return { token: r.body.accessToken, id: r.body.user._id };
  };
  const authH = (t) => ({ Authorization: `Bearer ${t}` });

  test('chưa consent → /meals/parse-text 403 AI_CONSENT_REQUIRED, KHÔNG chạm OpenAI', async () => {
    const { token } = await reg('noconsent@example.com');
    const res = await request(app).post('/api/meals/parse-text').set(authH(token)).send({ text: 'pho bo' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AI_CONSENT_REQUIRED');
    expect(parseMealText).not.toHaveBeenCalled(); // KHÔNG gọi OpenAI
  });

  test('sau POST /users/ai-consent → parse-text qua (OpenAI mock)', async () => {
    const { token } = await reg('consent@example.com');
    parseMealText.mockResolvedValueOnce([{ name: 'Pho', calories: 400, protein: 20, carbs: 40, fat: 10 }]);

    const c = await request(app).post('/api/users/ai-consent').set(authH(token)).send({});
    expect(c.status).toBe(200);
    expect(c.body.granted).toBe(true);
    expect(c.body.grantedAt).toBeTruthy();

    const res = await request(app).post('/api/meals/parse-text').set(authH(token)).send({ text: 'pho bo' });
    expect(res.status).toBe(200);
    expect(parseMealText).toHaveBeenCalledTimes(1);
  });

  test('ai-consent idempotent: lần 2 KHÔNG ghi lại (spy update), grantedAt giữ nguyên', async () => {
    const { token } = await reg('idem@example.com');
    const c1 = await request(app).post('/api/users/ai-consent').set(authH(token)).send({});
    expect(c1.body.granted).toBe(true);

    // Gia cố (test-skeptic): KHÔNG diff 2 clock (có thể cùng ms → false pass). Thay vào đó
    // spy: lần consent THỨ HAI (đã granted) PHẢI KHÔNG gọi findByIdAndUpdate (guard bỏ qua ghi).
    const spy = jest.spyOn(User, 'findByIdAndUpdate');
    const c2 = await request(app).post('/api/users/ai-consent').set(authH(token)).send({});
    expect(c2.body.granted).toBe(true);
    expect(spy).not.toHaveBeenCalled(); // idempotent: không ghi lại
    // grantedAt vẫn là mốc lần đầu.
    expect(new Date(c2.body.grantedAt).getTime()).toBe(new Date(c1.body.grantedAt).getTime());
    spy.mockRestore();
  });

  test('quicklog kind=weight KHÔNG cần consent (không gọi AI)', async () => {
    const { token } = await reg('weight@example.com');
    const res = await request(app).post('/api/quicklog').set(authH(token)).send({
      kind: 'weight', value: 70, clientId: 'w-1111-4222-8333-444444444444', origin: 'deeplink',
    });
    expect(res.status).toBe(201);
  });

  test('log tay (POST /api/meals) KHÔNG cần consent', async () => {
    const { token } = await reg('manual@example.com');
    const res = await request(app).post('/api/meals').set(authH(token)).send({
      date: '2026-08-24', mealType: 'lunch',
      items: [{ name: 'Rice', calories: 200 }],
    });
    expect(res.status).toBe(201);
    expect(parseMealText).not.toHaveBeenCalled();
  });
});

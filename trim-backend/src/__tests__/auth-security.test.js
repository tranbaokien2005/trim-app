/**
 * RUNBOOK 003 — auth security: validation (zod), password strength, generic+timing-safe
 * login, per-account lockout, register anti-enum (hướng a).
 */
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../app');
const User = require('../models/User');

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
  jest.restoreAllMocks();
});

const reg = (over = {}) =>
  request(app).post('/api/auth/register').send({
    name: 'Test', email: 'test@example.com', password: 'password123', ...over,
  });
const login = (body) => request(app).post('/api/auth/login').send(body);

// ── TASK 3: validation ───────────────────────────────────────────────────────
describe('validation (zod)', () => {
  test('register thiếu field → 400', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'a@b.com' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Validation failed');
    expect(Array.isArray(res.body.errors)).toBe(true);
  });

  test('register email sai định dạng → 400', async () => {
    const res = await reg({ email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Validation failed');
  });

  test('login thiếu password → 400', async () => {
    const res = await login({ email: 'a@b.com' });
    expect(res.status).toBe(400);
  });

  test('error message KHÔNG echo giá trị password gửi lên', async () => {
    const res = await reg({ password: 'short1' }); // yếu (thiếu độ dài)
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).not.toContain('short1');
  });

  test('body hợp lệ → qua như cũ (201)', async () => {
    const res = await reg();
    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeDefined();
  });
});

// ── TASK 4: password strength ────────────────────────────────────────────────
describe('password strength (register)', () => {
  test('quá ngắn (<8) → 400', async () => {
    const res = await reg({ password: 'pass1' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Validation failed');
  });
  test('không có số → 400', async () => {
    const res = await reg({ password: 'passwordonly' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Validation failed');
  });
  test('không có chữ → 400', async () => {
    const res = await reg({ password: '12345678' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Validation failed');
  });
  test('đạt (>=8, có chữ + số) → 201', async () => {
    const res = await reg({ password: 'goodpass1' });
    expect(res.status).toBe(201);
  });
});

// ── TASK 5: login generic + timing-safe ──────────────────────────────────────
describe('login generic + timing-safe', () => {
  test('sai email VÀ sai mật khẩu → CÙNG message + CÙNG status', async () => {
    await reg({ email: 'real@example.com' });

    const wrongEmail = await login({ email: 'nobody@example.com', password: 'password123' });
    const wrongPass  = await login({ email: 'real@example.com', password: 'wrongpassword1' });

    // Load-bearing: hai nhánh PHẢI giống hệt nhau (chống enumeration).
    expect(wrongEmail.status).toBe(401);
    expect(wrongPass.status).toBe(401);
    expect(wrongEmail.status).toBe(wrongPass.status);
    expect(wrongEmail.body.message).toBe(wrongPass.body.message);
    expect(wrongEmail.body.message).toBe('Invalid credentials');
  });

  test('email không tồn tại VẪN gọi bcrypt.compare với hash bcrypt thật (timing-safe)', async () => {
    const spy = jest.spyOn(bcrypt, 'compare');
    await login({ email: 'ghost@example.com', password: 'password123' });
    expect(spy).toHaveBeenCalledTimes(1); // so với DUMMY_HASH, không return sớm
    // Gia cố (test-skeptic): tham số thứ 2 phải là HASH BCRYPT thật ($2a/$2b/$2y…),
    // KHÔNG phải chuỗi rỗng/plaintext/hash rẻ — nếu không, timing vẫn lệch.
    const secondArg = spy.mock.calls[0][1];
    expect(secondArg).toMatch(/^\$2[aby]\$\d{2}\$/);
  });

  test('đúng email + đúng mật khẩu → 200 + token', async () => {
    await reg({ email: 'ok@example.com' });
    const res = await login({ email: 'ok@example.com', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
  });
});

// ── TASK 6: per-account lockout ──────────────────────────────────────────────
describe('account lockout', () => {
  const EMAIL = 'lock@example.com';

  test('5 lần sai → khoá; lần 6 dù mật khẩu ĐÚNG vẫn 401 generic', async () => {
    await reg({ email: EMAIL });

    for (let i = 0; i < 5; i++) {
      const r = await login({ email: EMAIL, password: 'wrongpassword1' });
      expect(r.status).toBe(401);
    }

    // Đang khoá: mật khẩu ĐÚNG cũng bị từ chối, message GIỐNG hệt (không lộ trạng thái khoá).
    const correctButLocked = await login({ email: EMAIL, password: 'password123' });
    expect(correctButLocked.status).toBe(401);
    expect(correctButLocked.body.message).toBe('Invalid credentials');

    // Xác nhận DB đã đặt lockUntil trong tương lai.
    const u = await User.findOne({ email: EMAIL });
    expect(u.lockUntil).toBeTruthy();
    expect(u.lockUntil.getTime()).toBeGreaterThan(Date.now());
  });

  test('login đúng RESET đếm khi chưa đạt ngưỡng', async () => {
    await reg({ email: 'reset@example.com' });
    // 3 lần sai (chưa khoá)
    for (let i = 0; i < 3; i++) await login({ email: 'reset@example.com', password: 'wrongpassword1' });
    let u = await User.findOne({ email: 'reset@example.com' });
    expect(u.failedLoginAttempts).toBe(3);

    // login đúng → reset
    const ok = await login({ email: 'reset@example.com', password: 'password123' });
    expect(ok.status).toBe(200);
    u = await User.findOne({ email: 'reset@example.com' });
    expect(u.failedLoginAttempts).toBe(0);
    expect(u.lockUntil == null).toBe(true);
  });

  test('hết cửa sổ khoá → login đúng lại được (lockUntil quá khứ)', async () => {
    await reg({ email: 'expire@example.com' });
    // đặt lockUntil vào QUÁ KHỨ (giả lập hết hạn khoá)
    await User.updateOne(
      { email: 'expire@example.com' },
      { $set: { lockUntil: new Date(Date.now() - 1000), failedLoginAttempts: 0 } }
    );
    const ok = await login({ email: 'expire@example.com', password: 'password123' });
    expect(ok.status).toBe(200);
    expect(ok.body.accessToken).toBeDefined();
  });
});

// ── register anti-enum (hướng a) ─────────────────────────────────────────────
describe('register duplicate (anti-enum hướng a)', () => {
  test('email trùng → 400 message thân thiện, KHÔNG rơi vào global E11000 handler', async () => {
    await reg({ email: 'dup@example.com' });
    const res = await reg({ email: 'dup@example.com' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('This email is already registered');
  });
});

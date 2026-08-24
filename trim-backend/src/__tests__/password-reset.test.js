/**
 * RUNBOOK 006 Phase 3 — password reset (dormant, flag/email-gated).
 * Mock email service để (a) không gọi Resend thật, (b) bật isConfigured trong test.
 */
jest.mock('../services/email', () => ({
  isConfigured: jest.fn(() => true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue({ sent: true }),
}));

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const crypto = require('crypto');
const app = require('../app');
const User = require('../models/User');
const PasswordResetToken = require('../models/PasswordResetToken');
const RefreshToken = require('../models/RefreshToken');
const email = require('../services/email');

let mongod;
const GENERIC = 'If an account exists, a reset link has been sent.';
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

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
  await PasswordResetToken.deleteMany({});
  await RefreshToken.deleteMany({});
  jest.clearAllMocks();
  email.isConfigured.mockReturnValue(true);
});

const register = (email_ = 'reset@example.com') =>
  request(app).post('/api/auth/register').send({ name: 'R', email: email_, password: 'password123' });

// ── forgot-password: LUÔN 200 generic (anti-enum) ──
describe('forgot-password', () => {
  test('user tồn tại → 200 generic + lưu HASH của ĐÚNG token đã gửi (không thô)', async () => {
    await register('exists@example.com');
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'exists@example.com' });
    expect(res.body).toEqual({ message: GENERIC }); // toàn body giống hệt (anti-enum)
    expect(res.status).toBe(200);
    const tokens = await PasswordResetToken.find({});
    expect(tokens.length).toBe(1);
    expect(email.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    // Gia cố (test-skeptic M3): tokenHash PHẢI là SHA-256 của token THẬT đã gửi qua email,
    // KHÔNG phải chính token thô (cả hai đều 64 hex nên regex-shape không phân biệt được).
    const rawSent = email.sendPasswordResetEmail.mock.calls[0][1];
    expect(tokens[0].tokenHash).toBe(sha256(rawSent));
    expect(tokens[0].tokenHash).not.toBe(rawSent);
    expect(tokens[0].expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  test('user KHÔNG tồn tại → 200 GIỐNG HỆT, KHÔNG tạo token (anti-enum)', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@example.com' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: GENERIC }); // toàn body, không chỉ message
    expect(await PasswordResetToken.countDocuments({})).toBe(0);
    expect(email.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  test('DORMANT: email chưa cấu hình → 200 generic, KHÔNG tạo token', async () => {
    await register('dormant@example.com');
    email.isConfigured.mockReturnValue(false);
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'dormant@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe(GENERIC);
    expect(await PasswordResetToken.countDocuments({})).toBe(0);
  });
});

// ── reset-password ──
describe('reset-password', () => {
  // Helper: tạo user + token reset thô hợp lệ, trả { rawToken, userId }.
  const seedReset = async (email_ = 'reset@example.com', ttlMs = 15 * 60 * 1000) => {
    const r = await register(email_);
    const userId = r.body.user._id;
    const rawToken = crypto.randomBytes(32).toString('hex');
    await PasswordResetToken.create({
      user: userId, tokenHash: sha256(rawToken), expiresAt: new Date(Date.now() + ttlMs),
    });
    return { rawToken, userId, email: email_ };
  };

  test('token hợp lệ → đổi password, xoá token, revoke refresh tokens', async () => {
    const { rawToken, userId, email: em } = await seedReset();
    // Login trước để có refresh token → sau reset phải bị revoke.
    const login = await request(app).post('/api/auth/login').send({ email: em, password: 'password123' });
    const oldRefresh = login.body.refreshToken;
    // register + login đều cấp refresh token → có active token trước reset.
    expect(await RefreshToken.countDocuments({ user: userId, revokedAt: null })).toBeGreaterThanOrEqual(1);

    const res = await request(app).post('/api/auth/reset-password')
      .send({ token: rawToken, newPassword: 'newpass123' });
    expect(res.status).toBe(200);

    // NGAY sau reset (trước khi login lại): token reset đã xoá; MỌI refresh token của user
    // đã revoke (buộc login lại mọi thiết bị). Token refresh cũ không dùng được nữa.
    expect(await PasswordResetToken.countDocuments({ user: userId })).toBe(0);
    expect(await RefreshToken.countDocuments({ user: userId, revokedAt: null })).toBe(0);
    const reuse = await request(app).post('/api/auth/refresh').send({ refreshToken: oldRefresh });
    expect(reuse.status).toBe(401);

    // Password cũ KHÔNG login được; password mới login được.
    const oldLogin = await request(app).post('/api/auth/login').send({ email: em, password: 'password123' });
    expect(oldLogin.status).toBe(401);
    const newLogin = await request(app).post('/api/auth/login').send({ email: em, password: 'newpass123' });
    expect(newLogin.status).toBe(200);
  });

  test('token HẾT HẠN → 400 generic (LOAD-BEARING)', async () => {
    const { rawToken } = await seedReset('exp@example.com', -1000); // đã hết hạn
    const res = await request(app).post('/api/auth/reset-password')
      .send({ token: rawToken, newPassword: 'newpass123' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid or expired reset token');
  });

  test('token SAI → 400 generic', async () => {
    await seedReset('wrong@example.com');
    const res = await request(app).post('/api/auth/reset-password')
      .send({ token: 'not-a-real-token', newPassword: 'newpass123' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid or expired reset token');
  });

  test('newPassword yếu → 400 (zod, dùng lại rule GĐ1c)', async () => {
    const { rawToken } = await seedReset('weak@example.com');
    const res = await request(app).post('/api/auth/reset-password')
      .send({ token: rawToken, newPassword: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Validation failed');
  });
});

// ── GATE TTL ──
describe('PasswordResetToken TTL gate', () => {
  test('index {expiresAt:1} expireAfterSeconds:0 document-level, đúng 1 TTL', async () => {
    await PasswordResetToken.syncIndexes();
    const idx = await PasswordResetToken.collection.indexes();
    const ttl = idx.find((i) => i.key && i.key.expiresAt === 1);
    expect(ttl).toBeDefined();
    expect(ttl.expireAfterSeconds).toBe(0);
    expect(idx.filter((i) => i.expireAfterSeconds !== undefined).length).toBe(1);
  });
});

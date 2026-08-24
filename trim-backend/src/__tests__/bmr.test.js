/**
 * TASK 7 hardening (khuyến nghị @trim-test-skeptic) — neo HẰNG SỐ công thức vào
 * số literal. Các test khác (phase1 tdee, currentstats-bmr) tính kỳ vọng QUA
 * chính bmr.js nên bị "mù" nếu ai đổi hệ số Mifflin hay BASELINE_RATIO (cả hai
 * vế dịch cùng nhau). Test này là ground-truth thuần: input cố định → số cố định,
 * KHÔNG phụ thuộc ngày giờ. Đổi hệ số công thức => test này FAIL.
 */
const {
  calculateBMR,
  calculateBaseline,
  calculateTDEE,
  BASELINE_RATIO,
} = require('../utils/bmr');

describe('bmr.js — hằng số công thức (ground-truth literal)', () => {
  test('BASELINE_RATIO = 0.2 (khoá)', () => {
    expect(BASELINE_RATIO).toBe(0.2);
  });

  test('calculateBMR Mifflin-St Jeor — male (+5)', () => {
    // 10*70 + 6.25*175 - 5*30 + 5 = 1648.75 (chưa làm tròn)
    expect(calculateBMR(70, 175, 30, 'male')).toBe(1648.75);
  });

  test('calculateBMR — female (-161)', () => {
    // 10*60 + 6.25*165 - 5*36 - 161 = 1290.25
    expect(calculateBMR(60, 165, 36, 'female')).toBe(1290.25);
  });

  test('calculateBMR — other (-78)', () => {
    // 10*60 + 6.25*165 - 5*36 - 78 = 1373.25
    expect(calculateBMR(60, 165, 36, 'other')).toBe(1373.25);
  });

  test('calculateBaseline = round(bmr * 0.2)', () => {
    expect(calculateBaseline(1290)).toBe(258);
    expect(calculateBaseline(1000)).toBe(200);
  });

  test('calculateTDEE = bmr + baseline + round(burned)', () => {
    // 1290 + 258 + 250 = 1798 (mô hình baseline đang ship)
    expect(calculateTDEE(1290, 250)).toBe(1798);
    // không log hoạt động: 1290 + 258 + 0
    expect(calculateTDEE(1290)).toBe(1548);
  });
});

/**
 * Guard AN TOÀN cho việc đặt goal (guideline 1.4.1 — app không được khuyến khích hành vi
 * hại sức khoẻ). Chặn CỨNG ở server bằng if, KHÔNG bằng prompt.
 *
 * Trả về { message } (chuỗi lỗi an toàn để trả 400) nếu goal KHÔNG an toàn, hoặc null nếu OK.
 * Dùng lại công thức trong bmr.js — KHÔNG viết lại.
 */
const {
  calculateBMI,
  calculateDailyTarget,
  SAFE_MIN_CALORIES_FEMALE,
  SAFE_MIN_CALORIES_MALE,
  MIN_HEALTHY_BMI,
  MAX_WEEKLY_LOSS_KG,
} = require('./bmr');

/**
 * @param {object} p
 * @param {'lose'|'gain'|'maintain'} p.goalType
 * @param {number} p.weeklyRate  kg/tuần (dương)
 * @param {number} p.targetWeight kg
 * @param {number} p.height       cm
 * @param {string} p.gender       'male' | 'female' | 'other'
 * @param {number} p.tdee         kcal
 * @returns {{message:string}|null}
 */
const checkGoalSafety = ({ goalType, weeklyRate, targetWeight, height, gender, tdee }) => {
  // 1) Tốc độ giảm quá nhanh (> 1 kg/tuần). Không áp cho maintain.
  if (goalType !== 'maintain' && Math.abs(weeklyRate || 0) > MAX_WEEKLY_LOSS_KG) {
    return {
      message:
        'For your safety, weight loss is capped at 1 kg per week. Please choose a slower rate.',
    };
  }

  // 2) Calo mục tiêu/ngày dưới ngưỡng an toàn theo giới. 'other' dùng ngưỡng nữ (thấp hơn,
  //    tránh over-reject); guard vẫn chặn mọi target thực sự nguy hiểm < 1200 cho mọi giới.
  const minCal = gender === 'male' ? SAFE_MIN_CALORIES_MALE : SAFE_MIN_CALORIES_FEMALE;
  const dailyTarget = calculateDailyTarget(tdee, goalType, weeklyRate);
  if (dailyTarget < minCal) {
    return {
      message:
        'This goal would set your daily calories below a safe minimum (1200 for women / 1500 for men). Please choose a gentler goal or consult a professional.',
    };
  }

  // 3) Cân nặng mục tiêu rơi dưới BMI khoẻ mạnh.
  if (targetWeight && height) {
    const targetBmi = calculateBMI(targetWeight, height);
    if (targetBmi < MIN_HEALTHY_BMI) {
      return {
        message:
          'Your target weight falls below a healthy BMI. We recommend speaking with a healthcare professional before setting this goal.',
      };
    }
  }

  return null;
};

module.exports = { checkGoalSafety };

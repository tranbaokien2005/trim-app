/**
 * Nguồn DUY NHẤT cho mọi phép tính BMR / TDEE / calorie target của backend.
 * Không được tính lại các công thức này ở bất kỳ route nào.
 */

// Baseline = phần năng lượng ngoài BMR khi không log hoạt động gì (NEAT + tiêu hoá).
// TODO(P0-#2): thay hằng số này bằng multiplier suy từ user.profile.baseActivityLevel.
const BASELINE_RATIO = 0.2;

// 1 kg mỡ ≈ 7700 kcal
const CALORIES_PER_KG = 7700;

// ── Ngưỡng AN TOÀN (guideline 1.4.1 — app không khuyến khích hành vi hại sức khoẻ) ──
// Hằng số tập trung ở đây, KHÔNG rải magic number trong route.
const SAFE_MIN_CALORIES_FEMALE = 1200; // kcal/ngày tối thiểu an toàn (nữ)
const SAFE_MIN_CALORIES_MALE = 1500;   // kcal/ngày tối thiểu an toàn (nam)
const MIN_HEALTHY_BMI = 18.5;          // BMI khoẻ mạnh tối thiểu
const MAX_WEEKLY_LOSS_KG = 1.0;        // tốc độ giảm cân tối đa an toàn (kg/tuần)

/**
 * Mifflin-St Jeor.
 * TRẢ VỀ SỐ CHƯA LÀM TRÒN — cố ý, để nơi gọi tự quyết định làm tròn.
 * (Giữ đúng hành vi cũ: stats.js làm tròn, patterns.js thì không.)
 * weight: kg · height: cm · age: năm
 */
const calculateBMR = (weight, height, age, gender) => {
  const base = 10 * weight + 6.25 * height - 5 * age;
  if (gender === 'male') return base + 5;
  if (gender === 'female') return base - 161;
  return base - 78; // 'other' — trung bình của +5 và -161
};

/** weight: kg · height: cm */
const calculateBMI = (weight, height) => {
  const heightInMeters = height / 100;
  return weight / (heightInMeters * heightInMeters);
};

/** Tuổi theo LỊCH (không phải chia 365.25 — bản chia bị trôi theo năm nhuận). */
const calculateAge = (dateOfBirth) => {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

/** Baseline làm tròn, tính từ BMR đã làm tròn. */
const calculateBaseline = (bmr) => Math.round(bmr * BASELINE_RATIO);

/**
 * TDEE = BMR + baseline + calo đã log.
 * Truyền vào BMR ĐÃ LÀM TRÒN để khớp hành vi cũ của stats.js và users.js.
 */
const calculateTDEE = (bmr, loggedBurned = 0) => {
  return bmr + calculateBaseline(bmr) + Math.round(loggedBurned);
};

/**
 * Calorie target theo ngày.
 * QUY ƯỚC ĐÃ CHỐT: rẽ nhánh theo goalType, weeklyRate LUÔN DƯƠNG.
 * (Hàm cũ calculateDailyCalorieTarget nhận rate âm cho giảm cân — đã xoá, gây nhầm dấu.)
 * goalType: 'lose' | 'gain' | 'maintain' · weeklyRate: kg/tuần, dương
 */
const calculateDailyTarget = (tdee, goalType, weeklyRate) => {
  const dailyAdjustment = Math.round((Math.abs(weeklyRate) || 0) * CALORIES_PER_KG / 7);
  if (goalType === 'lose') return tdee - dailyAdjustment;
  if (goalType === 'gain') return tdee + dailyAdjustment;
  return tdee; // maintain
};

/**
 * Tiện ích: tính BMR trực tiếp từ document User.
 * Trả null nếu thiếu dữ liệu — nơi gọi phải xử lý null.
 * TRẢ VỀ SỐ CHƯA LÀM TRÒN.
 */
const calculateBMRFromUser = (user) => {
  const weight = user?.currentStats?.weight;
  const height = user?.profile?.height;
  const dob    = user?.profile?.dateOfBirth;
  const gender = user?.profile?.gender;
  if (!weight || !height || !dob) return null;
  return calculateBMR(weight, height, calculateAge(dob), gender);
};

module.exports = {
  BASELINE_RATIO,
  CALORIES_PER_KG,
  SAFE_MIN_CALORIES_FEMALE,
  SAFE_MIN_CALORIES_MALE,
  MIN_HEALTHY_BMI,
  MAX_WEEKLY_LOSS_KG,
  calculateBMR,
  calculateBMI,
  calculateAge,
  calculateBaseline,
  calculateTDEE,
  calculateDailyTarget,
  calculateBMRFromUser,
};

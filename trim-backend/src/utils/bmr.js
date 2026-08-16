// Mifflin-St Jeor BMR formula
const calculateBMR = (weight, height, age, gender) => {
  // weight in kg, height in cm, age in years
  if (gender === 'male') {
    return 10 * weight + 6.25 * height - 5 * age + 5;
  } else if (gender === 'female') {
    return 10 * weight + 6.25 * height - 5 * age - 161;
  } else {
    // For other genders, use average
    return (10 * weight + 6.25 * height - 5 * age) - 78;
  }
};

const calculateBMI = (weight, height) => {
  // weight in kg, height in cm
  const heightInMeters = height / 100;
  return weight / (heightInMeters * heightInMeters);
};

const calculateTDEE = (bmr, loggedBurned = 0) => {
  const baseline = Math.round(bmr * 0.2);
  return bmr + baseline + Math.round(loggedBurned);
};

const calculateDailyCalorieTarget = (tdee, weeklyRate) => {
  // weeklyRate in kg per week (negative for weight loss)
  // 7700 calories per kg of fat
  const dailyDeficit = (weeklyRate * 7700) / 7;
  return tdee - dailyDeficit;
};

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

module.exports = {
  calculateBMR,
  calculateBMI,
  calculateTDEE,
  calculateDailyCalorieTarget,
  calculateAge,
};
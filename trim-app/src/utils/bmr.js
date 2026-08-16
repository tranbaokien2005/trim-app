/**
 * Calculate Basal Metabolic Rate (BMR) using Mifflin-St Jeor formula
 * BMR = 10*weight(kg) + 6.25*height(cm) - 5*age(years) + 5 (for male)
 * BMR = 10*weight(kg) + 6.25*height(cm) - 5*age(years) - 161 (for female)
 */
export const calcBMR = (weight, height, age, gender) => {
  const base = 10 * weight + 6.25 * height - 5 * age;
  if (gender === 'male') return Math.round(base + 5);
  if (gender === 'female') return Math.round(base - 161);
  return Math.round(base - 78); // 'other' — average of male (+5) and female (-161)
};

export const calcTDEE = (bmr) => {
  const baseline = Math.round(bmr * 0.2);
  return bmr + baseline;
};

/**
 * Calculate daily caloric target based on goal
 * goalType: 'lose' | 'maintain' | 'gain'
 * targetRate: kg per week (0.1 - 1.0)
 * 1 kg = ~7700 calories
 */
export const calcDailyTarget = (tdee, goalType, targetRate) => {
  const caloriesPerKg = 7700;
  const dailyCalorieChange = (caloriesPerKg * targetRate) / 7; // per day

  if (goalType === 'lose') {
    return Math.round(tdee - dailyCalorieChange);
  } else if (goalType === 'gain') {
    return Math.round(tdee + dailyCalorieChange);
  }
  return tdee; // maintain
};

/**
 * Calculate projected date to reach goal weight
 * currentWeight: current weight in kg
 * goalWeight: target weight in kg
 * targetRate: kg per week (positive value)
 * Returns date object
 */
export const calcProjectedDate = (currentWeight, goalWeight, targetRate) => {
  const difference = Math.abs(goalWeight - currentWeight);
  const weeksNeeded = difference / targetRate;
  const daysNeeded = Math.round(weeksNeeded * 7);

  const projectedDate = new Date();
  projectedDate.setDate(projectedDate.getDate() + daysNeeded);
  return projectedDate;
};

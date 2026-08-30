// Date / label helpers shared across screens.

/** Returns YYYY-MM-DD in the device's local timezone. */
export const formatDateYYYYMMDD = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/** 0=Sun, 1=Mon, ..., 6=Sat -> weekday name. */
export const getDayNameVi = (dayOfWeek) => {
  const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday',
                 'Thursday', 'Friday', 'Saturday'];
  return names[dayOfWeek] || '';
};

/** 'breakfast' -> 'Breakfast', etc. Falls back to the raw value. */
export const translateMealType = (mt) => {
  const map = {
    breakfast: 'Breakfast',
    lunch: 'Lunch',
    dinner: 'Dinner',
    snack: 'Snack',
  };
  return map[mt] || mt;
};

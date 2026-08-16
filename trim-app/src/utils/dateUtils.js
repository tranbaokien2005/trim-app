// Date / label helpers shared across screens.

/** Returns YYYY-MM-DD in the device's local timezone. */
export const formatDateYYYYMMDD = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/** 0=CN, 1=T2, ..., 6=T7 -> Vietnamese weekday name. */
export const getDayNameVi = (dayOfWeek) => {
  const names = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư',
                 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  return names[dayOfWeek] || '';
};

/** 'breakfast' -> 'Sáng', etc. Falls back to the raw value. */
export const translateMealType = (mt) => {
  const map = {
    breakfast: 'Sáng',
    lunch: 'Trưa',
    dinner: 'Tối',
    snack: 'Phụ',
  };
  return map[mt] || mt;
};

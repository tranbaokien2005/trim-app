import api from './api';

/**
 * Một cửa duy nhất cho log đến từ ngoài app (deep link, Shortcut, widget...).
 * clientId là khoá chống trùng — gọi lại với CÙNG clientId là an toàn tuyệt đối,
 * server trả lại bản ghi cũ chứ không tạo bản thứ hai. Vì vậy khi retry phải
 * dùng LẠI clientId cũ, đừng sinh cái mới.
 */
export const postQuickLog = async ({ kind, text, value, mealType, clientId, origin = 'deeplink' }) => {
  const res = await api.post('/quicklog', { kind, text, value, mealType, clientId, origin });
  return res.data; // { ok, duplicate, kind, created }
};

const UNDO_PATH = { meal: 'meals', activity: 'activities', weight: 'weights' };

/** Hoàn tác = xoá đúng document vừa tạo, dùng route xoá đã có sẵn. */
export const undoQuickLog = (kind, id) => api.delete(`/${UNDO_PATH[kind]}/${id}`);

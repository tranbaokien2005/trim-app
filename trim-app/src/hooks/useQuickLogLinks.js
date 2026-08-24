import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { parseTrimUrl } from '../utils/parseTrimUrl';
import { uuidv4 } from '../utils/uuid';
import { postQuickLog, undoQuickLog } from '../services/quicklog';

/**
 * Bắt và xử lý deep link trim:// ở TẦNG GỐC — ngoài mọi screen.
 *
 * Ba điều dễ làm sai, đã xử lý ở đây:
 *  1. clientId sinh MỘT LẦN cho mỗi URL nhận được (lúc đưa vào hàng đợi),
 *     không sinh lại khi re-render. Retry cũng dùng lại chính clientId đó.
 *  2. URL đến lúc chưa đăng nhập / đang khôi phục token được GIỮ trong hàng đợi
 *     và xử lý sau khi vào được MainTabs. Không được nuốt mất.
 *  3. Cold start dùng getInitialURL, app đang chạy dùng listener 'url'.
 *
 * LƯU Ý: scheme trim:// KHÔNG chạy trong Expo Go — cần development build.
 */
const KIND_LABEL = { meal: 'bữa ăn', activity: 'hoạt động', weight: 'cân nặng' };

const describe = (intent, created) => {
  if (intent.kind === 'weight') return `Đã ghi ${intent.value} kg`;
  if (intent.kind === 'activity') {
    const burned = created?.summary?.totalCaloriesBurned;
    return burned ? `Đã ghi hoạt động · ${burned} kcal đốt` : 'Đã ghi hoạt động';
  }
  const cal = created?.totals?.calories;
  return cal ? `Đã ghi bữa ăn · ${cal} kcal` : 'Đã ghi bữa ăn';
};

export default function useQuickLogLinks({ ready, onNeedsManualLog }) {
  const [toast, setToast] = useState(null);
  const [tick, setTick] = useState(0);
  const queueRef = useRef([]);
  const busyRef = useRef(false);
  const hideTimer = useRef(null);

  const showToast = useCallback((next, autoHideMs) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setToast(next);
    if (autoHideMs) hideTimer.current = setTimeout(() => setToast(null), autoHideMs);
  }, []);

  const dismissToast = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setToast(null);
  }, []);

  const enqueue = useCallback((url) => {
    const intent = parseTrimUrl(url);
    if (!intent) return;
    queueRef.current.push({ ...intent, clientId: uuidv4() });
    setTick((n) => n + 1);
  }, []);

  useEffect(() => {
    let alive = true;
    Linking.getInitialURL()
      .then((url) => { if (alive && url) enqueue(url); })
      .catch(() => {});
    const sub = Linking.addEventListener('url', (event) => enqueue(event?.url));
    return () => {
      alive = false;
      if (sub && sub.remove) sub.remove();
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [enqueue]);

  const submit = useCallback(async (intent) => {
    showToast({ status: 'saving', message: `Đang ghi ${KIND_LABEL[intent.kind]}...`, intent });
    try {
      const data = await postQuickLog({ ...intent, origin: 'deeplink' });
      if (data && data.duplicate) {
        showToast({ status: 'duplicate', message: 'Đã ghi rồi', intent }, 3000);
        return;
      }
      const created = data && data.created;
      showToast({
        status: 'success',
        message: describe(intent, created),
        intent,
        undo: created && created._id ? { kind: intent.kind, id: created._id } : null,
      }, 6000);
    } catch (_) {
      // Không mất dữ liệu: đưa user tới màn Log kèm nội dung, và giữ nút Thử lại.
      showToast({ status: 'error', message: 'Chưa ghi được — thử lại hoặc nhập tay', intent });
      if (onNeedsManualLog) onNeedsManualLog(intent);
    }
  }, [showToast, onNeedsManualLog]);

  useEffect(() => {
    if (!ready || busyRef.current || queueRef.current.length === 0) return;
    busyRef.current = true;
    (async () => {
      while (queueRef.current.length > 0) {
        await submit(queueRef.current.shift());
      }
      busyRef.current = false;
    })();
  }, [ready, tick, submit]);

  const undo = useCallback(async () => {
    if (!toast || !toast.undo) return;
    const { kind, id } = toast.undo;
    showToast({ status: 'saving', message: 'Đang hoàn tác...' });
    try {
      await undoQuickLog(kind, id);
      showToast({ status: 'duplicate', message: 'Đã hoàn tác' }, 2500);
    } catch (_) {
      showToast({ status: 'error', message: 'Hoàn tác không thành công' }, 4000);
    }
  }, [toast, showToast]);

  const retry = useCallback(() => {
    if (!toast || !toast.intent) return;
    // dùng LẠI clientId cũ — nếu lần trước server đã ghi thành công thì lần này
    // chỉ nhận duplicate: true, không tạo bản ghi thứ hai.
    const intent = toast.intent;
    queueRef.current.push(intent);
    setTick((n) => n + 1);
  }, [toast]);

  return { toast, dismissToast, undo, retry };
}

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';

/**
 * Thẻ xác nhận cho log đến từ deep link. Nổi trên mọi screen, ngoài navigator.
 * success  -> có nút Hoàn tác (6 giây)
 * duplicate-> "Đã ghi rồi", KHÔNG phải lỗi, không tô đỏ
 * error    -> giữ nguyên trên màn, có nút Thử lại (dùng lại clientId cũ)
 */
const ACCENT = {
  saving:    '#888888',
  success:   '#2ECC71',
  duplicate: '#FFB74D',
  error:     '#FF6B6B',
};

const QuickLogToast = ({ toast, onUndo, onRetry, onDismiss }) => {
  if (!toast) return null;

  const accent = ACCENT[toast.status] || ACCENT.saving;
  const showUndo = toast.status === 'success' && !!toast.undo;
  const showRetry = toast.status === 'error';

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={[styles.card, { borderColor: accent }]}>
        {toast.status === 'saving' ? (
          <ActivityIndicator size="small" color={accent} style={styles.spinner} />
        ) : (
          <View style={[styles.dot, { backgroundColor: accent }]} />
        )}

        <Text style={styles.message} numberOfLines={2}>{toast.message}</Text>

        {showUndo && (
          <TouchableOpacity onPress={onUndo} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[styles.action, { color: accent }]}>Hoàn tác</Text>
          </TouchableOpacity>
        )}
        {showRetry && (
          <TouchableOpacity onPress={onRetry} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[styles.action, { color: accent }]}>Thử lại</Text>
          </TouchableOpacity>
        )}
        {toast.status !== 'saving' && (
          <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.close}>✕</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 96,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: 520,
    width: '100%',
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderRadius: 28,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  spinner: { marginRight: 10 },
  message: { flex: 1, color: '#FFFFFF', fontSize: 14 },
  action: { fontSize: 14, fontWeight: '600', marginLeft: 14 },
  close: { color: '#888888', fontSize: 14, marginLeft: 14 },
});

export default QuickLogToast;

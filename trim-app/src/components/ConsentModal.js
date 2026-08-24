import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import api from '../services/api';

/**
 * OpenAI consent modal (guideline 5.1.2(i)). Hiện MỘT LẦN trước khi dùng AI lần đầu, hoặc
 * khi API trả 403 AI_CONSENT_REQUIRED. Copy dùng ĐÚNG chuỗi trong RUNBOOK 005.
 *
 * Props:
 *   visible    : boolean
 *   onEnable() : gọi sau khi POST /users/ai-consent thành công (caller retry hành động AI)
 *   onDismiss(): user chọn log tay (đóng modal, không gọi AI)
 */
const ConsentModal = ({ visible, onEnable, onDismiss }) => {
  const [submitting, setSubmitting] = useState(false);

  const enable = async () => {
    try {
      setSubmitting(true);
      await api.post('/users/ai-consent');
      onEnable && onEnable();
    } catch (e) {
      // Nếu set consent lỗi, vẫn đóng để user không kẹt; họ có thể thử lại.
      onDismiss && onDismiss();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Use AI to analyze your food &amp; activity?</Text>

          <Text style={styles.body}>
            To estimate nutrition from a photo or from what you type, Trim sends that text and
            image to OpenAI, an AI provider, which processes it and sends back an estimate. OpenAI
            does not use this data to train its models.
          </Text>

          <Text style={styles.sub}>
            This is optional. You can always log food, activity, and weight manually without AI.
            Estimates may be inaccurate.
          </Text>

          <TouchableOpacity
            style={[styles.primaryBtn, submitting && { opacity: 0.6 }]}
            onPress={enable}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting
              ? <ActivityIndicator color="#0F0F0F" />
              : <Text style={styles.primaryText}>Enable AI analysis</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} onPress={onDismiss} disabled={submitting} activeOpacity={0.7}>
            <Text style={styles.secondaryText}>Not now — I'll log manually</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#1A1A1A',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 24,
  },
  title: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', marginBottom: 14 },
  body: { color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 21, marginBottom: 12 },
  sub: { color: 'rgba(255,255,255,0.55)', fontSize: 13, lineHeight: 19, marginBottom: 22 },
  primaryBtn: {
    backgroundColor: '#2ECC71',
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryText: { color: '#0F0F0F', fontSize: 16, fontWeight: '700' },
  secondaryBtn: { paddingVertical: 12, alignItems: 'center' },
  secondaryText: { color: 'rgba(255,255,255,0.7)', fontSize: 15 },
});

export default ConsentModal;

import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
} from 'react-native';

// Plain-English explanations for the numbers we show. Keep each to 1–2 sentences,
// everyday tone — this is a tap-to-learn helper, not a textbook.
export const INFO_CONTENT = {
  tdee: {
    title: 'TDEE',
    body: 'Total Daily Energy Expenditure — roughly how many calories your body burns in a day, from breathing to workouts. Eat under it to lose weight, over it to gain.',
  },
  deficit: {
    title: 'Deficit',
    body: "How far under your daily budget you are. Eating less than you burn is what drives weight loss — and we add back the calories you burned from activity.",
  },
  bmr: {
    title: 'BMR',
    body: 'Basal Metabolic Rate — the calories your body burns at complete rest, just to keep you alive. Everything else is built on top of this.',
  },
  baseline: {
    title: 'Baseline',
    body: 'Everyday movement on top of your BMR — walking around, daily life — before any workout you log. We estimate it at about 20% of your BMR.',
  },
  burned: {
    title: 'Burned',
    body: 'Calories from the workouts and activities you logged today. These add to what you can eat while still hitting your goal.',
  },
};

export default function InfoSheet({ visible, onClose, infoKey }) {
  const info = INFO_CONTENT[infoKey] || null;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>
      <View style={styles.sheet}>
        <Text style={styles.title}>{info?.title || ''}</Text>
        <Text style={styles.body}>{info?.body || ''}</Text>
        <TouchableOpacity style={styles.btn} onPress={onClose} activeOpacity={0.85}>
          <Text style={styles.btnText}>Got it</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// Small circled-i affordance placed next to a label.
export function InfoDot({ onPress, style }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      style={[styles.dot, style]}
      activeOpacity={0.6}
    >
      <Text style={styles.dotText}>ⓘ</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 36,
    gap: 12,
  },
  title: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  body: { color: '#B0B0B0', fontSize: 14, lineHeight: 21 },
  btn: {
    marginTop: 8,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  btnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  dot: { marginLeft: 5 },
  dotText: { color: '#666', fontSize: 12, fontWeight: '700' },
});

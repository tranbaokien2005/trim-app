import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
} from 'react-native';

// Bottom-sheet chooser used by the Log tabs: one primary "add" action expands into
// "Type it in" / "Use AI", so a screen shows a SINGLE primary button instead of two
// competing green buttons (a green FAB fighting a green "+ Add" button).
export default function ActionChooserSheet({
  visible,
  onClose,
  onManual,
  onAI,
  title = 'Add',
  manualLabel = 'Type it in',
  aiLabel = '✨ Use AI',
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>
      <View style={styles.sheet}>
        <Text style={styles.title}>{title}</Text>

        <TouchableOpacity
          style={styles.option}
          onPress={() => {
            onClose();
            onManual && onManual();
          }}
        >
          <Text style={styles.optionText}>{manualLabel}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.option, styles.optionAI]}
          onPress={() => {
            onClose();
            onAI && onAI();
          }}
        >
          <Text style={[styles.optionText, styles.optionTextAI]}>{aiLabel}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancel} onPress={onClose}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>
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
    padding: 20,
    paddingBottom: 32,
    gap: 10,
  },
  title: {
    color: '#888',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  option: {
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  optionAI: { backgroundColor: '#2ECC71', borderColor: '#2ECC71' },
  optionText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  optionTextAI: { color: '#0F0F0F' },
  cancel: { paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  cancelText: { color: '#666', fontSize: 14 },
});

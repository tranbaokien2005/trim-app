import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  TextInput,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  ScrollView,
} from 'react-native';

const STEP = 0.1;
const MIN_RATE = 0.1;
const MAX_RATE = 1.0;

const TargetRateScreen = ({ navigation, route }) => {
  const { userData } = route.params;
  const [goalWeight, setGoalWeight] = useState('');
  const [targetRate, setTargetRate] = useState(0.5);
  const [goalWeightFocused, setGoalWeightFocused] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  const adjustRate = (delta) => {
    setTargetRate((prev) => {
      const next = Math.round((prev + delta) * 10) / 10;
      return Math.min(MAX_RATE, Math.max(MIN_RATE, next));
    });
  };

  const handleNext = () => {
    if (goalWeight.trim()) {
      const updatedData = { ...userData, goalWeight: parseFloat(goalWeight), targetRate };
      navigation.navigate('Summary', { userData: updatedData });
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: '#0F0F0F' }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View pointerEvents="none" style={styles.glow} />
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <Text style={styles.step}>Step 5 of 7</Text>
            <Text style={styles.title}>Target Settings</Text>
            <Text style={styles.subtitle}>Set your goal and pace</Text>

            <Text style={styles.label}>Goal Weight (kg)</Text>
            <TextInput
              style={[styles.input, goalWeightFocused && styles.inputFocused]}
              placeholder="70"
              placeholderTextColor="#444"
              value={goalWeight}
              onChangeText={setGoalWeight}
              keyboardType="decimal-pad"
              returnKeyType="done"
              onSubmitEditing={handleNext}
              onFocus={() => setGoalWeightFocused(true)}
              onBlur={() => setGoalWeightFocused(false)}
            />

            <Text style={[styles.label, { marginTop: 24 }]}>Target Rate (kg/week)</Text>
            <View style={styles.stepper}>
              <TouchableOpacity
                style={[styles.stepBtn, targetRate <= MIN_RATE && styles.stepBtnDisabled]}
                onPress={() => adjustRate(-STEP)}
                disabled={targetRate <= MIN_RATE}
              >
                <Text style={styles.stepBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.rateValue}>{targetRate.toFixed(1)}</Text>
              <TouchableOpacity
                style={[styles.stepBtn, targetRate >= MAX_RATE && styles.stepBtnDisabled]}
                onPress={() => adjustRate(STEP)}
                disabled={targetRate >= MAX_RATE}
              >
                <Text style={styles.stepBtnText}>+</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.rateRange}>
              <Text style={styles.rangeLabel}>0.1 kg/week (slow)</Text>
              <Text style={styles.rangeLabel}>1.0 kg/week (fast)</Text>
            </View>

            <TouchableOpacity
              style={[styles.btn, !goalWeight.trim() && styles.btnDisabled]}
              onPress={handleNext}
              disabled={!goalWeight.trim()}
              activeOpacity={0.85}
            >
              <Text style={styles.btnText}>Next</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  glow: {
    position: 'absolute',
    top: -60,
    alignSelf: 'center',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: '#2ECC71',
    opacity: 0.05,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  card: {
    padding: 28,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  step: { fontSize: 13, color: '#555', marginBottom: 6 },
  title: { fontSize: 24, fontWeight: '700', color: '#FFFFFF', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 24 },
  label: { fontSize: 13, color: '#888', marginBottom: 8 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#FFFFFF',
    fontSize: 15,
  },
  inputFocused: { borderColor: '#2ECC71' },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
    marginBottom: 12,
  },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  stepBtnDisabled: { opacity: 0.3 },
  stepBtnText: { fontSize: 20, color: '#FFFFFF', lineHeight: 24 },
  rateValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2ECC71',
    minWidth: 60,
    textAlign: 'center',
  },
  rateRange: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  rangeLabel: { fontSize: 12, color: '#555' },
  btn: {
    marginTop: 28,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#2ECC71',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});

export default TargetRateScreen;

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
  Alert,
} from 'react-native';

const TargetSettingsScreen = ({ navigation, route }) => {
  const { userData } = route.params;
  const currentWeight = userData.weight;
  const heightCm     = userData.height;
  const goalType     = userData.goalType;

  const bmi = currentWeight / Math.pow(heightCm / 100, 2);

  let defaultTarget;
  if (goalType === 'lose') {
    if (bmi > 25) {
      defaultTarget = Math.round(22 * Math.pow(heightCm / 100, 2));
    } else if (bmi >= 18.5) {
      defaultTarget = Math.round(currentWeight * 0.95);
    } else {
      defaultTarget = currentWeight;
    }
  } else {
    defaultTarget = Math.round(currentWeight * 1.10);
  }

  const defaultTargetRef = useRef(defaultTarget);

  const [goalWeight, setGoalWeight]               = useState(String(defaultTarget));
  const [goalWeightFocused, setGoalWeightFocused] = useState(false);

  const fadeAnim      = useRef(new Animated.Value(0)).current;
  const slideAnim     = useRef(new Animated.Value(30)).current;
  const alertShownRef = useRef(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  const validateTargetWeight = () => {
    if (alertShownRef.current) return;
    const target = parseFloat(goalWeight);
    if (isNaN(target)) return;

    if (goalType === 'lose' && target >= currentWeight) {
      alertShownRef.current = true;
      Alert.alert(
        'Looks like a gain goal',
        `Your target (${target}kg) is higher than your current weight (${currentWeight}kg). Switch to Gain Muscle?`,
        [
          {
            text: 'Switch to Gain Muscle',
            onPress: () => {
              alertShownRef.current = false;
              setGoalWeight(String(defaultTargetRef.current));
              navigation.navigate('GoalType', { ...route.params, preSelectedGoal: 'gain' });
            },
          },
          {
            text: 'Reset',
            style: 'cancel',
            onPress: () => {
              alertShownRef.current = false;
              setGoalWeight(String(defaultTargetRef.current));
            },
          },
        ],
        { cancelable: false }
      );
      return;
    }

    if (goalType === 'gain' && target <= currentWeight) {
      alertShownRef.current = true;
      Alert.alert(
        'Looks like a lose goal',
        `Your target (${target}kg) is lower than your current weight (${currentWeight}kg). Switch to Lose Weight?`,
        [
          {
            text: 'Switch to Lose Weight',
            onPress: () => {
              alertShownRef.current = false;
              setGoalWeight(String(defaultTargetRef.current));
              navigation.navigate('GoalType', { ...route.params, preSelectedGoal: 'lose' });
            },
          },
          {
            text: 'Reset',
            style: 'cancel',
            onPress: () => {
              alertShownRef.current = false;
              setGoalWeight(String(defaultTargetRef.current));
            },
          },
        ],
        { cancelable: false }
      );
    }
  };

  const handleNext = () => {
    if (!goalWeight.trim()) return;
    // weeklyRate defaults to 0.5 — user can change pace via Edit Goal after onboarding
    const updatedData = { ...userData, goalWeight: parseFloat(goalWeight), targetRate: 0.5 };
    navigation.navigate('Summary', { userData: updatedData });
  };

  const isLowBMI = goalType === 'lose' && bmi < 18.5;

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
          {navigation.canGoBack() && (
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Text style={styles.backArrow}>←</Text>
            </TouchableOpacity>
          )}
          <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <Text style={styles.step}>Step 5 of 7</Text>
            <Text style={styles.title}>Target Settings</Text>
            <Text style={styles.subtitle}>Set your goal weight</Text>

            <Text style={styles.label}>Goal Weight (kg)</Text>
            <TextInput
              style={[styles.input, goalWeightFocused && styles.inputFocused]}
              placeholder="70"
              placeholderTextColor="#444"
              value={goalWeight}
              onChangeText={setGoalWeight}
              keyboardType="decimal-pad"
              returnKeyType="done"
              onSubmitEditing={() => Keyboard.dismiss()}
              onEndEditing={validateTargetWeight}
              onFocus={() => setGoalWeightFocused(true)}
              onBlur={() => { setGoalWeightFocused(false); validateTargetWeight(); }}
            />

            {isLowBMI ? (
              <Text style={styles.warnText}>
                ⚠️ Your BMI is already low ({bmi.toFixed(1)}). Losing more weight may not be healthy.
              </Text>
            ) : (
              <Text style={styles.recommendText}>
                💡 Recommended: {defaultTarget}kg based on your profile
              </Text>
            )}

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
  step:     { fontSize: 13, color: '#555', marginBottom: 6 },
  title:    { fontSize: 24, fontWeight: '700', color: '#FFFFFF', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 24 },
  label:    { fontSize: 13, color: '#888', marginBottom: 8 },
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
  inputFocused:  { borderColor: '#2ECC71' },
  warnText:      { color: '#FF6B6B', fontSize: 12, marginTop: 6 },
  recommendText: { color: '#2ECC71', fontSize: 12, marginTop: 6 },
  btn: {
    marginTop: 28,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#2ECC71',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.4 },
  btnText:     { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  backBtn:   { alignSelf: 'flex-start', marginBottom: 16, padding: 8, marginLeft: -8 },
  backArrow: { color: 'white', fontSize: 24 },
});

export default TargetSettingsScreen;

import React, { useState, useMemo, useRef, useEffect } from 'react';
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

const CurrentWeightScreen = ({ navigation, route }) => {
  const { userData } = route.params;
  const [weight, setWeight] = useState('');
  const [weightFocused, setWeightFocused] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  const bmi = useMemo(() => {
    if (weight && userData.height) {
      const heightInMeters = userData.height / 100;
      return (parseFloat(weight) / (heightInMeters * heightInMeters)).toFixed(1);
    }
    return null;
  }, [weight, userData.height]);

  const handleNext = () => {
    if (weight.trim()) {
      const updatedData = { ...userData, weight: parseFloat(weight) };
      navigation.navigate('GoalType', { userData: updatedData });
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
          {navigation.canGoBack() && (
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Text style={styles.backArrow}>←</Text>
            </TouchableOpacity>
          )}
          <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <Text style={styles.step}>Step 3 of 7</Text>
            <Text style={styles.title}>Current Weight</Text>
            <Text style={styles.subtitle}>We'll use this to track your progress</Text>

            <Text style={styles.label}>Weight (kg)</Text>
            <TextInput
              style={[styles.input, weightFocused && styles.inputFocused]}
              placeholder="75"
              placeholderTextColor="#444"
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
              returnKeyType="done"
              onSubmitEditing={handleNext}
              onFocus={() => setWeightFocused(true)}
              onBlur={() => setWeightFocused(false)}
            />

            {bmi && (
              <View style={styles.bmiCard}>
                <Text style={styles.bmiLabel}>Estimated BMI</Text>
                <Text style={styles.bmiValue}>{bmi}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.btn, !weight.trim() && styles.btnDisabled]}
              onPress={handleNext}
              disabled={!weight.trim()}
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
  bmiCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    alignItems: 'center',
  },
  bmiLabel: { fontSize: 13, color: '#666', marginBottom: 6 },
  bmiValue: { fontSize: 32, fontWeight: '700', color: '#2ECC71' },
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
  backBtn: { alignSelf: 'flex-start', marginBottom: 16, padding: 8, marginLeft: -8 },
  backArrow: { color: 'white', fontSize: 24 },
});

export default CurrentWeightScreen;

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  ScrollView,
} from 'react-native';

const GOALS = [
  { id: 'lose',     icon: '🔥', label: 'Lose Weight',  sub: 'Burn fat, feel lighter' },
  { id: 'maintain', icon: '⚖️', label: 'Maintain',      sub: 'Stay at your best' },
  { id: 'gain',     icon: '💪', label: 'Gain Muscle',   sub: 'Build strength & mass' },
];

const GoalTypeScreen = ({ navigation, route }) => {
  const { userData } = route.params;
  const preSelectedGoal = route.params?.preSelectedGoal;
  const [selectedGoal, setSelectedGoal] = useState(preSelectedGoal || null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  const handleNext = () => {
    if (!selectedGoal) return;
    if (selectedGoal === 'maintain') {
      navigation.navigate('Summary', {
        userData: {
          ...userData,
          goalType: 'maintain',
          goalWeight: userData.weight,
          targetRate: 0,
        },
      });
    } else {
      navigation.navigate('TargetSettings', {
        userData: { ...userData, goalType: selectedGoal },
      });
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
            <Text style={styles.step}>Step 4 of 7</Text>
            <Text style={styles.title}>What's Your Goal?</Text>
            <Text style={styles.subtitle}>Choose what you want to achieve</Text>

            {GOALS.map((goal) => {
              const active = selectedGoal === goal.id;
              return (
                <TouchableOpacity
                  key={goal.id}
                  style={[styles.optionCard, active && styles.optionCardActive]}
                  onPress={() => setSelectedGoal(goal.id)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.optionIcon}>{goal.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionLabel}>{goal.label}</Text>
                    <Text style={styles.optionSub}>{goal.sub}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={[styles.btn, !selectedGoal && styles.btnDisabled]}
              onPress={handleNext}
              disabled={!selectedGoal}
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
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 16,
  },
  optionCardActive: {
    borderColor: '#2ECC71',
    backgroundColor: 'rgba(46,204,113,0.08)',
  },
  optionIcon: { fontSize: 28 },
  optionLabel: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  optionSub: { fontSize: 13, color: '#666', marginTop: 4 },
  btn: {
    marginTop: 8,
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

export default GoalTypeScreen;

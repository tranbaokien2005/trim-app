import React, { useMemo, useRef, useEffect, useState } from 'react';
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
  Alert,
  ActivityIndicator,
} from 'react-native';
import { calcBMR, calcTDEE, calcDailyTarget, calcProjectedDate } from '../../utils/bmr';
import InfoSheet, { InfoDot } from '../../components/ui/InfoSheet';
import { useAuth } from '../../store/authStore';
import api from '../../services/api';

const SummaryScreen = ({ navigation, route }) => {
  const { userData } = route.params;
  const { completeOnboarding } = useAuth();
  const [loading, setLoading] = useState(false);
  const [infoKey, setInfoKey] = useState(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  const calculations = useMemo(() => {
    const dob = new Date(userData.dob);
    const today = new Date();
    const age = today.getFullYear() - dob.getFullYear() - (today < new Date(today.getFullYear(), dob.getMonth(), dob.getDate()) ? 1 : 0);
    const bmr = calcBMR(userData.weight, userData.height, age, userData.gender);
    const tdee = calcTDEE(bmr);
    const dailyTarget = calcDailyTarget(tdee, userData.goalType, userData.targetRate);
    const projectedDate = calcProjectedDate(userData.weight, userData.goalWeight, userData.targetRate);
    return { bmr, tdee, dailyTarget, projectedDate, age };
  }, [userData]);

  const handleNext = async () => {
    setLoading(true);
    try {
      await api.post('/users/me/complete-profile', {
        profile: {
          dateOfBirth: userData.dob,
          gender: userData.gender,
          height: userData.height,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
        weight: userData.weight,
        goal: {
          type: userData.goalType,
          targetWeight: userData.goalWeight,
          weeklyRate: userData.targetRate,
          startWeight: userData.weight,
        },
      });
      await completeOnboarding(true);
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to save your profile. Please try again.');
      setLoading(false);
    }
  };

  const isMaintain = userData.goalType === 'maintain';

  const summaryRows = [
    { label: 'Age', value: `${calculations.age} years` },
    { label: 'Weight', value: `${userData.weight} kg` },
    { label: isMaintain ? 'Maintain at' : 'Goal Weight', value: `${userData.goalWeight} kg` },
    ...(!isMaintain ? [{ label: 'Target Rate', value: `${userData.targetRate} kg/week` }] : []),
  ];

  const calcRows = [
    { label: 'BMR', value: `${calculations.bmr} kcal/day`, info: 'bmr' },
    { label: 'TDEE', value: `${calculations.tdee} kcal/day`, info: 'tdee' },
    { label: 'Daily Target', value: `${isMaintain ? calculations.tdee : calculations.dailyTarget} kcal/day` },
    ...(!isMaintain ? [{ label: 'Projected Date', value: calculations.projectedDate.toLocaleDateString() }] : []),
  ];

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
            <Text style={styles.step}>Step 6 of 7</Text>
            <Text style={styles.title}>Your Plan</Text>
            <Text style={styles.subtitle}>Here's what we calculated</Text>

            <View style={styles.summaryCard}>
              {summaryRows.map((row, i) => (
                <View key={row.label}>
                  <View style={styles.row}>
                    <Text style={styles.rowLabel}>{row.label}</Text>
                    <Text style={styles.rowValue}>{row.value}</Text>
                  </View>
                  {i < summaryRows.length - 1 && <View style={styles.divider} />}
                </View>
              ))}
            </View>

            {isMaintain ? (
              <View style={styles.tipsCard}>
                <Text style={styles.tipsTitle}>Tips to maintain your weight</Text>
                {[
                  { icon: '🥗', tip: 'Eat at your TDEE — not above, not below' },
                  { icon: '💧', tip: 'Stay hydrated — 2–3L water daily' },
                  { icon: '🏃', tip: 'Stay active — at least 30 min movement/day' },
                  { icon: '⚖️',  tip: 'Weigh yourself weekly, same time of day' },
                  { icon: '😴', tip: 'Sleep 7–9 hours — affects hunger hormones' },
                ].map((item, i) => (
                  <View key={i} style={styles.tipRow}>
                    <Text style={styles.tipIcon}>{item.icon}</Text>
                    <Text style={styles.tipText}>{item.tip}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.calcCard}>
                <Text style={styles.calcTitle}>Calculations</Text>
                {calcRows.map((row, i) => (
                  <View key={row.label}>
                    <View style={styles.row}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={styles.calcLabel}>{row.label}</Text>
                        {row.info && <InfoDot onPress={() => setInfoKey(row.info)} />}
                      </View>
                      <Text style={styles.calcValue}>{row.value}</Text>
                    </View>
                    {i < calcRows.length - 1 && <View style={styles.calcDivider} />}
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleNext}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#FFFFFF" />
                : <Text style={styles.btnText}>Let's Go</Text>
              }
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
        <InfoSheet visible={!!infoKey} infoKey={infoKey} onClose={() => setInfoKey(null)} />
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
  summaryCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 20,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
  rowLabel: { fontSize: 14, color: '#666' },
  rowValue: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  calcCard: {
    backgroundColor: 'rgba(46,204,113,0.06)',
    borderRadius: 16,
    padding: 20,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(46,204,113,0.15)',
  },
  calcTitle: { fontSize: 14, fontWeight: '700', color: '#2ECC71', marginBottom: 12 },
  calcLabel: { fontSize: 14, color: '#888' },
  calcValue: { fontSize: 14, fontWeight: '600', color: '#2ECC71' },
  calcDivider: { height: 1, backgroundColor: 'rgba(46,204,113,0.1)' },
  tipsCard: {
    backgroundColor: 'rgba(46,204,113,0.06)',
    borderRadius: 16,
    padding: 20,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(46,204,113,0.15)',
  },
  tipsTitle: { color: '#2ECC71', fontSize: 15, fontWeight: '700', marginBottom: 16 },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, gap: 12 },
  tipIcon: { fontSize: 18, width: 24 },
  tipText: { color: '#888', fontSize: 14, flex: 1, lineHeight: 20 },
  btn: {
    marginTop: 24,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#2ECC71',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  backBtn: { alignSelf: 'flex-start', marginBottom: 16, padding: 8, marginLeft: -8 },
  backArrow: { color: 'white', fontSize: 24 },
});

export default SummaryScreen;

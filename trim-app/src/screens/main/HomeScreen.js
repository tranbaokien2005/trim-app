import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Animated,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Circle } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../store/authStore';
import api, { getPatternToday } from '../../services/api';
import { formatDateYYYYMMDD } from '../../utils/dateUtils';
import SmartDayCard from '../../components/SmartDayCard';

// ─── helpers ────────────────────────────────────────────────────────────────

const getToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const MONTHS_LONG = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const formatDisplayDate = (dateStr) => {
  const d = new Date(dateStr + 'T00:00:00');
  return `${MONTHS_LONG[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};

const formatShortDate = (d) =>
  `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;

const getGreeting = () => {
  const hour = new Date().getHours();
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
};

const calcStreak = (createdAt) => {
  if (!createdAt) return 1;
  const ms = Date.now() - new Date(createdAt).getTime();
  return Math.max(1, Math.ceil(ms / 86400000));
};

const capitalizeName = (name) => {
  if (!name) return '';
  return name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
};

const getBMIInfo = (bmi) => {
  if (bmi < 18.5) return { color: '#64B5F6', label: 'Underweight' };
  if (bmi < 25)   return { color: '#2ECC71', label: 'Normal' };
  if (bmi < 30)   return { color: '#FFA726', label: 'Overweight' };
  return { color: '#EF5350', label: 'Obese' };
};

const goalLabel = (type) => {
  if (type === 'lose') return 'Lose Weight';
  if (type === 'gain') return 'Gain Muscle';
  return 'Maintain';
};

// ─── SVG: Calorie ring ───────────────────────────────────────────────────────

const CalorieRingSVG = ({ consumed, tdee, ringColor, deficitAbs, isSurplus, statusLabel }) => {
  const SIZE = 180;
  const SW = 14;
  const radius = (SIZE - SW) / 2;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = tdee > 0 ? Math.min(consumed / tdee, 1) : 0;
  const offset = circumference * (1 - progress);

  return (
    <View style={ringStyles.wrapper}>
      <Svg width={SIZE} height={SIZE}>
        <Circle
          cx={cx} cy={cy} r={radius}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={SW}
          fill="none"
        />
        <Circle
          cx={cx} cy={cy} r={radius}
          stroke={ringColor}
          strokeWidth={SW}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          rotation={-90}
          originX={cx}
          originY={cy}
        />
      </Svg>
      <View style={ringStyles.center}>
        <Text style={ringStyles.deficitNum}>{isSurplus ? '+' : ''}{deficitAbs}</Text>
        <Text style={[ringStyles.statusLabel, { color: ringColor }]}>{statusLabel}</Text>
      </View>
    </View>
  );
};

const ringStyles = StyleSheet.create({
  wrapper: { alignItems: 'center', justifyContent: 'center', marginVertical: 16 },
  center: {
    position: 'absolute',
    width: 180, height: 180,
    alignItems: 'center', justifyContent: 'center',
  },
  deficitNum:  { color: '#FFFFFF', fontSize: 36, fontWeight: '800' },
  statusLabel: { fontSize: 13, fontWeight: '600', marginTop: 4 },
});

// ─── SVG: Goal ring ──────────────────────────────────────────────────────────

const GoalRingSVG = ({ pct }) => {
  const SIZE = 56;
  const SW = 5;
  const radius = (SIZE - SW) / 2;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(Math.max(pct, 0), 100) / 100;
  const offset = circumference * (1 - progress);

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={SIZE} height={SIZE}>
        <Circle
          cx={cx} cy={cy} r={radius}
          stroke="rgba(46,204,113,0.15)"
          strokeWidth={SW}
          fill="none"
        />
        <Circle
          cx={cx} cy={cy} r={radius}
          stroke="#2ECC71"
          strokeWidth={SW}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          rotation={-90}
          originX={cx}
          originY={cy}
        />
      </Svg>
      <View style={{ position: 'absolute', width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#2ECC71', fontSize: 12, fontWeight: '700' }}>{Math.round(pct)}%</Text>
      </View>
    </View>
  );
};

// ─── Macro data ──────────────────────────────────────────────────────────────

const MACRO_DEFS = [
  { key: 'protein', letter: 'P', accent: '#4FC3F7', barBg: 'rgba(79,195,247,0.15)',  barFill: 'rgba(79,195,247,0.6)',  maxVal: 150 },
  { key: 'carbs',   letter: 'C', accent: '#FFB74D', barBg: 'rgba(255,183,77,0.15)',  barFill: 'rgba(255,183,77,0.6)',  maxVal: 250 },
  { key: 'fat',     letter: 'F', accent: '#CE93D8', barBg: 'rgba(206,147,216,0.15)', barFill: 'rgba(206,147,216,0.6)', maxVal: 65  },
];

// ─── Smart goal default ──────────────────────────────────────────────────────

const getSmartDefault = (goalType, weight, height) => {
  const bmi = weight / Math.pow(height / 100, 2);
  if (goalType === 'lose') {
    if (bmi < 18.5) return { weight, warn: true };
    if (bmi > 25) return { weight: Math.round(22 * Math.pow(height / 100, 2)), warn: false };
    return { weight: Math.round(weight * 0.95), warn: false };
  }
  if (goalType === 'gain') {
    const tenPercent = Math.round(weight * 1.10);
    const bmi27cap   = Math.round(27 * Math.pow(height / 100, 2));
    return { weight: Math.min(tenPercent, bmi27cap), warn: false };
  }
  return { weight, warn: false };
};

// ─── Pace presets ────────────────────────────────────────────────────────────

const PACE_PRESETS = [
  { rate: 0.25, emoji: '🐢', label: 'Slow',       sub: '~275 cal/day' },
  { rate: 0.5,  emoji: '✅', label: 'Normal',     sub: '~550 cal/day' },
  { rate: 1.0,  emoji: '🔥', label: 'Aggressive', sub: '~1100 cal/day' },
];

// ─── Zone panel ──────────────────────────────────────────────────────────────

const ZONE_RANGES = {
  0.25: { okLow: 200,  okHigh: 350  },
  0.5:  { okLow: 450,  okHigh: 650  },
  1.0:  { okLow: 900,  okHigh: 1200 },
};

const ZonePanel = ({ weeklyRate, actualDeficit, targetDeficit, onChangePace }) => {
  const targetDef = Math.round(targetDeficit || 0);
  const zones = ZONE_RANGES[weeklyRate] || {
    okLow:  Math.round(targetDef * 0.82),
    okHigh: Math.round(targetDef * 1.2),
  };
  const maxDef     = Math.round(zones.okHigh * 1.5);
  const dotPct     = Math.min(Math.max(actualDeficit / maxDef, 0), 0.97);
  const redFlex    = zones.okLow;
  const greenFlex  = zones.okHigh - zones.okLow;
  const orangeFlex = maxDef - zones.okHigh;

  return (
    <View>
      <Text style={zpStyles.sectionLabel}>PACE ZONE</Text>

      <View style={zpStyles.paceRow}>
        {PACE_PRESETS.map(preset => {
          const sel = preset.rate === weeklyRate;
          return (
            <TouchableOpacity
              key={preset.rate}
              style={[zpStyles.paceCard, sel && zpStyles.paceCardSelected]}
              onPress={() => onChangePace(preset.rate)}
              activeOpacity={0.8}
            >
              <Text style={[zpStyles.paceCardLabel, sel && { color: '#2ECC71' }]}>
                {preset.emoji} {preset.label}
              </Text>
              <Text style={zpStyles.paceCardSub}>{preset.sub}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={zpStyles.barWrapper}>
        <View style={zpStyles.track}>
          <View style={{ flex: redFlex,    backgroundColor: '#E74C3C' }} />
          <View style={{ flex: greenFlex,  backgroundColor: '#2ECC71' }} />
          <View style={{ flex: orangeFlex, backgroundColor: '#FF9500' }} />
        </View>
        <View style={[zpStyles.dot, { left: `${dotPct * 100}%` }]} />
      </View>

      <Text style={zpStyles.deficitLabel}>
        Today's deficit: {Math.max(actualDeficit, 0)} cal  ·  Goal: ~{targetDef} cal/day
      </Text>
    </View>
  );
};

const zpStyles = StyleSheet.create({
  sectionLabel: { fontSize: 10, color: '#555', letterSpacing: 1, marginTop: 12, marginBottom: 8 },
  paceRow:      { flexDirection: 'row', gap: 8 },
  paceCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  paceCardSelected: { borderColor: '#2ECC71' },
  paceCardLabel:    { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  paceCardSub:      { color: '#666', fontSize: 11, marginTop: 3 },
  barWrapper: { position: 'relative', marginTop: 12, marginBottom: 4 },
  track: {
    height: 8,
    borderRadius: 6,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  dot: {
    position: 'absolute',
    top: -3,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
    marginLeft: -7,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  deficitLabel: { color: '#666', fontSize: 12, marginTop: 8 },
});

// ─── HomeScreen ──────────────────────────────────────────────────────────────

const HomeScreen = ({ navigation }) => {
  const { user, showWelcome, clearWelcome } = useAuth();
  const scaleAnim   = useRef(new Animated.Value(0.85)).current;
  const warningAnim = useRef(new Animated.Value(0)).current;
  const zoneBarAnim = useRef(new Animated.Value(0)).current;
  const hintRef     = useRef(null);
  const [stats, setStats] = useState(null);
  const [showZoneBar,  setShowZoneBar]  = useState(false);
  const [showZoneHint, setShowZoneHint] = useState(false);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showChangeGoal, setShowChangeGoal] = useState(false);
  const [switchingToMaintain, setSwitchingToMaintain] = useState(false);
  const [newGoalType, setNewGoalType] = useState('lose');
  const [newTargetWeight, setNewTargetWeight] = useState('');
  const [newWeeklyRate, setNewWeeklyRate] = useState(0.5);
  const [savingGoal, setSavingGoal] = useState(false);
  const [goalError, setGoalError] = useState('');
  const [pattern, setPattern] = useState(null);
  const [patternLoading, setPatternLoading] = useState(false);
  const [patternDismissed, setPatternDismissed] = useState(false);

  const load = useCallback((isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    const today = getToday();
    return Promise.all([
      api.get(`/stats/daily?date=${today}`),
      api.get('/users/me'),
    ])
      .then(([statsRes, profileRes]) => {
        setStats(statsRes.data);
        setProfile(profileRes.data.user);
      })
      .catch(() => {})
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, []);

  const loadPattern = useCallback(async () => {
    try {
      // Skip if the user already dismissed the card today
      const today = formatDateYYYYMMDD(new Date());
      const dismissed = await AsyncStorage.getItem(`smartCardDismissed:${today}`);
      if (dismissed === 'true') {
        setPatternDismissed(true);
        return;
      }
      setPatternLoading(true);
      const res = await getPatternToday();
      if (res.success && res.data.pattern) {
        setPattern(res.data.pattern);
      } else {
        setPattern(null);
      }
    } catch (e) {
      console.warn('Pattern load failed:', e);
      setPattern(null);
    } finally {
      setPatternLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); loadPattern(); }, [load, loadPattern]));

  useEffect(() => {
    if (showWelcome) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }).start();
    } else {
      scaleAnim.setValue(0.85);
    }
  }, [showWelcome]);

  useEffect(() => {
    if (showWarning) {
      warningAnim.setValue(0);
      Animated.timing(warningAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    }
  }, [showWarning, warningAnim]);

  useEffect(() => {
    AsyncStorage.getItem('showZoneBar').then(v => {
      if (v === 'true') setShowZoneBar(true);
    });
    return () => { if (hintRef.current) clearTimeout(hintRef.current); };
  }, []);

  useEffect(() => {
    Animated.timing(zoneBarAnim, {
      toValue: showZoneBar ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [showZoneBar, zoneBarAnim]);

  useEffect(() => {
    if (!showChangeGoal) return;
    const ag = profile?.goals?.find(g => g.isActive);
    const currentType = ag?.type || 'lose';
    const cw = profile?.currentStats?.weight || 0;
    const h  = profile?.profile?.height || 170;
    setNewGoalType(currentType);
    if (currentType !== 'maintain') {
      const smart = getSmartDefault(currentType, cw, h);
      setNewTargetWeight(String(smart.weight));
    } else {
      setNewTargetWeight(String(cw));
    }
    setGoalError('');
  }, [showChangeGoal]); // eslint-disable-line react-hooks/exhaustive-deps

  const onRefresh = () => { setRefreshing(true); load(true); };

  // ── derived values ──────────────────────────────────────────────────────────
  const consumed     = stats?.caloriesConsumed || 0;
  const loggedBurned = stats?.caloriesBurned   || 0;

  // Tất cả lấy từ backend — KHÔNG tính lại trên máy.
  const bmr      = stats?.bmr   || 0;
  const tdee     = stats?.tdee  || 0;
  const baseline = Math.max(0, tdee - bmr - loggedBurned);
  const target   = stats?.dailyTarget ?? tdee;

  const activeGoal = profile?.goals?.find(g => g.isActive);
  const goalType   = stats?.goalType   || activeGoal?.type || 'lose';
  const weeklyRate = stats?.weeklyRate ?? (activeGoal?.weeklyRate || 0);

  // Mức deficit mục tiêu/ngày, suy từ số backend trả về (không dùng hằng số calo/kg).
  const targetDeficit = Math.abs(tdee - target);

  const actualDeficit = stats?.deficit ?? (tdee - consumed);
  const deficitAbs    = Math.abs(actualDeficit);
  const isSurplus     = consumed > tdee;

  let ringColor, statusLabel;
  if (consumed < target * 0.6) {
    ringColor = '#FF9500'; statusLabel = 'Eating too little';
  } else if (consumed < target * 0.85) {
    ringColor = '#F1C40F'; statusLabel = 'Under goal';
  } else if (consumed <= target * 1.15) {
    ringColor = '#2ECC71'; statusLabel = 'On track';
  } else {
    ringColor = '#E74C3C'; statusLabel = 'Over budget';
  }

  const hour        = new Date().getHours();
  const showWarning = hour >= 18 && consumed < target * 0.6;

  const macros = (stats?.meals || []).reduce(
    (acc, m) => ({
      protein: acc.protein + (m.totals?.protein || 0),
      carbs:   acc.carbs   + (m.totals?.carbs   || 0),
      fat:     acc.fat     + (m.totals?.fat     || 0),
    }),
    { protein: 0, carbs: 0, fat: 0 }
  );

  const currentWeight = profile?.currentStats?.weight;
  const bmi           = profile?.currentStats?.bmi;
  const startWeight   = activeGoal?.startWeight;
  const targetWeight  = activeGoal?.targetWeight;

  // Goal progress %
  let goalPct = 0;
  if (currentWeight && startWeight && targetWeight && startWeight !== targetWeight) {
    if (activeGoal?.type === 'lose') {
      goalPct = ((startWeight - currentWeight) / (startWeight - targetWeight)) * 100;
    } else if (activeGoal?.type === 'gain') {
      goalPct = ((currentWeight - startWeight) / (targetWeight - startWeight)) * 100;
    }
    goalPct = Math.min(Math.max(goalPct, 0), 100);
  }

  // Projected date
  let projectedStr = '—';
  if (activeGoal?.weeklyRate && currentWeight && targetWeight) {
    const weightDiff = Math.abs(targetWeight - currentWeight);
    const weeks = weightDiff / activeGoal.weeklyRate;
    const proj  = new Date();
    proj.setDate(proj.getDate() + Math.round(weeks * 7));
    projectedStr = formatShortDate(proj);
  }

  // Streak
  const streak = calcStreak(profile?.createdAt);

  // Weight change from start
  let weightChange = null;
  if (startWeight != null && currentWeight != null && startWeight !== currentWeight) {
    weightChange = {
      val:  Math.abs(startWeight - currentWeight).toFixed(1),
      lost: currentWeight < startWeight,
    };
  }

  const nothingLogged = consumed === 0 && loggedBurned === 0;

  // Goal completion flags
  const goalReached = currentWeight != null && targetWeight != null && (
    (goalType === 'lose'     && currentWeight <= targetWeight) ||
    (goalType === 'gain'     && currentWeight >= targetWeight) ||
    (goalType === 'maintain' && Math.abs(currentWeight - targetWeight) <= 0.5)
  );
  const remaining   = currentWeight != null && targetWeight != null ? Math.abs(currentWeight - targetWeight) : 0;
  const almostThere = !goalReached && remaining > 0 && remaining <= 1;

  const openChangeGoal = () => {
    const ag = profile?.goals?.find(g => g.isActive);
    setNewWeeklyRate(ag?.weeklyRate || 0.5);
    setShowChangeGoal(true);
  };

  const toggleZoneBar = () => {
    const next = !showZoneBar;
    setShowZoneBar(next);
    AsyncStorage.setItem('showZoneBar', String(next));
  };

  const handleChangePace = async (rate) => {
    if (rate === weeklyRate || !activeGoal) return;
    try {
      await api.put('/users/me/goal', {
        type: activeGoal.type,
        targetWeight: activeGoal.targetWeight,
        weeklyRate: rate,
        startWeight: activeGoal.startWeight,
      });
      load();
    } catch {
      // silent fail
    }
  };

  const handleSaveGoal = async () => {
    setGoalError('');
    if (newGoalType !== 'maintain') {
      const tw = parseFloat(newTargetWeight);
      if (isNaN(tw) || tw <= 0) {
        setGoalError('Please enter a valid target weight');
        return;
      }
      if (newGoalType === 'lose' && tw >= currentWeight) {
        setGoalError(`Target must be less than current weight (${currentWeight}kg)`);
        return;
      }
      if (newGoalType === 'gain' && tw <= currentWeight) {
        setGoalError(`Target must be more than current weight (${currentWeight}kg)`);
        return;
      }
    }
    setSavingGoal(true);
    try {
      await api.put('/users/me/goal', {
        type: newGoalType,
        targetWeight: newGoalType === 'maintain' ? currentWeight : parseFloat(newTargetWeight),
        weeklyRate: newGoalType === 'maintain' ? 0 : newWeeklyRate,
        startWeight: currentWeight,
      });
      setShowChangeGoal(false);
      load();
    } catch (err) {
      setGoalError('Something went wrong. Please try again.');
    } finally {
      setSavingGoal(false);
    }
  };

  const handleGoalTypeSelect = (type) => {
    setNewGoalType(type);
    const h = profile?.profile?.height || 170;
    if (type !== 'maintain') {
      const smart = getSmartDefault(type, currentWeight || 0, h);
      setNewTargetWeight(String(smart.weight));
      setGoalError(smart.warn ? '⚠️ Your BMI is already low. Losing more weight may not be healthy.' : '');
    } else {
      setNewTargetWeight(String(currentWeight || 0));
      setGoalError('');
    }
  };

  const handleSwitchToMaintain = async () => {
    setSwitchingToMaintain(true);
    try {
      await api.put('/users/me/goal', {
        type: 'maintain',
        targetWeight: currentWeight,
        weeklyRate: 0,
        startWeight: currentWeight,
      });
      load();
      Alert.alert('', 'Switched to Maintain ✓');
    } catch {
      Alert.alert('Error', 'Could not switch goal. Please try again.');
    } finally {
      setSwitchingToMaintain(false);
    }
  };

  // Sheet projected date (live-updates with pace/weight changes in Edit Goal)
  let sheetProjectedStr = '';
  if (newGoalType !== 'maintain' && newWeeklyRate > 0) {
    const tw = parseFloat(newTargetWeight);
    if (!isNaN(tw) && currentWeight) {
      const weightDiff  = Math.abs(tw - currentWeight);
      const weeksRaw    = weightDiff / newWeeklyRate;
      const weeksNum    = Math.max(1, Math.round(weeksRaw));
      const proj        = new Date();
      proj.setDate(proj.getDate() + weeksNum * 7);
      sheetProjectedStr = `Estimated: ${formatShortDate(proj)} · ${weeksNum} week${weeksNum !== 1 ? 's' : ''} away`;
    }
  }

  // ── loading state ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#2ECC71" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2ECC71" />
        }
      >
        {/* ── Section 1: Header ─────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greetingText}>{getGreeting()},</Text>
            <Text style={styles.nameText}>{capitalizeName(profile?.name || user?.name) || 'there'}</Text>
            <Text style={styles.dateText}>{formatDisplayDate(getToday())}</Text>
          </View>
          <View style={styles.streakBadge}>
            <Text style={styles.streakText}>🔥 Day {streak}</Text>
          </View>
        </View>

        {/* ── Smart Day Card (Tier 1) ───────────────────────────────── */}
        {pattern && !patternDismissed && (
          <SmartDayCard
            pattern={pattern}
            onApplied={() => { setPattern(null); load(); }}
            onHidden={() => { setPattern(null); setPatternDismissed(true); }}
          />
        )}

        {/* ── Section 2: Calorie Ring Card ──────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardLabel}>CALORIES</Text>
            <Text style={styles.cardSubLabel}>Today</Text>
          </View>

          <CalorieRingSVG
            consumed={consumed}
            tdee={tdee}
            ringColor={ringColor}
            deficitAbs={deficitAbs}
            isSurplus={isSurplus}
            statusLabel={statusLabel}
          />

          <View style={styles.calorieRow}>
            <View style={styles.calItem}>
              <Text style={styles.calValue}>{consumed}</Text>
              <Text style={styles.calLabel}>Consumed</Text>
            </View>
            <View style={[styles.calItem, styles.calItemMiddle]}>
              <Text style={styles.calValue}>{tdee}</Text>
              <Text style={styles.calLabel}>TDEE</Text>
            </View>
            <View style={styles.calItem}>
              <Text style={[styles.calValue, { color: ringColor }]}>{deficitAbs}</Text>
              <Text style={styles.calLabel}>Deficit</Text>
            </View>
          </View>

          <View style={styles.progressBarContainer}>
            <View style={styles.progressBarTrack}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: consumed >= target
                      ? '100%'
                      : target > 0 ? `${(consumed / target) * 100}%` : '0%',
                    backgroundColor: consumed >= target ? '#E74C3C' : ringColor,
                  },
                ]}
              />
            </View>
            <Text style={styles.progressBarLabel}>{consumed} / {target} cal</Text>
          </View>

          <View style={styles.pacePillRow}>
            <TouchableOpacity
              style={[styles.pacePill, showZoneBar && styles.pacePillActive]}
              onPress={toggleZoneBar}
            >
              <Text style={[styles.pacePillText, showZoneBar && styles.pacePillTextActive]}>
                ⚡ Pace
              </Text>
            </TouchableOpacity>
          </View>

          {showZoneBar && (
            <Animated.View style={{ opacity: zoneBarAnim }}>
              <ZonePanel
                weeklyRate={weeklyRate}
                actualDeficit={actualDeficit}
                targetDeficit={targetDeficit}
                onChangePace={handleChangePace}
              />
            </Animated.View>
          )}
        </View>

        {/* ── Warning Banner ────────────────────────────────────────────── */}
        {showWarning && (
          <Animated.View style={[styles.warningBanner, { opacity: warningAnim }]}>
            <Text style={{ fontSize: 16 }}>⚠️</Text>
            <Text style={styles.warningText}>
              You're under your calorie goal — eating too little can slow your progress.
            </Text>
          </Animated.View>
        )}

        {/* ── Section 3: Macro Cards ────────────────────────────────────── */}
        <View style={styles.macroRow}>
          {MACRO_DEFS.map((m) => {
            const value = macros[m.key] || 0;
            const pct   = m.maxVal > 0 ? Math.min(value / m.maxVal, 1) : 0;
            return (
              <View key={m.key} style={styles.macroCard}>
                <View style={styles.macroHeader}>
                  <View style={[styles.macroDot, { backgroundColor: m.accent }]} />
                  <Text style={[styles.macroLetter, { color: m.accent }]}>{m.letter}</Text>
                </View>
                <Text style={styles.macroValue}>
                  {Math.round(value)}
                  <Text style={styles.macroUnit}>g</Text>
                </Text>
                <View style={[styles.macroBarBg, { backgroundColor: m.barBg }]}>
                  <View
                    style={[
                      styles.macroBarFill,
                      { width: `${Math.round(pct * 100)}%`, backgroundColor: m.barFill },
                    ]}
                  />
                </View>
              </View>
            );
          })}
        </View>

        {/* ── Section 4: Goal Card ──────────────────────────────────────── */}
        {activeGoal && (
          goalReached ? (
            /* ── Goal Complete Card ── */
            <View style={styles.goalCard}>
              <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700' }}>🎉 Goal Reached!</Text>
              <Text style={{ color: '#888', fontSize: 13, marginTop: 4 }}>
                {startWeight}kg → {targetWeight}kg · {goalLabel(activeGoal.type)}
              </Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <TouchableOpacity
                  style={styles.goalCompleteSecondary}
                  onPress={openChangeGoal}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '600' }}>Set New Goal</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.goalCompletePrimary, switchingToMaintain && { opacity: 0.6 }]}
                  onPress={handleSwitchToMaintain}
                  disabled={switchingToMaintain}
                >
                  <Text style={{ color: '#0F0F0F', fontSize: 14, fontWeight: '600' }}>
                    {switchingToMaintain ? 'Saving…' : 'Switch to Maintain'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* ── Normal Goal Card ── */
            <View style={styles.goalCard}>
              {/* Row 1: pill + circle */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <View style={styles.goalPill}>
                  <Text style={styles.goalPillText}>{goalLabel(activeGoal.type)}</Text>
                </View>
                <GoalRingSVG pct={goalPct} />
              </View>

              {/* Row 2: weight */}
              {currentWeight != null && targetWeight != null && (
                <Text style={styles.goalWeightText}>{currentWeight}kg → {targetWeight}kg</Text>
              )}

              {/* Row 3: date + edit */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                <Text style={styles.goalDateText}>Est. {projectedStr}</Text>
                <TouchableOpacity onPress={openChangeGoal}>
                  <Text style={{ color: '#555', fontSize: 12, fontWeight: '400' }}>Edit goal</Text>
                </TouchableOpacity>
              </View>

              {/* Almost-there strip */}
              {almostThere && (
                <>
                  <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 12 }} />
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
                    <Text style={{ fontSize: 14 }}>💡</Text>
                    <Text style={{ color: '#FFA726', fontSize: 12 }}>
                      Almost there! {remaining.toFixed(1)}kg to go
                    </Text>
                  </View>
                </>
              )}
            </View>
          )
        )}

        {/* ── Section 5: Activity & Weight Row ─────────────────────────── */}
        <View style={styles.twoColRow}>
          {/* Activity */}
          <View style={[styles.card, styles.halfCard]}>
            <Text style={styles.miniLabel}>ACTIVITY</Text>
            <View style={styles.miniRow}>
              <Text style={styles.miniMeta}>BMR</Text>
              <Text style={styles.miniValue}>{bmr}</Text>
            </View>
            <View style={styles.miniRow}>
              <Text style={styles.miniMeta}>Baseline</Text>
              <Text style={styles.miniValue}>{baseline}</Text>
            </View>
            <View style={styles.miniRow}>
              <Text style={styles.miniMeta}>Burned</Text>
              <Text style={styles.miniValue}>{loggedBurned}</Text>
            </View>
            <View style={styles.miniDivider} />
            <View style={[styles.miniRow, { marginBottom: 0 }]}>
              <Text style={[styles.miniMeta, { color: '#2ECC71', fontWeight: '600' }]}>TDEE</Text>
              <Text style={[styles.miniValue, { color: '#2ECC71', fontSize: 16, fontWeight: '700' }]}>{tdee}</Text>
            </View>
          </View>

          {/* Weight */}
          <View style={[styles.card, styles.halfCard]}>
            <Text style={styles.miniLabel}>WEIGHT</Text>
            {currentWeight != null ? (
              <>
                <Text style={styles.weightValue}>
                  {currentWeight}
                  <Text style={styles.weightUnit}> kg</Text>
                </Text>
                {bmi ? (
                  <Text style={{ color: getBMIInfo(bmi).color, fontSize: 12, marginTop: 4, fontWeight: '600' }}>
                    BMI {bmi} · {getBMIInfo(bmi).label}
                  </Text>
                ) : null}
                {weightChange && (
                  <Text style={[styles.weightChange, { color: weightChange.lost ? '#2ECC71' : '#FF6B6B' }]}>
                    {weightChange.lost ? '↓' : '↑'} {weightChange.val}kg
                  </Text>
                )}
              </>
            ) : (
              <>
                <Text style={styles.notLoggedText}>Not logged</Text>
                <TouchableOpacity onPress={() => navigation.navigate('Log', { initialTab: 'weight' })}>
                  <Text style={styles.logNowText}>Log now</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* ── Section 6: Day 1 Banner ───────────────────────────────────── */}
        {nothingLogged && (
          <TouchableOpacity
            style={styles.bannerCard}
            onPress={() => navigation.navigate('Log')}
            activeOpacity={0.8}
          >
            <Text style={styles.bannerText}>📝  Day 1 · Start tracking your first meal</Text>
            <Text style={styles.bannerCta}>Log →</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* ── Change Goal Bottom Sheet ──────────────────────────────────────── */}
      <Modal
        visible={showChangeGoal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowChangeGoal(false)}
      >
        <TouchableOpacity
          style={styles.sheetOverlay}
          activeOpacity={1}
          onPress={() => setShowChangeGoal(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ width: '100%' }}
          >
          <TouchableOpacity activeOpacity={1} style={styles.bottomSheet}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Change Goal</Text>
              <TouchableOpacity onPress={() => setShowChangeGoal(false)}>
                <Text style={{ color: '#666', fontSize: 14 }}>Cancel</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sheetLabel}>Goal Type</Text>
            {[
              { value: 'lose',     label: 'Lose Weight', icon: '🔥' },
              { value: 'maintain', label: 'Maintain',    icon: '⚖️' },
              { value: 'gain',     label: 'Gain Muscle', icon: '💪' },
            ].map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.goalOption, newGoalType === opt.value && styles.goalOptionSelected]}
                onPress={() => handleGoalTypeSelect(opt.value)}
              >
                <Text style={{ fontSize: 18 }}>{opt.icon}</Text>
                <Text style={[styles.goalOptionText, newGoalType === opt.value && { color: '#2ECC71' }]}>
                  {opt.label}
                </Text>
                {newGoalType === opt.value && (
                  <Text style={{ color: '#2ECC71', marginLeft: 'auto' }}>✓</Text>
                )}
              </TouchableOpacity>
            ))}

            {newGoalType !== 'maintain' && (
              <>
                <Text style={[styles.sheetLabel, { marginTop: 16 }]}>Target Weight (kg)</Text>
                <TextInput
                  style={styles.sheetInput}
                  value={newTargetWeight}
                  onChangeText={setNewTargetWeight}
                  keyboardType="numeric"
                  placeholder={newGoalType === 'lose' ? `Less than ${currentWeight}kg` : `More than ${currentWeight}kg`}
                  placeholderTextColor="#444"
                />
                {newTargetWeight ? (
                  <Text style={styles.recommendText}>💡 Recommended based on your profile</Text>
                ) : null}
                <Text style={[styles.sheetLabel, { marginTop: 16 }]}>Pace</Text>
                <View style={styles.sheetPaceRow}>
                  {PACE_PRESETS.map(preset => (
                    <TouchableOpacity
                      key={preset.rate}
                      style={[styles.sheetPaceCard, newWeeklyRate === preset.rate && styles.sheetPaceCardSelected]}
                      onPress={() => setNewWeeklyRate(preset.rate)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.sheetPaceEmoji}>{preset.emoji}</Text>
                      <Text style={[styles.sheetPaceLabel, newWeeklyRate === preset.rate && { color: '#2ECC71' }]}>
                        {preset.label}
                      </Text>
                      <Text style={styles.sheetPaceSub}>{preset.sub}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {sheetProjectedStr ? (
                  <Text style={styles.sheetProjectedDate}>{sheetProjectedStr}</Text>
                ) : null}
              </>
            )}

            {newGoalType === 'maintain' && (
              <View style={styles.maintainInfo}>
                <Text style={styles.maintainText}>
                  Your daily target will equal your TDEE.{'\n'}Stay consistent and log daily.
                </Text>
              </View>
            )}

            {goalError ? <Text style={styles.goalErrorText}>{goalError}</Text> : null}

            <TouchableOpacity
              style={[styles.saveGoalBtn, savingGoal && { opacity: 0.6 }]}
              onPress={handleSaveGoal}
              disabled={savingGoal}
            >
              <Text style={styles.saveGoalBtnText}>{savingGoal ? 'Saving...' : 'Save Goal'}</Text>
            </TouchableOpacity>
            </ScrollView>
          </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      {/* ── Welcome Modal ─────────────────────────────────────────────────── */}
      <Modal
        visible={showWelcome}
        transparent
        animationType="fade"
        onRequestClose={clearWelcome}
      >
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.modalCard, { transform: [{ scale: scaleAnim }] }]}>
            <Text style={styles.modalEmoji}>🎉</Text>
            <Text style={styles.modalTitle}>Welcome to Trim!</Text>
            <Text style={styles.modalBody}>
              Your plan is all set. Start logging meals and tracking progress toward your goal.
            </Text>
            <TouchableOpacity style={styles.modalBtn} onPress={clearWelcome} activeOpacity={0.85}>
              <Text style={styles.modalBtnText}>Let's Go!</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  scroll:    { paddingHorizontal: 20, paddingBottom: 100, paddingTop: 16 },

  // Header
  header:       { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 24 },
  greetingText: { color: '#888', fontSize: 14 },
  nameText:     { color: '#FFFFFF', fontSize: 26, fontWeight: '800', marginTop: 2 },
  dateText:     { color: '#555', fontSize: 13, marginTop: 4 },
  streakBadge: {
    backgroundColor: 'rgba(255,140,0,0.12)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,140,0,0.2)',
  },
  streakText: { color: '#FF8C00', fontWeight: '700', fontSize: 14 },

  // Base card
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 24,
    marginBottom: 12,
  },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardLabel:     { color: '#666', fontSize: 12, fontWeight: '600', letterSpacing: 1 },
  cardSubLabel:  { color: '#555', fontSize: 12 },

  // Calorie bottom row + progress bar
  calorieRow:    { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 4 },
  progressBarContainer: { marginTop: 14 },
  progressBarTrack: {
    height: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  progressBarFill: { height: 8, borderRadius: 6 },
  progressBarLabel: { color: '#666', fontSize: 11, textAlign: 'right', marginTop: 5 },

  // Warning banner
  warningBanner: {
    backgroundColor: 'rgba(255,149,0,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,149,0,0.3)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  warningText: { color: '#FFB74D', fontSize: 13, flex: 1, lineHeight: 18 },
  calItem:       { flex: 1, alignItems: 'center' },
  calItemMiddle: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  calValue:      { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  calLabel:      { color: '#666', fontSize: 12, marginTop: 2 },

  // Macros
  macroRow:  { flexDirection: 'row', gap: 8, marginBottom: 12 },
  macroCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  macroHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  macroDot:    { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
  macroLetter: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  macroValue:  { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  macroUnit:   { color: '#555', fontSize: 13, fontWeight: '400' },
  macroBarBg:  { height: 3, borderRadius: 2, marginTop: 10, overflow: 'hidden' },
  macroBarFill:{ height: 3, borderRadius: 2 },

  // Goal
  goalCard: {
    backgroundColor: 'rgba(46,204,113,0.06)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(46,204,113,0.12)',
  },
  goalCompleteSecondary: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    paddingVertical: 10,
    alignItems: 'center',
  },
  goalCompletePrimary: {
    flex: 1,
    backgroundColor: '#2ECC71',
    borderRadius: 20,
    paddingVertical: 10,
    alignItems: 'center',
  },
  goalPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(46,204,113,0.15)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(46,204,113,0.3)',
  },
  goalPillText: { color: '#2ECC71', fontSize: 12, fontWeight: '600' },
  goalWeightText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  goalDateText:   { color: '#666', fontSize: 13 },

  // Two-column row
  twoColRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  halfCard:  { flex: 1, padding: 16 },

  // Activity/Weight shared
  miniLabel:   { color: '#666', fontSize: 11, fontWeight: '600', letterSpacing: 0.8, marginBottom: 12 },
  miniRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  miniValue:   { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  miniMeta:    { color: '#666', fontSize: 12 },
  miniDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 6 },

  // Weight card specifics
  weightValue:    { color: '#FFFFFF', fontSize: 24, fontWeight: '800' },
  weightUnit:     { color: '#666', fontSize: 14, fontWeight: '400' },
  weightChange:   { fontSize: 13, marginTop: 4, fontWeight: '600' },
  notLoggedText:  { color: '#555', fontSize: 14 },
  logNowText:     { color: '#2ECC71', fontSize: 12, marginTop: 4 },

  // Day 1 banner
  bannerCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bannerText: { color: '#888', fontSize: 14, flex: 1 },
  bannerCta:  { color: '#2ECC71', fontWeight: '600', marginLeft: 8 },

  // Welcome modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#1A1A1A',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(46,204,113,0.2)',
  },
  modalEmoji:   { fontSize: 52, marginBottom: 16 },
  modalTitle:   { fontSize: 24, fontWeight: '700', color: '#FFFFFF', marginBottom: 12, textAlign: 'center' },
  modalBody:    { fontSize: 15, color: '#888', textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  modalBtn:     { width: '100%', height: 52, borderRadius: 12, backgroundColor: '#2ECC71', alignItems: 'center', justifyContent: 'center' },
  modalBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  // Change Goal bottom sheet
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sheetTitle:  { color: 'white', fontSize: 18, fontWeight: '700' },
  sheetLabel:  { color: '#888', fontSize: 13, marginBottom: 8 },
  goalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginBottom: 8,
  },
  goalOptionSelected: {
    borderColor: '#2ECC71',
    backgroundColor: 'rgba(46,204,113,0.08)',
  },
  goalOptionText: { color: 'white', fontSize: 15, fontWeight: '600' },
  sheetInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: 'white',
    fontSize: 15,
  },
  sheetPaceRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  sheetPaceCard: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sheetPaceCardSelected: {
    borderColor: '#2ECC71',
    backgroundColor: 'rgba(46,204,113,0.08)',
  },
  sheetPaceEmoji: { fontSize: 22, marginBottom: 4 },
  sheetPaceLabel: { color: 'white', fontSize: 13, fontWeight: '600' },
  sheetPaceSub:   { color: '#666', fontSize: 11, marginTop: 2 },
  sheetProjectedDate: { color: '#2ECC71', fontSize: 12, textAlign: 'center', marginBottom: 4 },
  pacePillRow:        { alignItems: 'flex-end', marginTop: 8 },
  pacePill:           { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  pacePillActive:     { backgroundColor: 'rgba(46,204,113,0.15)' },
  pacePillText:       { color: '#888', fontSize: 12 },
  pacePillTextActive: { color: '#2ECC71' },
  maintainInfo: {
    backgroundColor: 'rgba(46,204,113,0.06)',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(46,204,113,0.15)',
  },
  maintainText:    { color: '#888', fontSize: 14, lineHeight: 20 },
  goalErrorText:   { color: '#FF4444', fontSize: 13, marginTop: 8, textAlign: 'center' },
  recommendText:   { color: '#2ECC71', fontSize: 12, marginTop: 4, marginLeft: 4 },
  saveGoalBtn: {
    backgroundColor: '#2ECC71',
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  saveGoalBtnText: { color: 'white', fontWeight: '700', fontSize: 16 },
});

export default HomeScreen;

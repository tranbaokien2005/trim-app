import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { applyPattern } from '../services/api';
import { formatDateYYYYMMDD, getDayNameVi, translateMealType } from '../utils/dateUtils';

// Local design tokens — mirrors the per-screen `C` convention (see LogScreen.js).
const C = {
  primary: '#2ECC71',
  text: '#FFFFFF',
  secondary: '#888888',
  muted: '#666666',
  danger: '#E74C3C',
};

const MAX_ACTIVITIES = 3;

const SmartDayCard = ({ pattern, onApplied, onHidden }) => {
  const [applying, setApplying] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [fade]);

  const preview    = pattern?.preview || {};
  const meals      = preview.meals || [];
  const activities = preview.activities || [];
  const dayName    = getDayNameVi(pattern?.dayOfWeek);

  const hiddenActivities  = Math.max(activities.length - MAX_ACTIVITIES, 0);
  const visibleActivities = activities.slice(0, MAX_ACTIVITIES);

  const handleApply = async () => {
    setApplying(true);
    try {
      const res = await applyPattern(pattern.sourceDate);
      const d = res?.data || {};
      Alert.alert(
        '',
        `Applied! +${d.mealLogsCreated || 0} meals, +${d.activityLogsCreated || 0} activities`,
      );
      onApplied && onApplied();
      // Parent unmounts this card after onApplied → no need to reset state.
    } catch (e) {
      const status = e?.response?.status;
      if (status === 409) {
        Alert.alert('', "You already have logs today. Apply won't overwrite them.");
        onHidden && onHidden(); // treat as dismissed for today
        return;
      }
      const msg = e?.response?.data?.error || 'Something went wrong. Please try again.';
      Alert.alert('Error', msg);
      setApplying(false);
    }
  };

  const handleHide = async () => {
    const today = formatDateYYYYMMDD(new Date());
    try {
      await AsyncStorage.setItem(`smartCardDismissed:${today}`, 'true');
    } catch (_) {
      // non-fatal — dismissal just won't persist across restarts
    }
    onHidden && onHidden();
  };

  return (
    <Animated.View style={[styles.card, { opacity: fade }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerIcon}>📋</Text>
        <Text style={styles.headerTitle}>Your {dayName}</Text>
      </View>

      {/* ── Summary row (3 stats) ── */}
      <View style={styles.summaryRow}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Calories in</Text>
          <Text style={styles.statValue}>{preview.totalCaloriesConsumed ?? 0}</Text>
        </View>
        <View style={[styles.stat, styles.statMiddle]}>
          <Text style={styles.statLabel}>Calories burned</Text>
          <Text style={styles.statValue}>{preview.totalCaloriesBurned ?? 0}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>TDEE</Text>
          <Text style={styles.statValue}>~{preview.estimatedTDEE ?? 0}</Text>
        </View>
      </View>

      {/* ── Meals preview ── */}
      {meals.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Meals</Text>
          {meals.map((meal, i) => (
            <View key={`${meal.mealType}-${i}`} style={styles.mealRow}>
              <View style={styles.mealBadge}>
                <Text style={styles.mealBadgeText}>{translateMealType(meal.mealType)}</Text>
              </View>
              <Text style={styles.mealItems} numberOfLines={2}>
                {(meal.items || []).map((it) => it.name).join(', ')}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* ── Activities preview ── */}
      {activities.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Activity</Text>
          {visibleActivities.map((act, i) => (
            <Text key={`${act.name}-${i}`} style={styles.activityRow} numberOfLines={1}>
              {act.name} · {act.durationMinutes} min · {act.caloriesBurned} cal
            </Text>
          ))}
          {hiddenActivities > 0 && (
            <Text style={styles.activityMore}>+{hiddenActivities} more</Text>
          )}
        </View>
      )}

      {/* ── Footnote ── */}
      <Text style={styles.footnote}>
        Based on your last {pattern?.dataPointCount ?? 0} {dayName}s
      </Text>

      {/* ── Buttons ── */}
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.applyBtn, applying && { opacity: 0.6 }]}
          onPress={handleApply}
          disabled={applying}
          activeOpacity={0.85}
        >
          {applying ? (
            <ActivityIndicator color="#0F0F0F" size="small" />
          ) : (
            <Text style={styles.applyBtnText}>✓ Apply</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.hideBtn, applying && { opacity: 0.4 }]}
          onPress={handleHide}
          disabled={applying}
          activeOpacity={0.7}
        >
          <Text style={styles.hideBtnText}>✕ Hide</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderRadius: 28,
    padding: 20,
    marginBottom: 12,
  },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  headerIcon: { fontSize: 18, marginRight: 8 },
  headerTitle: { color: C.text, fontSize: 16, fontWeight: '700' },

  // Summary
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { flex: 1, alignItems: 'center' },
  statMiddle: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  statLabel: { color: C.muted, fontSize: 12 },
  statValue: { color: C.primary, fontSize: 18, fontWeight: '700', marginTop: 4 },

  // Sections
  section: { marginTop: 16 },
  sectionTitle: {
    color: C.muted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },

  // Meals
  mealRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  mealBadge: {
    backgroundColor: 'rgba(46,204,113,0.15)',
    borderColor: 'rgba(46,204,113,0.3)',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginRight: 10,
  },
  mealBadgeText: { color: C.primary, fontSize: 12, fontWeight: '600' },
  mealItems: { color: C.text, fontSize: 13, flex: 1, lineHeight: 18 },

  // Activities
  activityRow: { color: C.secondary, fontSize: 13, marginBottom: 6 },
  activityMore: { color: C.muted, fontSize: 12, marginTop: 2 },

  // Footnote
  footnote: { color: C.muted, fontSize: 11, marginTop: 16 },

  // Buttons
  buttonRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16, gap: 12 },
  applyBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnText: { color: '#0F0F0F', fontSize: 15, fontWeight: '700' },
  hideBtn: {
    height: 48,
    borderRadius: 14,
    backgroundColor: 'transparent',
    borderColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hideBtnText: { color: C.secondary, fontSize: 15, fontWeight: '600' },
});

export default SmartDayCard;

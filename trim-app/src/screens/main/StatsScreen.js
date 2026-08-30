import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../store/authStore';
import api from '../../services/api';
import { formatDateYYYYMMDD } from '../../utils/dateUtils';

const C = {
  bg: '#0F0F0F',
  card: '#1A1A1A',
  primary: '#2ECC71',
  text: '#FFFFFF',
  secondary: '#888888',
  danger: '#E74C3C',
  border: '#2A2A2A',
  orange: '#F39C12',
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const getDayLabel = (dateStr) => {
  const d = new Date(dateStr + 'T00:00:00');
  return DAYS[d.getDay()];
};

const formatShortDate = (dateStr) => {
  const [, month, day] = dateStr.split('-');
  return `${parseInt(month)}/${parseInt(day)}`;
};

const CHART_HEIGHT = 120;

const BarChart = ({ days }) => {
  const values = days.map((d) => d.caloriesConsumed);
  const maxVal = Math.max(...values, 1);
  const targetVal = days.find((d) => d.dailyTarget > 0)?.dailyTarget || 0;

  return (
    <View style={chartStyles.container}>
      {days.map((d, i) => {
        const barH = Math.max((d.caloriesConsumed / maxVal) * CHART_HEIGHT, d.caloriesConsumed > 0 ? 4 : 0);
        const isOver = targetVal > 0 && d.caloriesConsumed > targetVal;
        return (
          <View key={d.date} style={chartStyles.column}>
            <Text style={chartStyles.valLabel}>
              {d.caloriesConsumed > 0 ? d.caloriesConsumed : ''}
            </Text>
            <View style={chartStyles.barWrapper}>
              <View
                style={[
                  chartStyles.bar,
                  { height: barH, backgroundColor: isOver ? C.danger : C.primary },
                ]}
              />
            </View>
            <Text style={chartStyles.dayLabel}>{getDayLabel(d.date)}</Text>
          </View>
        );
      })}
    </View>
  );
};

const chartStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: CHART_HEIGHT + 44,
    paddingHorizontal: 4,
  },
  column: { flex: 1, alignItems: 'center' },
  barWrapper: { height: CHART_HEIGHT, justifyContent: 'flex-end', width: '70%' },
  bar: { borderRadius: 4, width: '100%' },
  valLabel: { fontSize: 8, color: C.secondary, marginBottom: 2 },
  dayLabel: { fontSize: 10, color: C.secondary, marginTop: 4 },
});

const StatsScreen = () => {
  const { user } = useAuth();
  const [weekly, setWeekly] = useState(null);
  const [weights, setWeights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback((isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);
    return Promise.all([
      api.get('/stats/weekly', { params: { end: formatDateYYYYMMDD(new Date()) } }),
      api.get('/weights?limit=7'),
    ])
      .then(([weeklyRes, weightsRes]) => {
        setWeekly(weeklyRes.data);
        setWeights(weightsRes.data);
      })
      .catch((err) => {
        setError(err?.response?.data?.message || 'Failed to load stats');
      })
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = () => {
    setRefreshing(true);
    load(true);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={C.primary} style={styles.center} />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => load()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const totals = weekly?.totals || {};
  const days = weekly?.days || [];
  // Only days with food logged count as real data — an unlogged day has
  // deficit = target + burned − 0 (a big false positive), so exclude them.
  const loggedDays    = days.filter((d) => d.caloriesConsumed > 0);
  const hasData       = loggedDays.length > 0;
  const enoughData    = loggedDays.length >= 2;
  const daysInDeficit = loggedDays.filter((d) => d.deficit > 0).length;
  const avgDeficit    = hasData
    ? Math.round(loggedDays.reduce((s, d) => s + d.deficit, 0) / loggedDays.length)
    : null;
  const activeGoal = user?.goals?.find((g) => g.isActive);
  const latestWeight = weights[0];

  const goalProgress =
    activeGoal && latestWeight && activeGoal.startWeight && activeGoal.targetWeight
      ? Math.min(
          Math.max(
            (activeGoal.startWeight - latestWeight.weight) /
              (activeGoal.startWeight - activeGoal.targetWeight),
            0
          ),
          1
        )
      : null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>Statistics</Text>
        </View>

        {/* Weekly Summary */}
        <Text style={styles.sectionLabel}>This Week</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{Math.round(totals.caloriesConsumed / 7) || 0}</Text>
            <Text style={styles.summaryLabel}>Avg Calories</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: !enoughData ? C.secondary : avgDeficit >= 0 ? C.primary : C.danger }]}>
              {enoughData ? Math.abs(avgDeficit) : '—'}
            </Text>
            <Text style={styles.summaryLabel}>
              {!enoughData ? 'Not enough data' : avgDeficit >= 0 ? 'Avg Deficit' : 'Avg Surplus'}
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: C.primary }]}>{daysInDeficit}</Text>
            <Text style={styles.summaryLabel}>Days Deficit</Text>
          </View>
        </View>

        {/* 7-Day Calorie Bar Chart */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Calories — Last 7 Days</Text>
          {hasData ? (
            <BarChart days={days} />
          ) : (
            <Text style={styles.emptyText}>Log meals to see trends</Text>
          )}
        </View>

        {/* Weight History */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Weight History</Text>
          {weights.length > 0 ? (
            weights.map((w, i) => (
              <View key={w._id} style={[styles.weightRow, i < weights.length - 1 && styles.rowBorder]}>
                <Text style={styles.weightDate}>{formatShortDate(w.date?.slice(0, 10) || '')}</Text>
                <Text style={styles.weightVal}>{w.weight} kg</Text>
                {w.bmi ? <Text style={styles.weightBmi}>BMI {Math.round(w.bmi * 10) / 10}</Text> : null}
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No weight logs yet</Text>
          )}
        </View>

        {/* Goal Progress */}
        {activeGoal ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Goal Progress</Text>
            <View style={styles.goalRow}>
              <View style={styles.goalItem}>
                <Text style={styles.goalVal}>{latestWeight?.weight || '—'} kg</Text>
                <Text style={styles.goalLbl}>Current</Text>
              </View>
              <Text style={styles.goalArrow}>→</Text>
              <View style={styles.goalItem}>
                <Text style={[styles.goalVal, { color: C.primary }]}>
                  {activeGoal.targetWeight} kg
                </Text>
                <Text style={styles.goalLbl}>Target</Text>
              </View>
            </View>
            {goalProgress !== null ? (
              <View style={styles.progressBarBg}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${Math.round(goalProgress * 100)}%` },
                  ]}
                />
              </View>
            ) : null}
            {goalProgress !== null ? (
              <Text style={styles.progressPct}>
                {Math.round(goalProgress * 100)}% to goal
              </Text>
            ) : null}
            {activeGoal.dailyCalorieTarget > 0 ? (
              <Text style={styles.goalTarget}>
                Daily target: {Math.round(activeGoal.dailyCalorieTarget)} cal
              </Text>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: '700', color: C.text },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: C.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
  },
  summaryRow: { flexDirection: 'row', marginHorizontal: 16, gap: 8, marginBottom: 12 },
  summaryCard: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  summaryValue: { fontSize: 22, fontWeight: '700', color: C.text },
  summaryLabel: { fontSize: 10, color: C.secondary, marginTop: 2, textAlign: 'center' },
  card: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: C.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  emptyText: { color: C.secondary, fontSize: 14 },
  weightRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: C.border },
  weightDate: { flex: 1, color: C.secondary, fontSize: 13 },
  weightVal: { fontSize: 16, fontWeight: '600', color: C.text, marginRight: 12 },
  weightBmi: { fontSize: 12, color: C.secondary },
  goalRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  goalItem: { flex: 1, alignItems: 'center' },
  goalVal: { fontSize: 20, fontWeight: '700', color: C.text },
  goalLbl: { fontSize: 11, color: C.secondary, marginTop: 2 },
  goalArrow: { fontSize: 20, color: C.secondary, paddingHorizontal: 8 },
  progressBarBg: {
    height: 8,
    backgroundColor: C.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressBarFill: { height: '100%', backgroundColor: C.primary, borderRadius: 4 },
  progressPct: { fontSize: 12, color: C.primary, fontWeight: '600', marginBottom: 8 },
  goalTarget: { fontSize: 13, color: C.secondary },
  errorText: { color: C.danger, fontSize: 16, marginBottom: 16, textAlign: 'center' },
  retryBtn: {
    backgroundColor: C.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: { color: C.text, fontWeight: '700' },
});

export default StatsScreen;

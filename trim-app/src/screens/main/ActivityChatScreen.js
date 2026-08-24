import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useAuth } from '../../store/authStore';
import api from '../../services/api';
import ConsentModal from '../../components/ConsentModal';

const getToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const INTENSITIES = ['Low', 'Medium', 'High'];
const UNITS       = ['min', 'hr'];
const SMART_DUR   = { min: 30, hr: 1 };

const emptyItem = () => ({ activity: '', duration: 30, unit: 'min', intensity: 'Medium' });

const enrich = (item) => ({
  ...item,
  editDuration:   item.durationMinutes,
  baseCalories:   item.caloriesBurned,
  displayCalories: item.caloriesBurned,
});

const ActivityChatScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [formItems, setFormItems]           = useState([emptyItem()]);
  const [freeText, setFreeText]             = useState('');
  const [uiState, setUiState]               = useState('empty'); // empty|loading|results|success
  const [parsedItems, setParsedItems]       = useState([]);
  const [errorText, setErrorText]           = useState('');
  const [logging, setLogging]               = useState(false);
  const [remainingCalories, setRemainingCalories] = useState(null);
  const [editingIndex, setEditingIndex]     = useState(null);
  const [totalCalories, setTotalCalories]   = useState(0);
  const [showConsent, setShowConsent] = useState(false);

  const displayTotal = parsedItems.reduce((s, i) => s + (i.displayCalories || 0), 0);
  const hasInput     = formItems.some((i) => i.activity.trim()) || freeText.trim().length > 0;
  const goalType     = user?.goals?.find((g) => g.isActive)?.type || 'lose';

  // ─── Form helpers ────────────────────────────────────────────────────────────

  const updateItem = (index, field, value) =>
    setFormItems((prev) => prev.map((it, i) => (i === index ? { ...it, [field]: value } : it)));

  const updateDuration = (index, dir) => {
    const item  = formItems[index];
    const isHr  = item.unit === 'hr';
    const step  = isHr ? 0.5 : 5;
    const min   = isHr ? 0.5 : 5;
    const current = parseFloat(item.duration) || (isHr ? 1 : 30);
    const next  = Math.max(min, current + dir * step);
    updateItem(index, 'duration', Number(next.toFixed(1)));
  };

  const addItem    = () => setFormItems((prev) => [...prev, emptyItem()]);
  const removeItem = (index) => setFormItems((prev) => prev.filter((_, i) => i !== index));

  const updateParsedItem = (index, field, value) =>
    setParsedItems((prev) => prev.map((it, i) => (i === index ? { ...it, [field]: value } : it)));

  const removeParsedItem = (index) => {
    const updated = parsedItems.filter((_, i) => i !== index);
    setParsedItems(updated);
    if (updated.length === 0) handleTryAgain();
  };

  const updateDisplayCalories = (index, newVal) => {
    const updated = parsedItems.map((item, i) =>
      i === index ? { ...item, displayCalories: newVal, caloriesBurned: newVal } : item
    );
    setParsedItems(updated);
    const newTotal = updated.reduce((sum, item) => sum + (item.displayCalories || 0), 0);
    setTotalCalories(newTotal);
  };

  // ─── API logic ───────────────────────────────────────────────────────────────

  const handleParse = async () => {
    const formParts = formItems
      .filter((item) => item.activity.trim())
      .map((item) => {
        const dur = item.unit === 'hr'
          ? `${item.duration} hour`
          : `${item.duration} min`;
        return `${item.activity} ${dur} ${item.intensity} intensity`;
      });
    const allParts = [...formParts];
    if (freeText.trim()) allParts.push(freeText.trim());
    const finalPrompt = allParts.join(', ');

    setErrorText('');
    setUiState('loading');
    try {
      const res = await api.post('/activities/parse-text', { text: finalPrompt, date: getToday() });
      setParsedItems((res.data.entries || []).map(enrich));
      try {
        const statsRes = await api.get('/stats/daily', { params: { date: getToday() } });
        setRemainingCalories(statsRes.data?.remaining ?? null);
      } catch {
        setRemainingCalories(null);
      }
      setUiState('results');
    } catch (err) {
      if (err?.response?.status === 403 && err?.response?.data?.code === 'AI_CONSENT_REQUIRED') {
        setUiState('empty');
        setErrorText('');
        setShowConsent(true);
        return;
      }
      setUiState('empty');
      setErrorText("Couldn't parse that. Try again.");
    }
  };

  const handleLogAll = async () => {
    setLogging(true);
    const body = {
      date: getToday(),
      entries: parsedItems.map((item) => ({
        name:            item.name,
        type:            item.type || 'cardio',
        durationMinutes: item.editDuration || item.durationMinutes,
        caloriesBurned:  item.displayCalories,
        intensity:       item.intensity || 'medium',
        source:          'ai_parsed',
      })),
    };
    try {
      await api.post('/activities', body);
      setLogging(false);
      setUiState('success');
      setTimeout(() => navigation.goBack(), 1500);
    } catch (err) {
      console.log('Save error:', err.response?.data || err.message);
      setLogging(false);
      Alert.alert('Error', err.response?.data?.message || 'Failed to save activity');
    }
  };

  const handleTryAgain = () => {
    setUiState('empty');
    setParsedItems([]);
    setFormItems([emptyItem()]);
    setFreeText('');
    setErrorText('');
    setRemainingCalories(null);
    setEditingIndex(null);
  };

  // ─── Render helpers ──────────────────────────────────────────────────────────

  const renderTopContent = () => {
    if (uiState === 'loading') {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2ECC71" />
          <Text style={styles.analyzingText}>Analyzing...</Text>
        </View>
      );
    }

    if (uiState === 'success') {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <View style={{
            width: 80, height: 80, borderRadius: 40,
            backgroundColor: 'rgba(46,204,113,0.15)',
            borderWidth: 2, borderColor: '#2ECC71',
            alignItems: 'center', justifyContent: 'center', marginBottom: 24,
          }}>
            <Text style={{ fontSize: 36 }}>🔥</Text>
          </View>
          <Text style={{ color: 'white', fontSize: 24, fontWeight: '700', marginBottom: 8 }}>
            Activity Logged!
          </Text>
          <Text style={{ color: '#666', fontSize: 15, textAlign: 'center', marginBottom: 32 }}>
            Added to your activity log
          </Text>
          <View style={{
            backgroundColor: 'rgba(46,204,113,0.08)', borderRadius: 20,
            paddingHorizontal: 24, paddingVertical: 14,
            borderWidth: 1, borderColor: 'rgba(46,204,113,0.2)', marginBottom: 40,
          }}>
            <Text style={{ color: '#2ECC71', fontSize: 22, fontWeight: '700', textAlign: 'center' }}>
              {displayTotal} cal burned
            </Text>
            <Text style={{ color: '#555', fontSize: 12, textAlign: 'center', marginTop: 2 }}>
              {parsedItems.length} activity{parsedItems.length > 1 ? 's' : ''} logged
            </Text>
          </View>
          <Text style={{ color: '#444', fontSize: 12 }}>Returning to log...</Text>
        </View>
      );
    }

    if (uiState === 'results') {
      // Insight block
      const afterActivity = remainingCalories != null ? remainingCalories + displayTotal : null;
      let insightIcon, insightColor, insightText, insightSub;

      if (afterActivity == null) {
        insightIcon = '💡'; insightColor = '#555';
        insightText = '— cal remaining';
        insightSub  = 'Stats unavailable';
      } else if (goalType === 'gain') {
        insightIcon = '⚡'; insightColor = '#FFA726';
        insightText = `${displayTotal} cal burned`;
        insightSub  = 'Remember to eat back these calories';
      } else if (goalType === 'lose') {
        if (displayTotal >= 200) {
          insightIcon = '🔥'; insightColor = '#2ECC71';
          insightText = `Great burn! +${displayTotal} cal to your budget`;
          insightSub  = `You now have ${afterActivity} cal remaining`;
        } else {
          insightIcon = '💪'; insightColor = '#FFA726';
          insightText = `${displayTotal} cal burned`;
          insightSub  = 'Every bit counts!';
        }
      } else {
        insightIcon = '✅'; insightColor = '#2ECC71';
        insightText = `${displayTotal} cal burned`;
        insightSub  = 'Logged to your activity';
      }

      return (
        <>
          {parsedItems.map((item, i) => (
            <View key={i} style={[styles.itemCard, { position: 'relative' }]}>
              {/* Name row + Edit button */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginRight: 24 }}>
                <Text style={styles.itemName}>{item.name}</Text>
                <TouchableOpacity onPress={() => setEditingIndex(editingIndex === i ? null : i)}>
                  <Text style={{ color: '#555', fontSize: 12 }}>{editingIndex === i ? 'Done' : 'Edit'}</Text>
                </TouchableOpacity>
              </View>

              {/* Activity details */}
              <Text style={styles.itemMacros}>
                {item.displayCalories} cal burned  ·  {item.durationMinutes} min  ·  {item.intensity}
              </Text>

              {/* Edit panel */}
              {editingIndex === i && (
                <View style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 12, marginTop: 10 }}>
                  <Text style={{ color: '#666', fontSize: 11, marginBottom: 4 }}>CALORIES BURNED</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity
                      onPress={() => updateDisplayCalories(i, Math.max(0, item.displayCalories - 50))}
                      style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 }}
                    >
                      <Text style={{ color: 'white', fontSize: 18 }}>−</Text>
                    </TouchableOpacity>
                    <TextInput
                      value={item.displayCalories.toString()}
                      onChangeText={(val) => {
                        if (/^\d*$/.test(val)) updateDisplayCalories(i, parseInt(val) || 0);
                      }}
                      keyboardType="numeric"
                      style={{ color: '#2ECC71', fontSize: 16, fontWeight: '600', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 10, minWidth: 70, textAlign: 'center', marginHorizontal: 8 }}
                    />
                    <TouchableOpacity
                      onPress={() => updateDisplayCalories(i, item.displayCalories + 50)}
                      style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 }}
                    >
                      <Text style={{ color: 'white', fontSize: 18 }}>+</Text>
                    </TouchableOpacity>
                    <Text style={{ color: '#666', fontSize: 14, marginLeft: 8 }}>cal</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setEditingIndex(null)}
                    style={{ backgroundColor: 'rgba(46,204,113,0.15)', borderRadius: 10, padding: 10, marginTop: 12, alignItems: 'center' }}
                  >
                    <Text style={{ color: '#2ECC71', fontSize: 14, fontWeight: '600' }}>Done ✓</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Delete button */}
              <TouchableOpacity
                onPress={() => removeParsedItem(i)}
                style={{ position: 'absolute', top: 0, right: 0, padding: 8 }}
              >
                <Text style={{ color: '#555', fontSize: 16 }}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}

          <View style={styles.totalBar}>
            <Text style={styles.totalText}>Total burned: {displayTotal} cal</Text>
          </View>

          {/* Insight block */}
          <View style={[styles.insightBlock, { borderLeftColor: insightColor }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 16, marginRight: 8 }}>{insightIcon}</Text>
              <Text style={{ color: insightColor, fontSize: 14, fontWeight: '600', flex: 1 }}>
                {insightText}
              </Text>
            </View>
            <Text style={{ color: '#666', fontSize: 12, marginTop: 4, marginLeft: 24 }}>
              {insightSub}
            </Text>
            {parsedItems[0]?.note ? (
              <Text style={{ color: '#555', fontSize: 11, marginTop: 8, marginLeft: 24, fontStyle: 'italic' }}>
                💊 {parsedItems[0].note}
              </Text>
            ) : null}
          </View>
        </>
      );
    }

    // ── Empty state: Quick Add form ────────────────────────────────────────────
    return (
      <>
        <View style={styles.formHeader}>
          <Text style={{ fontSize: 36 }}>🏃</Text>
          <Text style={styles.formTitle}>What did you do?</Text>
          <Text style={{ color: '#666', fontSize: 14, marginTop: 4 }}>
            Type in any language — English or Vietnamese
          </Text>
        </View>

        <Text style={styles.sectionLabel}>QUICK ADD</Text>

        {formItems.map((item, i) => (
          <View key={i} style={styles.formItem}>
            {/* Row 1: activity input + duration stepper */}
            <View style={styles.formRow}>
              <TextInput
                style={[styles.baseInput, { flex: 1 }]}
                value={item.activity}
                onChangeText={(v) => updateItem(i, 'activity', v)}
                placeholder="Activity name & details (e.g. chạy bộ nhẹ)"
                placeholderTextColor="#444"
                color="#FFFFFF"
                fontSize={14}
              />
              <View style={styles.stepper}>
                <TouchableOpacity style={styles.stepperBtn} onPress={() => updateDuration(i, -1)}>
                  <Text style={styles.stepperIcon}>−</Text>
                </TouchableOpacity>
                <TextInput
                  style={styles.stepperInput}
                  value={item.duration.toString()}
                  onChangeText={(val) => {
                    if (/^\d*\.?\d*$/.test(val)) updateItem(i, 'duration', val);
                  }}
                  onBlur={() => {
                    const val = parseFloat(item.duration);
                    if (!val || val < 1) updateItem(i, 'duration', item.unit === 'hr' ? 1 : 5);
                  }}
                  keyboardType="decimal-pad"
                  color="#FFFFFF"
                />
                <TouchableOpacity style={styles.stepperBtn} onPress={() => updateDuration(i, +1)}>
                  <Text style={styles.stepperIcon}>+</Text>
                </TouchableOpacity>
              </View>
              {formItems.length > 1 && (
                <TouchableOpacity onPress={() => removeItem(i)} style={styles.removeBtn}>
                  <Text style={styles.removeBtnText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Row 2: unit pills + intensity pills */}
            <View style={{ flexDirection: 'row', marginTop: 8, gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {UNITS.map((unit) => (
                <TouchableOpacity
                  key={unit}
                  onPress={() => {
                    updateItem(i, 'unit', unit);
                    updateItem(i, 'duration', SMART_DUR[unit]);
                  }}
                  style={[styles.unitPill, item.unit === unit && styles.unitPillOn]}
                >
                  <Text style={[styles.unitPillText, item.unit === unit && styles.unitPillTextOn]}>
                    {unit}
                  </Text>
                </TouchableOpacity>
              ))}
              <View style={{ width: 1, height: 16, backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 2 }} />
              {INTENSITIES.map((intensity) => (
                <TouchableOpacity
                  key={intensity}
                  onPress={() => updateItem(i, 'intensity', intensity)}
                  style={[styles.unitPill, item.intensity === intensity && styles.unitPillOn]}
                >
                  <Text style={[styles.unitPillText, item.intensity === intensity && styles.unitPillTextOn]}>
                    {intensity}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <TouchableOpacity onPress={addItem} style={styles.addItemBtn}>
          <Text style={styles.addItemText}>+ Add activity</Text>
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}> OR </Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Free text */}
        <Text style={styles.sectionLabel}>TYPE FREELY</Text>
        <TextInput
          style={styles.freeTextInput}
          value={freeText}
          onChangeText={setFreeText}
          placeholder={'e.g. đi bộ 8000 bước, gym chest day 1 tiếng, swimming 45 min moderate pace...'}
          placeholderTextColor="#444"
          color="#FFFFFF"
          fontSize={14}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
        {errorText
          ? <Text style={styles.errorText}>{errorText}</Text>
          : <Text style={styles.hintText}>💡 More detail = better accuracy</Text>
        }
      </>
    );
  };

  const renderBottomContent = () => {
    if (uiState === 'results') {
      return (
        <>
          <TouchableOpacity
            style={[styles.primaryBtn, logging && { opacity: 0.6 }]}
            onPress={handleLogAll}
            disabled={logging}
          >
            {logging
              ? <ActivityIndicator color="#0F0F0F" />
              : <Text style={styles.primaryBtnText}>Log Activity</Text>
            }
          </TouchableOpacity>
          <TouchableOpacity style={styles.ghostBtn} onPress={handleTryAgain}>
            <Text style={styles.ghostBtnText}>Try again</Text>
          </TouchableOpacity>
        </>
      );
    }

    return (
      <>
        <TouchableOpacity
          style={[styles.primaryBtn, (!hasInput || uiState === 'loading') && { opacity: 0.3 }]}
          onPress={handleParse}
          disabled={!hasInput || uiState === 'loading'}
        >
          <Text style={styles.primaryBtnText}>Parse & Log →</Text>
        </TouchableOpacity>
        <Text style={{ color: '#444', fontSize: 11, textAlign: 'center', marginTop: 8 }}>
          ⚡ AI estimates · adjust after parsing
        </Text>
      </>
    );
  };

  // ─── Main render ─────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerTitle}>AI Activity Log</Text>
          <Text style={{ color: '#666', fontSize: 12, marginTop: 1 }}>Log any activity or exercise</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <View style={{ flex: 1, backgroundColor: '#0F0F0F' }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 }}
        >
          {renderTopContent()}
          {uiState !== 'success' && (
            <View style={{ marginTop: 24, marginBottom: 40 }}>
              {renderBottomContent()}
            </View>
          )}
        </ScrollView>
      </View>

      <ConsentModal
        visible={showConsent}
        onEnable={() => { setShowConsent(false); handleParse(); }}
        onDismiss={() => setShowConsent(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F0F0F' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backBtn:     { width: 40, padding: 4 },
  backArrow:   { color: '#FFFFFF', fontSize: 24 },
  headerTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  centered:      { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  analyzingText: { color: '#666', fontSize: 14, marginTop: 12 },

  formHeader: { paddingTop: 16, paddingBottom: 20, alignItems: 'center' },
  formTitle:  { color: '#FFFFFF', fontSize: 20, fontWeight: '700', marginTop: 8 },

  sectionLabel: { color: '#555', fontSize: 11, fontWeight: '600', letterSpacing: 1, marginBottom: 10 },
  formItem:     { marginBottom: 12 },
  formRow:      { flexDirection: 'row', alignItems: 'center', gap: 8 },

  baseInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  stepperBtn:   { paddingHorizontal: 12, paddingVertical: 10 },
  stepperIcon:  { color: '#2ECC71', fontSize: 18, fontWeight: '600' },
  stepperInput: { color: '#FFFFFF', fontSize: 14, fontWeight: '600', minWidth: 36, textAlign: 'center', paddingVertical: 10 },

  unitPill:     { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: 'transparent' },
  unitPillOn:   { backgroundColor: 'rgba(46,204,113,0.2)', borderColor: '#2ECC71' },
  unitPillText: { color: '#888', fontSize: 12 },
  unitPillTextOn: { color: '#2ECC71' },

  removeBtn:     { paddingHorizontal: 8 },
  removeBtnText: { color: '#555', fontSize: 16 },
  addItemBtn:    { paddingVertical: 10 },
  addItemText:   { color: '#2ECC71', fontSize: 13 },

  dividerRow:  { flexDirection: 'row', alignItems: 'center', marginVertical: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  dividerText: { color: '#444', fontSize: 12, marginHorizontal: 10 },

  freeTextInput: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 12, minHeight: 70, textAlignVertical: 'top' },
  hintText:      { color: '#444', fontSize: 12, marginTop: 8 },
  errorText:     { color: '#EF5350', fontSize: 12, marginTop: 8 },

  itemCard:   { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 14, marginBottom: 8 },
  itemName:   { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  itemMacros: { color: '#888', fontSize: 12, marginTop: 3 },

  totalBar:  { backgroundColor: 'rgba(46,204,113,0.08)', borderRadius: 12, padding: 12, marginTop: 4 },
  totalText: { color: '#2ECC71', fontSize: 16, fontWeight: '700', textAlign: 'center' },

  insightBlock: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 14, marginTop: 12, marginBottom: 4, borderLeftWidth: 3 },

  primaryBtn:     { backgroundColor: '#2ECC71', borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  primaryBtnText: { color: '#0F0F0F', fontWeight: '700', fontSize: 15 },
  ghostBtn:       { paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  ghostBtnText:   { color: '#666', fontSize: 14 },
});

export default ActivityChatScreen;

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  TextInput,
  Modal,
  ActivityIndicator,
  RefreshControl,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import api from '../../services/api';
import ActionChooserSheet from '../../components/ui/ActionChooserSheet';
import { dark } from '../../theme/tokens';

// Core palette sourced from the shared tokens (single source of truth: src/theme/tokens).
// modal bg + solid border have no exact token yet — kept literal.
const C = {
  bg: dark.bg,
  card: dark.surface,
  modal: '#1E1E1E',
  primary: dark.accent,
  text: dark.textPrimary,
  secondary: dark.textSecondary,
  danger: dark.danger,
  border: '#2A2A2A',
  input: dark.surfaceAlt,
};

const getBMIInfo = (bmi) => {
  if (bmi < 18.5) return { color: '#64B5F6', label: 'Underweight' };
  if (bmi < 25)   return { color: '#2ECC71', label: 'Normal' };
  if (bmi < 30)   return { color: '#FFA726', label: 'Overweight' };
  return { color: '#EF5350', label: 'Obese' };
};

const getWeightChangeColor = (currentW, prevW, goalType) => {
  if (prevW == null) return null;
  const diff = currentW - prevW;
  if (diff === 0) return null;
  if (goalType === 'lose') return diff < 0 ? '#2ECC71' : '#FF6B6B';
  if (goalType === 'gain') return diff > 0 ? '#2ECC71' : '#FF6B6B';
  return Math.abs(diff) <= 1 ? '#2ECC71' : '#FFB74D';
};

const dateToYMD = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const getToday = () => dateToYMD(new Date());

const formatDisplayDate = (dateStr) => {
  const [year, month, day] = dateStr.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(month) - 1]} ${parseInt(day)}, ${year}`;
};

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];
const MEAL_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' };
const ACTIVITY_TYPES = ['Cardio', 'Strength', 'Daily Activity', 'Sport', 'Other'];
const INTENSITIES = ['Low', 'Medium', 'High'];

// ─── SAVE TEMPLATE MODAL ─────────────────────────────────────────────────────

const SaveTemplateModal = ({ visible, onClose, onSave, defaultName, saving, type = 'meal' }) => {
  const [name, setName] = useState('');
  const isActivity = type === 'activity';
  const noun = isActivity ? 'activity' : 'meal';
  const Noun = isActivity ? 'Activity' : 'Meal';
  const namePlaceholder = isActivity ? 'Name this activity (e.g. Morning Run)' : 'Name this meal (e.g. Office Lunch)';

  useEffect(() => {
    if (visible) setName(defaultName || '');
  }, [visible, defaultName]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' }} />
        </TouchableWithoutFeedback>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={saveModalStyles.sheet}>
            <View style={saveModalStyles.handle} />
            <Text style={saveModalStyles.title}>Save this {noun}?</Text>
            <Text style={saveModalStyles.body}>
              {type === 'meal'
                ? 'Save it so you can log this meal in 1 tap next time'
                : 'You can quickly log this activity again next time'}
            </Text>
            <TextInput
              style={saveModalStyles.input}
              value={name}
              onChangeText={setName}
              placeholder={namePlaceholder}
              placeholderTextColor="#444"
              returnKeyType="done"
              color="#FFF"
            />
            <TouchableOpacity
              style={[saveModalStyles.saveBtn, (!name.trim() || saving) && { opacity: 0.5 }]}
              onPress={() => onSave(name.trim())}
              disabled={!name.trim() || saving}
            >
              {saving
                ? <ActivityIndicator color="#0F0F0F" />
                : <Text style={saveModalStyles.saveBtnText}>Save {Noun}</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={saveModalStyles.skipBtn} onPress={onClose} disabled={saving}>
              <Text style={saveModalStyles.skipText}>Not now</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

// ─── TEMPLATE PILL ROW ────────────────────────────────────────────────────────

const TemplatePillRow = ({
  templates, loading, onSelect,
  emptyLabel = 'No saved templates yet',
  getLabelFn, onLongPress,
  sectionLabel = 'Saved Meals',
}) => {
  const getLabel = getLabelFn || ((t) => t.name);

  if (loading) {
    return (
      <View style={{ paddingVertical: 10 }}>
        <ActivityIndicator color={C.primary} size="small" />
      </View>
    );
  }
  return (
    <View style={tmplPillStyles.wrapper}>
      <Text style={tmplPillStyles.sectionLabel}>{sectionLabel}</Text>
      {templates.length === 0 ? (
        <Text style={tmplPillStyles.emptyText}>{emptyLabel}</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          {templates.map((t) => (
            <TouchableOpacity
              key={t._id}
              style={tmplPillStyles.pill}
              onPress={() => onSelect(t)}
              onLongPress={() => onLongPress && onLongPress(t)}
              delayLongPress={500}
              activeOpacity={0.7}
            >
              <Text style={tmplPillStyles.pillText} numberOfLines={1}>{getLabel(t)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

// ─── MEAL TEMPLATE PREVIEW SHEET ─────────────────────────────────────────────

const MealTemplatePreviewSheet = ({ template, visible, onClose, onLog, onEdit, onDelete }) => {
  const [logging, setLogging] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState('snack');

  useEffect(() => {
    if (template) setSelectedMealType(getMealType());
  }, [template]);

  if (!template) return null;

  const totalCal = template.items?.reduce((s, i) => s + (i.calories || 0), 0) || 0;
  const totalP   = template.items?.reduce((s, i) => s + (i.protein  || 0), 0) || 0;
  const totalC   = template.items?.reduce((s, i) => s + (i.carbs    || 0), 0) || 0;
  const totalF   = template.items?.reduce((s, i) => s + (i.fat      || 0), 0) || 0;
  const hasMacros = totalP > 0 || totalC > 0 || totalF > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' }} />
        </TouchableWithoutFeedback>
        <View style={previewStyles.sheet}>
          <View style={previewStyles.handle} />
          <Text style={previewStyles.title}>{template.name}</Text>
          {template.items?.map((item, i) => {
            const macroLine = [
              item.protein > 0 ? `${item.protein}g P` : null,
              item.carbs > 0 ? `${item.carbs}g C` : null,
              item.fat > 0 ? `${item.fat}g F` : null,
            ].filter(Boolean).join(' · ');
            return (
              <View key={i} style={previewStyles.itemRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={previewStyles.itemName} numberOfLines={1}>{item.name}</Text>
                  {macroLine ? (
                    <Text style={{ fontSize: 11, color: '#555', marginTop: 2 }}>{macroLine}</Text>
                  ) : null}
                </View>
                <Text style={previewStyles.itemCal}>{item.calories} cal</Text>
              </View>
            );
          })}
          <Text style={{ fontSize: 11, color: C.secondary, marginTop: 12, marginBottom: 8,
                         textTransform: 'uppercase', letterSpacing: 0.5 }}>Log as</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
            {MEAL_TYPES.map((t) => (
              <TouchableOpacity
                key={t}
                style={[mealFormStyles.pill, selectedMealType === t && mealFormStyles.pillOn]}
                onPress={() => setSelectedMealType(t)}
              >
                <Text style={[mealFormStyles.pillText, selectedMealType === t && mealFormStyles.pillTextOn]}>
                  {MEAL_LABELS[t]}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={previewStyles.macroBox}>
            <Text style={previewStyles.totalCal}>{Math.round(totalCal)} cal</Text>
            {hasMacros && (
              <Text style={previewStyles.macros}>
                {Math.round(totalP)}g P · {Math.round(totalC)}g C · {Math.round(totalF)}g F
              </Text>
            )}
          </View>
          <TouchableOpacity
            style={[previewStyles.logBtn, logging && { opacity: 0.6 }]}
            disabled={logging}
            onPress={async () => {
              setLogging(true);
              try { await onLog(template, selectedMealType); } catch (_) {} finally { setLogging(false); }
            }}
          >
            {logging ? <ActivityIndicator color="#0F0F0F" /> : <Text style={previewStyles.logBtnText}>Log This</Text>}
          </TouchableOpacity>
          {(onEdit || onDelete) && (
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
              {onEdit && (
                <TouchableOpacity
                  style={previewStyles.secondaryBtn}
                  onPress={() => onEdit(template)}
                >
                  <Text style={previewStyles.secondaryBtnText}>Edit</Text>
                </TouchableOpacity>
              )}
              {onDelete && (
                <TouchableOpacity
                  style={[previewStyles.secondaryBtn, previewStyles.secondaryBtnDanger]}
                  onPress={() => onDelete(template)}
                >
                  <Text style={[previewStyles.secondaryBtnText, { color: '#EF5350' }]}>Delete</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          <TouchableOpacity style={previewStyles.cancelBtn} onPress={onClose}>
            <Text style={previewStyles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// ─── ACTIVITY TEMPLATE PREVIEW SHEET ─────────────────────────────────────────

const ActivityTemplatePreviewSheet = ({ template, visible, onClose, onLog, onEdit, onDelete }) => {
  const [logging, setLogging] = useState(false);

  if (!template) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' }} />
        </TouchableWithoutFeedback>
        <View style={previewStyles.sheet}>
          <View style={previewStyles.handle} />
          <Text style={previewStyles.typeLabel}>Activity</Text>
          <Text style={previewStyles.title}>{template.name}</Text>
          <View style={previewStyles.activityDetails}>
            <View style={previewStyles.activityStat}>
              <Text style={previewStyles.activityStatVal}>{template.durationMinutes}</Text>
              <Text style={previewStyles.activityStatLabel}>min</Text>
            </View>
            <View style={previewStyles.activityDivider} />
            <View style={previewStyles.activityStat}>
              <Text style={[previewStyles.activityStatVal, { color: C.primary }]}>{template.caloriesBurned}</Text>
              <Text style={previewStyles.activityStatLabel}>cal burned</Text>
            </View>
          </View>
          <TouchableOpacity
            style={[previewStyles.logBtn, logging && { opacity: 0.6 }]}
            disabled={logging}
            onPress={async () => {
              setLogging(true);
              try { await onLog(template); } catch (_) {} finally { setLogging(false); }
            }}
          >
            {logging ? <ActivityIndicator color="#0F0F0F" /> : <Text style={previewStyles.logBtnText}>Log This</Text>}
          </TouchableOpacity>
          {(onEdit || onDelete) && (
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
              {onEdit && (
                <TouchableOpacity
                  style={previewStyles.secondaryBtn}
                  onPress={() => onEdit(template)}
                >
                  <Text style={previewStyles.secondaryBtnText}>Edit</Text>
                </TouchableOpacity>
              )}
              {onDelete && (
                <TouchableOpacity
                  style={[previewStyles.secondaryBtn, previewStyles.secondaryBtnDanger]}
                  onPress={() => onDelete(template)}
                >
                  <Text style={[previewStyles.secondaryBtnText, { color: '#EF5350' }]}>Delete</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          <TouchableOpacity style={previewStyles.cancelBtn} onPress={onClose}>
            <Text style={previewStyles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// ─── MEALS SECTION ────────────────────────────────────────────────────────────

const getMealType = () => {
  const h = new Date().getHours();
  if (h >= 6  && h <= 10) return 'breakfast';
  if (h >= 11 && h <= 14) return 'lunch';
  if (h >= 15 && h <= 17) return 'snack';
  if (h >= 18 && h <= 22) return 'dinner';
  return 'snack';
};

const buildTemplateName = (items) => {
  if (!items || items.length === 0) return '';
  if (items.length === 1) return items[0].name;
  return `${items[0].name} + ${items.length - 1} more`;
};

const MealsTab = ({ today, refreshTrigger, navigation, draft, onDraftConsumed }) => {
  const [meals, setMeals]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showChooser, setShowChooser] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // form state
  const [mealType, setMealType]     = useState(getMealType());
  const [foodName, setFoodName]     = useState('');
  const [calories, setCalories]     = useState('');
  const [protein, setProtein]       = useState('');
  const [carbs, setCarbs]           = useState('');
  const [fat, setFat]               = useState('');
  const [servingSize, setServingSize] = useState('');
  const [saving, setSaving]         = useState(false);
  const [formError, setFormError]   = useState('');
  const [editingMeal, setEditingMeal] = useState(null);
  const [editName, setEditName]         = useState('');
  const [editCalories, setEditCalories] = useState(0);
  const [editProtein, setEditProtein]   = useState(0);
  const [editCarbs, setEditCarbs]       = useState(0);
  const [editFat, setEditFat]           = useState(0);
  const [editServing, setEditServing]   = useState('');
  const [editShowMacros, setEditShowMacros] = useState(false);
  const [editSaving, setEditSaving]     = useState(false);

  // template state
  const [templates, setTemplates]             = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [showSaveModal, setShowSaveModal]     = useState(false);
  const [saveTmplName, setSaveTmplName]       = useState('');
  const [savingTemplate, setSavingTemplate]   = useState(false);
  const [lastMealPayload, setLastMealPayload] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showTemplateSheet, setShowTemplateSheet] = useState(false);

  // create template form state
  const [showCreateForm, setShowCreateForm]   = useState(false);
  const [ctMealType, setCtMealType]           = useState(getMealType());
  const [ctItems, setCtItems]                 = useState([]);
  const [ctItemName, setCtItemName]           = useState('');
  const [ctItemCal, setCtItemCal]             = useState('');
  const [ctItemProtein, setCtItemProtein]     = useState('');
  const [ctItemCarbs, setCtItemCarbs]         = useState('');
  const [ctItemFat, setCtItemFat]             = useState('');
  const [ctItemServing, setCtItemServing]     = useState('');
  const [ctShowMacros, setCtShowMacros]       = useState(false);
  const [ctShowAddItemForm, setCtShowAddItemForm] = useState(false);
  const [ctItemError, setCtItemError]         = useState('');
  const [ctSaving, setCtSaving]               = useState(false);
  const [ctError, setCtError]                 = useState('');
  const [editingTemplateId, setEditingTemplateId] = useState(null);

  // inline item-edit state
  const [editingItemIdx, setEditingItemIdx] = useState(null);
  const [eiName, setEiName]               = useState('');
  const [eiCal, setEiCal]                 = useState('');
  const [eiProtein, setEiProtein]         = useState('');
  const [eiCarbs, setEiCarbs]             = useState('');
  const [eiFat, setEiFat]                 = useState('');
  const [eiServing, setEiServing]         = useState('');
  const [eiShowMacros, setEiShowMacros]   = useState(false);
  const [eiError, setEiError]             = useState('');

  const load = useCallback((isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    return api.get(`/meals?date=${today}`)
      .then((res) => setMeals(res.data || []))
      .catch(() => {})
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, [today]);

  const loadTemplates = useCallback(() => {
    setTemplatesLoading(true);
    api.get('/templates?type=meal')
      .then((res) => setTemplates(res.data?.templates || []))
      .catch(() => {})
      .finally(() => setTemplatesLoading(false));
  }, []);

  useEffect(() => { load(); }, [load, refreshTrigger]);
  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  // Deep link ghi hụt -> mở sẵn form và điền tên món, để user không phải gõ lại.
  useEffect(() => {
    if (!draft || !draft.text) return;
    setShowForm(true);
    setFoodName(draft.text);
    setFormError('');
    if (onDraftConsumed) onDraftConsumed();
  }, [draft, onDraftConsumed]);

  const onRefresh = () => { setRefreshing(true); load(true); };

  const resetForm = () => {
    setMealType(getMealType());
    setFoodName('');
    setCalories('');
    setProtein('');
    setCarbs('');
    setFat('');
    setServingSize('');
    setFormError('');
  };

  const handleSave = async () => {
    if (!foodName.trim() || !(parseInt(calories) > 0)) {
      setFormError('Please enter a food name and calories');
      return;
    }
    setFormError('');
    setSaving(true);
    const payload = {
      date: today,
      mealType,
      items: [{
        name:            foodName.trim(),
        calories:        parseInt(calories)  || 0,
        protein:         parseInt(protein)   || 0,
        carbs:           parseInt(carbs)     || 0,
        fat:             parseInt(fat)       || 0,
        servingSize:     servingSize.trim()  || '1 serving',
        servingQuantity: 1,
        source:          'manual',
      }],
    };
    try {
      await api.post('/meals', payload);
      setLastMealPayload(payload);
      setSaveTmplName(foodName.trim());
      resetForm();
      setShowForm(false);
      load();
      setShowSaveModal(true);
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to save meal');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTemplate = async (name) => {
    if (!name || !lastMealPayload) return;
    setSavingTemplate(true);
    try {
      await api.post('/templates', {
        type:     'meal',
        name,
        mealType: lastMealPayload.mealType,
        items:    lastMealPayload.items.map(({ name: n, calories: c, protein: p, carbs: cb, fat: f, servingSize: ss }) => ({
          name: n, calories: c, protein: p, carbs: cb, fat: f, servingSize: ss,
        })),
      });
      setShowSaveModal(false);
      loadTemplates();
    } catch (err) {
      setShowSaveModal(false);
      if (err?.response?.status === 403) {
        Alert.alert('Template limit reached', 'Upgrade to Premium for unlimited templates');
      } else {
        Alert.alert('Error', 'Could not save template');
      }
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleLogTemplate = async (template, chosenMealType) => {
    try {
      await api.post('/meals', { date: today, mealType: chosenMealType, items: template.items });
      setShowTemplateSheet(false);
      setSelectedTemplate(null);
      load();
    } catch {
      Alert.alert('Error', 'Could not log meal');
    }
  };

  const handleDeleteTemplate = (template, onSuccess) => {
    Alert.alert(
      'Delete template?',
      `Delete '${template.name}'?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/templates/${template._id}`);
              loadTemplates();
              if (onSuccess) onSuccess();
            } catch {
              Alert.alert('Error', 'Could not delete template');
            }
          },
        },
      ]
    );
  };

  const openEditTemplate = (template) => {
    setShowTemplateSheet(false);
    setSelectedTemplate(null);
    setEditingTemplateId(template._id);
    setCtMealType(template.mealType || getMealType());
    setCtItems(template.items ? template.items.map((it) => ({
      name:        it.name,
      calories:    it.calories || 0,
      protein:     it.protein  || 0,
      carbs:       it.carbs    || 0,
      fat:         it.fat      || 0,
      servingSize: it.servingSize || undefined,
    })) : []);
    setCtItemName('');
    setCtItemCal('');
    setCtItemProtein('');
    setCtItemCarbs('');
    setCtItemFat('');
    setCtItemServing('');
    setCtShowMacros(false);
    setCtShowAddItemForm(false);
    setCtItemError('');
    setCtError('');
    setShowCreateForm(true);
  };

  const resetCreateForm = () => {
    setCtMealType(getMealType());
    setCtItems([]);
    setCtItemName('');
    setCtItemCal('');
    setCtItemProtein('');
    setCtItemCarbs('');
    setCtItemFat('');
    setCtItemServing('');
    setCtShowAddItemForm(false);
    setCtItemError('');
    setCtError('');
    setEditingTemplateId(null);
    setEditingItemIdx(null);
    setEiName(''); setEiCal(''); setEiProtein(''); setEiCarbs('');
    setEiFat(''); setEiServing(''); setEiShowMacros(false); setEiError('');
  };

  const handleAddCtItem = () => {
    if (!ctItemName.trim()) { setCtItemError('Food name is required'); return; }
    if (!(parseInt(ctItemCal) > 0)) { setCtItemError('Calories must be > 0'); return; }
    setCtItems((prev) => [
      ...prev,
      {
        name:        ctItemName.trim(),
        calories:    parseInt(ctItemCal),
        protein:     parseInt(ctItemProtein) || 0,
        carbs:       parseInt(ctItemCarbs) || 0,
        fat:         parseInt(ctItemFat) || 0,
        servingSize: ctItemServing.trim() || undefined,
      },
    ]);
    setCtItemName('');
    setCtItemCal('');
    setCtItemProtein('');
    setCtItemCarbs('');
    setCtItemFat('');
    setCtItemServing('');
    setCtItemError('');
    setCtShowAddItemForm(false);
    if (ctError) setCtError('');
  };

  const openItemEdit = (idx) => {
    const it = ctItems[idx];
    setEditingItemIdx(idx);
    setEiName(it.name || '');
    setEiCal(it.calories ? String(it.calories) : '');
    setEiProtein(it.protein ? String(it.protein) : '');
    setEiCarbs(it.carbs ? String(it.carbs) : '');
    setEiFat(it.fat ? String(it.fat) : '');
    setEiServing(it.servingSize || '');
    setEiShowMacros((it.protein || 0) > 0 || (it.carbs || 0) > 0 || (it.fat || 0) > 0);
    setEiError('');
    setCtShowAddItemForm(false);
  };

  const closeItemEdit = () => {
    setEditingItemIdx(null);
    setEiName(''); setEiCal(''); setEiProtein(''); setEiCarbs('');
    setEiFat(''); setEiServing(''); setEiShowMacros(false); setEiError('');
  };

  const saveItemEdit = () => {
    if (!eiName.trim())         { setEiError('Food name is required'); return; }
    if (!(parseInt(eiCal) > 0)) { setEiError('Calories must be > 0'); return; }
    setCtItems((prev) => prev.map((it, i) => i === editingItemIdx ? {
      name:        eiName.trim(),
      calories:    parseInt(eiCal),
      protein:     parseInt(eiProtein) || 0,
      carbs:       parseInt(eiCarbs)   || 0,
      fat:         parseInt(eiFat)     || 0,
      servingSize: eiServing.trim() || undefined,
    } : it));
    closeItemEdit();
  };

  const deleteItemFromEdit = () => {
    setCtItems((prev) => prev.filter((_, i) => i !== editingItemIdx));
    closeItemEdit();
  };

  const handleCreateTemplate = async () => {
    let workingItems = ctItems;
    if (ctShowAddItemForm && ctItemName.trim() && parseInt(ctItemCal) > 0) {
      workingItems = [
        ...ctItems,
        {
          name:        ctItemName.trim(),
          calories:    parseInt(ctItemCal),
          protein:     parseInt(ctItemProtein) || 0,
          carbs:       parseInt(ctItemCarbs) || 0,
          fat:         parseInt(ctItemFat) || 0,
          servingSize: ctItemServing.trim() || undefined,
        },
      ];
    }
    if (workingItems.length === 0) { setCtError('Add at least one item'); return; }
    const generatedName = buildTemplateName(workingItems);
    setCtSaving(true);
    setCtError('');
    const isEditing = !!editingTemplateId;
    const tmplId = editingTemplateId;
    try {
      if (isEditing) {
        await api.put(`/templates/${tmplId}`, {
          name: generatedName,
          items: workingItems,
        });
      } else {
        await api.post('/templates', {
          type: 'meal',
          name: generatedName,
          mealType: 'snack',
          items: workingItems,
        });
      }
      resetCreateForm();
      setShowCreateForm(false);
      loadTemplates();
      Alert.alert('Saved', isEditing ? 'Template updated' : 'Template created successfully');
    } catch (err) {
      if (err?.response?.status === 403) {
        Alert.alert('Template limit reached', 'Upgrade to Premium for unlimited templates');
        setShowCreateForm(false);
        resetCreateForm();
      } else {
        setCtError('Could not save template');
      }
    } finally {
      setCtSaving(false);
    }
  };

  const totalCal = meals.reduce((s, m) => s + (m.totals?.calories || 0), 0);

  const grouped = MEAL_TYPES.reduce((acc, type) => {
    const group = meals.filter((m) => m.mealType === type);
    if (group.length) acc[type] = group;
    return acc;
  }, {});

  if (loading) {
    return <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} />;
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 80 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />
        }
      >
        {/* Primary action first — big "+ Add meal" (chooser: Manual / ✨ AI) */}
        {!showForm && (
          <TouchableOpacity style={tabStyles.addBtn} onPress={() => setShowChooser(true)}>
            <Text style={tabStyles.addBtnText}>+ Add meal</Text>
          </TouchableOpacity>
        )}

        <View style={tabStyles.totalBar}>
          <Text style={tabStyles.totalLabel}>Total today</Text>
          <Text style={tabStyles.totalVal}>{Math.round(totalCal)} cal</Text>
        </View>

        {/* ── Create Template inline form ── */}
        {showCreateForm && (
          <View style={[mealFormStyles.container, { marginBottom: 4 }]}>
            <Text style={createFormStyles.formTitle}>{editingTemplateId ? 'Edit Template' : 'New Template'}</Text>

            <View style={createFormStyles.itemsGroup}>
              <View style={createFormStyles.itemsGroupHeader}>
                <Text style={createFormStyles.itemsLabel}>Items</Text>
                {ctItems.length > 0 ? (
                  <Text style={createFormStyles.itemsCount}>{ctItems.length}</Text>
                ) : null}
              </View>

              {/* Empty state */}
              {ctItems.length === 0 && !ctShowAddItemForm && (
                <TouchableOpacity
                  style={createFormStyles.itemsEmptyCard}
                  onPress={() => setCtShowAddItemForm(true)}
                  activeOpacity={0.7}
                >
                  <Text style={createFormStyles.itemsEmptyIcon}>＋</Text>
                  <Text style={createFormStyles.itemsEmptyTitle}>Add your first item</Text>
                  <Text style={createFormStyles.itemsEmptySub}>Tap to start</Text>
                </TouchableOpacity>
              )}

              {/* Items with inline editing */}
              {ctItems.map((item, i) => {
                if (editingItemIdx === i) {
                  return (
                    <View key={i} style={createFormStyles.itemEditCard}>
                      <Text style={createFormStyles.itemEditLabel}>Edit Item</Text>
                      <View style={createFormStyles.addItemRow}>
                        <TextInput
                          style={[mealFormStyles.input, createFormStyles.addItemNameInput]}
                          value={eiName}
                          onChangeText={(v) => { setEiName(v); if (eiError) setEiError(''); }}
                          placeholder="Food name"
                          placeholderTextColor="#444"
                          color="#FFF"
                          autoFocus
                        />
                        <TextInput
                          style={[mealFormStyles.inputSmall, createFormStyles.addItemCalInput]}
                          value={eiCal}
                          onChangeText={(v) => { setEiCal(v); if (eiError) setEiError(''); }}
                          placeholder="Cal"
                          placeholderTextColor="#444"
                          keyboardType="numeric"
                          color="#FFF"
                        />
                      </View>
                      <TouchableOpacity
                        style={createFormStyles.macrosToggle}
                        onPress={() => setEiShowMacros((v) => !v)}
                      >
                        <Text style={createFormStyles.macrosToggleText}>
                          {eiShowMacros ? '− Hide macros' : '+ Show macros'}
                        </Text>
                      </TouchableOpacity>
                      {eiShowMacros && (
                        <View style={{ gap: 8, marginBottom: 8 }}>
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TextInput
                              style={[mealFormStyles.inputSmall, { flex: 1 }]}
                              value={eiProtein} onChangeText={setEiProtein}
                              placeholder="Protein (g)" placeholderTextColor="#444"
                              keyboardType="numeric" color="#FFF"
                            />
                            <TextInput
                              style={[mealFormStyles.inputSmall, { flex: 1 }]}
                              value={eiCarbs} onChangeText={setEiCarbs}
                              placeholder="Carbs (g)" placeholderTextColor="#444"
                              keyboardType="numeric" color="#FFF"
                            />
                            <TextInput
                              style={[mealFormStyles.inputSmall, { flex: 1 }]}
                              value={eiFat} onChangeText={setEiFat}
                              placeholder="Fat (g)" placeholderTextColor="#444"
                              keyboardType="numeric" color="#FFF"
                            />
                          </View>
                          <TextInput
                            style={[mealFormStyles.input, { marginBottom: 0 }]}
                            value={eiServing} onChangeText={setEiServing}
                            placeholder="Serving size (optional)"
                            placeholderTextColor="#444" color="#FFF"
                          />
                        </View>
                      )}
                      {eiError ? (
                        <Text style={{ color: '#EF5350', fontSize: 12, marginBottom: 6 }}>{eiError}</Text>
                      ) : null}
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity
                          style={[createFormStyles.addItemBtn, { flex: 1, width: 'auto', height: 38 }]}
                          onPress={saveItemEdit}
                        >
                          <Text style={createFormStyles.addItemBtnText}>Save</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={createFormStyles.addItemCancelBtn}
                          onPress={closeItemEdit}
                        >
                          <Text style={{ color: '#666', fontSize: 14 }}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={createFormStyles.itemDeleteBtn}
                          onPress={deleteItemFromEdit}
                        >
                          <Text style={createFormStyles.itemDeleteBtnText}>Delete</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                }
                const macroLine = [
                  item.protein > 0 ? `${item.protein}g P` : null,
                  item.carbs > 0 ? `${item.carbs}g C` : null,
                  item.fat > 0 ? `${item.fat}g F` : null,
                ].filter(Boolean).join(' · ');
                return (
                  <TouchableOpacity
                    key={i}
                    style={createFormStyles.itemCard}
                    onPress={() => openItemEdit(i)}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={createFormStyles.itemCardName} numberOfLines={1}>{item.name}</Text>
                      {macroLine ? (
                        <Text style={createFormStyles.itemCardMacros}>{macroLine}</Text>
                      ) : item.servingSize ? (
                        <Text style={createFormStyles.itemCardMacros}>{item.servingSize}</Text>
                      ) : null}
                    </View>
                    <Text style={createFormStyles.itemCardCal}>{item.calories} cal</Text>
                    <Text style={createFormStyles.itemCardChevron}>›</Text>
                  </TouchableOpacity>
                );
              })}

              {/* + Add another item */}
              {!ctShowAddItemForm && ctItems.length > 0 && editingItemIdx === null && (
                <TouchableOpacity
                  style={createFormStyles.addItemToggleBtn}
                  onPress={() => setCtShowAddItemForm(true)}
                  activeOpacity={0.7}
                >
                  <Text style={createFormStyles.addItemToggleBtnText}>＋  Add another item</Text>
                </TouchableOpacity>
              )}

              {/* Add item inline form */}
              {ctShowAddItemForm && (
                <View style={createFormStyles.addItemFormContainer}>
                  <View style={createFormStyles.addItemRow}>
                    <TextInput
                      style={[mealFormStyles.input, createFormStyles.addItemNameInput]}
                      value={ctItemName}
                      onChangeText={(v) => { setCtItemName(v); if (ctItemError) setCtItemError(''); }}
                      placeholder="Food name"
                      placeholderTextColor="#444"
                      returnKeyType="next"
                      color="#FFF"
                      autoFocus
                    />
                    <TextInput
                      style={[mealFormStyles.inputSmall, createFormStyles.addItemCalInput]}
                      value={ctItemCal}
                      onChangeText={(v) => { setCtItemCal(v); if (ctItemError) setCtItemError(''); }}
                      placeholder="Cal"
                      placeholderTextColor="#444"
                      keyboardType="numeric"
                      returnKeyType="done"
                      color="#FFF"
                    />
                  </View>
                  <TouchableOpacity
                    style={createFormStyles.macrosToggle}
                    onPress={() => setCtShowMacros((v) => !v)}
                  >
                    <Text style={createFormStyles.macrosToggleText}>
                      {ctShowMacros ? '− Hide macros' : '+ Show macros'}
                    </Text>
                  </TouchableOpacity>
                  {ctShowMacros && (
                    <View style={{ gap: 8, marginBottom: 8 }}>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TextInput
                          style={[mealFormStyles.inputSmall, { flex: 1 }]}
                          value={ctItemProtein}
                          onChangeText={setCtItemProtein}
                          placeholder="Protein (g)"
                          placeholderTextColor="#444"
                          keyboardType="numeric"
                          color="#FFF"
                        />
                        <TextInput
                          style={[mealFormStyles.inputSmall, { flex: 1 }]}
                          value={ctItemCarbs}
                          onChangeText={setCtItemCarbs}
                          placeholder="Carbs (g)"
                          placeholderTextColor="#444"
                          keyboardType="numeric"
                          color="#FFF"
                        />
                        <TextInput
                          style={[mealFormStyles.inputSmall, { flex: 1 }]}
                          value={ctItemFat}
                          onChangeText={setCtItemFat}
                          placeholder="Fat (g)"
                          placeholderTextColor="#444"
                          keyboardType="numeric"
                          color="#FFF"
                        />
                      </View>
                      <TextInput
                        style={[mealFormStyles.input, { marginBottom: 0 }]}
                        value={ctItemServing}
                        onChangeText={setCtItemServing}
                        placeholder="Serving size (optional)"
                        placeholderTextColor="#444"
                        color="#FFF"
                      />
                    </View>
                  )}
                  {ctItemError ? (
                    <Text style={{ color: '#EF5350', fontSize: 12, marginBottom: 6 }}>{ctItemError}</Text>
                  ) : null}
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      style={[createFormStyles.addItemBtn, { flex: 1, width: 'auto', height: 38 }]}
                      onPress={handleAddCtItem}
                    >
                      <Text style={createFormStyles.addItemBtnText}>Add item</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={createFormStyles.addItemCancelBtn}
                      onPress={() => {
                        setCtItemName(''); setCtItemCal('');
                        setCtItemProtein(''); setCtItemCarbs(''); setCtItemFat(''); setCtItemServing('');
                        setCtItemError(''); setCtShowAddItemForm(false);
                      }}
                    >
                      <Text style={{ color: '#666', fontSize: 14 }}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>

            {ctError ? (
              <Text style={{ color: '#EF5350', fontSize: 12, marginBottom: 8, marginTop: 4 }}>{ctError}</Text>
            ) : null}

            {/* Save */}
            <TouchableOpacity
              style={[mealFormStyles.saveBtn, { marginTop: 4 }, ctSaving && { opacity: 0.6 }]}
              onPress={handleCreateTemplate}
              disabled={ctSaving}
            >
              {ctSaving
                ? <ActivityIndicator color="#0F0F0F" />
                : <Text style={mealFormStyles.saveBtnText}>{editingTemplateId ? 'Save Changes' : 'Save Template'}</Text>}
            </TouchableOpacity>

            {/* Cancel */}
            <TouchableOpacity
              style={{ paddingVertical: 12, alignItems: 'center' }}
              onPress={() => { resetCreateForm(); setShowCreateForm(false); }}
            >
              <Text style={{ color: '#666', fontSize: 14 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Separator ── */}
        <View style={createFormStyles.divider} />

        {meals.length === 0 && !showForm && (
          <Text style={tabStyles.emptyText}>No meals logged today</Text>
        )}

        {Object.entries(grouped).map(([type, group]) => (
          <View key={type} style={tabStyles.section}>
            <Text style={tabStyles.sectionTitle}>{MEAL_LABELS[type]}</Text>
            {group.map((meal) => (
              <View key={meal._id} style={tabStyles.itemRow}>
                <View style={{ flex: 1 }}>
                  {meal.items.map((it, i) => (
                    <TouchableOpacity
                      key={i}
                      onPress={() => {
                        setEditName(it.name);
                        setEditCalories(it.calories || 0);
                        setEditProtein(it.protein  || 0);
                        setEditCarbs(it.carbs      || 0);
                        setEditFat(it.fat          || 0);
                        setEditServing(it.servingSize || '');
                        setEditShowMacros(
                          (it.protein || 0) > 0 || (it.carbs || 0) > 0 || (it.fat || 0) > 0
                        );
                        setEditingMeal({ mealId: meal._id, itemId: it._id });
                      }}
                      activeOpacity={0.6}
                    >
                      <Text style={tabStyles.itemName} numberOfLines={1}>{it.name}</Text>
                    </TouchableOpacity>
                  ))}
                  <Text style={tabStyles.itemMeta}>
                    {Math.round(meal.totals?.calories || 0)} cal
                    {meal.totals?.protein ? ` · ${Math.round(meal.totals.protein)}g P` : ''}
                    {meal.totals?.carbs ? ` · ${Math.round(meal.totals.carbs)}g C` : ''}
                    {meal.totals?.fat ? ` · ${Math.round(meal.totals.fat)}g F` : ''}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={async () => {
                    try {
                      await api.delete(`/meals/${meal._id}`);
                      load();
                    } catch (err) {
                      Alert.alert('Error', 'Could not delete meal');
                    }
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={{ padding: 8 }}
                >
                  <Text style={{ color: '#EF5350', fontSize: 16 }}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ))}

        {/* Inline add meal form */}
        {showForm && (
          <View style={mealFormStyles.container}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {MEAL_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[mealFormStyles.pill, mealType === t && mealFormStyles.pillOn]}
                    onPress={() => setMealType(t)}
                  >
                    <Text style={[mealFormStyles.pillText, mealType === t && mealFormStyles.pillTextOn]}>
                      {MEAL_LABELS[t]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <TextInput
              style={mealFormStyles.input}
              value={foodName}
              onChangeText={(v) => { setFoodName(v); if (formError) setFormError(''); }}
              placeholder="Food name..."
              placeholderTextColor="#444"
              color="#FFFFFF"
            />
            {formError ? (
              <Text style={{ color: '#EF5350', fontSize: 12, marginTop: 4, marginBottom: 6 }}>{formError}</Text>
            ) : null}

            <View style={mealFormStyles.row}>
              <View style={{ flex: 1 }}>
                <Text style={mealFormStyles.fieldLabel}>Calories *</Text>
                <TextInput
                  style={mealFormStyles.inputSmall}
                  value={calories}
                  onChangeText={(v) => { setCalories(v); if (formError) setFormError(''); }}
                  placeholder="0"
                  placeholderTextColor="#444"
                  keyboardType="numeric"
                  color="#FFFFFF"
                />
              </View>
              <View style={{ width: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={mealFormStyles.fieldLabel}>Protein (optional)</Text>
                <TextInput
                  style={mealFormStyles.inputSmall}
                  value={protein}
                  onChangeText={setProtein}
                  placeholder="0"
                  placeholderTextColor="#444"
                  keyboardType="numeric"
                  color="#FFFFFF"
                />
              </View>
            </View>

            <View style={mealFormStyles.row}>
              <View style={{ flex: 1 }}>
                <Text style={mealFormStyles.fieldLabel}>Carbs (optional)</Text>
                <TextInput
                  style={mealFormStyles.inputSmall}
                  value={carbs}
                  onChangeText={setCarbs}
                  placeholder="0"
                  placeholderTextColor="#444"
                  keyboardType="numeric"
                  color="#FFFFFF"
                />
              </View>
              <View style={{ width: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={mealFormStyles.fieldLabel}>Fat (optional)</Text>
                <TextInput
                  style={mealFormStyles.inputSmall}
                  value={fat}
                  onChangeText={setFat}
                  placeholder="0"
                  placeholderTextColor="#444"
                  keyboardType="numeric"
                  color="#FFFFFF"
                />
              </View>
            </View>

            <TextInput
              style={[mealFormStyles.input, { marginTop: 4 }]}
              value={servingSize}
              onChangeText={setServingSize}
              placeholder="Serving size (e.g. 1 bowl)"
              placeholderTextColor="#444"
              color="#FFFFFF"
            />

            <TouchableOpacity
              style={[mealFormStyles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#0F0F0F" /> : <Text style={mealFormStyles.saveBtnText}>Save Meal</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={{ paddingVertical: 12, alignItems: 'center' }}
              onPress={() => { resetForm(); setShowForm(false); }}
            >
              <Text style={{ color: '#666', fontSize: 14 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Saved (secondary) — shrunk to the bottom; one ghost entry ── */}
        {templates.length > 0 && (
          <TemplatePillRow
            templates={templates}
            loading={templatesLoading}
            onSelect={(t) => { setSelectedTemplate(t); setShowTemplateSheet(true); }}
            onLongPress={(t) => Alert.alert(
              t.name,
              'What would you like to do?',
              [
                { text: 'Edit',   onPress: () => openEditTemplate(t) },
                { text: 'Delete', style: 'destructive', onPress: () => handleDeleteTemplate(t) },
                { text: 'Cancel', style: 'cancel' },
              ]
            )}
            sectionLabel="Saved Meals"
            getLabelFn={(t) => {
              const cal = t.items?.reduce((s, i) => s + (i.calories || 0), 0) || 0;
              return cal > 0 ? `${t.name} · ${cal} cal` : t.name;
            }}
          />
        )}
        {!showCreateForm && (
          <TouchableOpacity
            style={createFormStyles.toggleBtn}
            onPress={() => { setShowCreateForm(true); setCtShowAddItemForm(true); }}
            activeOpacity={0.7}
          >
            <Text style={createFormStyles.toggleBtnText}>+ Save a meal</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Single primary add action → chooser (Manual / ✨ AI). Replaces the
          separate "+ Add Meal" button and the floating "AI Log" FAB. */}
      <ActionChooserSheet
        visible={showChooser}
        onClose={() => setShowChooser(false)}
        title="Add meal"
        manualLabel="Manual"
        aiLabel="✨ AI"
        onManual={() => { setMealType(getMealType()); setShowForm(true); }}
        onAI={() => navigation.navigate('ChatInput')}
      />

      {/* Edit item bottom sheet */}
      <Modal visible={editingMeal !== null} transparent animationType="slide" onRequestClose={() => setEditingMeal(null)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <TouchableWithoutFeedback onPress={() => setEditingMeal(null)}>
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' }} />
          </TouchableWithoutFeedback>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <ScrollView
              style={{ backgroundColor: '#1A1A1A', borderTopLeftRadius: 20, borderTopRightRadius: 20 }}
              contentContainerStyle={{ padding: 20 }}
              keyboardShouldPersistTaps="handled"
              bounces={false}
            >
              <Text style={{ color: '#888', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Edit Item</Text>

              {/* Name */}
              <TextInput
                style={mealFormStyles.input}
                value={editName}
                onChangeText={setEditName}
                placeholder="Food name..."
                placeholderTextColor="#444"
                color="#FFFFFF"
              />

              {/* Calories stepper */}
              <Text style={{ color: '#888', fontSize: 12, marginBottom: 8 }}>Calories</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 16 }}>
                <TouchableOpacity
                  onPress={() => setEditCalories(Math.max(0, editCalories - 50))}
                  style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#252525', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ color: '#FFF', fontSize: 22, fontWeight: '700' }}>−</Text>
                </TouchableOpacity>
                <TextInput
                  style={{ backgroundColor: '#252525', borderRadius: 10, paddingHorizontal: 12, color: '#FFF', fontSize: 20, fontWeight: '700', textAlign: 'center', minWidth: 80, height: 48 }}
                  value={String(editCalories)}
                  onChangeText={(v) => setEditCalories(parseInt(v) || 0)}
                  keyboardType="numeric"
                />
                <TouchableOpacity
                  onPress={() => setEditCalories(editCalories + 50)}
                  style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#252525', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ color: '#FFF', fontSize: 22, fontWeight: '700' }}>+</Text>
                </TouchableOpacity>
              </View>

              {/* Macros toggle */}
              <TouchableOpacity
                style={createFormStyles.macrosToggle}
                onPress={() => setEditShowMacros((v) => !v)}
              >
                <Text style={createFormStyles.macrosToggleText}>
                  {editShowMacros ? '− Hide macros' : '+ Show macros'}
                </Text>
              </TouchableOpacity>

              {editShowMacros && (
                <View style={{ gap: 8, marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#555', fontSize: 11, marginBottom: 4 }}>Protein (g)</Text>
                      <TextInput
                        style={mealFormStyles.inputSmall}
                        value={editProtein === 0 ? '' : String(editProtein)}
                        onChangeText={(v) => setEditProtein(parseInt(v) || 0)}
                        placeholder="0"
                        placeholderTextColor="#444"
                        keyboardType="numeric"
                        color="#FFF"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#555', fontSize: 11, marginBottom: 4 }}>Carbs (g)</Text>
                      <TextInput
                        style={mealFormStyles.inputSmall}
                        value={editCarbs === 0 ? '' : String(editCarbs)}
                        onChangeText={(v) => setEditCarbs(parseInt(v) || 0)}
                        placeholder="0"
                        placeholderTextColor="#444"
                        keyboardType="numeric"
                        color="#FFF"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#555', fontSize: 11, marginBottom: 4 }}>Fat (g)</Text>
                      <TextInput
                        style={mealFormStyles.inputSmall}
                        value={editFat === 0 ? '' : String(editFat)}
                        onChangeText={(v) => setEditFat(parseInt(v) || 0)}
                        placeholder="0"
                        placeholderTextColor="#444"
                        keyboardType="numeric"
                        color="#FFF"
                      />
                    </View>
                  </View>
                  <TextInput
                    style={[mealFormStyles.input, { marginBottom: 0 }]}
                    value={editServing}
                    onChangeText={setEditServing}
                    placeholder="Serving size (optional)"
                    placeholderTextColor="#444"
                    color="#FFF"
                  />
                </View>
              )}

              <TouchableOpacity
                style={[mealFormStyles.saveBtn, { marginTop: 12 }, editSaving && { opacity: 0.6 }]}
                onPress={async () => {
                  if (!editName.trim()) return;
                  setEditSaving(true);
                  try {
                    await api.put(`/meals/${editingMeal.mealId}`, {
                      updateItem: {
                        itemId:      editingMeal.itemId,
                        name:        editName.trim(),
                        calories:    editCalories,
                        protein:     editProtein,
                        carbs:       editCarbs,
                        fat:         editFat,
                        servingSize: editServing.trim() || undefined,
                      },
                    });
                    setEditingMeal(null);
                    load();
                  } catch {
                    Alert.alert('Error', 'Could not update item');
                  } finally {
                    setEditSaving(false);
                  }
                }}
                disabled={editSaving}
              >
                {editSaving ? <ActivityIndicator color="#0F0F0F" /> : <Text style={mealFormStyles.saveBtnText}>Save Changes</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={{ paddingVertical: 12, alignItems: 'center', marginTop: 4 }} onPress={() => setEditingMeal(null)}>
                <Text style={{ color: '#666', fontSize: 14 }}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Meal template preview sheet */}
      <MealTemplatePreviewSheet
        template={selectedTemplate}
        visible={showTemplateSheet}
        onClose={() => { setShowTemplateSheet(false); setSelectedTemplate(null); }}
        onLog={handleLogTemplate}
        onEdit={openEditTemplate}
        onDelete={(t) => handleDeleteTemplate(t, () => { setShowTemplateSheet(false); setSelectedTemplate(null); })}
      />

      {/* Save as template modal */}
      <SaveTemplateModal
        visible={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={handleSaveTemplate}
        defaultName={saveTmplName}
        saving={savingTemplate}
        type="meal"
      />
    </View>
  );
};

// ─── ACTIVITY SECTION ─────────────────────────────────────────────────────────

const AddActivityModal = ({ visible, onClose, onSaved, today }) => {
  const [entry, setEntry] = useState({
    name: '', type: 'Cardio', durationMinutes: '', caloriesBurned: '', intensity: 'Medium',
  });
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setEntry({ name: '', type: 'Cardio', durationMinutes: '', caloriesBurned: '', intensity: 'Medium' });
  };

  const handleClose = () => { resetForm(); onClose(); };

  const handleSave = () => {
    if (!entry.name.trim()) { Alert.alert('Name required'); return; }
    const dur = parseInt(entry.durationMinutes);
    const cal = parseInt(entry.caloriesBurned);
    if (isNaN(dur) || dur < 0) { Alert.alert('Valid duration required'); return; }
    if (isNaN(cal) || cal < 0) { Alert.alert('Valid calories required'); return; }

    setSaving(true);
    api.post('/activities', {
      date: today,
      entries: [{
        name: entry.name.trim(),
        type: entry.type.toLowerCase().replace(' ', '_'),
        durationMinutes: dur,
        caloriesBurned: cal,
        intensity: entry.intensity.toLowerCase(),
      }],
    })
      .then(() => {
        resetForm();
        onSaved({ name: entry.name.trim(), activityName: entry.name.trim(), durationMinutes: dur, caloriesBurned: cal });
      })
      .catch((err) => Alert.alert('Error', err?.response?.data?.message || 'Failed to save'))
      .finally(() => setSaving(false));
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <SafeAreaView style={modalStyles.container} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>Add Activity</Text>
            <TouchableOpacity onPress={handleClose}>
              <Text style={modalStyles.closeBtn}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" bounces={false}>
              <Text style={modalStyles.label}>Activity Name</Text>
              <TextInput
                style={modalStyles.input}
                placeholder="e.g. Running"
                placeholderTextColor={C.secondary}
                value={entry.name}
                onChangeText={(v) => setEntry((p) => ({ ...p, name: v }))}
              />

              <Text style={modalStyles.label}>Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                <View style={modalStyles.chipRow}>
                  {ACTIVITY_TYPES.map((t) => (
                    <TouchableOpacity
                      key={t}
                      style={[modalStyles.chip, entry.type === t && modalStyles.chipActive]}
                      onPress={() => setEntry((p) => ({ ...p, type: t }))}
                    >
                      <Text style={[modalStyles.chipText, entry.type === t && modalStyles.chipTextActive]}>
                        {t}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <View style={modalStyles.row2}>
                <View style={{ flex: 1 }}>
                  <Text style={modalStyles.label}>Duration (min)</Text>
                  <TextInput
                    style={modalStyles.input}
                    placeholder="30"
                    placeholderTextColor={C.secondary}
                    keyboardType="numeric"
                    value={entry.durationMinutes}
                    onChangeText={(v) => setEntry((p) => ({ ...p, durationMinutes: v }))}
                  />
                </View>
                <View style={{ width: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={modalStyles.label}>Calories Burned</Text>
                  <TextInput
                    style={modalStyles.input}
                    placeholder="250"
                    placeholderTextColor={C.secondary}
                    keyboardType="numeric"
                    value={entry.caloriesBurned}
                    onChangeText={(v) => setEntry((p) => ({ ...p, caloriesBurned: v }))}
                  />
                </View>
              </View>

              <Text style={modalStyles.label}>Intensity</Text>
              <View style={modalStyles.chipRow}>
                {INTENSITIES.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[modalStyles.chip, entry.intensity === t && modalStyles.chipActive]}
                    onPress={() => setEntry((p) => ({ ...p, intensity: t }))}
                  >
                    <Text style={[modalStyles.chipText, entry.intensity === t && modalStyles.chipTextActive]}>
                      {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
          </ScrollView>

          <TouchableOpacity
            style={[modalStyles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color={C.bg} />
              : <Text style={modalStyles.saveBtnText}>Save Activity</Text>}
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const ActivityTab = ({ today, refreshTrigger, navigation }) => {
  const [showChooser, setShowChooser] = useState(false);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editingActivity, setEditingActivity] = useState(null);

  // template state
  const [templates, setTemplates]               = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [showSaveModal, setShowSaveModal]       = useState(false);
  const [saveTmplName, setSaveTmplName]         = useState('');
  const [savingTemplate, setSavingTemplate]     = useState(false);
  const [lastActivityData, setLastActivityData] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showTemplateSheet, setShowTemplateSheet] = useState(false);

  // create template form state
  const [showCreateForm, setShowCreateForm]       = useState(false);
  const [ctName, setCtName]                       = useState('');
  const [ctNameUserEdited, setCtNameUserEdited]   = useState(false);
  const [ctActivityName, setCtActivityName]       = useState('');
  const [ctDuration, setCtDuration]               = useState('');
  const [ctCalories, setCtCalories]               = useState('');
  const [ctSaving, setCtSaving]                   = useState(false);
  const [ctError, setCtError]                     = useState('');
  const [editingTemplateId, setEditingTemplateId] = useState(null);

  const load = useCallback((isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    return api.get(`/activities?date=${today}`)
      .then((res) => setLogs(res.data || []))
      .catch(() => {})
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, [today]);

  const loadTemplates = useCallback(() => {
    setTemplatesLoading(true);
    api.get('/templates?type=activity')
      .then((res) => setTemplates(res.data?.templates || []))
      .catch(() => {})
      .finally(() => setTemplatesLoading(false));
  }, []);

  useEffect(() => { load(); }, [load, refreshTrigger]);
  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  useEffect(() => {
    if (ctNameUserEdited) return;
    setCtName(ctActivityName);
  }, [ctActivityName, ctNameUserEdited]);

  const onRefresh = () => { setRefreshing(true); load(true); };

  const deleteLog = (id) => {
    Alert.alert('Delete activity?', '', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: () => {
          api.delete(`/activities/${id}`)
            .then(() => load())
            .catch(() => Alert.alert('Error', 'Could not delete'));
        },
      },
    ]);
  };

  const handleSaveTemplate = async (name) => {
    if (!name || !lastActivityData) return;
    setSavingTemplate(true);
    try {
      await api.post('/templates', {
        type:            'activity',
        name,
        activityName:    lastActivityData.activityName,
        durationMinutes: lastActivityData.durationMinutes,
        caloriesBurned:  lastActivityData.caloriesBurned,
      });
      setShowSaveModal(false);
      loadTemplates();
    } catch (err) {
      setShowSaveModal(false);
      if (err?.response?.status === 403) {
        Alert.alert('Template limit reached', 'Upgrade to Premium for unlimited templates');
      } else {
        Alert.alert('Error', 'Could not save template');
      }
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleLogTemplate = async (template) => {
    try {
      await api.post('/activities', {
        date: today,
        entries: [{ name: template.activityName, durationMinutes: template.durationMinutes, caloriesBurned: template.caloriesBurned }],
      });
      setShowTemplateSheet(false);
      setSelectedTemplate(null);
      load();
    } catch {
      Alert.alert('Error', 'Could not log activity');
    }
  };

  const resetCreateForm = () => {
    setCtName('');
    setCtNameUserEdited(false);
    setCtActivityName('');
    setCtDuration('');
    setCtCalories('');
    setCtError('');
    setEditingTemplateId(null);
  };

  const handleCreateTemplate = async () => {
    if (!ctActivityName.trim()) { setCtError('Activity name is required'); return; }
    const dur = parseInt(ctDuration);
    if (!(dur > 0)) { setCtError('Duration must be > 0'); return; }
    const cal = parseInt(ctCalories);
    if (isNaN(cal) || cal < 0) { setCtError('Calories must be >= 0'); return; }
    if (!ctName.trim()) { setCtError('Template name is required'); return; }
    setCtSaving(true);
    setCtError('');
    const isEditing = !!editingTemplateId;
    const tmplId = editingTemplateId;
    try {
      if (isEditing) {
        await api.put(`/templates/${tmplId}`, {
          name:            ctName.trim(),
          activityName:    ctActivityName.trim(),
          durationMinutes: dur,
          caloriesBurned:  cal,
        });
      } else {
        await api.post('/templates', {
          type:            'activity',
          name:            ctName.trim(),
          activityName:    ctActivityName.trim(),
          durationMinutes: dur,
          caloriesBurned:  cal,
        });
      }
      resetCreateForm();
      setShowCreateForm(false);
      loadTemplates();
      Alert.alert('Saved', isEditing ? 'Template updated' : 'Template created successfully');
    } catch (err) {
      if (err?.response?.status === 403) {
        Alert.alert('Template limit reached', 'Upgrade to Premium for unlimited templates');
        setShowCreateForm(false);
        resetCreateForm();
      } else {
        setCtError('Could not save template');
      }
    } finally {
      setCtSaving(false);
    }
  };

  const openEditTemplate = (template) => {
    setShowTemplateSheet(false);
    setSelectedTemplate(null);
    setEditingTemplateId(template._id);
    setCtActivityName(template.activityName || '');
    setCtDuration(String(template.durationMinutes || ''));
    setCtCalories(String(template.caloriesBurned ?? 0));
    setCtName(template.name || '');
    setCtNameUserEdited(true);
    setCtError('');
    setShowCreateForm(true);
  };

  const handleDeleteTemplate = (template, onSuccess) => {
    Alert.alert(
      'Delete template?',
      `Delete '${template.name}'?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/templates/${template._id}`);
              loadTemplates();
              if (onSuccess) onSuccess();
            } catch {
              Alert.alert('Error', 'Could not delete template');
            }
          },
        },
      ]
    );
  };

  const totalBurned = logs.reduce((s, l) => s + (l.summary?.totalCaloriesBurned || 0), 0);
  const totalMinutes = logs.reduce((s, l) => s + (l.summary?.totalActiveMinutes || 0), 0);

  if (loading) {
    return <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} />;
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 80 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
      >
        {/* Primary action first — big "+ Add activity" (chooser: Manual / ✨ AI) */}
        <TouchableOpacity style={tabStyles.addBtn} onPress={() => setShowChooser(true)}>
          <Text style={tabStyles.addBtnText}>+ Add activity</Text>
        </TouchableOpacity>

        <View style={tabStyles.totalBar}>
          <Text style={tabStyles.totalLabel}>Total burned</Text>
          <Text style={tabStyles.totalVal}>{totalBurned} cal · {totalMinutes} min</Text>
        </View>

        {/* ── Create / Edit Template inline form ── */}
        {showCreateForm && (
          <View style={[mealFormStyles.container, { marginBottom: 4 }]}>
            <Text style={createFormStyles.formTitle}>{editingTemplateId ? 'Edit Template' : 'New Template'}</Text>

            <TextInput
              style={mealFormStyles.input}
              value={ctActivityName}
              onChangeText={(v) => { setCtActivityName(v); if (ctError) setCtError(''); }}
              placeholder="Activity name (e.g. Morning Run) *"
              placeholderTextColor="#444"
              maxLength={80}
              color="#FFF"
              autoFocus
            />

            <TextInput
              style={mealFormStyles.input}
              value={ctName}
              onChangeText={(v) => { setCtName(v); setCtNameUserEdited(true); if (ctError) setCtError(''); }}
              placeholder="Template name (auto-filled)"
              placeholderTextColor="#444"
              maxLength={100}
              color="#FFF"
            />

            <View style={mealFormStyles.row}>
              <View style={{ flex: 1 }}>
                <Text style={mealFormStyles.fieldLabel}>Duration (min) *</Text>
                <TextInput
                  style={mealFormStyles.inputSmall}
                  value={ctDuration}
                  onChangeText={(v) => { setCtDuration(v); if (ctError) setCtError(''); }}
                  placeholder="30"
                  placeholderTextColor="#444"
                  keyboardType="numeric"
                  color="#FFF"
                />
              </View>
              <View style={{ width: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={mealFormStyles.fieldLabel}>Calories burned *</Text>
                <TextInput
                  style={mealFormStyles.inputSmall}
                  value={ctCalories}
                  onChangeText={(v) => { setCtCalories(v); if (ctError) setCtError(''); }}
                  placeholder="0"
                  placeholderTextColor="#444"
                  keyboardType="numeric"
                  color="#FFF"
                />
              </View>
            </View>

            {ctError ? (
              <Text style={{ color: '#EF5350', fontSize: 12, marginBottom: 8, marginTop: 4 }}>{ctError}</Text>
            ) : null}

            <TouchableOpacity
              style={[mealFormStyles.saveBtn, { marginTop: 4 }, ctSaving && { opacity: 0.6 }]}
              onPress={handleCreateTemplate}
              disabled={ctSaving}
            >
              {ctSaving
                ? <ActivityIndicator color="#0F0F0F" />
                : <Text style={mealFormStyles.saveBtnText}>{editingTemplateId ? 'Save Changes' : 'Save Template'}</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={{ paddingVertical: 12, alignItems: 'center' }}
              onPress={() => { resetCreateForm(); setShowCreateForm(false); }}
            >
              <Text style={{ color: '#666', fontSize: 14 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Separator ── */}
        <View style={createFormStyles.divider} />

        {logs.length === 0 && <Text style={tabStyles.emptyText}>No activities logged today</Text>}

        {logs.map((log) =>
          log.entries.map((e, i) => (
            <View key={`${log._id}-${i}`} style={tabStyles.itemRow}>
              <TouchableOpacity
                style={{ flex: 1 }}
                onPress={() => setEditingActivity({
                  logId: log._id, entryId: e._id, name: e.name,
                  caloriesBurned: e.caloriesBurned.toString(),
                  durationMinutes: e.durationMinutes.toString(),
                })}
                activeOpacity={0.6}
              >
                <Text style={tabStyles.itemName}>{e.name}</Text>
                <Text style={tabStyles.itemMeta}>
                  {e.durationMinutes} min · {e.caloriesBurned} cal{e.intensity ? ` · ${e.intensity}` : ''}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={tabStyles.deleteBtn} onPress={() => deleteLog(log._id)}>
                <Text style={tabStyles.deleteBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))
        )}

        {/* ── Saved (secondary) — shrunk to the bottom; one ghost entry ── */}
        {templates.length > 0 && (
          <TemplatePillRow
            templates={templates}
            loading={templatesLoading}
            onSelect={(t) => { setSelectedTemplate(t); setShowTemplateSheet(true); }}
            sectionLabel="Saved Activities"
            onLongPress={(t) => Alert.alert(
              t.name,
              'What would you like to do?',
              [
                { text: 'Edit',   onPress: () => openEditTemplate(t) },
                { text: 'Delete', style: 'destructive', onPress: () => handleDeleteTemplate(t) },
                { text: 'Cancel', style: 'cancel' },
              ]
            )}
            getLabelFn={(t) => t.caloriesBurned > 0 ? `${t.name} · ${t.caloriesBurned} cal` : t.name}
          />
        )}
        {!showCreateForm && (
          <TouchableOpacity
            style={createFormStyles.toggleBtn}
            onPress={() => setShowCreateForm(true)}
            activeOpacity={0.7}
          >
            <Text style={createFormStyles.toggleBtnText}>+ Save an activity</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Single primary add action → chooser (Manual / ✨ AI). Replaces the
          separate "+ Add Activity" button and the floating "AI Log" FAB. */}
      <ActionChooserSheet
        visible={showChooser}
        onClose={() => setShowChooser(false)}
        title="Add activity"
        manualLabel="Manual"
        aiLabel="✨ AI"
        onManual={() => setShowModal(true)}
        onAI={() => navigation.navigate('ActivityChat')}
      />

      <AddActivityModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onSaved={(data) => {
          setShowModal(false);
          load();
          setLastActivityData(data);
          setSaveTmplName(data.name);
          setShowSaveModal(true);
        }}
        today={today}
      />

      {/* Edit activity bottom sheet */}
      <Modal visible={editingActivity !== null} transparent animationType="slide" onRequestClose={() => setEditingActivity(null)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <TouchableWithoutFeedback onPress={() => setEditingActivity(null)}>
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' }} />
          </TouchableWithoutFeedback>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={{ backgroundColor: '#1A1A1A', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}>
              <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '700', marginBottom: 20 }}>Edit Activity</Text>

              <Text style={{ color: '#666', fontSize: 11, marginBottom: 6 }}>ACTIVITY NAME</Text>
              <TextInput
                value={editingActivity?.name}
                onChangeText={(val) => setEditingActivity((prev) => ({ ...prev, name: val }))}
                style={{ color: '#FFF', fontSize: 15, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 14, marginBottom: 16 }}
              />

              <Text style={{ color: '#666', fontSize: 11, marginBottom: 6 }}>DURATION (min)</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <TouchableOpacity
                  onPress={() => setEditingActivity((prev) => ({ ...prev, durationMinutes: Math.max(1, parseInt(prev.durationMinutes) - 5).toString() }))}
                  style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 }}
                >
                  <Text style={{ color: '#FFF', fontSize: 20 }}>−</Text>
                </TouchableOpacity>
                <TextInput
                  value={editingActivity?.durationMinutes}
                  onChangeText={(val) => { if (/^\d*$/.test(val)) setEditingActivity((prev) => ({ ...prev, durationMinutes: val })); }}
                  keyboardType="numeric"
                  style={{ color: '#FFF', fontSize: 18, fontWeight: '700', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 12, minWidth: 70, textAlign: 'center', marginHorizontal: 10 }}
                />
                <TouchableOpacity
                  onPress={() => setEditingActivity((prev) => ({ ...prev, durationMinutes: (parseInt(prev.durationMinutes) + 5).toString() }))}
                  style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 }}
                >
                  <Text style={{ color: '#FFF', fontSize: 20 }}>+</Text>
                </TouchableOpacity>
                <Text style={{ color: '#666', fontSize: 14, marginLeft: 10 }}>min</Text>
              </View>

              <Text style={{ color: '#666', fontSize: 11, marginBottom: 6 }}>CALORIES BURNED</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
                <TouchableOpacity
                  onPress={() => setEditingActivity((prev) => ({ ...prev, caloriesBurned: Math.max(0, parseInt(prev.caloriesBurned) - 50).toString() }))}
                  style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 }}
                >
                  <Text style={{ color: '#FFF', fontSize: 20 }}>−</Text>
                </TouchableOpacity>
                <TextInput
                  value={editingActivity?.caloriesBurned}
                  onChangeText={(val) => { if (/^\d*$/.test(val)) setEditingActivity((prev) => ({ ...prev, caloriesBurned: val })); }}
                  keyboardType="numeric"
                  style={{ color: '#2ECC71', fontSize: 18, fontWeight: '700', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 12, minWidth: 70, textAlign: 'center', marginHorizontal: 10 }}
                />
                <TouchableOpacity
                  onPress={() => setEditingActivity((prev) => ({ ...prev, caloriesBurned: (parseInt(prev.caloriesBurned) + 50).toString() }))}
                  style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 }}
                >
                  <Text style={{ color: '#FFF', fontSize: 20 }}>+</Text>
                </TouchableOpacity>
                <Text style={{ color: '#666', fontSize: 14, marginLeft: 10 }}>cal</Text>
              </View>

              <TouchableOpacity
                onPress={async () => {
                  try {
                    await api.put(`/activities/${editingActivity.logId}`, {
                      updateEntry: {
                        entryId: editingActivity.entryId,
                        name: editingActivity.name,
                        caloriesBurned: parseInt(editingActivity.caloriesBurned) || 0,
                        durationMinutes: parseInt(editingActivity.durationMinutes) || 0,
                      },
                    });
                    setEditingActivity(null);
                    load();
                  } catch {
                    Alert.alert('Error', 'Could not save changes');
                  }
                }}
                style={{ backgroundColor: '#2ECC71', borderRadius: 14, padding: 16, alignItems: 'center' }}
              >
                <Text style={{ color: '#0F0F0F', fontSize: 15, fontWeight: '700' }}>Save Changes</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setEditingActivity(null)} style={{ alignItems: 'center', marginTop: 12 }}>
                <Text style={{ color: '#666', fontSize: 14 }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Activity template preview sheet */}
      <ActivityTemplatePreviewSheet
        template={selectedTemplate}
        visible={showTemplateSheet}
        onClose={() => { setShowTemplateSheet(false); setSelectedTemplate(null); }}
        onLog={handleLogTemplate}
        onEdit={openEditTemplate}
        onDelete={(t) => handleDeleteTemplate(t, () => { setShowTemplateSheet(false); setSelectedTemplate(null); })}
      />

      {/* Save as template modal */}
      <SaveTemplateModal
        visible={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={handleSaveTemplate}
        defaultName={saveTmplName}
        saving={savingTemplate}
        type="activity"
      />
    </View>
  );
};

// ─── WEIGHT SECTION ───────────────────────────────────────────────────────────

const AddWeightModal = ({ visible, onClose, onSaved }) => {
  const [weight, setWeight] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [dateObj, setDateObj] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);

  const resetForm = () => { setWeight(''); setNotes(''); setDateObj(new Date()); setShowPicker(false); };
  const handleClose = () => { resetForm(); onClose(); };

  const handleSave = () => {
    const w = parseFloat(weight);
    if (isNaN(w) || w <= 0) { Alert.alert('Valid weight required'); return; }
    setSaving(true);
    api.post('/weights', { weight: w, date: dateToYMD(dateObj), notes: notes.trim() || undefined })
      .then(() => { resetForm(); onSaved(); })
      .catch((err) => Alert.alert('Error', err?.response?.data?.message || 'Failed to save'))
      .finally(() => setSaving(false));
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <SafeAreaView style={modalStyles.container} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>Log Weight</Text>
            <TouchableOpacity onPress={handleClose}>
              <Text style={modalStyles.closeBtn}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" bounces={false}>
            <Text style={modalStyles.label}>Date</Text>
            <TouchableOpacity
              style={[modalStyles.input, { justifyContent: 'center' }]}
              onPress={() => setShowPicker(true)}
              activeOpacity={0.8}
            >
              <Text style={{ color: C.text, fontSize: 15 }}>
                {formatDisplayDate(dateToYMD(dateObj))}
              </Text>
            </TouchableOpacity>

            {showPicker && (
              <DateTimePicker
                value={dateObj}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                maximumDate={new Date()}
                onChange={(event, selectedDate) => {
                  setShowPicker(Platform.OS === 'ios');
                  if (selectedDate) setDateObj(selectedDate);
                }}
                themeVariant="dark"
                textColor="white"
              />
            )}
            {showPicker && Platform.OS === 'ios' && (
              <TouchableOpacity
                onPress={() => setShowPicker(false)}
                style={{ alignSelf: 'flex-end', paddingHorizontal: 16, paddingVertical: 8 }}
              >
                <Text style={{ color: C.primary, fontWeight: '600' }}>Done</Text>
              </TouchableOpacity>
            )}

            <Text style={modalStyles.label}>Weight (kg)</Text>
            <TextInput
              style={modalStyles.input}
              placeholder="70.0"
              placeholderTextColor={C.secondary}
              keyboardType="numeric"
              value={weight}
              onChangeText={setWeight}
            />

            <Text style={modalStyles.label}>Notes (optional)</Text>
            <TextInput
              style={[modalStyles.input, { height: 80, textAlignVertical: 'top', paddingTop: 12 }]}
              placeholder="How are you feeling?"
              placeholderTextColor={C.secondary}
              multiline
              value={notes}
              onChangeText={setNotes}
            />
          </ScrollView>

          <TouchableOpacity
            style={[modalStyles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color={C.bg} />
              : <Text style={modalStyles.saveBtnText}>Save Weight</Text>}
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const WeightTab = ({ refreshTrigger }) => {
  const [weights, setWeights] = useState([]);
  const [goalType, setGoalType] = useState('lose');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const INITIAL_SHOW = 3;

  const load = useCallback((isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    return Promise.all([
      api.get('/weights?limit=30'),
      api.get('/users/me'),
    ])
      .then(([weightsRes, userRes]) => {
        setWeights((weightsRes.data || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
        const activeGoal = userRes.data.user?.goals?.find(g => g.isActive);
        setGoalType(activeGoal?.type || 'lose');
      })
      .catch(() => {})
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(() => { load(); }, [load, refreshTrigger]);

  const onRefresh = () => { setRefreshing(true); load(true); };

  const deleteWeight = (id) => {
    Alert.alert('Delete entry?', '', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: () => {
          api.delete(`/weights/${id}`)
            .then(() => load())
            .catch(() => Alert.alert('Error', 'Could not delete'));
        },
      },
    ]);
  };

  if (loading) {
    return <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} />;
  }

  const latest = weights[0];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
    <ScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />
      }
    >
      {/* Latest weight highlighted */}
      {latest ? (
        <View style={weightStyles.latestCard}>
          <Text style={weightStyles.latestLabel}>Current Weight</Text>
          <Text style={weightStyles.latestVal}>{latest.weight} kg</Text>
          {latest.bmi ? (
            <Text style={[weightStyles.latestBmi, { color: getBMIInfo(latest.bmi).color }]}>
              BMI {Math.round(latest.bmi * 10) / 10} · {getBMIInfo(latest.bmi).label}
            </Text>
          ) : null}
          <Text style={weightStyles.latestDate}>
            {formatDisplayDate(latest.date?.slice(0, 10) || '')}
          </Text>
        </View>
      ) : (
        <Text style={tabStyles.emptyText}>No weight entries yet</Text>
      )}

      {/* Log button */}
      <TouchableOpacity style={tabStyles.addBtn} onPress={() => setShowModal(true)}>
        <Text style={tabStyles.addBtnText}>+ Log Weight</Text>
      </TouchableOpacity>

      {/* History list */}
      {weights.length > 0 && (
        <View style={tabStyles.section}>
          <Text style={tabStyles.sectionTitle}>History</Text>
          {(showAll ? weights : weights.slice(0, INITIAL_SHOW)).map((w, i) => {
            const prevW = weights[i + 1]?.weight;
            const changeColor = getWeightChangeColor(w.weight, prevW, goalType);
            const changeDiff = prevW != null ? w.weight - prevW : null;
            const bmiInfo = w.bmi ? getBMIInfo(w.bmi) : null;
            const isLatest = i === 0;
            return (
              <View
                key={w._id}
                style={[weightStyles.historyCard, isLatest && weightStyles.historyCardLatest]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={weightStyles.historyDate}>
                    {formatDisplayDate(w.date?.slice(0, 10) || '')}
                  </Text>
                  <Text style={weightStyles.historyWeight}>{w.weight} kg</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  {bmiInfo ? (
                    <Text style={{ color: '#888', fontSize: 12 }}>
                      {Math.round(w.bmi * 10) / 10} · {bmiInfo.label}
                    </Text>
                  ) : null}
                  {changeDiff !== null && changeDiff !== 0 ? (
                    <View style={{
                      marginTop: 4,
                      borderRadius: 10,
                      paddingHorizontal: 7,
                      paddingVertical: 2,
                      backgroundColor: changeDiff > 0
                        ? 'rgba(239,83,80,0.15)'
                        : 'rgba(46,204,113,0.15)',
                      alignSelf: 'flex-end',
                    }}>
                      <Text style={{
                        fontSize: 11,
                        fontWeight: '600',
                        color: changeDiff > 0 ? '#EF5350' : '#2ECC71',
                      }}>
                        {changeDiff > 0 ? '↑' : '↓'} {Math.abs(changeDiff).toFixed(1)}kg
                      </Text>
                    </View>
                  ) : null}
                  <TouchableOpacity
                    onPress={async () => {
                      console.log('deleting weight:', w._id);
                      try {
                        await api.delete(`/weights/${w._id}`);
                        load();
                      } catch (err) {
                        console.log('Delete weight error:', err.response?.data || err.message);
                        Alert.alert('Error', 'Could not delete weight');
                      }
                    }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={{ padding: 8, marginTop: 4 }}
                  >
                    <Text style={{ color: '#EF5350', fontSize: 16 }}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}

          {weights.length > INITIAL_SHOW && !showAll && (
            <TouchableOpacity onPress={() => setShowAll(true)}>
              <Text style={{ color: '#888', fontSize: 13, textAlign: 'center', paddingVertical: 10 }}>
                Show {weights.length - INITIAL_SHOW} more
              </Text>
            </TouchableOpacity>
          )}
          {showAll && weights.length > INITIAL_SHOW && (
            <TouchableOpacity onPress={() => setShowAll(false)}>
              <Text style={{ color: '#888', fontSize: 13, textAlign: 'center', paddingVertical: 10 }}>
                Show less
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <AddWeightModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onSaved={() => { setShowModal(false); load(); }}
      />
    </ScrollView>
    </KeyboardAvoidingView>
  );
};

// ─── MAIN LOG SCREEN ──────────────────────────────────────────────────────────

const TABS = [
  { key: 'meals', label: 'Meals' },
  { key: 'activity', label: 'Activity' },
  { key: 'weight', label: 'Weight' },
];

const LogScreen = ({ navigation, route }) => {
  const [activeTab, setActiveTab] = useState('meals');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const today = getToday();

  useEffect(() => {
    if (route?.params?.initialTab) {
      setActiveTab(route.params.initialTab);
    }
  }, [route?.params?.initialTab]);

  // Bản nháp do deep link đẩy sang khi POST /quicklog thất bại.
  const quickLogDraft = route?.params?.quickLogDraft;
  const clearQuickLogDraft = useCallback(() => {
    navigation.setParams({ quickLogDraft: undefined });
  }, [navigation]);

  useFocusEffect(useCallback(() => {
    setRefreshTrigger((n) => n + 1);
  }, []));

  return (
    <SafeAreaView style={styles.container}>
      {/* Screen header */}
      <View style={styles.header}>
        <Text style={styles.title}>Log</Text>
        <Text style={styles.date}>{formatDisplayDate(today)}</Text>
      </View>

      {/* Top tab bar */}
      <View style={styles.tabBar}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabBtn, activeTab === t.key && styles.tabBtnActive]}
            onPress={() => setActiveTab(t.key)}
          >
            <Text style={[styles.tabLabel, activeTab === t.key && styles.tabLabelActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab content */}
      <View style={{ flex: 1 }}>
        {activeTab === 'meals' && (
          <MealsTab
            today={today}
            refreshTrigger={refreshTrigger}
            navigation={navigation}
            draft={quickLogDraft && quickLogDraft.kind === 'meal' ? quickLogDraft : null}
            onDraftConsumed={clearQuickLogDraft}
          />
        )}
        {activeTab === 'activity' && <ActivityTab today={today} refreshTrigger={refreshTrigger} navigation={navigation} />}
        {activeTab === 'weight' && <WeightTab refreshTrigger={refreshTrigger} />}
      </View>
    </SafeAreaView>
  );
};

// ─── STYLES ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  title: { fontSize: 28, fontWeight: '700', color: C.text },
  date: { fontSize: 13, color: C.secondary },
  tabBar: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 4, backgroundColor: C.card, borderRadius: 10, padding: 3 },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  tabBtnActive: { backgroundColor: C.primary },
  tabLabel: { fontSize: 13, fontWeight: '600', color: C.secondary },
  tabLabelActive: { color: C.bg },
});

const tabStyles = StyleSheet.create({
  totalBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: C.card,
    borderRadius: 10,
  },
  totalLabel: { fontSize: 13, color: C.secondary },
  totalVal: { fontSize: 15, fontWeight: '700', color: C.primary },
  emptyText: { color: C.secondary, textAlign: 'center', marginTop: 32, fontSize: 14 },
  section: { marginHorizontal: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: C.secondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, marginTop: 8 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
  },
  rowBorder: { marginBottom: 0, borderBottomWidth: 0 },
  itemName: { fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 2 },
  itemMeta: { fontSize: 12, color: C.secondary },
  deleteBtn: { padding: 8 },
  deleteBtnText: { color: C.danger, fontSize: 16, fontWeight: '700' },
  addBtn: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 32,
    backgroundColor: C.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addBtnText: { color: C.bg, fontWeight: '700', fontSize: 15 },
});

const weightStyles = StyleSheet.create({
  latestCard: {
    margin: 16,
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.primary,
  },
  latestLabel: { fontSize: 12, color: C.secondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  latestVal: { fontSize: 40, fontWeight: '700', color: C.primary, marginBottom: 4 },
  latestBmi: { fontSize: 14 },
  latestDate: { fontSize: 12, color: C.secondary, marginTop: 4 },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  historyCardLatest: {
    borderLeftWidth: 3,
    borderLeftColor: '#2ECC71',
  },
  historyDate:   { color: '#888', fontSize: 13, marginBottom: 4 },
  historyWeight: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
});

const modalStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.modal },
  scrollContent: { paddingBottom: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  title: { fontSize: 18, fontWeight: '700', color: C.text },
  closeBtn: { fontSize: 16, color: C.secondary },
  label: { fontSize: 13, color: C.secondary, marginTop: 16, marginBottom: 6, marginHorizontal: 16 },
  input: {
    backgroundColor: C.input,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: C.text,
    fontSize: 15,
    marginHorizontal: 16,
    height: 48,
  },
  inputSmall: {
    backgroundColor: C.input,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: C.text,
    fontSize: 14,
    height: 40,
  },
  row4: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: 16, gap: 8 },
  row2: { flexDirection: 'row', marginHorizontal: 16 },
  halfField: { flex: 1, minWidth: '45%' },
  fieldLabel: { fontSize: 11, color: C.secondary, marginBottom: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: 12, gap: 8, marginBottom: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  chipActive: { backgroundColor: C.primary, borderColor: C.primary },
  chipText: { fontSize: 13, color: C.secondary, fontWeight: '500' },
  chipTextActive: { color: C.bg, fontWeight: '700' },
  results: {
    backgroundColor: C.card,
    marginHorizontal: 16,
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: 4,
  },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12 },
  resultBorder: { borderTopWidth: 1, borderTopColor: C.border },
  resultName: { color: C.text, fontSize: 14, marginRight: 8 },
  resultBrand: { fontSize: 11, color: C.secondary, marginTop: 2 },
  resultCal: { color: C.secondary, fontSize: 13 },
  pickerCard: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  pickerHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  pickerName: { fontSize: 16, fontWeight: '700', color: C.text, flex: 1, marginRight: 8 },
  pickerBrand: { fontSize: 12, color: C.secondary, marginTop: 2 },
  pickerClear: { padding: 4 },
  pickerClearText: { color: C.secondary, fontSize: 16 },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 8,
  },
  stepperBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnText: { color: C.text, fontSize: 24, fontWeight: '700', lineHeight: 28 },
  stepperInput: {
    backgroundColor: C.input,
    borderRadius: 8,
    paddingHorizontal: 8,
    color: C.text,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    minWidth: 64,
    height: 44,
  },
  stepperUnit: { fontSize: 14, color: C.secondary },
  pickerCal: { fontSize: 32, fontWeight: '700', color: C.primary, textAlign: 'center', marginBottom: 8 },
  pickerMacros: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  pickerMacroItem: { fontSize: 14, color: C.secondary },
  pickerMacroDot: { fontSize: 14, color: C.border },
  saveBtn: {
    backgroundColor: C.primary,
    margin: 16,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveBtnText: { color: C.bg, fontSize: 16, fontWeight: '700' },
});

const mealFormStyles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  pillOn:       { backgroundColor: C.primary, borderColor: C.primary },
  pillText:     { fontSize: 13, color: C.secondary, fontWeight: '500' },
  pillTextOn:   { color: C.bg, fontWeight: '700' },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    fontSize: 14,
  },
  row:          { flexDirection: 'row', marginBottom: 10 },
  fieldLabel:   { fontSize: 11, color: '#555', marginBottom: 4 },
  inputSmall: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 10,
    fontSize: 14,
  },
  saveBtn: {
    backgroundColor: C.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnText: { color: C.bg, fontWeight: '700', fontSize: 15 },
});

const createFormStyles = StyleSheet.create({
  toggleBtn: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(46,204,113,0.3)',
  },
  toggleBtnText: { color: C.primary, fontSize: 13, fontWeight: '600' },
  formTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: C.text,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  itemsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#555',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  ctItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 4,
  },
  ctItemName:   { color: C.text, fontSize: 13 },
  ctItemMacros: { color: '#555', fontSize: 11, marginTop: 2 },
  ctItemCal:    { color: C.primary, fontSize: 12, fontWeight: '600', marginRight: 10 },
  itemsGroup: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 10,
    marginBottom: 10,
  },
  itemsGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  itemsCount: {
    backgroundColor: 'rgba(46,204,113,0.15)',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    fontSize: 11,
    fontWeight: '700',
    color: C.primary,
    overflow: 'hidden',
  },
  itemsEmptyCard: {
    alignItems: 'center',
    paddingVertical: 18,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  itemsEmptyIcon: { fontSize: 20, color: '#555', marginBottom: 4 },
  itemsEmptyTitle: { color: '#888', fontSize: 13, fontWeight: '600', marginBottom: 2 },
  itemsEmptySub:   { color: '#555', fontSize: 11 },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 4,
  },
  itemCardName:    { color: C.text, fontSize: 13, fontWeight: '500' },
  itemCardMacros:  { color: '#555', fontSize: 11, marginTop: 1 },
  itemCardCal:     { color: C.primary, fontSize: 12, fontWeight: '600', marginRight: 6 },
  itemCardChevron: { color: '#555', fontSize: 18, lineHeight: 20 },
  itemEditCard: {
    backgroundColor: 'rgba(46,204,113,0.06)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(46,204,113,0.2)',
    padding: 10,
    marginBottom: 4,
  },
  itemEditLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  itemDeleteBtn: {
    borderRadius: 10,
    height: 38,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239,83,80,0.35)',
  },
  itemDeleteBtnText: { color: '#EF5350', fontSize: 13, fontWeight: '600' },
  addItemToggleBtn: {
    marginTop: 4,
    marginBottom: 8,
    paddingVertical: 11,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(46,204,113,0.3)',
    backgroundColor: 'rgba(46,204,113,0.04)',
  },
  addItemToggleBtnText: { color: C.primary, fontSize: 13, fontWeight: '600' },
  addItemFormContainer: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  addItemRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  addItemNameInput: { flex: 1, marginBottom: 0 },
  addItemCalInput:  { width: 72, marginBottom: 0 },
  addItemBtn: {
    backgroundColor: C.primary,
    borderRadius: 10,
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addItemCancelBtn: {
    borderRadius: 10,
    height: 38,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  addItemBtnText: { color: '#0F0F0F', fontSize: 14, fontWeight: '700' },
  macrosToggle:     { marginBottom: 8 },
  macrosToggleText: { color: C.primary, fontSize: 12, fontWeight: '600' },
  divider: {
    marginHorizontal: 16,
    marginVertical: 6,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
});

const saveModalStyles = StyleSheet.create({
  sheet: {
    backgroundColor: C.modal,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 48,
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#333', alignSelf: 'center', marginBottom: 20 },
  title:  { fontSize: 20, fontWeight: '700', color: C.text, marginBottom: 6 },
  body:   { fontSize: 14, color: C.secondary, marginBottom: 20, lineHeight: 20 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 14,
    color: C.text,
    fontSize: 15,
    marginBottom: 16,
  },
  saveBtn:     { backgroundColor: C.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  saveBtnText: { color: C.bg, fontWeight: '700', fontSize: 15 },
  skipBtn:     { paddingVertical: 10, alignItems: 'center' },
  skipText:    { color: C.secondary, fontSize: 14 },
});

const tmplPillStyles = StyleSheet.create({
  wrapper:      { marginBottom: 8, marginTop: 4 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#555', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginHorizontal: 16 },
  emptyText:    { fontSize: 12, color: '#444', marginHorizontal: 16, marginBottom: 4 },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(46,204,113,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(46,204,113,0.25)',
    maxWidth: 150,
  },
  pillText: { color: C.primary, fontSize: 13, fontWeight: '600' },
});

const previewStyles = StyleSheet.create({
  sheet: {
    backgroundColor: C.modal,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 48,
  },
  handle:    { width: 36, height: 4, borderRadius: 2, backgroundColor: '#333', alignSelf: 'center', marginBottom: 20 },
  typeLabel: { fontSize: 11, fontWeight: '700', color: C.secondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  title:     { fontSize: 22, fontWeight: '700', color: C.text, marginBottom: 16 },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  itemName: { fontSize: 14, color: C.text, flex: 1, marginRight: 8 },
  itemCal:  { fontSize: 13, color: C.secondary },
  macroBox: {
    marginTop: 16,
    marginBottom: 20,
    alignItems: 'center',
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
  },
  totalCal: { fontSize: 28, fontWeight: '700', color: C.primary, marginBottom: 4 },
  macros:   { fontSize: 13, color: C.secondary },
  activityDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 20,
    padding: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    gap: 24,
  },
  activityStat:      { alignItems: 'center' },
  activityStatVal:   { fontSize: 32, fontWeight: '700', color: C.text },
  activityStatLabel: { fontSize: 12, color: C.secondary, marginTop: 2 },
  activityDivider:   { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.1)' },
  logBtn:     { backgroundColor: C.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  logBtnText: { color: C.bg, fontWeight: '700', fontSize: 15 },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 11,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  secondaryBtnDanger: { borderColor: 'rgba(239,83,80,0.25)', backgroundColor: 'rgba(239,83,80,0.06)' },
  secondaryBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  cancelBtn:  { paddingVertical: 10, alignItems: 'center' },
  cancelText: { color: C.secondary, fontSize: 14 },
});

export default LogScreen;

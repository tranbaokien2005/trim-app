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
import DateTimePicker from '@react-native-community/datetimepicker';

const formatLocalDate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const AboutYouScreen = ({ navigation, route }) => {
  const userData = route.params?.userData ?? {};
  const [dob, setDob] = useState(new Date(2000, 0, 1));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [gender, setGender] = useState('male');
  const [heightUnit, setHeightUnit] = useState('cm');
  const [heightCm, setHeightCm] = useState('');
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const heightRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  const getHeightInCm = () => {
    if (heightUnit === 'cm') return parseFloat(heightCm);
    const ft = parseFloat(heightFt) || 0;
    const inches = parseFloat(heightIn) || 0;
    return Math.round((ft * 30.48) + (inches * 2.54));
  };

  const handleUnitToggle = (newUnit) => {
    if (newUnit === heightUnit) return;
    if (newUnit === 'ft') {
      const totalCm = parseFloat(heightCm);
      if (totalCm && !isNaN(totalCm)) {
        const totalInches = totalCm / 2.54;
        setHeightFt(String(Math.floor(totalInches / 12)));
        setHeightIn(String(Math.round(totalInches % 12)));
      }
    } else {
      const ft = parseFloat(heightFt) || 0;
      const inches = parseFloat(heightIn) || 0;
      if (ft > 0 || inches > 0) {
        setHeightCm(String(Math.round(ft * 30.48 + inches * 2.54)));
      }
    }
    setHeightUnit(newUnit);
  };

  const isHeightValid = () => {
    if (heightUnit === 'cm') return !!heightCm.trim();
    return !!(heightFt.trim() || heightIn.trim());
  };

  const handleNext = () => {
    if (isHeightValid()) {
      const updatedData = {
        ...userData,
        dob: formatLocalDate(dob),
        gender,
        height: getHeightInCm(),
      };
      navigation.navigate('CurrentWeight', { userData: updatedData });
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
            <Text style={styles.step}>Step 2 of 7</Text>
            <Text style={styles.title}>About You</Text>
            <Text style={styles.subtitle}>Help us personalize your plan</Text>

            {/* ── Date of Birth ── */}
            <Text style={styles.label}>Date of Birth</Text>
            <TouchableOpacity
              style={styles.input}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.8}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 15 }}>
                {formatLocalDate(dob)}
              </Text>
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={dob}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                maximumDate={new Date()}
                minimumDate={new Date(1940, 0, 1)}
                onChange={(event, selectedDate) => {
                  setShowDatePicker(Platform.OS === 'ios');
                  if (selectedDate) setDob(selectedDate);
                }}
                themeVariant="dark"
                textColor="white"
              />
            )}
            {showDatePicker && Platform.OS === 'ios' && (
              <TouchableOpacity
                onPress={() => setShowDatePicker(false)}
                style={{ alignSelf: 'flex-end', padding: 8, marginTop: 4 }}
              >
                <Text style={{ color: '#2ECC71', fontWeight: '600' }}>Done</Text>
              </TouchableOpacity>
            )}

            {/* ── Gender ── */}
            <Text style={[styles.label, { marginTop: 20 }]}>Gender</Text>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
              <TouchableOpacity
                style={[styles.genderBtn, gender === 'male' && styles.genderActive]}
                onPress={() => setGender('male')}
              >
                <Text style={[styles.genderText, gender === 'male' && styles.genderTextActive]}>Male</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.genderBtn, gender === 'female' && styles.genderActive]}
                onPress={() => setGender('female')}
              >
                <Text style={[styles.genderText, gender === 'female' && styles.genderTextActive]}>Female</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.genderBtn, gender === 'other' && styles.genderActive]}
                onPress={() => setGender('other')}
              >
                <Text style={[styles.genderText, gender === 'other' && styles.genderTextActive]}>Other</Text>
              </TouchableOpacity>
            </View>

            {/* ── Height ── */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 8 }}>
              <Text style={styles.label}>Height</Text>
              <View style={styles.unitToggle}>
                <TouchableOpacity
                  style={[styles.unitBtn, heightUnit === 'cm' && styles.unitBtnActive]}
                  onPress={() => handleUnitToggle('cm')}
                >
                  <Text style={[styles.unitText, heightUnit === 'cm' && styles.unitTextActive]}>cm</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.unitBtn, heightUnit === 'ft' && styles.unitBtnActive]}
                  onPress={() => handleUnitToggle('ft')}
                >
                  <Text style={[styles.unitText, heightUnit === 'ft' && styles.unitTextActive]}>ft</Text>
                </TouchableOpacity>
              </View>
            </View>

            {heightUnit === 'cm' ? (
              <TextInput
                ref={heightRef}
                style={styles.input}
                placeholder="175"
                placeholderTextColor="#444"
                keyboardType="numeric"
                returnKeyType="done"
                onSubmitEditing={() => Keyboard.dismiss()}
                value={heightCm}
                onChangeText={setHeightCm}
              />
            ) : (
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <TextInput
                    style={styles.input}
                    placeholder="5"
                    placeholderTextColor="#444"
                    keyboardType="numeric"
                    returnKeyType="next"
                    value={heightFt}
                    onChangeText={setHeightFt}
                  />
                  <Text style={styles.unitHint}>ft</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <TextInput
                    style={styles.input}
                    placeholder="9"
                    placeholderTextColor="#444"
                    keyboardType="numeric"
                    returnKeyType="done"
                    onSubmitEditing={() => Keyboard.dismiss()}
                    value={heightIn}
                    onChangeText={setHeightIn}
                  />
                  <Text style={styles.unitHint}>in</Text>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={[styles.btn, !isHeightValid() && styles.btnDisabled]}
              onPress={handleNext}
              disabled={!isHeightValid()}
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
    justifyContent: 'center',
  },
  inputFocused: { borderColor: '#2ECC71' },
  unitToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    padding: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  unitBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6 },
  unitBtnActive: { backgroundColor: '#2ECC71' },
  unitText: { color: '#666', fontSize: 13, fontWeight: '600' },
  unitTextActive: { color: 'white' },
  unitHint: { color: '#555', fontSize: 12, marginTop: 4, marginLeft: 4 },
  genderBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  // Brand-green selection pattern (mirrors GoalTypeScreen.optionCardActive) —
  // replaces the off-brand blue/pink/purple fills.
  genderActive: { backgroundColor: 'rgba(46,204,113,0.08)', borderColor: '#2ECC71' },
  genderText: { fontSize: 15, fontWeight: '600', color: '#888' },
  genderTextActive: { color: '#2ECC71' },
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

export default AboutYouScreen;

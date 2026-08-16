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
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../../store/authStore';
import api from '../../services/api';

const OPTIONS = [
  { id: 'template', icon: '📋', label: 'Set up Template', desc: "We'll create a meal plan and workout routine for you" },
  { id: 'fresh',    icon: '⚡', label: 'Start Fresh',      desc: 'Create your own plan and start logging immediately' },
];

const FirstLogChoiceScreen = ({ navigation }) => {
  const { completeOnboarding } = useAuth();
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  const handleStartFresh = async () => {
    setSelected('fresh');
    setLoading(true);
    try {
      await api.post('/users/complete-onboarding');
      await completeOnboarding(true);
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || 'Something went wrong. Please try again.');
      setSelected(null);
    } finally {
      setLoading(false);
    }
  };

  const handleTemplate = () => {
    setSelected('template');
    navigation.navigate('TemplateSetup');
  };

  const handlePress = (id) => {
    if (loading) return;
    if (id === 'fresh') handleStartFresh();
    else handleTemplate();
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
            <Text style={styles.step}>Step 7 of 7</Text>
            <Text style={styles.title}>How to Start?</Text>
            <Text style={styles.subtitle}>Choose how you'd like to begin</Text>

            {OPTIONS.map((opt) => {
              const active = selected === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[styles.optionCard, active && styles.optionCardActive, loading && styles.optionCardDisabled]}
                  onPress={() => handlePress(opt.id)}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <Text style={styles.optionIcon}>{opt.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionLabel}>{opt.label}</Text>
                    <Text style={styles.optionDesc}>{opt.desc}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            {loading && (
              <ActivityIndicator color="#2ECC71" style={{ marginTop: 20 }} />
            )}
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
    padding: 24,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 16,
  },
  optionCardActive: {
    borderColor: '#2ECC71',
    backgroundColor: 'rgba(46,204,113,0.08)',
  },
  optionCardDisabled: { opacity: 0.5 },
  optionIcon: { fontSize: 28 },
  optionLabel: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
  optionDesc: { fontSize: 14, color: '#666', marginTop: 6 },
  backBtn: { alignSelf: 'flex-start', marginBottom: 16, padding: 8, marginLeft: -8 },
  backArrow: { color: 'white', fontSize: 24 },
});

export default FirstLogChoiceScreen;

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  TextInput,
  Image,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../store/authStore';
import { register as registerService } from '../../services/auth';

// ─── Component ───────────────────────────────────────────────────────────────

const RegisterScreen = ({ navigation }) => {
  const { login } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);

  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmPasswordRef = useRef(null);

  const fadeAnim    = useRef(new Animated.Value(0)).current;
  const translateY  = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useFocusEffect(
    useCallback(() => {
      setName('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setErrors({ name: '', email: '', password: '', confirmPassword: '' });
      setApiError('');
      setShowPassword(false);
      setShowConfirmPassword(false);
    }, [])
  );

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const validate = () => {
    const newErrors = { name: '', email: '', password: '', confirmPassword: '' };
    let valid = true;

    if (name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
      valid = false;
    }
    if (!emailRegex.test(email.trim())) {
      newErrors.email = 'Please enter a valid email';
      valid = false;
    }
    if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
      valid = false;
    }
    if (confirmPassword !== password) {
      newErrors.confirmPassword = 'Passwords do not match';
      valid = false;
    }

    setErrors(newErrors);
    return valid;
  };

  const handleSubmit = async () => {
    console.log('handleSubmit called');
    if (!validate()) return;
    setApiError('');
    setLoading(true);
    try {
      console.log('Calling API with:', { name: name.trim(), email: email.trim() });
      const { accessToken, refreshToken, user } = await registerService({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
      });
      await login(accessToken, refreshToken, user);
      navigation.navigate('AboutYou', {
        userData: { name: name.trim(), email: email.trim() },
      });
    } catch (err) {
      console.log('Register error:', err.message, err);
      setApiError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: '#0F0F0F' }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -60,
            alignSelf: 'center',
            width: 280,
            height: 280,
            borderRadius: 140,
            backgroundColor: '#2ECC71',
            opacity: 0.05,
            zIndex: 0,
          }}
        />

        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            paddingHorizontal: 24,
            paddingVertical: 48,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Back */}
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>

          {/* Card */}
          <Animated.View
            style={[styles.card, { opacity: fadeAnim, transform: [{ translateY }] }]}
          >
            {/* Logo */}
            <Image
              source={require('../../assets/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />

            <Text style={styles.title}>Create your account</Text>
            <Text style={styles.subtitle}>Start your journey today</Text>

            {/* ── Full Name ── */}
            <TextInput
              style={[styles.input, errors.name && styles.inputError]}
              placeholder="Full name"
              placeholderTextColor="#444444"
              value={name}
              onChangeText={(v) => { setName(v); setErrors((e) => ({ ...e, name: '' })); }}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => emailRef.current?.focus()}
            />
            {!!errors.name && <Text style={styles.fieldError}>{errors.name}</Text>}

            {/* ── Email ── */}
            <TextInput
              ref={emailRef}
              style={[styles.input, styles.inputSpacing, errors.email && styles.inputError]}
              placeholder="Email address"
              placeholderTextColor="#444444"
              value={email}
              onChangeText={(v) => { setEmail(v); setErrors((e) => ({ ...e, email: '' })); }}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
            {!!errors.email && <Text style={styles.fieldError}>{errors.email}</Text>}

            {/* ── Password ── */}
            <View style={styles.inputWrapper}>
              <TextInput
                ref={passwordRef}
                style={[styles.input, styles.passwordInput, errors.password && styles.inputError]}
                placeholder="Password"
                placeholderTextColor="#444444"
                value={password}
                onChangeText={(v) => { setPassword(v); setErrors((e) => ({ ...e, password: '' })); }}
                secureTextEntry={!showPassword}
                textContentType="oneTimeCode"
                autoComplete="off"
                importantForAutofill="no"
                selectionColor="#2ECC71"
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => confirmPasswordRef.current?.focus()}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPassword((s) => !s)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                  size={20}
                  color="#666666"
                />
              </TouchableOpacity>
            </View>
            {!!errors.password && <Text style={styles.fieldError}>{errors.password}</Text>}

            {/* ── Confirm Password ── */}
            <View style={styles.inputWrapper}>
              <TextInput
                ref={confirmPasswordRef}
                style={[styles.input, styles.passwordInput, errors.confirmPassword && styles.inputError]}
                placeholder="Confirm password"
                placeholderTextColor="#444444"
                value={confirmPassword}
                onChangeText={(v) => { setConfirmPassword(v); setErrors((e) => ({ ...e, confirmPassword: '' })); }}
                secureTextEntry={!showConfirmPassword}
                textContentType="oneTimeCode"
                autoComplete="off"
                importantForAutofill="no"
                selectionColor="#2ECC71"
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowConfirmPassword((s) => !s)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                  size={20}
                  color="#666666"
                />
              </TouchableOpacity>
            </View>
            {!!errors.confirmPassword && <Text style={styles.fieldError}>{errors.confirmPassword}</Text>}

            {/* ── Submit ── */}
            <TouchableOpacity
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#FFFFFF" />
                : <Text style={styles.submitText}>Create Account</Text>}
            </TouchableOpacity>

            {!!apiError && <Text style={styles.apiError}>{apiError}</Text>}

            {/* ── Divider ── */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerLabel}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* ── Sign in row ── */}
            <View style={styles.signInRow}>
              <Text style={styles.signInPrompt}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.goBack()}>
                <Text style={styles.signInLink}>Sign In</Text>
              </TouchableOpacity>
            </View>

            {/* ── Terms ── */}
            <Text style={styles.terms}>
              By continuing, you agree to our Terms of Service and Privacy Policy
            </Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignSelf: 'flex-start',
  },
  backArrow: {
    fontSize: 28,
    color: '#FFFFFF',
    lineHeight: 32,
  },

  card: {
    padding: 32,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#ffffff',
    shadowOpacity: 0.03,
    shadowRadius: 20,
  },

  logo: {
    width: 72,
    height: 72,
    alignSelf: 'center',
    marginBottom: 16,
  },

  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#555555',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 28,
  },

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
  inputSpacing: {
    marginTop: 12,
  },
  inputError: {
    borderColor: '#FF4444',
  },

  inputWrapper: {
    position: 'relative',
    marginTop: 12,
  },
  passwordInput: {
    paddingRight: 48,
  },
  eyeBtn: {
    position: 'absolute',
    right: 16,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },

  fieldError: {
    fontSize: 12,
    color: '#FF4444',
    marginTop: 4,
    marginLeft: 4,
  },
  apiError: {
    fontSize: 13,
    color: '#FF4444',
    textAlign: 'center',
    marginTop: 12,
  },

  submitBtn: {
    marginTop: 24,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#2ECC71',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  dividerLabel: {
    fontSize: 13,
    color: '#444444',
    marginHorizontal: 12,
  },

  signInRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  signInPrompt: {
    fontSize: 14,
    color: '#555555',
  },
  signInLink: {
    fontSize: 14,
    color: '#2ECC71',
    fontWeight: '600',
  },

  terms: {
    marginTop: 20,
    fontSize: 11,
    color: '#333333',
    textAlign: 'center',
    lineHeight: 16,
  },
});

export default RegisterScreen;

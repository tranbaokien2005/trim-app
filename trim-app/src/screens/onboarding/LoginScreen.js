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
import { login as loginService } from '../../services/auth';

const LoginScreen = ({ navigation }) => {
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [authError, setAuthError] = useState('');

  const passwordRef    = useRef(null);
  const cardOpacity    = useRef(new Animated.Value(0)).current;
  const cardTranslateY = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(cardTranslateY, {
        toValue: 0,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useFocusEffect(
    useCallback(() => {
      setEmail('');
      setPassword('');
      setEmailError('');
      setPasswordError('');
      setAuthError('');
      setShowPassword(false);
    }, [])
  );

  const handleSignIn = async () => {
    let valid = true;

    const emailTrimmed = email.trim();
    if (!emailTrimmed || !emailTrimmed.includes('@') || !emailTrimmed.includes('.')) {
      setEmailError('Please enter a valid email');
      valid = false;
    } else {
      setEmailError('');
    }

    if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      valid = false;
    } else {
      setPasswordError('');
    }

    if (!valid) return;

    setAuthError('');
    setLoading(true);
    try {
      const { accessToken, refreshToken, user } = await loginService(emailTrimmed, password);
      await login(accessToken, refreshToken, user);
    } catch (err) {
      setAuthError('Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: '#0F0F0F' }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* Top ambient glow */}
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
          }}
        />

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Back arrow */}
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>

          {/* Glass card */}
          <Animated.View
            style={[styles.card, { opacity: cardOpacity, transform: [{ translateY: cardTranslateY }] }]}
          >
            {/* Logo */}
            <Image
              source={require('../../assets/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />

            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to continue</Text>

            {/* Email */}
            <TextInput
              style={[styles.input, emailFocused && styles.inputFocused, emailError && styles.inputError]}
              placeholder="Email address"
              placeholderTextColor="#444444"
              value={email}
              onChangeText={(v) => { setEmail(v); if (emailError) setEmailError(''); }}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => passwordRef.current?.focus()}
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
            />
            {!!emailError && <Text style={styles.fieldError}>{emailError}</Text>}

            {/* Password */}
            <View style={styles.inputSpacing}>
              <View style={styles.passwordWrap}>
                <TextInput
                  ref={passwordRef}
                  style={[
                    styles.input,
                    styles.passwordInput,
                    passwordFocused && styles.inputFocused,
                    passwordError && styles.inputError,
                  ]}
                  placeholder="Password"
                  placeholderTextColor="#444444"
                  value={password}
                  onChangeText={(v) => { setPassword(v); if (passwordError) setPasswordError(''); }}
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleSignIn}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
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
              {!!passwordError && <Text style={styles.fieldError}>{passwordError}</Text>}
            </View>

            {/* Forgot password — CHỈ hiện khi flag bật (RUNBOOK 006 P3.2). Mặc định ẩn:
                không có nút chết ở v1. Bật bằng EXPO_PUBLIC_PASSWORD_RESET=true khi Ken cấu hình email. */}
            {process.env.EXPO_PUBLIC_PASSWORD_RESET === 'true' && (
              <TouchableOpacity style={styles.forgotWrap} onPress={() => navigation.navigate('ForgotPassword')}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>
            )}

            {/* Sign In button */}
            <TouchableOpacity
              style={[styles.signInBtn, loading && styles.signInBtnDisabled]}
              onPress={handleSignIn}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#FFFFFF" />
                : <Text style={styles.signInText}>Sign In</Text>}
            </TouchableOpacity>

            {/* Auth error */}
            {!!authError && <Text style={styles.authError}>{authError}</Text>}

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerLabel}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Sign up row */}
            <View style={styles.signUpRow}>
              <Text style={styles.signUpPrompt}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('CreateAccount')}>
                <Text style={styles.signUpLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>

            {/* Terms */}
            <Text style={styles.terms}>
              By continuing, you agree to our Terms of Service and Privacy Policy
            </Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
};

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

  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
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
    width: 100,
    height: 100,
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
    paddingVertical: 16,
    color: '#FFFFFF',
    fontSize: 15,
  },
  inputSpacing: {
    marginTop: 12,
  },
  inputFocused: {
    borderColor: '#2ECC71',
  },
  inputError: {
    borderColor: '#FF4444',
  },

  passwordWrap: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 64,
  },
  eyeBtn: {
    position: 'absolute',
    right: 16,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  terms: {
    marginTop: 16,
    fontSize: 11,
    color: '#444444',
    textAlign: 'center',
    lineHeight: 16,
  },

  fieldError: {
    fontSize: 12,
    color: '#FF4444',
    marginTop: 4,
  },
  authError: {
    fontSize: 12,
    color: '#FF4444',
    marginTop: 8,
    textAlign: 'center',
  },

  forgotWrap: {
    alignSelf: 'flex-end',
    marginTop: 8,
  },
  forgotText: {
    fontSize: 13,
    color: '#2ECC71',
  },

  signInBtn: {
    marginTop: 24,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#2ECC71',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInBtnDisabled: {
    opacity: 0.7,
  },
  signInText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 28,
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

  signUpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  signUpPrompt: {
    fontSize: 14,
    color: '#555555',
  },
  signUpLink: {
    fontSize: 14,
    color: '#2ECC71',
    fontWeight: '600',
  },
});

export default LoginScreen;

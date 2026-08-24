import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import api from '../../services/api';

/**
 * ForgotPassword (RUNBOOK 006 P3.2) — dormant, chỉ tới được khi flag bật.
 * Nhập email → POST /auth/forgot-password (LUÔN 200 generic) → hiện "check your email".
 */
const C = { bg: '#0F0F0F', primary: '#2ECC71', text: '#FFFFFF', secondary: '#888', border: '#2A2A2A' };

const ForgotPasswordScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (!email.trim()) return;
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
    } catch (_) {
      // Backend luôn trả 200 generic; kể cả lỗi mạng cũng hiện màn generic để không lộ.
    } finally {
      setLoading(false);
      setSent(true);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <MaterialCommunityIcons name="chevron-left" size={28} color={C.text} />
      </TouchableOpacity>

      <View style={styles.container}>
        {sent ? (
          <>
            <Text style={styles.title}>Check your email</Text>
            <Text style={styles.body}>
              If an account exists for that address, we've sent a link to reset your password.
              The link is valid for 15 minutes.
            </Text>
            <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('Login')}>
              <Text style={styles.buttonText}>Back to sign in</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.title}>Reset your password</Text>
            <Text style={styles.body}>Enter your email and we'll send you a reset link.</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={C.secondary}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <TouchableOpacity style={[styles.button, loading && { opacity: 0.6 }]} onPress={submit} disabled={loading}>
              {loading ? <ActivityIndicator color="#0F0F0F" /> : <Text style={styles.buttonText}>Send reset link</Text>}
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  back: { padding: 16 },
  container: { flex: 1, paddingHorizontal: 24, justifyContent: 'center' },
  title: { color: C.text, fontSize: 26, fontWeight: '700', marginBottom: 12 },
  body: { color: 'rgba(255,255,255,0.75)', fontSize: 15, lineHeight: 22, marginBottom: 24 },
  input: {
    backgroundColor: '#1A1A1A', borderRadius: 14, borderWidth: 1, borderColor: C.border,
    color: C.text, fontSize: 16, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 20,
  },
  button: { backgroundColor: C.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  buttonText: { color: '#0F0F0F', fontSize: 16, fontWeight: '700' },
});

export default ForgotPasswordScreen;

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator,
} from 'react-native';
import api from '../../services/api';

/**
 * ResetPassword (RUNBOOK 006 P3.2) — dormant. Token đến qua route.params.token
 * (khi Ken bật email + wire deep link trim://reset?token=). Nhập password mới →
 * POST /auth/reset-password → thành công về Login.
 */
const C = { bg: '#0F0F0F', primary: '#2ECC71', text: '#FFFFFF', secondary: '#888', border: '#2A2A2A', danger: '#FF4444' };

const ResetPasswordScreen = ({ navigation, route }) => {
  const token = route?.params?.token || '';
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    // Rule GĐ1c: >=8, có chữ + số. Check nhẹ ở client; backend là nguồn thật.
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      setError('Password must be at least 8 characters and include a letter and a number.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword: password });
      navigation.navigate('Login', { resetDone: true });
    } catch (e) {
      setError(e?.response?.data?.message || 'Could not reset password. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Set a new password</Text>
        <Text style={styles.body}>Choose a new password for your account.</Text>

        <TextInput
          style={styles.input}
          placeholder="New password"
          placeholderTextColor={C.secondary}
          secureTextEntry
          autoCapitalize="none"
          value={password}
          onChangeText={(v) => { setPassword(v); if (error) setError(''); }}
        />
        {!!error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity style={[styles.button, loading && { opacity: 0.6 }]} onPress={submit} disabled={loading}>
          {loading ? <ActivityIndicator color="#0F0F0F" /> : <Text style={styles.buttonText}>Reset password</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  container: { flex: 1, paddingHorizontal: 24, justifyContent: 'center' },
  title: { color: C.text, fontSize: 26, fontWeight: '700', marginBottom: 12 },
  body: { color: 'rgba(255,255,255,0.75)', fontSize: 15, lineHeight: 22, marginBottom: 24 },
  input: {
    backgroundColor: '#1A1A1A', borderRadius: 14, borderWidth: 1, borderColor: C.border,
    color: C.text, fontSize: 16, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 10,
  },
  error: { color: C.danger, fontSize: 13, marginBottom: 14 },
  button: { backgroundColor: C.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#0F0F0F', fontSize: 16, fontWeight: '700' },
});

export default ResetPasswordScreen;

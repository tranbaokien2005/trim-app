import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, SafeAreaView } from 'react-native';

/**
 * Medical disclaimer — bước BẮT BUỘC trong onboarding (RUNBOOK 005 P2.2).
 * Copy dùng ĐÚNG chuỗi runbook. Phải bấm "I understand" mới tiếp tục.
 */
const DisclaimerScreen = ({ navigation }) => {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Before you start</Text>

        <Text style={styles.body}>
          Trim helps you track food, activity, and weight. It is a wellness tool, not a medical
          service. The calorie and health numbers it shows are estimates, not professional advice.
          Please talk to a doctor or registered dietitian before making significant changes to your
          diet or exercise — especially if you have a health condition, are pregnant, or have ever
          struggled with disordered eating.
        </Text>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('CreateAccount')}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>I understand</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F0F0F' },
  container: { padding: 24, paddingTop: 60, flexGrow: 1, justifyContent: 'center' },
  title: { color: '#FFFFFF', fontSize: 26, fontWeight: '700', marginBottom: 20 },
  body: { color: 'rgba(255,255,255,0.8)', fontSize: 15, lineHeight: 24 },
  footer: { padding: 24 },
  button: {
    backgroundColor: '#2ECC71',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: { color: '#0F0F0F', fontSize: 16, fontWeight: '700' },
});

export default DisclaimerScreen;

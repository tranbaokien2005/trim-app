import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Linking } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SHORTCUT_ICLOUD_URL } from '../../config/quickLog';

/**
 * Hướng dẫn Quick Log qua Back Tap (RUNBOOK 006 P2.1). Màn tĩnh trong Settings/Profile.
 * Deep link trim://log?text=... đã có sẵn (RUNBOOK 001). Đây chỉ là hướng dẫn tay.
 */
const C = {
  bg: '#0F0F0F', card: '#1A1A1A', primary: '#2ECC71', text: '#FFFFFF',
  secondary: '#888888', border: '#2A2A2A',
};

const Step = ({ n, children }) => (
  <View style={styles.step}>
    <View style={styles.stepNum}><Text style={styles.stepNumText}>{n}</Text></View>
    <Text style={styles.stepText}>{children}</Text>
  </View>
);

const QuickLogHelpScreen = ({ navigation }) => {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Quick Log (Back Tap)</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.intro}>
          Log a meal in seconds — just tap the back of your iPhone twice. No need to find and
          open the app first. Great for logging on the go.
        </Text>

        {SHORTCUT_ICLOUD_URL ? (
          <View style={{ marginBottom: 24 }}>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => Linking.openURL(SHORTCUT_ICLOUD_URL)}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="plus-circle-outline" size={20} color={C.bg} />
              <Text style={styles.addBtnText}>Add to Shortcuts</Text>
            </TouchableOpacity>
            <Text style={styles.addSub}>
              One tap installs the ready-made “Trim Quick Log” shortcut. Then just assign it to
              Back Tap (step 2 below).
            </Text>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>1. Create the Shortcut</Text>
        <View style={styles.card}>
          <Step n="1">Open the Shortcuts app and tap + to create a new shortcut.</Step>
          <Step n="2">Add the action “Ask for Input” and set the input type to Text.</Step>
          <Step n="3">Add the action “Open URL” and set the URL to{'\n'}trim://log?text=[Provided Input]</Step>
          <Step n="4">Name it “Trim Quick Log” and save.</Step>
        </View>

        <Text style={styles.sectionTitle}>2. Assign it to Back Tap</Text>
        <View style={styles.card}>
          <Step n="1">Open Settings → Accessibility → Touch → Back Tap.</Step>
          <Step n="2">Choose Double Tap (or Triple Tap).</Step>
          <Step n="3">Scroll to Shortcuts and pick “Trim Quick Log”.</Step>
        </View>
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => Linking.openSettings()}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="cog-outline" size={18} color={C.primary} />
          <Text style={styles.secondaryBtnText}>Open Settings</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>3. Use it</Text>
        <View style={styles.card}>
          <Step n="1">Tap the back of your phone twice.</Step>
          <Step n="2">Type what you ate (e.g. “pho bo and iced coffee”).</Step>
          <Step n="3">Trim opens and logs it for you.</Step>
        </View>

        {!SHORTCUT_ICLOUD_URL && (
          <Text style={styles.note}>
            A one-tap iCloud shortcut link is coming soon — for now, set it up manually with the
            steps above.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  headerTitle: { color: C.text, fontSize: 17, fontWeight: '700' },
  container: { padding: 20, paddingBottom: 48 },
  intro: { color: 'rgba(255,255,255,0.8)', fontSize: 15, lineHeight: 23, marginBottom: 24 },
  sectionTitle: { color: C.primary, fontSize: 13, fontWeight: '700', letterSpacing: 0.5, marginBottom: 10, marginTop: 6 },
  card: {
    backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    padding: 16, marginBottom: 22,
  },
  step: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  stepNum: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(46,204,113,0.15)',
    alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 1,
  },
  stepNumText: { color: C.primary, fontSize: 13, fontWeight: '700' },
  stepText: { color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 21, flex: 1 },
  note: { color: C.secondary, fontSize: 13, lineHeight: 20, fontStyle: 'italic' },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.primary, borderRadius: 14, paddingVertical: 15,
  },
  addBtnText: { color: C.bg, fontSize: 15, fontWeight: '700' },
  addSub: { color: C.secondary, fontSize: 13, lineHeight: 19, marginTop: 10, textAlign: 'center' },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 14, paddingVertical: 13, marginTop: -8, marginBottom: 22,
    borderWidth: 1, borderColor: 'rgba(46,204,113,0.4)',
  },
  secondaryBtnText: { color: C.primary, fontSize: 14, fontWeight: '700' },
});

export default QuickLogHelpScreen;

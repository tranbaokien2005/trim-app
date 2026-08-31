import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../store/authStore';
import api from '../../services/api';
import { dark } from '../../theme/tokens';

// Core palette sourced from the shared tokens (single source of truth: src/theme/tokens).
// destructive red + solid border have no exact token yet — kept literal.
const C = {
  bg: dark.bg,
  card: dark.surface,
  primary: dark.accent,
  text: dark.textPrimary,
  secondary: dark.textSecondary,
  danger: dark.danger,
  destructive: '#FF4444',
  border: '#2A2A2A',
};

const GOAL_TYPE_LABELS = { lose: 'Lose Weight', maintain: 'Maintain', gain: 'Gain Weight' };

const capitalizeName = (name) => {
  if (!name) return '';
  return name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
};

const ProfileScreen = () => {
  const navigation = useNavigation();
  const { user: authUser, logout } = useAuth();
  const [userData, setUserData] = useState(authUser);
  const [loading, setLoading] = useState(!authUser);

  const [showDelete, setShowDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    return api.get('/users/me')
      .then((res) => setUserData(res.data.user))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleLogout = () => {
    logout();
  };

  const openDeleteModal = () => {
    setDeletePassword('');
    setDeleteError('');
    setShowDelete(true);
  };

  const closeDeleteModal = () => {
    if (deleting) return;
    setShowDelete(false);
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword || deleting) return;
    setDeleting(true);
    setDeleteError('');
    try {
      // axios sends a DELETE body only via `data`
      await api.delete('/users/me', { data: { password: deletePassword } });
      setShowDelete(false);
      logout(); // clears SecureStore + state → RootNavigator returns to Onboarding
    } catch (err) {
      const status = err?.response?.status;
      setDeleteError(
        status === 401
          ? 'Incorrect password. Please try again.'
          : err?.response?.data?.message || 'Could not delete your account. Please try again.'
      );
      setDeleting(false); // keep the modal open so the error is visible
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={C.primary} style={styles.center} />
      </SafeAreaView>
    );
  }

  const activeGoal = userData?.goals?.find((g) => g.isActive);
  const stats = userData?.currentStats;
  const profile = userData?.profile;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
        </View>

        {/* User Card */}
        <View style={styles.card}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarLetter}>
              {(userData?.name || 'U')[0].toUpperCase()}
            </Text>
          </View>
          <Text style={styles.userName}>{capitalizeName(userData?.name) || '—'}</Text>
          <Text style={styles.userEmail}>{userData?.email || '—'}</Text>
        </View>

        {/* Body Stats */}
        <Text style={styles.sectionLabel}>Body Stats</Text>
        <View style={styles.card}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statVal}>
                {profile?.height ? `${profile.height} cm` : '—'}
              </Text>
              <Text style={styles.statLbl}>Height</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statVal}>
                {stats?.weight ? `${stats.weight} kg` : '—'}
              </Text>
              <Text style={styles.statLbl}>Weight</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statVal}>{stats?.bmi ? Math.round(stats.bmi * 10) / 10 : '—'}</Text>
              <Text style={styles.statLbl}>BMI</Text>
            </View>
          </View>
        </View>

        {/* Active Goal */}
        {activeGoal ? (
          <>
            <Text style={styles.sectionLabel}>Active Goal</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.goalType}>
                  {GOAL_TYPE_LABELS[activeGoal.type] || activeGoal.type}
                </Text>
                <View style={styles.goalBadge}>
                  <Text style={styles.goalBadgeText}>Active</Text>
                </View>
              </View>
              <View style={styles.goalDetails}>
                {activeGoal.targetWeight ? (
                  <View style={styles.goalRow}>
                    <Text style={styles.goalLabel}>Target weight</Text>
                    <Text style={styles.goalValue}>{activeGoal.targetWeight} kg</Text>
                  </View>
                ) : null}
                {activeGoal.weeklyRate ? (
                  <View style={styles.goalRow}>
                    <Text style={styles.goalLabel}>Weekly rate</Text>
                    <Text style={styles.goalValue}>{Math.abs(activeGoal.weeklyRate)} kg/week</Text>
                  </View>
                ) : null}
                {activeGoal.dailyCalorieTarget ? (
                  <View style={styles.goalRow}>
                    <Text style={styles.goalLabel}>Daily calories</Text>
                    <Text style={[styles.goalValue, { color: C.primary }]}>
                      {Math.round(activeGoal.dailyCalorieTarget)} cal
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </>
        ) : null}

        {/* App Info */}
        <Text style={styles.sectionLabel}>About</Text>
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Version</Text>
            <Text style={styles.infoValue}>1.0.0</Text>
          </View>
        </View>

        {/* Quick Log (Back Tap) help — power-user feature, in Settings not onboarding */}
        <TouchableOpacity
          style={styles.settingsRow}
          onPress={() => navigation.navigate('QuickLogHelp')}
          activeOpacity={0.7}
        >
          <View style={styles.settingsRowLeft}>
            <MaterialCommunityIcons name="gesture-double-tap" size={20} color={C.primary} />
            <Text style={styles.settingsRowText}>Quick Log (Back Tap)</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color={C.secondary} />
        </TouchableOpacity>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <MaterialCommunityIcons name="logout" size={18} color={C.danger} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        {/* Delete account — deliberately quieter than Log Out */}
        <TouchableOpacity
          style={styles.deleteLink}
          onPress={openDeleteModal}
          activeOpacity={0.7}
        >
          <Text style={styles.deleteLinkText}>Delete account</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={showDelete}
        transparent
        animationType="fade"
        onRequestClose={closeDeleteModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete account?</Text>

            <Text style={styles.modalBody}>
              This permanently deletes your account and every weight, meal and activity
              log plus every template you have saved. This cannot be undone.
            </Text>

            <Text style={styles.modalLabel}>Enter your password to confirm</Text>
            <TextInput
              style={styles.modalInput}
              value={deletePassword}
              onChangeText={(t) => { setDeletePassword(t); setDeleteError(''); }}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Password"
              placeholderTextColor={C.secondary}
              editable={!deleting}
            />

            {deleteError ? <Text style={styles.modalError}>{deleteError}</Text> : null}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancel]}
                onPress={closeDeleteModal}
                disabled={deleting}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  styles.modalDelete,
                  (!deletePassword || deleting) && styles.modalDeleteDisabled,
                ]}
                onPress={handleDeleteAccount}
                disabled={!deletePassword || deleting}
                activeOpacity={0.7}
              >
                {deleting
                  ? <ActivityIndicator size="small" color="#FFFFFF" />
                  : <Text style={styles.modalDeleteText}>Delete forever</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: '700', color: C.text },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: C.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
  },
  card: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 4,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 12,
  },
  avatarLetter: { fontSize: 28, fontWeight: '700', color: C.bg },
  userName: { fontSize: 20, fontWeight: '700', color: C.text, textAlign: 'center', marginBottom: 4 },
  userEmail: { fontSize: 14, color: C.secondary, textAlign: 'center' },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  statVal: { fontSize: 18, fontWeight: '700', color: C.text },
  statLbl: { fontSize: 11, color: C.secondary, marginTop: 2 },
  statDivider: { width: 1, height: 36, backgroundColor: C.border },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  goalType: { fontSize: 17, fontWeight: '700', color: C.text },
  goalBadge: {
    backgroundColor: C.primary,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  goalBadgeText: { fontSize: 11, fontWeight: '700', color: C.bg },
  goalDetails: { gap: 10 },
  goalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  goalLabel: { fontSize: 14, color: C.secondary },
  goalValue: { fontSize: 14, fontWeight: '600', color: C.text },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between' },
  infoLabel: { fontSize: 14, color: C.text },
  infoValue: { fontSize: 14, color: C.secondary },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 24,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.danger,
    borderRadius: 10,
    paddingVertical: 14,
    gap: 8,
  },
  logoutText: { fontSize: 16, fontWeight: '700', color: C.danger },
  settingsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 15, paddingHorizontal: 16, marginBottom: 12,
  },
  settingsRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingsRowText: { fontSize: 15, fontWeight: '600', color: C.text },

  deleteLink: {
    alignItems: 'center',
    paddingVertical: 14,
    marginBottom: 40,
  },
  deleteLinkText: { fontSize: 14, fontWeight: '600', color: C.destructive },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: C.text, marginBottom: 10 },
  modalBody: { fontSize: 14, color: C.secondary, lineHeight: 20, marginBottom: 18 },
  modalLabel: { fontSize: 12, color: C.secondary, marginBottom: 6 },
  modalInput: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: C.text,
    backgroundColor: C.bg,
  },
  modalError: { fontSize: 13, color: C.destructive, marginTop: 10 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  modalBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancel: { borderWidth: 1, borderColor: C.border },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: C.text },
  modalDelete: { backgroundColor: C.destructive },
  modalDeleteDisabled: { opacity: 0.4 },
  modalDeleteText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});

export default ProfileScreen;

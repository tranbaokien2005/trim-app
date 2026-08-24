import React, { useCallback, useEffect, useState } from 'react';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import { useAuth, getOnboardingCompleted } from '../store/authStore';
import OnboardingStack from './OnboardingStack';
import MainTabs from './MainTabs';
import useQuickLogLinks from '../hooks/useQuickLogLinks';
import QuickLogToast from '../components/QuickLogToast';

const TAB_BY_KIND = { meal: 'meals', activity: 'activity', weight: 'weight' };

export const RootNavigator = () => {
  const { token, onboardingCompleted, restoreSession, logout } = useAuth();
  const [isCheckingToken, setIsCheckingToken] = useState(true);
  const navigationRef = useNavigationContainerRef();

  // Deep link chỉ được XỬ LÝ khi đã vào được MainTabs; đến sớm hơn thì nằm
  // trong hàng đợi của hook, không mất.
  const quickLogReady = !isCheckingToken && !!token && onboardingCompleted;

  const openManualLog = useCallback((intent) => {
    if (!navigationRef.isReady()) return;
    navigationRef.navigate('Log', {
      screen: 'LogMain',
      params: {
        initialTab: TAB_BY_KIND[intent.kind] || 'meals',
        quickLogDraft: intent,
      },
    });
  }, [navigationRef]);

  const { toast, dismissToast, undo, retry } = useQuickLogLinks({
    ready: quickLogReady,
    onNeedsManualLog: openManualLog,
  });

  useEffect(() => {
    Promise.all([
      SecureStore.getItemAsync('authToken'),
      SecureStore.getItemAsync('authUser'),
      getOnboardingCompleted(),
    ])
      .then(([storedToken, storedUser, onboardingDone]) => {
        if (storedToken) {
          const userObj = storedUser ? JSON.parse(storedUser) : null;
          restoreSession(storedToken, userObj, onboardingDone);
        } else {
          logout();
        }
      })
      .catch(() => logout())
      .finally(() => setIsCheckingToken(false));
  }, []);

  if (isCheckingToken) {
    return null;
  }

  let navigator;
  if (!token) {
    navigator = <OnboardingStack initialRoute="Welcome" />;
  } else if (!onboardingCompleted) {
    navigator = <OnboardingStack initialRoute="AboutYou" />;
  } else {
    navigator = <MainTabs />;
  }

  return (
    <>
      <NavigationContainer ref={navigationRef}>
        {navigator}
      </NavigationContainer>
      <QuickLogToast
        toast={toast}
        onUndo={undo}
        onRetry={retry}
        onDismiss={dismissToast}
      />
    </>
  );
};

export default RootNavigator;

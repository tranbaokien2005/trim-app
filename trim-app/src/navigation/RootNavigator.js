import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import { useAuth, getOnboardingCompleted } from '../store/authStore';
import OnboardingStack from './OnboardingStack';
import MainTabs from './MainTabs';

export const RootNavigator = () => {
  const { token, onboardingCompleted, restoreSession, logout } = useAuth();
  const [isCheckingToken, setIsCheckingToken] = useState(true);

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
    <NavigationContainer>
      {navigator}
    </NavigationContainer>
  );
};

export default RootNavigator;

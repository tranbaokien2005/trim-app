import React, { createContext, useState, useContext, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { setAuthToken, setLogoutCallback } from '../services/api';

const AuthContext = createContext();

export const getOnboardingCompleted = async () => {
  const val = await SecureStore.getItemAsync('onboardingCompleted');
  return val === 'true';
};

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const login = (accessToken, refreshToken, userObj) => {
    return SecureStore.setItemAsync('authToken', accessToken)
      .then(() => SecureStore.setItemAsync('refreshToken', refreshToken))
      .then(() => SecureStore.setItemAsync('authUser', JSON.stringify(userObj)))
      .then(() => SecureStore.setItemAsync('onboardingCompleted', String(userObj.onboardingCompleted ?? false)))
      .then(() => {
        setAuthToken(accessToken);
        setToken(accessToken);
        setUser(userObj);
        setOnboardingCompleted(userObj.onboardingCompleted ?? false);
      });
  };

  const restoreSession = (accessToken, userObj, onboardingDone = false) => {
    setAuthToken(accessToken);
    setToken(accessToken);
    setUser(userObj);
    setOnboardingCompleted(onboardingDone);
  };

  const completeOnboarding = async (triggerWelcome = false) => {
    await SecureStore.setItemAsync('onboardingCompleted', 'true');
    setOnboardingCompleted(true);
    if (triggerWelcome) setShowWelcome(true);
  };

  const clearWelcome = () => setShowWelcome(false);

  const logout = () => {
    setAuthToken(null);
    setToken(null);
    setUser(null);
    setOnboardingCompleted(false);
    SecureStore.deleteItemAsync('authToken').catch(() => {});
    SecureStore.deleteItemAsync('refreshToken').catch(() => {});
    SecureStore.deleteItemAsync('authUser').catch(() => {});
    SecureStore.deleteItemAsync('onboardingCompleted').catch(() => {});
  };

  useEffect(() => {
    setLogoutCallback(logout);
    return () => setLogoutCallback(null);
  }, []);

  const setLoading = (loading) => setIsLoading(loading);

  const value = {
    token,
    user,
    isLoading,
    onboardingCompleted,
    showWelcome,
    login,
    restoreSession,
    logout,
    completeOnboarding,
    clearWelcome,
    setLoading,
    isAuthenticated: !!token,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

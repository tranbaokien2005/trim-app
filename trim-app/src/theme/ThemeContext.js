import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { dark, light } from './tokens';

// Persisted preference: 'system' follows the OS, 'light'/'dark' force a scheme.
const STORAGE_KEY = 'themeMode';

// Default value resolves to the dark palette so useTheme() is always safe to call,
// even if a consumer is somehow rendered outside the provider.
const ThemeContext = createContext({
  theme: dark,
  mode: 'system',
  scheme: 'dark',
  setMode: () => {},
});

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme(); // 'light' | 'dark' | null (from OS)
  const [mode, setMode] = useState('system');

  // Load persisted preference once on mount.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (v === 'light' || v === 'dark' || v === 'system') setMode(v);
      })
      .catch(() => {});
  }, []);

  const scheme = mode === 'system' ? systemScheme ?? 'dark' : mode;
  const theme = scheme === 'light' ? light : dark;

  const chooseMode = (m) => {
    setMode(m);
    AsyncStorage.setItem(STORAGE_KEY, m).catch(() => {});
  };

  const value = useMemo(
    () => ({ theme, mode, scheme, setMode: chooseMode }),
    [theme, mode, scheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

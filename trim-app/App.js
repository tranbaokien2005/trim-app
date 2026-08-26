import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider } from './src/theme';
import { AuthProvider } from './src/store/authStore';
import RootNavigator from './src/navigation/RootNavigator';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <RootNavigator />
      </AuthProvider>
    </ThemeProvider>
  );
}

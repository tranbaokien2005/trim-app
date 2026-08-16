import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/store/authStore';
import RootNavigator from './src/navigation/RootNavigator';

export default function App() {
  return (
    <AuthProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <RootNavigator />
    </AuthProvider>
  );
}

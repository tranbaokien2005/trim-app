import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ProfileScreen from '../screens/main/ProfileScreen';
import QuickLogHelpScreen from '../screens/main/QuickLogHelpScreen';

const Stack = createNativeStackNavigator();

const ProfileStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ProfileMain" component={ProfileScreen} />
    <Stack.Screen name="QuickLogHelp" component={QuickLogHelpScreen} />
  </Stack.Navigator>
);

export default ProfileStack;

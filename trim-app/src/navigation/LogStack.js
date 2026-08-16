import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LogScreen from '../screens/main/LogScreen';
import ChatInputScreen from '../screens/main/ChatInputScreen';
import ActivityChatScreen from '../screens/main/ActivityChatScreen';

const Stack = createNativeStackNavigator();

const LogStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="LogMain" component={LogScreen} />
    <Stack.Screen name="ChatInput" component={ChatInputScreen} />
    <Stack.Screen name="ActivityChat" component={ActivityChatScreen} />
  </Stack.Navigator>
);

export default LogStack;

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import WelcomeScreen from '../screens/onboarding/WelcomeScreen';
import DisclaimerScreen from '../screens/onboarding/DisclaimerScreen';
import LoginScreen from '../screens/onboarding/LoginScreen';
import ForgotPasswordScreen from '../screens/onboarding/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/onboarding/ResetPasswordScreen';
import RegisterScreen from '../screens/onboarding/RegisterScreen';
import AboutYouScreen from '../screens/onboarding/AboutYouScreen';
import CurrentWeightScreen from '../screens/onboarding/CurrentWeightScreen';
import GoalTypeScreen from '../screens/onboarding/GoalTypeScreen';
import TargetSettingsScreen from '../screens/onboarding/TargetSettingsScreen';
import SummaryScreen from '../screens/onboarding/SummaryScreen';
import FirstLogChoiceScreen from '../screens/onboarding/FirstLogChoiceScreen';
import TemplateSetupScreen from '../screens/onboarding/TemplateSetupScreen';

const Stack = createNativeStackNavigator();

const OnboardingStack = ({ initialRoute = 'Welcome' }) => {
  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Disclaimer" component={DisclaimerScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      <Stack.Screen name="CreateAccount" component={RegisterScreen} />
      <Stack.Screen name="AboutYou" component={AboutYouScreen} />
      <Stack.Screen name="CurrentWeight" component={CurrentWeightScreen} />
      <Stack.Screen name="GoalType" component={GoalTypeScreen} />
      <Stack.Screen name="TargetSettings" component={TargetSettingsScreen} />
      <Stack.Screen name="Summary" component={SummaryScreen} />
      <Stack.Screen name="FirstLogChoice" component={FirstLogChoiceScreen} />
      <Stack.Screen name="TemplateSetup" component={TemplateSetupScreen} />
    </Stack.Navigator>
  );
};

export default OnboardingStack;

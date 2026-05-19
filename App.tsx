// ─────────────────────────────────────────────────────────────
// CrisisAI — App Entry Point
// Bottom Tab Navigation: Home | Map | Alerts | Simulate | Logs
// ─────────────────────────────────────────────────────────────

import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import HomeScreen from './src/screens/HomeScreen';
import MapScreen from './src/screens/MapScreen';
import CrisisBriefScreen from './src/screens/CrisisBriefScreen';
import AlertsScreen from './src/screens/AlertsScreen';
import SimulateScreen from './src/screens/SimulateScreen';
import LogsScreen from './src/screens/LogsScreen';
import { COLORS } from './src/constants/colors';

const Tab = createBottomTabNavigator();

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<string, { focused: IconName; unfocused: IconName }> = {
  Home:     { focused: 'home',          unfocused: 'home-outline' },
  Map:      { focused: 'map',           unfocused: 'map-outline' },
  Brief:    { focused: 'document-text', unfocused: 'document-text-outline' },
  Alerts:   { focused: 'warning',       unfocused: 'warning-outline' },
  Simulate: { focused: 'flask',         unfocused: 'flask-outline' },
  Logs:     { focused: 'document-text', unfocused: 'document-text-outline' },
};

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarActiveTintColor: COLORS.tabActive,
            tabBarInactiveTintColor: COLORS.tabInactive,
            tabBarStyle: {
              backgroundColor: COLORS.tabBarBg,
              borderTopColor: COLORS.border,
              borderTopWidth: 1,
              paddingBottom: 20,
              height: 70,
            },
            tabBarLabelStyle: {
              fontSize: 10,
              fontWeight: '600',
              letterSpacing: 0.3,
            },
            tabBarIcon: ({ focused, color, size }) => {
              const icons = TAB_ICONS[route.name];
              const iconName = focused ? icons.focused : icons.unfocused;
              return <Ionicons name={iconName} size={size} color={color} />;
            },
          })}
        >
          <Tab.Screen name="Home" component={HomeScreen} />
          <Tab.Screen name="Map" component={MapScreen} />
          <Tab.Screen name="Brief" component={CrisisBriefScreen} />
          <Tab.Screen name="Alerts" component={AlertsScreen} />
          <Tab.Screen name="Simulate" component={SimulateScreen} />
          <Tab.Screen name="Logs" component={LogsScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

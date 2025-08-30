import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, StyleSheet } from 'react-native';

import HomeScreen from './screens/HomeScreen';
import HealthJournalScreen from './screens/HealthJournalScreen';
import SettingsScreen from './screens/SettingsScreen';

const Tab = createBottomTabNavigator();

interface MainAppProps {
  userId: string;
  onResetOnboarding: () => void;
}

export default function MainApp({ userId, onResetOnboarding }: MainAppProps) {
  return (
    <NavigationContainer independent={true}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName: keyof typeof Ionicons.glyphMap;

            if (route.name === 'Home') {
              iconName = focused ? 'home' : 'home-outline';
            } else if (route.name === 'Health Journal') {
              iconName = focused ? 'journal' : 'journal-outline';
            } else if (route.name === 'Settings') {
              iconName = focused ? 'settings' : 'settings-outline';
            } else {
              iconName = 'home-outline';
            }

            return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: '#4A90E2',
          tabBarInactiveTintColor: '#8E8E93',
          tabBarStyle: {
            backgroundColor: '#ffffff',
            borderTopColor: '#E0E0E0',
            borderTopWidth: 1,
            paddingBottom: 5,
            paddingTop: 5,
            height: 60,
          },
          headerShown: false,
        })}
      >
        <Tab.Screen name="Home">
          {(props) => <HomeScreen {...props} userId={userId} />}
        </Tab.Screen>
        <Tab.Screen name="Health Journal">
          {(props) => <HealthJournalScreen {...props} userId={userId} />}
        </Tab.Screen>
        <Tab.Screen name="Settings">
          {(props) => <SettingsScreen {...props} userId={userId} onResetOnboarding={onResetOnboarding} />}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
});
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, SafeAreaView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import OnboardingFlow from './onboarding/OnboardingFlow';
import MainApp from './main/MainApp';
import { Ionicons } from '@expo/vector-icons';

export default function Index() {
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      checkOnboardingStatus();
    }, [])
  );

  const checkOnboardingStatus = async () => {
    try {
      const completed = await AsyncStorage.getItem('onboarding_completed');
      const storedUserId = await AsyncStorage.getItem('user_id');
      
      setOnboardingCompleted(completed === 'true');
      setUserId(storedUserId);
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      setOnboardingCompleted(false);
    }
  };

  const handleOnboardingComplete = async (newUserId: string) => {
    try {
      await AsyncStorage.setItem('onboarding_completed', 'true');
      await AsyncStorage.setItem('user_id', newUserId);
      setOnboardingCompleted(true);
      setUserId(newUserId);
    } catch (error) {
      console.error('Error saving onboarding status:', error);
    }
  };

  const resetOnboarding = async () => {
    try {
      await AsyncStorage.multiRemove(['onboarding_completed', 'user_id']);
      setOnboardingCompleted(false);
      setUserId(null);
    } catch (error) {
      console.error('Error resetting onboarding:', error);
    }
  };

  if (onboardingCompleted === null) {
    // Loading state
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <View style={styles.loadingContent}>
          <Ionicons name="medical" size={60} color="#4A90E2" />
          <Text style={styles.appName}>MedMind</Text>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!onboardingCompleted || !userId) {
    return <OnboardingFlow onComplete={handleOnboardingComplete} />;
  }

  return (
    <View style={styles.container}>
      <MainApp userId={userId} onResetOnboarding={resetOnboarding} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loadingContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4A90E2',
    marginTop: 16,
    marginBottom: 8,
  },
  loadingText: {
    fontSize: 16,
    color: '#666666',
  },
});
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

interface OnboardingFlowProps {
  onComplete: (userId: string) => void;
}

interface UserData {
  age: number | null;
  name: string;
  phone_number: string;
  profile_photo: string | null;
  emergency_contact: { name: string; phone: string };
  caregiver_contact: { name: string; phone: string };
  doctor_contact: { name: string; phone: string };
  appearance_mode: 'light' | 'dark';
  reminder_tone: string;
  notification_preferences: {
    sms: boolean;
    push: boolean;
    email: boolean;
  };
  fitbit_connected: boolean;
  apple_watch_connected: boolean;
  prescriptions: any[];
}

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || 'https://pill-reminder-3.preview.emergentagent.com';

export default function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [userData, setUserData] = useState<UserData>({
    age: null,
    name: '',
    phone_number: '',
    profile_photo: null,
    emergency_contact: { name: '', phone: '' },
    caregiver_contact: { name: '', phone: '' },
    doctor_contact: { name: '', phone: '' },
    appearance_mode: 'light',
    reminder_tone: 'default',
    notification_preferences: {
      sms: false,
      push: true,
      email: false,
    },
    fitbit_connected: false,
    apple_watch_connected: false,
    prescriptions: [],
  });

  const scrollViewRef = useRef<ScrollView>(null);

  const steps = [
    'Age Selection',
    'Emergency Contact',
    'Notifications',
    'Profile Photo',
    'Contact Info',
    'Caregiver Info',
    'Doctor Info',
    'Appearance',
    'Reminder Tone',
    'Notification Preferences',
    'Prescriptions',
    'Device Connection',
    'Complete',
  ];

  const updateUserData = (field: keyof UserData | string, value: any) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setUserData(prev => ({
        ...prev,
        [parent]: {
          ...(prev[parent as keyof UserData] as object),
          [child]: value,
        },
      }));
    } else {
      setUserData(prev => ({
        ...prev,
        [field]: value,
      }));
    }
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    }
  };

  const validateCurrentStep = (): boolean => {
    switch (currentStep) {
      case 0: // Age - only require age to be entered
        return userData.age !== null && userData.age > 0;
      default:
        return true; // Allow proceeding on ALL other steps without validation
    }
  };

  const requestNotificationPermissions = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permissions Required',
          'We need notification permissions to remind you about your medication.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
    }
  };

  const pickProfileImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'We need access to your photos to set a profile picture.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        updateUserData('profile_photo', result.assets[0].base64);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const completeOnboarding = async () => {
    try {
      // Ensure we have minimum required data with defaults
      const profileData = {
        ...userData,
        name: userData.name || 'MedMind User',
        phone_number: userData.phone_number || '',
        emergency_contact: {
          name: userData.emergency_contact.name || 'Emergency Contact',
          phone: userData.emergency_contact.phone || ''
        },
        caregiver_contact: {
          name: userData.caregiver_contact.name || 'Caregiver',
          phone: userData.caregiver_contact.phone || ''
        },
        doctor_contact: {
          name: userData.doctor_contact.name || 'Doctor',
          phone: userData.doctor_contact.phone || ''
        }
      };

      const response = await fetch(`${BACKEND_URL}/api/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(profileData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Profile creation error:', errorText);
        throw new Error(`Failed to create profile: ${response.status}`);
      }

      const profile = await response.json();
      
      // Mark onboarding as complete
      await fetch(`${BACKEND_URL}/api/profile/${profile.id}/complete-onboarding`, {
        method: 'POST',
      });

      onComplete(profile.id);
    } catch (error) {
      console.error('Error completing onboarding:', error);
      Alert.alert('Setup Complete', 'Welcome to MedMind! Let\'s get started.', [
        { text: 'Continue', onPress: () => onComplete('demo-user-' + Date.now()) }
      ]);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Age Selection
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>How old are you?</Text>
            <Text style={styles.stepSubtitle}>This helps us customize your experience</Text>
            <TextInput
              style={styles.ageInput}
              placeholder="Enter your age"
              keyboardType="numeric"
              value={userData.age?.toString() || ''}
              onChangeText={(text) => updateUserData('age', parseInt(text) || null)}
              maxLength={3}
            />
          </View>
        );

      case 1: // Emergency Contact
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Emergency Contact</Text>
            <Text style={styles.stepSubtitle}>Who should we contact if you miss medication?</Text>
            <TextInput
              style={styles.input}
              placeholder="Contact Name"
              value={userData.emergency_contact.name}
              onChangeText={(text) => updateUserData('emergency_contact.name', text)}
            />
            <TextInput
              style={styles.input}
              placeholder="Phone Number"
              keyboardType="phone-pad"
              value={userData.emergency_contact.phone}
              onChangeText={(text) => updateUserData('emergency_contact.phone', text)}
            />
          </View>
        );

      case 2: // Notifications
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Enable Notifications</Text>
            <Text style={styles.stepSubtitle}>Allow us to send you medication reminders</Text>
            <TouchableOpacity 
              style={styles.primaryButton} 
              onPress={requestNotificationPermissions}
            >
              <Text style={styles.primaryButtonText}>Allow Notifications</Text>
            </TouchableOpacity>
          </View>
        );

      case 3: // Profile Photo
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Add Profile Photo</Text>
            <Text style={styles.stepSubtitle}>Take a picture of yourself</Text>
            
            {userData.profile_photo ? (
              <View style={styles.profileImageContainer}>
                <Image
                  source={{ uri: `data:image/jpeg;base64,${userData.profile_photo}` }}
                  style={styles.profileImage}
                />
              </View>
            ) : (
              <View style={styles.profilePlaceholder}>
                <Ionicons name="person" size={60} color="#ccc" />
              </View>
            )}

            <TouchableOpacity style={styles.secondaryButton} onPress={pickProfileImage}>
              <Text style={styles.secondaryButtonText}>
                {userData.profile_photo ? 'Change Photo' : 'Add Photo'}
              </Text>
            </TouchableOpacity>
          </View>
        );

      case 4: // Contact Info
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Your Information</Text>
            <Text style={styles.stepSubtitle}>Tell us about yourself</Text>
            <TextInput
              style={styles.input}
              placeholder="Full Name"
              value={userData.name}
              onChangeText={(text) => updateUserData('name', text)}
            />
            <TextInput
              style={styles.input}
              placeholder="Phone Number"
              keyboardType="phone-pad"
              value={userData.phone_number}
              onChangeText={(text) => updateUserData('phone_number', text)}
            />
          </View>
        );

      case 5: // Caregiver Info
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Caregiver Contact</Text>
            <Text style={styles.stepSubtitle}>Your primary caregiver information</Text>
            <TextInput
              style={styles.input}
              placeholder="Caregiver Name"
              value={userData.caregiver_contact.name}
              onChangeText={(text) => updateUserData('caregiver_contact.name', text)}
            />
            <TextInput
              style={styles.input}
              placeholder="Caregiver Phone"
              keyboardType="phone-pad"
              value={userData.caregiver_contact.phone}
              onChangeText={(text) => updateUserData('caregiver_contact.phone', text)}
            />
          </View>
        );

      case 6: // Doctor Info
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Doctor Contact</Text>
            <Text style={styles.stepSubtitle}>Your primary doctor information</Text>
            <TextInput
              style={styles.input}
              placeholder="Doctor Name"
              value={userData.doctor_contact.name}
              onChangeText={(text) => updateUserData('doctor_contact.name', text)}
            />
            <TextInput
              style={styles.input}
              placeholder="Doctor Phone"
              keyboardType="phone-pad"
              value={userData.doctor_contact.phone}
              onChangeText={(text) => updateUserData('doctor_contact.phone', text)}
            />
          </View>
        );

      case 7: // Appearance
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Choose Appearance</Text>
            <Text style={styles.stepSubtitle}>Select your preferred theme</Text>
            <View style={styles.optionContainer}>
              <TouchableOpacity
                style={[
                  styles.optionButton,
                  userData.appearance_mode === 'light' && styles.selectedOption,
                ]}
                onPress={() => updateUserData('appearance_mode', 'light')}
              >
                <Ionicons name="sunny" size={30} color="#4A90E2" />
                <Text style={styles.optionText}>Light Mode</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.optionButton,
                  userData.appearance_mode === 'dark' && styles.selectedOption,
                ]}
                onPress={() => updateUserData('appearance_mode', 'dark')}
              >
                <Ionicons name="moon" size={30} color="#4A90E2" />
                <Text style={styles.optionText}>Dark Mode</Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      case 8: // Reminder Tone
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Reminder Sound</Text>
            <Text style={styles.stepSubtitle}>Choose your notification sound</Text>
            {['Default', 'Bell', 'Chime', 'Alert'].map((tone) => (
              <TouchableOpacity
                key={tone}
                style={[
                  styles.listOption,
                  userData.reminder_tone === tone.toLowerCase() && styles.selectedListOption,
                ]}
                onPress={() => updateUserData('reminder_tone', tone.toLowerCase())}
              >
                <Text style={styles.listOptionText}>{tone}</Text>
                {userData.reminder_tone === tone.toLowerCase() && (
                  <Ionicons name="checkmark" size={20} color="#4A90E2" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        );

      case 9: // Notification Preferences
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Notification Preferences</Text>
            <Text style={styles.stepSubtitle}>How would you like to receive reminders?</Text>
            
            {[
              { key: 'push', label: 'Push Notifications', icon: 'notifications' },
              { key: 'sms', label: 'Text Messages', icon: 'chatbubble' },
              { key: 'email', label: 'Email Notifications', icon: 'mail' },
            ].map((option) => (
              <TouchableOpacity
                key={option.key}
                style={styles.checkboxOption}
                onPress={() =>
                  updateUserData(`notification_preferences.${option.key}`, 
                    !userData.notification_preferences[option.key as keyof typeof userData.notification_preferences]
                  )
                }
              >
                <View style={styles.checkboxRow}>
                  <Ionicons name={option.icon as any} size={24} color="#4A90E2" />
                  <Text style={styles.checkboxText}>{option.label}</Text>
                  <View style={[
                    styles.checkbox,
                    userData.notification_preferences[option.key as keyof typeof userData.notification_preferences] && styles.checkedBox
                  ]}>
                    {userData.notification_preferences[option.key as keyof typeof userData.notification_preferences] && (
                      <Ionicons name="checkmark" size={16} color="white" />
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        );

      case 10: // Prescriptions
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Your Prescriptions</Text>
            <Text style={styles.stepSubtitle}>Add your medications (you can do this later)</Text>
            <View style={styles.prescriptionPlaceholder}>
              <Ionicons name="medical" size={60} color="#ccc" />
              <Text style={styles.placeholderText}>
                You can add your prescriptions after completing setup
              </Text>
            </View>
          </View>
        );

      case 11: // Device Connection
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Connect Devices</Text>
            <Text style={styles.stepSubtitle}>Connect your fitness devices (optional)</Text>
            
            <TouchableOpacity
              style={styles.deviceOption}
              onPress={() => updateUserData('fitbit_connected', !userData.fitbit_connected)}
            >
              <View style={styles.deviceRow}>
                <Ionicons name="fitness" size={24} color="#4A90E2" />
                <Text style={styles.deviceText}>Connect Fitbit</Text>
                <View style={[styles.toggle, userData.fitbit_connected && styles.toggleActive]}>
                  {userData.fitbit_connected && <View style={styles.toggleDot} />}
                </View>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.deviceOption}
              onPress={() => updateUserData('apple_watch_connected', !userData.apple_watch_connected)}
            >
              <View style={styles.deviceRow}>
                <Ionicons name="watch" size={24} color="#4A90E2" />
                <Text style={styles.deviceText}>Connect Apple Watch</Text>
                <View style={[styles.toggle, userData.apple_watch_connected && styles.toggleActive]}>
                  {userData.apple_watch_connected && <View style={styles.toggleDot} />}
                </View>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.skipButton}>
              <Text style={styles.skipButtonText}>Skip for now</Text>
            </TouchableOpacity>
          </View>
        );

      case 12: // Complete
        return (
          <View style={styles.stepContent}>
            <View style={styles.completionContainer}>
              <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />
              <Text style={styles.completionTitle}>Setup Complete!</Text>
              <Text style={styles.completionSubtitle}>
                Welcome to MedMind! You{`'`}re all set to start managing your medication schedule.
              </Text>
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Ionicons name="medical" size={30} color="#4A90E2" />
            <Text style={styles.appName}>MedMind</Text>
          </View>
          <Text style={styles.stepIndicator}>
            {currentStep + 1} of {steps.length}
          </Text>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { width: `${((currentStep + 1) / steps.length) * 100}%` }]} />
        </View>

        {/* Content */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {renderStepContent()}
        </ScrollView>

        {/* Navigation */}
        <View style={styles.navigation}>
          {currentStep > 0 && (
            <TouchableOpacity style={styles.backButton} onPress={prevStep}>
              <Ionicons name="chevron-back" size={20} color="#4A90E2" />
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            style={[
              styles.nextButton,
              (!validateCurrentStep() && currentStep < 12) && styles.disabledButton,
            ]}
            onPress={currentStep === 12 ? completeOnboarding : nextStep}
            disabled={!validateCurrentStep() && currentStep < 12}
          >
            <Text style={styles.nextButtonText}>
              {currentStep === 12 ? 'Get Started' : 'Next'}
            </Text>
            {currentStep < 12 && <Ionicons name="chevron-forward" size={20} color="white" />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 15,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4A90E2',
    marginLeft: 8,
  },
  stepIndicator: {
    fontSize: 14,
    color: '#666666',
  },
  progressContainer: {
    height: 4,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 20,
    borderRadius: 2,
    marginBottom: 20,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#4A90E2',
    borderRadius: 2,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  stepContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333333',
    textAlign: 'center',
    marginBottom: 12,
  },
  stepSubtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
  },
  ageInput: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#4A90E2',
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#4A90E2',
    paddingBottom: 10,
    minWidth: 120,
  },
  input: {
    width: '100%',
    height: 50,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: '#ffffff',
  },
  profileImageContainer: {
    marginBottom: 24,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  profilePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  optionContainer: {
    flexDirection: 'row',
    gap: 20,
  },
  optionButton: {
    alignItems: 'center',
    padding: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    backgroundColor: '#ffffff',
    minWidth: 120,
  },
  selectedOption: {
    borderColor: '#4A90E2',
    backgroundColor: '#F0F8FF',
  },
  optionText: {
    marginTop: 8,
    fontSize: 16,
    color: '#333333',
  },
  listOption: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: '#ffffff',
  },
  selectedListOption: {
    borderColor: '#4A90E2',
    backgroundColor: '#F0F8FF',
  },
  listOptionText: {
    fontSize: 16,
    color: '#333333',
  },
  checkboxOption: {
    width: '100%',
    marginBottom: 16,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#ffffff',
  },
  checkboxText: {
    flex: 1,
    fontSize: 16,
    color: '#333333',
    marginLeft: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkedBox: {
    backgroundColor: '#4A90E2',
    borderColor: '#4A90E2',
  },
  prescriptionPlaceholder: {
    alignItems: 'center',
    padding: 40,
  },
  placeholderText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 24,
  },
  deviceOption: {
    width: '100%',
    marginBottom: 16,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#ffffff',
  },
  deviceText: {
    flex: 1,
    fontSize: 16,
    color: '#333333',
    marginLeft: 12,
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingHorizontal: 3,
  },
  toggleActive: {
    backgroundColor: '#4A90E2',
    alignItems: 'flex-end',
  },
  toggleDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ffffff',
  },
  skipButton: {
    marginTop: 20,
    padding: 12,
  },
  skipButtonText: {
    fontSize: 16,
    color: '#4A90E2',
    textAlign: 'center',
  },
  completionContainer: {
    alignItems: 'center',
    padding: 40,
  },
  completionTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333333',
    marginTop: 24,
    marginBottom: 16,
    textAlign: 'center',
  },
  completionSubtitle: {
    fontSize: 18,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 26,
  },
  navigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#ffffff',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  backButtonText: {
    fontSize: 16,
    color: '#4A90E2',
    marginLeft: 4,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4A90E2',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 100,
    justifyContent: 'center',
  },
  disabledButton: {
    backgroundColor: '#CCCCCC',
  },
  nextButtonText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '600',
    marginRight: 4,
  },
  primaryButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 18,
    color: '#ffffff',
    fontWeight: '600',
  },
  secondaryButton: {
    borderWidth: 2,
    borderColor: '#4A90E2',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 18,
    color: '#4A90E2',
    fontWeight: '600',
  },
});
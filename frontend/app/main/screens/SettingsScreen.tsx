import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Constants from 'expo-constants';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

interface SettingsScreenProps {
  userId: string;
  onResetOnboarding: () => void;
}

interface UserProfile {
  id: string;
  name: string;
  age: number;
  phone_number: string;
  profile_photo?: string;
  emergency_contact: { name: string; phone: string };
  caregiver_contact: { name: string; phone: string };
  doctor_contact: { name: string; phone: string };
  appearance_mode: string;
  reminder_tone: string;
  notification_preferences: {
    sms: boolean;
    push: boolean;
    email: boolean;
  };
  fitbit_connected: boolean;
  apple_watch_connected: boolean;
}

export default function SettingsScreen({ userId, onResetOnboarding }: SettingsScreenProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/profile/${userId}`);
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/profile/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      
      if (response.ok) {
        const updatedProfile = await response.json();
        setProfile(updatedProfile);
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    }
  };

  const changeProfilePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'We need access to your photos to change profile picture.');
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
        await updateProfile({ profile_photo: result.assets[0].base64 });
      }
    } catch (error) {
      console.error('Error changing profile photo:', error);
    }
  };

  const toggleNotificationPreference = (type: keyof UserProfile['notification_preferences']) => {
    if (!profile) return;
    
    const newPreferences = {
      ...profile.notification_preferences,
      [type]: !profile.notification_preferences[type],
    };
    
    updateProfile({ notification_preferences: newPreferences });
  };

  const toggleDeviceConnection = (device: 'fitbit_connected' | 'apple_watch_connected') => {
    if (!profile) return;
    
    updateProfile({ [device]: !profile[device] });
  };

  const renderSettingItem = (
    title: string,
    subtitle: string,
    icon: keyof typeof Ionicons.glyphMap,
    onPress: () => void,
    rightElement?: React.ReactNode
  ) => (
    <TouchableOpacity style={styles.settingItem} onPress={onPress}>
      <View style={styles.settingLeft}>
        <Ionicons name={icon} size={24} color="#4A90E2" />
        <View style={styles.settingTextContainer}>
          <Text style={styles.settingTitle}>{title}</Text>
          <Text style={styles.settingSubtitle}>{subtitle}</Text>
        </View>
      </View>
      {rightElement || <Ionicons name="chevron-forward" size={20} color="#CCCCCC" />}
    </TouchableOpacity>
  );

  const renderSectionHeader = (title: string) => (
    <Text style={styles.sectionHeader}>{title}</Text>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Ionicons name="settings" size={40} color="#4A90E2" />
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load profile</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.screenTitle}>Settings</Text>
        </View>

        {/* Profile Section */}
        {renderSectionHeader('Profile')}
        <View style={styles.profileSection}>
          <TouchableOpacity style={styles.profileImageContainer} onPress={changeProfilePhoto}>
            {profile.profile_photo ? (
              <Image
                source={{ uri: `data:image/jpeg;base64,${profile.profile_photo}` }}
                style={styles.profileImage}
              />
            ) : (
              <View style={styles.profilePlaceholder}>
                <Ionicons name="person" size={40} color="#CCCCCC" />
              </View>
            )}
            <View style={styles.editImageButton}>
              <Ionicons name="camera" size={16} color="#ffffff" />
            </View>
          </TouchableOpacity>
          
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{profile.name}</Text>
            <Text style={styles.profileDetails}>
              Age {profile.age} • {profile.phone_number}
            </Text>
          </View>
        </View>

        {/* Basic Information */}
        {renderSectionHeader('Basic Information')}
        <View style={styles.settingSection}>
          {renderSettingItem(
            'Personal Information',
            `${profile.name}, ${profile.age} years old`,
            'person',
            () => Alert.alert('Info', 'Edit profile feature coming soon')
          )}
          
          {renderSettingItem(
            'Emergency Contact',
            profile.emergency_contact.name,
            'call',
            () => Alert.alert('Emergency Contact', `${profile.emergency_contact.name}\n${profile.emergency_contact.phone}`)
          )}
          
          {renderSettingItem(
            'Caregiver Contact',
            profile.caregiver_contact.name,
            'people',
            () => Alert.alert('Caregiver Contact', `${profile.caregiver_contact.name}\n${profile.caregiver_contact.phone}`)
          )}
          
          {renderSettingItem(
            'Doctor Contact',
            profile.doctor_contact.name,
            'medical',
            () => Alert.alert('Doctor Contact', `${profile.doctor_contact.name}\n${profile.doctor_contact.phone}`)
          )}
        </View>

        {/* Appearance */}
        {renderSectionHeader('Appearance')}
        <View style={styles.settingSection}>
          {renderSettingItem(
            'App Theme',
            profile.appearance_mode === 'dark' ? 'Dark Mode' : 'Light Mode',
            profile.appearance_mode === 'dark' ? 'moon' : 'sunny',
            () => updateProfile({ 
              appearance_mode: profile.appearance_mode === 'dark' ? 'light' : 'dark' 
            })
          )}
        </View>

        {/* Notifications */}
        {renderSectionHeader('Notifications')}
        <View style={styles.settingSection}>
          {renderSettingItem(
            'Push Notifications',
            'Receive app notifications',
            'notifications',
            () => toggleNotificationPreference('push'),
            <Switch
              value={profile.notification_preferences.push}
              onValueChange={() => toggleNotificationPreference('push')}
              trackColor={{ false: '#E0E0E0', true: '#4A90E2' }}
              thumbColor={'#ffffff'}
            />
          )}
          
          {renderSettingItem(
            'SMS Notifications',
            'Receive text messages',
            'chatbubble',
            () => toggleNotificationPreference('sms'),
            <Switch
              value={profile.notification_preferences.sms}
              onValueChange={() => toggleNotificationPreference('sms')}
              trackColor={{ false: '#E0E0E0', true: '#4A90E2' }}
              thumbColor={'#ffffff'}
            />
          )}
          
          {renderSettingItem(
            'Email Notifications',
            'Receive email alerts',
            'mail',
            () => toggleNotificationPreference('email'),
            <Switch
              value={profile.notification_preferences.email}
              onValueChange={() => toggleNotificationPreference('email')}
              trackColor={{ false: '#E0E0E0', true: '#4A90E2' }}
              thumbColor={'#ffffff'}
            />
          )}
          
          {renderSettingItem(
            'Reminder Sound',
            profile.reminder_tone.charAt(0).toUpperCase() + profile.reminder_tone.slice(1),
            'volume-high',
            () => Alert.alert('Reminder Sound', 'Sound settings coming soon')
          )}
        </View>

        {/* Medications */}
        {renderSectionHeader('Medications')}
        <View style={styles.settingSection}>
          {renderSettingItem(
            'Manage Medications',
            'Add, edit, or remove medications',
            'medical',
            () => Alert.alert('Medications', 'Medication management coming soon')
          )}
          
          {renderSettingItem(
            'Smart Reminders',
            'Repeating reminders until confirmed',
            'timer',
            () => Alert.alert('Smart Reminders', 'Smart reminder settings coming soon')
          )}
        </View>

        {/* Device Connections */}
        {renderSectionHeader('Device Connections')}
        <View style={styles.settingSection}>
          {renderSettingItem(
            'Fitbit',
            profile.fitbit_connected ? 'Connected' : 'Not connected',
            'fitness',
            () => toggleDeviceConnection('fitbit_connected'),
            <Switch
              value={profile.fitbit_connected}
              onValueChange={() => toggleDeviceConnection('fitbit_connected')}
              trackColor={{ false: '#E0E0E0', true: '#4A90E2' }}
              thumbColor={'#ffffff'}
            />
          )}
          
          {renderSettingItem(
            'Apple Watch',
            profile.apple_watch_connected ? 'Connected' : 'Not connected',
            'watch',
            () => toggleDeviceConnection('apple_watch_connected'),
            <Switch
              value={profile.apple_watch_connected}
              onValueChange={() => toggleDeviceConnection('apple_watch_connected')}
              trackColor={{ false: '#E0E0E0', true: '#4A90E2' }}
              thumbColor={'#ffffff'}
            />
          )}
        </View>

        {/* Support */}
        {renderSectionHeader('Support')}
        <View style={styles.settingSection}>
          {renderSettingItem(
            'Help & Support',
            'Get help with the app',
            'help-circle',
            () => Alert.alert('Help & Support', 'Support features coming soon')
          )}
          
          {renderSettingItem(
            'Privacy Policy',
            'View our privacy policy',
            'shield-checkmark',
            () => Alert.alert('Privacy Policy', 'Privacy policy coming soon')
          )}
          
          {renderSettingItem(
            'About',
            'App version and information',
            'information-circle',
            () => Alert.alert('About MedMind', 'MedMind v1.0\nYour medication reminder companion')
          )}
        </View>

        {/* Reset Option */}
        {renderSectionHeader('Advanced')}
        <View style={styles.settingSection}>
          <TouchableOpacity
            style={[styles.settingItem, styles.dangerItem]}
            onPress={() =>
              Alert.alert(
                'Reset App',
                'This will clear all your data and return you to the onboarding process. Are you sure?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Reset', style: 'destructive', onPress: onResetOnboarding },
                ]
              )
            }
          >
            <View style={styles.settingLeft}>
              <Ionicons name="refresh" size={24} color="#F44336" />
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingTitle, styles.dangerText]}>Reset App</Text>
                <Text style={styles.settingSubtitle}>Clear all data and start over</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#F44336',
  },
  header: {
    marginBottom: 24,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333333',
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666666',
    marginTop: 24,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  profileImageContainer: {
    position: 'relative',
    marginRight: 16,
  },
  profileImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  profilePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editImageButton: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 4,
  },
  profileDetails: {
    fontSize: 14,
    color: '#666666',
  },
  settingSection: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 14,
    color: '#666666',
  },
  dangerItem: {
    borderBottomWidth: 0,
  },
  dangerText: {
    color: '#F44336',
  },
});
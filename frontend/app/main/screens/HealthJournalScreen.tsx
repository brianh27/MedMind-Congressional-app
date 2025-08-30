import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  RefreshControl,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Constants from 'expo-constants';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

interface HealthJournalScreenProps {
  userId: string;
}

interface JournalEntry {
  id: string;
  date: string;
  symptoms: string[];
  notes: string;
  mood_rating: number | null;
  side_effects: string[];
  caregiver_alerted: boolean;
  created_at: string;
  updated_at: string;
}

export default function HealthJournalScreen({ userId }: HealthJournalScreenProps) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [todayEntry, setTodayEntry] = useState<JournalEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Form states for today's entry
  const [symptoms, setSymptoms] = useState('');
  const [notes, setNotes] = useState('');
  const [moodRating, setMoodRating] = useState<number | null>(null);
  const [sideEffects, setSideEffects] = useState('');

  const today = new Date().toISOString().split('T')[0];

  useFocusEffect(
    useCallback(() => {
      loadJournalEntries();
    }, [])
  );

  const loadJournalEntries = async () => {
    try {
      // Load all entries
      const response = await fetch(`${BACKEND_URL}/api/health-journal/${userId}`);
      if (response.ok) {
        const data = await response.json();
        setEntries(data);
      }

      // Try to load today's entry
      try {
        const todayResponse = await fetch(`${BACKEND_URL}/api/health-journal/${userId}/${today}`);
        if (todayResponse.ok) {
          const todayData = await todayResponse.json();
          setTodayEntry(todayData);
          setSymptoms(todayData.symptoms.join(', '));
          setNotes(todayData.notes);
          setMoodRating(todayData.mood_rating);
          setSideEffects(todayData.side_effects.join(', '));
        } else {
          // No entry for today yet
          setTodayEntry(null);
          resetForm();
        }
      } catch (todayError) {
        console.log('No entry for today yet');
        setTodayEntry(null);
        resetForm();
      }

    } catch (error) {
      console.error('Error loading journal entries:', error);
      Alert.alert('Error', 'Failed to load journal entries');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const resetForm = () => {
    setSymptoms('');
    setNotes('');
    setMoodRating(null);
    setSideEffects('');
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadJournalEntries();
  };

  const saveTodayEntry = async () => {
    try {
      const entryData = {
        date: today,
        symptoms: symptoms.split(',').map(s => s.trim()).filter(s => s),
        notes: notes,
        mood_rating: moodRating,
        side_effects: sideEffects.split(',').map(s => s.trim()).filter(s => s),
      };

      let response;
      
      if (todayEntry) {
        // Update existing entry
        response = await fetch(`${BACKEND_URL}/api/health-journal/${todayEntry.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entryData),
        });
      } else {
        // Create new entry
        const formData = new FormData();
        formData.append('user_id', userId);
        Object.entries(entryData).forEach(([key, value]) => {
          if (Array.isArray(value)) {
            formData.append(key, JSON.stringify(value));
          } else {
            formData.append(key, value?.toString() || '');
          }
        });

        response = await fetch(`${BACKEND_URL}/api/health-journal`, {
          method: 'POST',
          body: formData,
        });
      }

      if (!response.ok) {
        throw new Error('Failed to save entry');
      }

      setIsEditing(false);
      loadJournalEntries();
      Alert.alert('Success', 'Journal entry saved successfully');

    } catch (error) {
      console.error('Error saving journal entry:', error);
      Alert.alert('Error', 'Failed to save journal entry');
    }
  };

  const alertCaregiver = async () => {
    Alert.alert(
      'Alert Caregiver',
      'Are you sure you want to alert your caregiver about symptoms?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Alert',
          style: 'default',
          onPress: async () => {
            try {
              if (todayEntry) {
                await fetch(`${BACKEND_URL}/api/health-journal/${todayEntry.id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ caregiver_alerted: true }),
                });
                Alert.alert('Success', 'Caregiver has been notified');
                loadJournalEntries();
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to alert caregiver');
            }
          },
        },
      ]
    );
  };

  const renderMoodRating = () => {
    return (
      <View style={styles.moodContainer}>
        <Text style={styles.inputLabel}>Mood Rating (1-10)</Text>
        <View style={styles.moodRatingContainer}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((rating) => (
            <TouchableOpacity
              key={rating}
              style={[
                styles.moodButton,
                moodRating === rating && styles.selectedMoodButton,
              ]}
              onPress={() => setMoodRating(rating)}
            >
              <Text
                style={[
                  styles.moodButtonText,
                  moodRating === rating && styles.selectedMoodButtonText,
                ]}
              >
                {rating}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderJournalEntry = (entry: JournalEntry) => {
    const entryDate = new Date(entry.date).toLocaleDateString();
    
    return (
      <TouchableOpacity key={entry.id} style={styles.entryCard}>
        <View style={styles.entryHeader}>
          <Text style={styles.entryDate}>{entryDate}</Text>
          {entry.caregiver_alerted && (
            <View style={styles.alertedBadge}>
              <Ionicons name="notifications" size={12} color="#FF6B35" />
              <Text style={styles.alertedText}>Alerted</Text>
            </View>
          )}
        </View>
        
        {entry.symptoms.length > 0 && (
          <View style={styles.entrySection}>
            <Text style={styles.entrySectionTitle}>Symptoms:</Text>
            <Text style={styles.entrySectionText}>{entry.symptoms.join(', ')}</Text>
          </View>
        )}
        
        {entry.notes && (
          <View style={styles.entrySection}>
            <Text style={styles.entrySectionTitle}>Notes:</Text>
            <Text style={styles.entrySectionText}>{entry.notes}</Text>
          </View>
        )}
        
        {entry.mood_rating && (
          <View style={styles.entrySection}>
            <Text style={styles.entrySectionTitle}>Mood: {entry.mood_rating}/10</Text>
          </View>
        )}
        
        {entry.side_effects.length > 0 && (
          <View style={styles.entrySection}>
            <Text style={styles.entrySectionTitle}>Side Effects:</Text>
            <Text style={styles.entrySectionText}>{entry.side_effects.join(', ')}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Ionicons name="journal" size={40} color="#4A90E2" />
          <Text style={styles.loadingText}>Loading journal...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.screenTitle}>Health Journal</Text>
        </View>

        {/* Today's Entry */}
        <View style={styles.todaySection}>
          <View style={styles.todaySectionHeader}>
            <Text style={styles.sectionTitle}>
              Today - {new Date().toLocaleDateString()}
            </Text>
            {!isEditing && (
              <TouchableOpacity onPress={() => setIsEditing(true)}>
                <Ionicons name="pencil" size={20} color="#4A90E2" />
              </TouchableOpacity>
            )}
          </View>

          {isEditing ? (
            <View style={styles.editForm}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Symptoms (comma separated)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g., headache, nausea, dizziness"
                  value={symptoms}
                  onChangeText={setSymptoms}
                  multiline
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Notes</Text>
                <TextInput
                  style={[styles.textInput, styles.notesInput]}
                  placeholder="How are you feeling today?"
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                />
              </View>

              {renderMoodRating()}

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Side Effects (comma separated)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g., drowsiness, upset stomach"
                  value={sideEffects}
                  onChangeText={setSideEffects}
                  multiline
                />
              </View>

              <View style={styles.formButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setIsEditing(false);
                    if (todayEntry) {
                      setSymptoms(todayEntry.symptoms.join(', '));
                      setNotes(todayEntry.notes);
                      setMoodRating(todayEntry.mood_rating);
                      setSideEffects(todayEntry.side_effects.join(', '));
                    } else {
                      resetForm();
                    }
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveButton} onPress={saveTodayEntry}>
                  <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.todayDisplay}>
              {todayEntry ? (
                <>
                  {todayEntry.symptoms.length > 0 && (
                    <View style={styles.displaySection}>
                      <Text style={styles.displayLabel}>Symptoms:</Text>
                      <Text style={styles.displayText}>{todayEntry.symptoms.join(', ')}</Text>
                    </View>
                  )}
                  
                  {todayEntry.notes && (
                    <View style={styles.displaySection}>
                      <Text style={styles.displayLabel}>Notes:</Text>
                      <Text style={styles.displayText}>{todayEntry.notes}</Text>
                    </View>
                  )}
                  
                  {todayEntry.mood_rating && (
                    <View style={styles.displaySection}>
                      <Text style={styles.displayLabel}>Mood: {todayEntry.mood_rating}/10</Text>
                    </View>
                  )}
                  
                  {todayEntry.side_effects.length > 0 && (
                    <View style={styles.displaySection}>
                      <Text style={styles.displayLabel}>Side Effects:</Text>
                      <Text style={styles.displayText}>{todayEntry.side_effects.join(', ')}</Text>
                    </View>
                  )}

                  {(todayEntry.symptoms.length > 0 || todayEntry.side_effects.length > 0) && 
                   !todayEntry.caregiver_alerted && (
                    <TouchableOpacity style={styles.alertButton} onPress={alertCaregiver}>
                      <Ionicons name="notifications" size={16} color="#ffffff" />
                      <Text style={styles.alertButtonText}>Alert Caregiver</Text>
                    </TouchableOpacity>
                  )}
                </>
              ) : (
                <Text style={styles.emptyStateText}>
                  No entry for today. Tap the edit icon to add your first entry.
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Previous Entries */}
        <View style={styles.historySection}>
          <Text style={styles.sectionTitle}>Previous Entries</Text>
          {entries
            .filter(entry => entry.date !== today)
            .slice(0, 10)
            .map(renderJournalEntry)
          }
          
          {entries.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={48} color="#CCCCCC" />
              <Text style={styles.emptyStateText}>No journal entries yet</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    padding: 20,
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
  header: {
    marginBottom: 24,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333333',
  },
  todaySection: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  todaySectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  editForm: {
    gap: 16,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#ffffff',
    minHeight: 44,
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  moodContainer: {
    gap: 8,
  },
  moodRatingContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  moodButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  selectedMoodButton: {
    backgroundColor: '#4A90E2',
    borderColor: '#4A90E2',
  },
  moodButtonText: {
    fontSize: 14,
    color: '#333333',
  },
  selectedMoodButtonText: {
    color: '#ffffff',
  },
  formButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    marginRight: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666666',
  },
  saveButton: {
    flex: 1,
    marginLeft: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#4A90E2',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '600',
  },
  todayDisplay: {
    gap: 12,
  },
  displaySection: {
    gap: 4,
  },
  displayLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
  },
  displayText: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  alertButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B35',
    padding: 12,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  alertButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    marginLeft: 6,
  },
  historySection: {
    gap: 16,
  },
  entryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  entryDate: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
  },
  alertedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  alertedText: {
    fontSize: 12,
    color: '#FF6B35',
    marginLeft: 4,
  },
  entrySection: {
    marginBottom: 8,
  },
  entrySectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 2,
  },
  entrySectionText: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 18,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
});
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Dimensions,
  Platform,
  FlatList,
  Modal,
  Image,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import Constants from 'expo-constants';

const { width } = Dimensions.get('window');
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || 'https://pill-reminder-3.preview.emergentagent.com';

interface HomeScreenProps {
  userId: string;
}

interface Medication {
  id: string;
  name: string;
  dosage: string;
  time_slots: string[];
  remaining_pills: number;
  total_pills: number;
  refill_info?: {
    pharmacy_name?: string;
    address?: string;
    refill_date?: string;
  };
}

interface MedicationLog {
  id: string;
  medication_id: string;
  scheduled_time: string;
  status: string;
  taken_at?: string;
}

interface MedicationTimelineItem {
  id: string;
  medication: Medication;
  scheduled_time: Date;
  status: 'upcoming' | 'current' | 'taken' | 'missed';
  log_id?: string;
}

interface DashboardData {
  user_profile: any;
  medications: Medication[];
  today_logs: MedicationLog[];
  streak: number;
  total_pills_taken: number;
  today_date: string;
}

export default function HomeScreen({ userId }: HomeScreenProps) {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [missedMedications, setMissedMedications] = useState<MedicationLog[]>([]);
  const [medicationTimeline, setMedicationTimeline] = useState<MedicationTimelineItem[]>([]);
  
  // Camera and verification states
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [selectedMedication, setSelectedMedication] = useState<MedicationTimelineItem | null>(null);
  const [verificationStep, setVerificationStep] = useState<'camera' | 'questions' | 'preview' | 'loading' | 'tips'>('camera');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [verificationAnswers, setVerificationAnswers] = useState<{[key: string]: boolean}>({});
  const [aiAnalysisResult, setAiAnalysisResult] = useState<any>(null);
  const [showRefillModal, setShowRefillModal] = useState(false);
  
  const timelineRef = useRef<FlatList>(null);

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [])
  );

  const loadDashboardData = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/dashboard/${userId}`);
      if (!response.ok) {
        throw new Error('Failed to load dashboard data');
      }
      const data = await response.json();
      setDashboardData(data);
      
      // Find missed medications
      const missed = data.today_logs.filter((log: MedicationLog) => log.status === 'missed');
      setMissedMedications(missed);
      
      // Generate medication timeline
      generateMedicationTimeline(data.medications, data.today_logs);
      
    } catch (error) {
      console.error('Error loading dashboard:', error);
      Alert.alert('Error', 'Failed to load data. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const generateMedicationTimeline = (medications: Medication[], logs: MedicationLog[]) => {
    const timeline: MedicationTimelineItem[] = [];
    const now = new Date();
    const today = now.toDateString();
    
    // Generate timeline for the past 7 days and next 7 days
    for (let dayOffset = -7; dayOffset <= 7; dayOffset++) {
      const currentDate = new Date();
      currentDate.setDate(now.getDate() + dayOffset);
      
      medications.forEach(medication => {
        medication.time_slots.forEach(timeSlot => {
          const [hours, minutes] = timeSlot.split(':').map(Number);
          const scheduledTime = new Date(currentDate);
          scheduledTime.setHours(hours, minutes, 0, 0);
          
          // Find corresponding log
          const log = logs.find(l => 
            l.medication_id === medication.id && 
            new Date(l.scheduled_time).getTime() === scheduledTime.getTime()
          );
          
          // Determine status
          let status: MedicationTimelineItem['status'] = 'upcoming';
          if (scheduledTime < now) {
            if (log?.status === 'taken') {
              status = 'taken';
            } else {
              status = 'missed';
            }
          } else if (scheduledTime.toDateString() === today) {
            const timeDiff = Math.abs(scheduledTime.getTime() - now.getTime()) / (1000 * 60);
            if (timeDiff <= 30) { // Within 30 minutes
              status = 'current';
            }
          }
          
          timeline.push({
            id: `${medication.id}-${scheduledTime.getTime()}`,
            medication,
            scheduled_time: scheduledTime,
            status,
            log_id: log?.id
          });
        });
      });
    }
    
    // Sort by scheduled time and find the most imminent current medication
    timeline.sort((a, b) => a.scheduled_time.getTime() - b.scheduled_time.getTime());
    setMedicationTimeline(timeline);
    
    // Auto-scroll to current medication
    setTimeout(() => {
      const currentIndex = timeline.findIndex(item => item.status === 'current');
      if (currentIndex !== -1 && timelineRef.current) {
        timelineRef.current.scrollToIndex({
          index: Math.max(0, currentIndex - 1),
          animated: true,
          viewPosition: 0.3
        });
      }
    }, 500);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const handleMedicationPress = (item: MedicationTimelineItem) => {
    if (item.status === 'current') {
      setSelectedMedication(item);
      setVerificationStep('camera');
      setShowVerificationModal(true);
    } else if (item.medication.refill_info) {
      setSelectedMedication(item);
      setShowRefillModal(true);
    }
  };

  const takeMedicationPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera permission is required to verify medication intake.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaType.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        setCapturedPhoto(result.assets[0].base64);
        setVerificationStep('questions');
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const analyzePhotoWithAI = async () => {
    if (!capturedPhoto || !selectedMedication) return;
    
    setVerificationStep('loading');
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/analyze-prescription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: capturedPhoto,
          medication_name: selectedMedication.medication.name
        })
      });
      
      if (!response.ok) throw new Error('Analysis failed');
      
      const result = await response.json();
      setAiAnalysisResult(result);
      setVerificationStep('preview');
    } catch (error) {
      console.error('Error analyzing photo:', error);
      Alert.alert('Error', 'Failed to analyze photo. Please try again.');
      setVerificationStep('questions');
    }
  };

  const submitVerification = async () => {
    if (!selectedMedication) return;
    
    setVerificationStep('loading');
    
    try {
      // Mark medication as taken
      if (selectedMedication.log_id) {
        await fetch(`${BACKEND_URL}/api/medication-logs/${selectedMedication.log_id}/take`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ verification_photo: capturedPhoto })
        });
      }
      
      // Simulate sending to caregiver
      setTimeout(() => {
        setVerificationStep('tips');
      }, 2000);
      
    } catch (error) {
      console.error('Error submitting verification:', error);
      Alert.alert('Error', 'Failed to submit verification.');
    }
  };

  const addSampleMedications = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/medications/${userId}/add-samples`, {
        method: 'POST',
      });
      
      if (response.ok) {
        Alert.alert(
          'Sample Medications Added', 
          'Added sample medications to demonstrate the timeline features!',
          [{ text: 'OK', onPress: () => loadDashboardData() }]
        );
      }
    } catch (error) {
      console.error('Error adding sample medications:', error);
    }
  };

  const closeVerificationModal = () => {
    setShowVerificationModal(false);
    setSelectedMedication(null);
    setCapturedPhoto(null);
    setVerificationAnswers({});
    setAiAnalysisResult(null);
    setVerificationStep('camera');
    loadDashboardData(); // Refresh data
  };

  const getStatusColor = (status: MedicationTimelineItem['status']) => {
    switch (status) {
      case 'current': return '#4CAF50'; // Green
      case 'taken': return '#2196F3';   // Blue
      case 'missed': return '#F44336';  // Red
      default: return '#F5F5F5';        // White
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    });
  };

  const formatDate = (date: Date) => {
    const today = new Date().toDateString();
    const tomorrow = new Date(Date.now() + 86400000).toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    
    if (date.toDateString() === today) return 'Today';
    if (date.toDateString() === tomorrow) return 'Tomorrow';
    if (date.toDateString() === yesterday) return 'Yesterday';
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const renderMedicationItem = ({ item }: { item: MedicationTimelineItem }) => {
    const statusColor = getStatusColor(item.status);
    const isClickable = item.status === 'current' || item.medication.refill_info;
    
    return (
      <TouchableOpacity
        style={[styles.medicationTimelineItem, { backgroundColor: statusColor }]}
        onPress={() => isClickable && handleMedicationPress(item)}
        disabled={!isClickable}
      >
        <View style={styles.timelineItemHeader}>
          <Text style={[styles.medicationName, { color: item.status === 'upcoming' ? '#333' : '#fff' }]}>
            {item.medication.name}
          </Text>
          <Text style={[styles.medicationTime, { color: item.status === 'upcoming' ? '#666' : '#fff' }]}>
            {formatTime(item.scheduled_time)}
          </Text>
        </View>
        
        <Text style={[styles.medicationDosage, { color: item.status === 'upcoming' ? '#666' : '#fff' }]}>
          {item.medication.dosage}
        </Text>
        
        <Text style={[styles.medicationDate, { color: item.status === 'upcoming' ? '#999' : '#fff' }]}>
          {formatDate(item.scheduled_time)}
        </Text>
        
        {item.medication.refill_info && (
          <View style={styles.refillIndicator}>
            <Ionicons name="refresh" size={12} color={item.status === 'upcoming' ? '#4A90E2' : '#fff'} />
          </View>
        )}
        
        {item.status === 'current' && (
          <View style={styles.currentIndicator}>
            <Ionicons name="camera" size={16} color="#fff" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderVerificationModal = () => {
    if (!selectedMedication) return null;
    
    return (
      <Modal visible={showVerificationModal} animationType="slide" presentationStyle="formSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeVerificationModal}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Take Medication</Text>
            <View style={{ width: 24 }} />
          </View>
          
          {verificationStep === 'camera' && (
            <View style={styles.cameraStep}>
              <Text style={styles.stepTitle}>Scan Your Medication</Text>
              <Text style={styles.stepSubtitle}>Take a photo of the pills you're about to take</Text>
              
              <View style={styles.medicationInfo}>
                <Text style={styles.medicationInfoText}>
                  {selectedMedication.medication.name} - {selectedMedication.medication.dosage}
                </Text>
              </View>
              
              <TouchableOpacity style={styles.cameraButton} onPress={takeMedicationPhoto}>
                <Ionicons name="camera" size={48} color="#fff" />
                <Text style={styles.cameraButtonText}>Take Photo</Text>
              </TouchableOpacity>
            </View>
          )}
          
          {verificationStep === 'questions' && (
            <ScrollView style={styles.questionsStep}>
              <Text style={styles.stepTitle}>Verification Questions</Text>
              
              {capturedPhoto && (
                <Image
                  source={{ uri: `data:image/jpeg;base64,${capturedPhoto}` }}
                  style={styles.capturedPhotoPreview}
                />
              )}
              
              <View style={styles.questionsList}>
                {[
                  'Did you use water to take the medication?',
                  'Did you take the correct number of pills?',
                  'Did you take it at the right time?',
                  'Are you feeling well to take this medication?'
                ].map((question, index) => (
                  <View key={index} style={styles.questionItem}>
                    <Text style={styles.questionText}>{question}</Text>
                    <View style={styles.questionButtons}>
                      <TouchableOpacity
                        style={[styles.questionButton, verificationAnswers[question] === true && styles.questionButtonSelected]}
                        onPress={() => setVerificationAnswers(prev => ({ ...prev, [question]: true }))}
                      >
                        <Text style={[styles.questionButtonText, verificationAnswers[question] === true && styles.questionButtonTextSelected]}>
                          Yes
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.questionButton, verificationAnswers[question] === false && styles.questionButtonSelected]}
                        onPress={() => setVerificationAnswers(prev => ({ ...prev, [question]: false }))}
                      >
                        <Text style={[styles.questionButtonText, verificationAnswers[question] === false && styles.questionButtonTextSelected]}>
                          No
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
              
              <TouchableOpacity style={styles.analyzeButton} onPress={analyzePhotoWithAI}>
                <Text style={styles.analyzeButtonText}>Analyze & Continue</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
          
          {verificationStep === 'preview' && (
            <View style={styles.previewStep}>
              <Text style={styles.stepTitle}>Verification Preview</Text>
              
              {aiAnalysisResult && (
                <View style={styles.analysisResult}>
                  <Text style={styles.analysisTitle}>AI Analysis Result</Text>
                  <Text style={styles.analysisText}>
                    Detected: {aiAnalysisResult.medication_name}
                  </Text>
                  <Text style={styles.analysisText}>
                    Dosage: {aiAnalysisResult.dosage}
                  </Text>
                  {aiAnalysisResult.pill_count && (
                    <Text style={styles.analysisText}>
                      Pills detected: {aiAnalysisResult.pill_count}
                    </Text>
                  )}
                  
                  {aiAnalysisResult.medication_name.toLowerCase() !== selectedMedication.medication.name.toLowerCase() && (
                    <View style={styles.mismatchAlert}>
                      <Ionicons name="warning" size={20} color="#F44336" />
                      <Text style={styles.mismatchText}>
                        Medication mismatch detected! Please retake the photo.
                      </Text>
                    </View>
                  )}
                </View>
              )}
              
              <TouchableOpacity style={styles.submitButton} onPress={submitVerification}>
                <Text style={styles.submitButtonText}>Submit Verification</Text>
              </TouchableOpacity>
            </View>
          )}
          
          {verificationStep === 'loading' && (
            <View style={styles.loadingStep}>
              <ActivityIndicator size="large" color="#4A90E2" />
              <Text style={styles.loadingText}>Sending information to caregiver...</Text>
            </View>
          )}
          
          {verificationStep === 'tips' && (
            <ScrollView style={styles.tipsStep}>
              <Text style={styles.stepTitle}>Post-Medication Tips</Text>
              
              <View style={styles.tipCard}>
                <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                <Text style={styles.tipTitle}>Medication Taken Successfully!</Text>
              </View>
              
              <View style={styles.tipsContainer}>
                <Text style={styles.tipsTitle}>Important Reminders:</Text>
                <Text style={styles.tipText}>• Avoid alcohol while taking this medication</Text>
                <Text style={styles.tipText}>• Do not drive if you feel drowsy</Text>
                <Text style={styles.tipText}>• Take with food if stomach upset occurs</Text>
                <Text style={styles.tipText}>• Stay hydrated throughout the day</Text>
              </View>
              
              <View style={styles.symptomsReminder}>
                <Ionicons name="warning-outline" size={20} color="#FF8F00" />
                <Text style={styles.symptomsText}>
                  If you experience any unknown symptoms, please mark them down in your health journal. 
                  If symptoms persist, contact your doctor immediately.
                </Text>
              </View>
              
              <TouchableOpacity style={styles.finishButton} onPress={closeVerificationModal}>
                <Text style={styles.finishButtonText}>Done</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    );
  };

  const renderCalendarWeek = () => {
    const days = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const isToday = i === 0;
      
      days.push(
        <TouchableOpacity key={i} style={styles.calendarDay}>
          <Text style={[styles.dayText, isToday && styles.todayText]}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'][date.getDay()]}
          </Text>
          <View style={[styles.dayDot, { backgroundColor: isToday ? '#4CAF50' : '#F44336' }]} />
        </TouchableOpacity>
      );
    }
    
    return days;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Ionicons name="medical" size={40} color="#4A90E2" />
          <Text style={styles.loadingText}>Loading...</Text>
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
          <Text style={styles.appName}>MedMind</Text>
          <View style={styles.streakContainer}>
            <Ionicons name="flame" size={20} color="#FF6B35" />
            <Text style={styles.streakText}>{dashboardData?.streak || 0}</Text>
          </View>
        </View>

        {/* Calendar Week View */}
        <View style={styles.calendarContainer}>
          <Text style={styles.sectionTitle}>This Week</Text>
          <View style={styles.calendarWeek}>
            {renderCalendarWeek()}
          </View>
          <TouchableOpacity style={styles.viewAllButton}>
            <Text style={styles.viewAllText}>View Full Calendar</Text>
            <Ionicons name="chevron-forward" size={16} color="#4A90E2" />
          </TouchableOpacity>
        </View>

        {/* Missed Medication Banner */}
        {missedMedications.length > 0 && (
          <View style={styles.missedBanner}>
            <Text style={styles.missedBannerText}>
              YOU have missed a pill. Your caregiver has been notified.
            </Text>
            <View style={styles.missedBannerButtons}>
              <TouchableOpacity style={[styles.missedButton, styles.yesButton]}>
                <Text style={styles.yesButtonText}>Yes, I took it</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.missedButton, styles.noButton]}>
                <Text style={styles.noButtonText}>No, I haven't</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Pills Overview */}
        <View style={styles.pillsOverview}>
          <View style={styles.pillsLeft}>
            <Text style={styles.pillsNumber}>{dashboardData?.total_pills_taken || 0}</Text>
            <Text style={styles.pillsLabel}>Pills Taken</Text>
          </View>
          <View style={styles.pillsChart}>
            <View style={styles.chartContainer}>
              <View style={[styles.chartFill, { width: '65%' }]} />
              <Text style={styles.chartText}>65% Complete</Text>
            </View>
          </View>
        </View>

        {/* Medication Timeline */}
        <View style={styles.timelineSection}>
          <View style={styles.timelineSectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Medication Schedule</Text>
              <Text style={styles.timelineSubtitle}>Scroll to see past and upcoming medications</Text>
            </View>
            
            {medicationTimeline.length === 0 && (
              <TouchableOpacity style={styles.addSampleButton} onPress={addSampleMedications}>
                <Ionicons name="add" size={16} color="#ffffff" />
                <Text style={styles.addSampleButtonText}>Demo</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {medicationTimeline.length > 0 ? (
            <FlatList
              ref={timelineRef}
              data={medicationTimeline}
              renderItem={renderMedicationItem}
              keyExtractor={item => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.timelineContainer}
              getItemLayout={(data, index) => ({
                length: 160,
                offset: 160 * index,
                index,
              })}
            />
          ) : (
            <View style={styles.emptyTimeline}>
              <Ionicons name="medical-outline" size={48} color="#CCCCCC" />
              <Text style={styles.emptyTimelineText}>No medications scheduled</Text>
              <Text style={styles.emptyTimelineSubtext}>Tap "Demo" to see timeline features</Text>
            </View>
          )}
        </View>

        {/* Health Tip */}
        <View style={styles.healthTip}>
          <Ionicons name="bulb" size={20} color="#FFA500" />
          <Text style={styles.healthTipText}>
            Avoid grapefruit juice while taking your medications - it can interfere with absorption.
          </Text>
        </View>
      </ScrollView>
      
      {renderVerificationModal()}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  appName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4A90E2',
  },
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  streakText: {
    marginLeft: 6,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF6B35',
  },
  calendarContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 16,
  },
  calendarWeek: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  calendarDay: {
    alignItems: 'center',
    padding: 8,
  },
  dayText: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
  },
  todayText: {
    color: '#4A90E2',
    fontWeight: 'bold',
  },
  dayDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  viewAllText: {
    fontSize: 16,
    color: '#4A90E2',
    marginRight: 4,
  },
  missedBanner: {
    backgroundColor: '#FFEBEE',
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  missedBannerText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#D32F2F',
    marginBottom: 12,
    textAlign: 'center',
  },
  missedBannerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  missedButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  yesButton: {
    backgroundColor: '#4CAF50',
  },
  noButton: {
    backgroundColor: '#F44336',
  },
  yesButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  noButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  pillsOverview: {
    flexDirection: 'row',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  pillsLeft: {
    flex: 1,
    alignItems: 'center',
  },
  pillsNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333333',
  },
  pillsLabel: {
    fontSize: 14,
    color: '#666666',
    marginTop: 4,
  },
  pillsChart: {
    flex: 1,
    justifyContent: 'center',
  },
  chartContainer: {
    height: 40,
    backgroundColor: '#E0E0E0',
    borderRadius: 20,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  chartFill: {
    position: 'absolute',
    left: 4,
    top: 4,
    bottom: 4,
    backgroundColor: '#4A90E2',
    borderRadius: 16,
  },
  chartText: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333333',
  },
  timelineSection: {
    marginBottom: 24,
  },
  timelineSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  timelineSubtitle: {
    fontSize: 14,
    color: '#666666',
    marginTop: 4,
  },
  addSampleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4A90E2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 4,
  },
  addSampleButtonText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  emptyTimeline: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
  },
  emptyTimelineText: {
    fontSize: 16,
    color: '#666666',
    marginTop: 12,
    fontWeight: '500',
  },
  emptyTimelineSubtext: {
    fontSize: 14,
    color: '#999999',
    marginTop: 4,
  },
  timelineContainer: {
    paddingVertical: 8,
  },
  medicationTimelineItem: {
    width: 150,
    height: 120,
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    justifyContent: 'space-between',
    position: 'relative',
  },
  timelineItemHeader: {
    flexDirection: 'column',
  },
  medicationName: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  medicationTime: {
    fontSize: 12,
    fontWeight: '600',
  },
  medicationDosage: {
    fontSize: 12,
  },
  medicationDate: {
    fontSize: 10,
    opacity: 0.8,
  },
  refillIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  currentIndicator: {
    position: 'absolute',
    bottom: 8,
    right: 8,
  },
  healthTip: {
    flexDirection: 'row',
    backgroundColor: '#FFF8E1',
    borderRadius: 8,
    padding: 16,
    alignItems: 'flex-start',
  },
  healthTipText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: '#FF8F00',
    lineHeight: 20,
  },
  
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  cameraStep: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
    textAlign: 'center',
  },
  stepSubtitle: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 32,
    textAlign: 'center',
  },
  medicationInfo: {
    backgroundColor: '#F0F8FF',
    padding: 16,
    borderRadius: 8,
    marginBottom: 32,
  },
  medicationInfoText: {
    fontSize: 16,
    color: '#4A90E2',
    fontWeight: '600',
    textAlign: 'center',
  },
  cameraButton: {
    backgroundColor: '#4A90E2',
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 8,
  },
  questionsStep: {
    flex: 1,
    padding: 20,
  },
  capturedPhotoPreview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 24,
  },
  questionsList: {
    marginBottom: 24,
  },
  questionItem: {
    marginBottom: 20,
  },
  questionText: {
    fontSize: 16,
    color: '#333333',
    marginBottom: 12,
  },
  questionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  questionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    alignItems: 'center',
  },
  questionButtonSelected: {
    borderColor: '#4A90E2',
    backgroundColor: '#F0F8FF',
  },
  questionButtonText: {
    fontSize: 14,
    color: '#666666',
  },
  questionButtonTextSelected: {
    color: '#4A90E2',
    fontWeight: 'bold',
  },
  analyzeButton: {
    backgroundColor: '#4A90E2',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  analyzeButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  previewStep: {
    flex: 1,
    padding: 20,
  },
  analysisResult: {
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  analysisTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 12,
  },
  analysisText: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  mismatchAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  mismatchText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#F44336',
  },
  submitButton: {
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingStep: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipsStep: {
    flex: 1,
    padding: 20,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E8',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  tipTitle: {
    marginLeft: 12,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  tipsContainer: {
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 12,
  },
  tipText: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 6,
    lineHeight: 20,
  },
  symptomsReminder: {
    flexDirection: 'row',
    backgroundColor: '#FFF8E1',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  symptomsText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: '#FF8F00',
    lineHeight: 20,
  },
  finishButton: {
    backgroundColor: '#4A90E2',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  finishButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Constants from 'expo-constants';

const { width } = Dimensions.get('window');
const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

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
}

interface MedicationLog {
  id: string;
  medication_id: string;
  scheduled_time: string;
  status: string;
  taken_at?: string;
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
      
    } catch (error) {
      console.error('Error loading dashboard:', error);
      Alert.alert('Error', 'Failed to load data. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const handleMissedMedicationConfirm = async (logId: string, taken: boolean) => {
    try {
      if (taken) {
        await fetch(`${BACKEND_URL}/api/medication-logs/${logId}/take`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      // Remove from missed list
      setMissedMedications(prev => prev.filter(med => med.id !== logId));
      
      // Refresh data
      loadDashboardData();
    } catch (error) {
      console.error('Error updating medication status:', error);
    }
  };

  const getMedicationStatus = (medication: Medication, logs: MedicationLog[]) => {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    for (const timeSlot of medication.time_slots) {
      const [hours, minutes] = timeSlot.split(':').map(Number);
      const slotTime = hours * 60 + minutes;
      const timeDiff = Math.abs(currentTime - slotTime);
      
      if (timeDiff <= 30) { // Within 30 minutes
        const log = logs.find(l => 
          l.medication_id === medication.id && 
          l.scheduled_time.includes(timeSlot)
        );
        
        if (!log || log.status === 'pending') {
          return 'current'; // Green - time to take
        } else if (log.status === 'taken') {
          return 'taken'; // Blue - already taken
        }
      }
    }
    
    return 'upcoming'; // White - upcoming
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'current':
        return '#4CAF50'; // Green
      case 'taken':
        return '#2196F3'; // Blue
      case 'missed':
        return '#F44336'; // Red
      default:
        return '#F5F5F5'; // Light gray
    }
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

  const renderMedicationCard = (medication: Medication) => {
    const status = getMedicationStatus(medication, dashboardData?.today_logs || []);
    const pillsPercentage = ((medication.total_pills - medication.remaining_pills) / medication.total_pills) * 100;
    
    return (
      <View key={medication.id} style={[styles.medicationCard, { borderLeftColor: getStatusColor(status) }]}>
        <View style={styles.medicationHeader}>
          <Text style={styles.medicationName}>{medication.name}</Text>
          <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(status) }]} />
        </View>
        <Text style={styles.medicationDosage}>{medication.dosage}</Text>
        <Text style={styles.medicationTime}>
          Next: {medication.time_slots[0]} • {medication.remaining_pills} pills left
        </Text>
      </View>
    );
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
              <TouchableOpacity
                style={[styles.missedButton, styles.yesButton]}
                onPress={() => handleMissedMedicationConfirm(missedMedications[0].id, true)}
              >
                <Text style={styles.yesButtonText}>Yes, I took it</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.missedButton, styles.noButton]}
                onPress={() => handleMissedMedicationConfirm(missedMedications[0].id, false)}
              >
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

        {/* Today's Medications */}
        <View style={styles.medicationsSection}>
          <Text style={styles.sectionTitle}>Today's Schedule</Text>
          {dashboardData?.medications.map(renderMedicationCard)}
        </View>

        {/* Health Tip */}
        <View style={styles.healthTip}>
          <Ionicons name="bulb" size={20} color="#FFA500" />
          <Text style={styles.healthTipText}>
            Avoid grapefruit juice while taking your medications - it can interfere with absorption.
          </Text>
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
  medicationsSection: {
    marginBottom: 24,
  },
  medicationCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  medicationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  medicationName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  medicationDosage: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  medicationTime: {
    fontSize: 14,
    color: '#4A90E2',
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
});
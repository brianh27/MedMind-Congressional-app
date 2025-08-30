#!/usr/bin/env python3
"""
MedMind Backend API Test Suite
Tests all backend endpoints for the MedMind medication management application.
"""

import requests
import json
import base64
import uuid
from datetime import datetime, date, timedelta
from typing import Dict, Any
import os

# Backend URL from environment
BACKEND_URL = "https://pill-reminder-3.preview.emergentagent.com/api"

class MedMindAPITester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.test_user_id = None
        self.test_medication_id = None
        self.test_journal_entry_id = None
        self.session = requests.Session()
        self.test_results = []
        
    def log_test(self, test_name: str, success: bool, details: str = ""):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        self.test_results.append({
            "test": test_name,
            "status": status,
            "success": success,
            "details": details
        })
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
    
    def create_sample_base64_image(self) -> str:
        """Create a sample base64 encoded image for testing"""
        # Simple 1x1 pixel PNG in base64
        return "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    
    def test_profile_management(self):
        """Test all profile management endpoints"""
        print("\n=== Testing Profile Management ===")
        
        # Test 1: Create User Profile
        profile_data = {
            "name": "Sarah Johnson",
            "age": 65,
            "phone_number": "+1-555-0123",
            "profile_photo": self.create_sample_base64_image(),
            "emergency_contact": {
                "name": "John Johnson",
                "phone": "+1-555-0124"
            },
            "caregiver_contact": {
                "name": "Mary Smith",
                "phone": "+1-555-0125"
            },
            "doctor_contact": {
                "name": "Dr. Williams",
                "phone": "+1-555-0126"
            },
            "appearance_mode": "light",
            "reminder_tone": "gentle",
            "notification_preferences": {
                "sms": True,
                "push": True,
                "email": False
            },
            "fitbit_connected": False,
            "apple_watch_connected": True
        }
        
        try:
            response = self.session.post(f"{self.base_url}/profile", json=profile_data)
            if response.status_code == 200:
                profile = response.json()
                self.test_user_id = profile["id"]
                self.log_test("Create User Profile", True, f"Created profile with ID: {self.test_user_id}")
            else:
                self.log_test("Create User Profile", False, f"Status: {response.status_code}, Response: {response.text}")
                return
        except Exception as e:
            self.log_test("Create User Profile", False, f"Exception: {str(e)}")
            return
        
        # Test 2: Get User Profile
        try:
            response = self.session.get(f"{self.base_url}/profile/{self.test_user_id}")
            if response.status_code == 200:
                profile = response.json()
                if profile["name"] == "Sarah Johnson" and profile["age"] == 65:
                    self.log_test("Get User Profile", True, "Profile retrieved successfully")
                else:
                    self.log_test("Get User Profile", False, "Profile data mismatch")
            else:
                self.log_test("Get User Profile", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Get User Profile", False, f"Exception: {str(e)}")
        
        # Test 3: Update User Profile
        update_data = {
            "age": 66,
            "appearance_mode": "dark"
        }
        
        try:
            response = self.session.put(f"{self.base_url}/profile/{self.test_user_id}", json=update_data)
            if response.status_code == 200:
                updated_profile = response.json()
                if updated_profile["age"] == 66 and updated_profile["appearance_mode"] == "dark":
                    self.log_test("Update User Profile", True, "Profile updated successfully")
                else:
                    self.log_test("Update User Profile", False, "Update not reflected")
            else:
                self.log_test("Update User Profile", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Update User Profile", False, f"Exception: {str(e)}")
        
        # Test 4: Complete Onboarding
        try:
            response = self.session.post(f"{self.base_url}/profile/{self.test_user_id}/complete-onboarding")
            if response.status_code == 200:
                result = response.json()
                if "message" in result:
                    self.log_test("Complete Onboarding", True, "Onboarding completed successfully")
                else:
                    self.log_test("Complete Onboarding", False, "Unexpected response format")
            else:
                self.log_test("Complete Onboarding", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Complete Onboarding", False, f"Exception: {str(e)}")
    
    def test_medication_management(self):
        """Test medication management endpoints"""
        print("\n=== Testing Medication Management ===")
        
        if not self.test_user_id:
            self.log_test("Medication Management", False, "No test user ID available")
            return
        
        # Test 1: Create Medication
        medication_data = {
            "name": "Lisinopril",
            "dosage": "10mg",
            "frequency": "once daily",
            "time_slots": ["08:00"],
            "total_pills": 30,
            "refill_info": {
                "pharmacy": "CVS Pharmacy",
                "address": "123 Main St",
                "phone": "+1-555-0127"
            },
            "prescription_image": self.create_sample_base64_image()
        }
        
        try:
            # Now using the corrected endpoint that accepts JSON with user_id included
            medication_data_with_user = medication_data.copy()
            medication_data_with_user["user_id"] = self.test_user_id
            response = self.session.post(f"{self.base_url}/medications", json=medication_data_with_user)
            if response.status_code == 200:
                medication = response.json()
                self.test_medication_id = medication["id"]
                self.log_test("Create Medication", True, f"Created medication with ID: {self.test_medication_id}")
            else:
                self.log_test("Create Medication", False, f"Status: {response.status_code}, Response: {response.text}")
                return
        except Exception as e:
            self.log_test("Create Medication", False, f"Exception: {str(e)}")
            return
        
        # Test 2: Get User Medications
        try:
            response = self.session.get(f"{self.base_url}/medications/{self.test_user_id}")
            if response.status_code == 200:
                medications = response.json()
                if isinstance(medications, list) and len(medications) > 0:
                    if medications[0]["name"] == "Lisinopril":
                        self.log_test("Get User Medications", True, f"Retrieved {len(medications)} medications")
                    else:
                        self.log_test("Get User Medications", False, "Medication data mismatch")
                else:
                    self.log_test("Get User Medications", False, "No medications returned")
            else:
                self.log_test("Get User Medications", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Get User Medications", False, f"Exception: {str(e)}")
        
        # Test 3: Update Medication
        if self.test_medication_id:
            update_data = {
                "dosage": "20mg",
                "remaining_pills": 25
            }
            
            try:
                response = self.session.put(f"{self.base_url}/medications/{self.test_medication_id}", json=update_data)
                if response.status_code == 200:
                    updated_medication = response.json()
                    if updated_medication["dosage"] == "20mg" and updated_medication["remaining_pills"] == 25:
                        self.log_test("Update Medication", True, "Medication updated successfully")
                    else:
                        self.log_test("Update Medication", False, "Update not reflected")
                else:
                    self.log_test("Update Medication", False, f"Status: {response.status_code}")
            except Exception as e:
                self.log_test("Update Medication", False, f"Exception: {str(e)}")
    
    def test_dashboard_api(self):
        """Test dashboard data retrieval"""
        print("\n=== Testing Dashboard API ===")
        
        if not self.test_user_id:
            self.log_test("Dashboard API", False, "No test user ID available")
            return
        
        try:
            response = self.session.get(f"{self.base_url}/dashboard/{self.test_user_id}")
            if response.status_code == 200:
                dashboard_data = response.json()
                required_fields = ["user_profile", "medications", "today_logs", "streak", "total_pills_taken", "today_date"]
                
                missing_fields = [field for field in required_fields if field not in dashboard_data]
                if not missing_fields:
                    self.log_test("Dashboard API", True, "Dashboard data retrieved with all required fields")
                else:
                    self.log_test("Dashboard API", False, f"Missing fields: {missing_fields}")
            else:
                self.log_test("Dashboard API", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Dashboard API", False, f"Exception: {str(e)}")
    
    def test_health_journal(self):
        """Test health journal endpoints"""
        print("\n=== Testing Health Journal ===")
        
        if not self.test_user_id:
            self.log_test("Health Journal", False, "No test user ID available")
            return
        
        # Test 1: Create Health Journal Entry
        journal_data = {
            "date": date.today().isoformat(),
            "symptoms": ["headache", "fatigue"],
            "notes": "Feeling tired today, might be related to new medication",
            "mood_rating": 6,
            "side_effects": ["drowsiness"]
        }
        
        try:
            # Now using the corrected endpoint that accepts JSON with user_id included
            journal_data_with_user = journal_data.copy()
            journal_data_with_user["user_id"] = self.test_user_id
            response = self.session.post(f"{self.base_url}/health-journal", json=journal_data_with_user)
            if response.status_code == 200:
                journal_entry = response.json()
                self.test_journal_entry_id = journal_entry["id"]
                self.log_test("Create Health Journal Entry", True, f"Created journal entry with ID: {self.test_journal_entry_id}")
            else:
                self.log_test("Create Health Journal Entry", False, f"Status: {response.status_code}, Response: {response.text}")
                return
        except Exception as e:
            self.log_test("Create Health Journal Entry", False, f"Exception: {str(e)}")
            return
        
        # Test 2: Get Health Journal Entries
        try:
            response = self.session.get(f"{self.base_url}/health-journal/{self.test_user_id}")
            if response.status_code == 200:
                journal_entries = response.json()
                if isinstance(journal_entries, list) and len(journal_entries) > 0:
                    if journal_entries[0]["mood_rating"] == 6:
                        self.log_test("Get Health Journal Entries", True, f"Retrieved {len(journal_entries)} journal entries")
                    else:
                        self.log_test("Get Health Journal Entries", False, "Journal entry data mismatch")
                else:
                    self.log_test("Get Health Journal Entries", False, "No journal entries returned")
            else:
                self.log_test("Get Health Journal Entries", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Get Health Journal Entries", False, f"Exception: {str(e)}")
    
    def test_prescription_analysis(self):
        """Test prescription analysis AI feature"""
        print("\n=== Testing Prescription Analysis (AI Feature) ===")
        
        analysis_data = {
            "image_base64": self.create_sample_base64_image(),
            "medication_name": "Lisinopril"
        }
        
        try:
            response = self.session.post(f"{self.base_url}/analyze-prescription", json=analysis_data)
            if response.status_code == 200:
                analysis_result = response.json()
                required_fields = ["medication_name", "dosage", "frequency", "instructions", "warnings", "confidence"]
                
                missing_fields = [field for field in required_fields if field not in analysis_result]
                if not missing_fields:
                    confidence = analysis_result.get("confidence", 0)
                    if 0 <= confidence <= 1:
                        self.log_test("Prescription Analysis", True, f"Analysis completed with confidence: {confidence}")
                    else:
                        self.log_test("Prescription Analysis", False, f"Invalid confidence score: {confidence}")
                else:
                    self.log_test("Prescription Analysis", False, f"Missing fields: {missing_fields}")
            else:
                self.log_test("Prescription Analysis", False, f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("Prescription Analysis", False, f"Exception: {str(e)}")
    
    def test_error_handling(self):
        """Test error handling for invalid requests"""
        print("\n=== Testing Error Handling ===")
        
        # Test 1: Get non-existent profile
        try:
            fake_id = str(uuid.uuid4())
            response = self.session.get(f"{self.base_url}/profile/{fake_id}")
            if response.status_code == 404:
                self.log_test("Error Handling - Non-existent Profile", True, "Correctly returned 404")
            else:
                self.log_test("Error Handling - Non-existent Profile", False, f"Expected 404, got {response.status_code}")
        except Exception as e:
            self.log_test("Error Handling - Non-existent Profile", False, f"Exception: {str(e)}")
        
        # Test 2: Update non-existent medication
        try:
            fake_id = str(uuid.uuid4())
            response = self.session.put(f"{self.base_url}/medications/{fake_id}", json={"dosage": "10mg"})
            if response.status_code == 404:
                self.log_test("Error Handling - Non-existent Medication", True, "Correctly returned 404")
            else:
                self.log_test("Error Handling - Non-existent Medication", False, f"Expected 404, got {response.status_code}")
        except Exception as e:
            self.log_test("Error Handling - Non-existent Medication", False, f"Exception: {str(e)}")
    
    def run_all_tests(self):
        """Run all test suites"""
        print("🧪 Starting MedMind Backend API Tests")
        print(f"🔗 Testing against: {self.base_url}")
        print("=" * 60)
        
        # Run all test suites
        self.test_profile_management()
        self.test_medication_management()
        self.test_dashboard_api()
        self.test_health_journal()
        self.test_prescription_analysis()
        self.test_error_handling()
        
        # Print summary
        self.print_summary()
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        print("\n📋 Detailed Results:")
        for result in self.test_results:
            print(f"{result['status']}: {result['test']}")
            if result['details'] and not result['success']:
                print(f"   ❗ {result['details']}")
        
        return passed, total

if __name__ == "__main__":
    tester = MedMindAPITester()
    tester.run_all_tests()
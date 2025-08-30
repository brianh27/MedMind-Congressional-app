from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, date, time, timedelta
import base64
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
import json

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# User Profile Models
class UserProfile(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    age: int
    phone_number: str
    profile_photo: Optional[str] = None  # base64 encoded
    emergency_contact: Dict[str, str]  # name, phone
    caregiver_contact: Dict[str, str]  # name, phone
    doctor_contact: Dict[str, str]  # name, phone
    appearance_mode: str  # "light" or "dark"
    reminder_tone: str
    notification_preferences: Dict[str, bool]  # sms, push, email
    fitbit_connected: bool = False
    apple_watch_connected: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    onboarding_completed: bool = False

class UserProfileCreate(BaseModel):
    name: str
    age: int
    phone_number: str
    profile_photo: Optional[str] = None
    emergency_contact: Dict[str, str]
    caregiver_contact: Dict[str, str] 
    doctor_contact: Dict[str, str]
    appearance_mode: str
    reminder_tone: str
    notification_preferences: Dict[str, bool]
    fitbit_connected: bool = False
    apple_watch_connected: bool = False

class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    phone_number: Optional[str] = None
    profile_photo: Optional[str] = None
    emergency_contact: Optional[Dict[str, str]] = None
    caregiver_contact: Optional[Dict[str, str]] = None
    doctor_contact: Optional[Dict[str, str]] = None
    appearance_mode: Optional[str] = None
    reminder_tone: Optional[str] = None
    notification_preferences: Optional[Dict[str, bool]] = None
    fitbit_connected: Optional[bool] = None
    apple_watch_connected: Optional[bool] = None

# Medication Models
class Medication(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    dosage: str
    frequency: str  # e.g., "twice daily", "every 8 hours"
    time_slots: List[str]  # ["08:00", "20:00"]
    total_pills: int
    remaining_pills: int
    refill_info: Optional[Dict[str, Any]] = None  # pharmacy, address, etc.
    prescription_image: Optional[str] = None  # base64
    ai_extracted_info: Optional[Dict[str, Any]] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True

class MedicationCreate(BaseModel):
    name: str
    dosage: str
    frequency: str
    time_slots: List[str]
    total_pills: int
    refill_info: Optional[Dict[str, Any]] = None
    prescription_image: Optional[str] = None

class MedicationUpdate(BaseModel):
    name: Optional[str] = None
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    time_slots: Optional[List[str]] = None
    remaining_pills: Optional[int] = None
    refill_info: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None

# Medication Log Models
class MedicationLog(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    medication_id: str
    scheduled_time: datetime
    taken_at: Optional[datetime] = None
    status: str  # "pending", "taken", "missed", "current"
    verification_photo: Optional[str] = None  # base64
    ai_verification: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None
    caregiver_notified: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

class MedicationLogCreate(BaseModel):
    medication_id: str
    scheduled_time: datetime
    status: str = "pending"

class MedicationLogUpdate(BaseModel):
    taken_at: Optional[datetime] = None
    status: Optional[str] = None
    verification_photo: Optional[str] = None
    notes: Optional[str] = None

# Health Journal Models
class HealthJournalEntry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    date: date
    symptoms: List[str] = []
    notes: str = ""
    mood_rating: Optional[int] = None  # 1-10
    side_effects: List[str] = []
    caregiver_alerted: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class HealthJournalEntryCreate(BaseModel):
    date: date
    symptoms: List[str] = []
    notes: str = ""
    mood_rating: Optional[int] = None
    side_effects: List[str] = []

class HealthJournalEntryUpdate(BaseModel):
    symptoms: Optional[List[str]] = None
    notes: Optional[str] = None
    mood_rating: Optional[int] = None
    side_effects: Optional[List[str]] = None
    caregiver_alerted: Optional[bool] = None

# Prescription Analysis Models
class PrescriptionAnalysisRequest(BaseModel):
    image_base64: str
    medication_name: str = ""

class PrescriptionAnalysisResponse(BaseModel):
    medication_name: str
    dosage: str
    frequency: str
    instructions: List[str]
    warnings: List[str]
    pill_count: Optional[int] = None
    confidence: float

# User Profile Routes
@api_router.post("/profile", response_model=UserProfile)
async def create_user_profile(profile: UserProfileCreate):
    profile_dict = profile.dict()
    profile_obj = UserProfile(**profile_dict)
    await db.user_profiles.insert_one(profile_obj.dict())
    return profile_obj

@api_router.get("/profile/{user_id}", response_model=UserProfile)
async def get_user_profile(user_id: str):
    profile = await db.user_profiles.find_one({"id": user_id})
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return UserProfile(**profile)

@api_router.get("/profile", response_model=List[UserProfile])
async def get_all_profiles():
    profiles = await db.user_profiles.find().to_list(1000)
    return [UserProfile(**profile) for profile in profiles]

@api_router.put("/profile/{user_id}", response_model=UserProfile)
async def update_user_profile(user_id: str, profile_update: UserProfileUpdate):
    update_dict = {k: v for k, v in profile_update.dict().items() if v is not None}
    if not update_dict:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    result = await db.user_profiles.update_one(
        {"id": user_id}, 
        {"$set": update_dict}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    updated_profile = await db.user_profiles.find_one({"id": user_id})
    return UserProfile(**updated_profile)

@api_router.post("/profile/{user_id}/complete-onboarding")
async def complete_onboarding(user_id: str):
    result = await db.user_profiles.update_one(
        {"id": user_id},
        {"$set": {"onboarding_completed": True}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Profile not found")
    return {"message": "Onboarding completed successfully"}

# Medication Routes
class MedicationCreateWithUser(BaseModel):
    user_id: str
    name: str
    dosage: str
    frequency: str
    time_slots: List[str]
    total_pills: int
    refill_info: Optional[Dict[str, Any]] = None
    prescription_image: Optional[str] = None

@api_router.post("/medications", response_model=Medication)
async def create_medication(medication_data: MedicationCreateWithUser):
    medication_dict = medication_data.dict()
    user_id = medication_dict.pop("user_id")
    medication_dict["user_id"] = user_id
    medication_dict["remaining_pills"] = medication_dict["total_pills"]
    medication_obj = Medication(**medication_dict)
    await db.medications.insert_one(medication_obj.dict())
    return medication_obj

@api_router.get("/medications/{user_id}", response_model=List[Medication])
async def get_user_medications(user_id: str):
    medications = await db.medications.find({"user_id": user_id, "is_active": True}).to_list(1000)
    return [Medication(**medication) for medication in medications]

@api_router.put("/medications/{medication_id}", response_model=Medication)
async def update_medication(medication_id: str, medication_update: MedicationUpdate):
    update_dict = {k: v for k, v in medication_update.dict().items() if v is not None}
    if not update_dict:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    result = await db.medications.update_one(
        {"id": medication_id}, 
        {"$set": update_dict}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Medication not found")
    
    updated_medication = await db.medications.find_one({"id": medication_id})
    return Medication(**updated_medication)

@api_router.delete("/medications/{medication_id}")
async def delete_medication(medication_id: str):
    result = await db.medications.update_one(
        {"id": medication_id},
        {"$set": {"is_active": False}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Medication not found")
    return {"message": "Medication deleted successfully"}

# Prescription Analysis Route
@api_router.post("/analyze-prescription", response_model=PrescriptionAnalysisResponse)
async def analyze_prescription(request: PrescriptionAnalysisRequest):
    try:
        # Initialize LLM chat with Emergent key
        chat = LlmChat(
            api_key=os.environ.get('EMERGENT_LLM_KEY'),
            session_id=f"prescription_{uuid.uuid4()}",
            system_message="You are a medical prescription analysis assistant. Analyze prescription images and extract medication information accurately. Always return structured JSON data."
        ).with_model("openai", "gpt-4o")

        # Create image content
        image_content = ImageContent(image_base64=request.image_base64)

        # Analysis prompt
        analysis_prompt = """
        Analyze this prescription image and extract the following information in JSON format:
        {
            "medication_name": "name of the medication",
            "dosage": "dosage amount and unit",
            "frequency": "how often to take (e.g., 'twice daily', 'every 8 hours')",
            "instructions": ["list", "of", "taking", "instructions"],
            "warnings": ["list", "of", "warnings", "or", "side", "effects"],
            "pill_count": number_of_pills_if_visible,
            "confidence": confidence_score_0_to_1
        }

        Focus on extracting accurate medication details. If any information is unclear, use null for that field.
        """

        user_message = UserMessage(
            text=analysis_prompt,
            file_contents=[image_content]
        )

        # Get AI response
        response = await chat.send_message(user_message)
        
        # Parse the JSON response
        try:
            analysis_data = json.loads(response.strip())
        except json.JSONDecodeError:
            # Fallback parsing if response isn't pure JSON
            analysis_data = {
                "medication_name": request.medication_name or "Unknown",
                "dosage": "Please verify dosage",
                "frequency": "As directed",
                "instructions": ["Take as prescribed by doctor"],
                "warnings": ["Consult doctor for side effects"],
                "pill_count": None,
                "confidence": 0.5
            }

        return PrescriptionAnalysisResponse(**analysis_data)

    except Exception as e:
        logging.error(f"Prescription analysis error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

# Medication Log Routes
@api_router.post("/medication-logs", response_model=MedicationLog)
async def create_medication_log(log: MedicationLogCreate, user_id: str = Form(...)):
    log_dict = log.dict()
    log_dict["user_id"] = user_id
    log_obj = MedicationLog(**log_dict)
    await db.medication_logs.insert_one(log_obj.dict())
    return log_obj

@api_router.get("/medication-logs/{user_id}", response_model=List[MedicationLog])
async def get_user_medication_logs(user_id: str, start_date: Optional[str] = None, end_date: Optional[str] = None):
    query = {"user_id": user_id}
    
    if start_date or end_date:
        date_query = {}
        if start_date:
            date_query["$gte"] = datetime.fromisoformat(start_date)
        if end_date:
            date_query["$lte"] = datetime.fromisoformat(end_date)
        query["scheduled_time"] = date_query
    
    logs = await db.medication_logs.find(query).sort("scheduled_time", -1).to_list(1000)
    return [MedicationLog(**log) for log in logs]

@api_router.put("/medication-logs/{log_id}", response_model=MedicationLog)
async def update_medication_log(log_id: str, log_update: MedicationLogUpdate):
    update_dict = {k: v for k, v in log_update.dict().items() if v is not None}
    if not update_dict:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    result = await db.medication_logs.update_one(
        {"id": log_id}, 
        {"$set": update_dict}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Medication log not found")
    
    updated_log = await db.medication_logs.find_one({"id": log_id})
    return MedicationLog(**updated_log)

@api_router.post("/medication-logs/{log_id}/take")
async def mark_medication_taken(log_id: str, verification_photo: Optional[str] = None):
    update_data = {
        "status": "taken",
        "taken_at": datetime.utcnow()
    }
    if verification_photo:
        update_data["verification_photo"] = verification_photo
    
    result = await db.medication_logs.update_one(
        {"id": log_id},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Medication log not found")
    
    return {"message": "Medication marked as taken"}

# Health Journal Routes
@api_router.post("/health-journal", response_model=HealthJournalEntry)
async def create_health_journal_entry(entry: HealthJournalEntryCreate, user_id: str = Form(...)):
    entry_dict = entry.dict()
    entry_dict["user_id"] = user_id
    entry_obj = HealthJournalEntry(**entry_dict)
    await db.health_journal.insert_one(entry_obj.dict())
    return entry_obj

@api_router.get("/health-journal/{user_id}", response_model=List[HealthJournalEntry])
async def get_health_journal_entries(user_id: str, start_date: Optional[str] = None, end_date: Optional[str] = None):
    query = {"user_id": user_id}
    
    if start_date or end_date:
        date_query = {}
        if start_date:
            date_query["$gte"] = date.fromisoformat(start_date)
        if end_date:
            date_query["$lte"] = date.fromisoformat(end_date)
        query["date"] = date_query
    
    entries = await db.health_journal.find(query).sort("date", -1).to_list(1000)
    return [HealthJournalEntry(**entry) for entry in entries]

@api_router.get("/health-journal/{user_id}/{date}")
async def get_health_journal_entry_by_date(user_id: str, date: str):
    entry_date = date.fromisoformat(date) if isinstance(date, str) else date
    entry = await db.health_journal.find_one({"user_id": user_id, "date": entry_date})
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    return HealthJournalEntry(**entry)

@api_router.put("/health-journal/{entry_id}", response_model=HealthJournalEntry)
async def update_health_journal_entry(entry_id: str, entry_update: HealthJournalEntryUpdate):
    update_dict = {k: v for k, v in entry_update.dict().items() if v is not None}
    update_dict["updated_at"] = datetime.utcnow()
    
    if not update_dict:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    result = await db.health_journal.update_one(
        {"id": entry_id}, 
        {"$set": update_dict}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    
    updated_entry = await db.health_journal.find_one({"id": entry_id})
    return HealthJournalEntry(**updated_entry)

# Dashboard/Stats Routes
@api_router.get("/dashboard/{user_id}")
async def get_user_dashboard(user_id: str):
    # Get user profile
    profile = await db.user_profiles.find_one({"id": user_id})
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    # Get medications
    medications = await db.medications.find({"user_id": user_id, "is_active": True}).to_list(1000)
    
    # Get today's medication logs
    today = datetime.now().date()
    today_start = datetime.combine(today, datetime.min.time())
    today_end = datetime.combine(today, datetime.max.time())
    
    today_logs = await db.medication_logs.find({
        "user_id": user_id,
        "scheduled_time": {"$gte": today_start, "$lte": today_end}
    }).to_list(1000)
    
    # Calculate streak (consecutive days without missed medication)
    streak = await calculate_medication_streak(user_id)
    
    # Get pill counts
    total_pills_taken = sum([med.get("total_pills", 0) - med.get("remaining_pills", 0) for med in medications])
    
    return {
        "user_profile": UserProfile(**profile),
        "medications": [Medication(**med) for med in medications],
        "today_logs": [MedicationLog(**log) for log in today_logs],
        "streak": streak,
        "total_pills_taken": total_pills_taken,
        "today_date": today.isoformat()
    }

async def calculate_medication_streak(user_id: str):
    # Simple streak calculation - days without missed medications
    current_date = datetime.now().date()
    streak = 0
    
    for i in range(365):  # Check last 365 days
        check_date = current_date - timedelta(days=i)
        day_start = datetime.combine(check_date, datetime.min.time())
        day_end = datetime.combine(check_date, datetime.max.time())
        
        day_logs = await db.medication_logs.find({
            "user_id": user_id,
            "scheduled_time": {"$gte": day_start, "$lte": day_end}
        }).to_list(1000)
        
        if not day_logs:
            break
            
        missed_count = sum(1 for log in day_logs if log.get("status") == "missed")
        if missed_count > 0:
            break
            
        streak += 1
    
    return streak

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
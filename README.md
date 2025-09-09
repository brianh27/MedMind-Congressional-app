# MedMind Congressional App

A medication management application built with Expo React Native and FastAPI backend.

## Environment Setup

### Prerequisites
- Node.js and npm/yarn
- Python 3.8+
- MongoDB (local or cloud instance)
- Emergent LLM API key

### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Create environment file:
   ```bash
   cp .env.example .env
   ```

4. Edit `.env` file with your actual values:
   - `MONGO_URL`: Your MongoDB connection string
   - `DB_NAME`: Database name for the application
   - `EMERGENT_LLM_KEY`: Your Emergent LLM API key

5. Start the backend server:
   ```bash
   uvicorn server:app --reload --host 0.0.0.0 --port 8000
   ```

### Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create environment file:
   ```bash
   cp .env.example .env
   ```

4. Edit `.env` file with your configuration:
   - Update the URLs to match your backend server location

5. Start the Expo development server:
   ```bash
   npm start
   ```

## Security Notes
- Never commit `.env` files to version control
- Keep your API keys secure and rotate them regularly
- Use environment-specific configurations for different deployment stages

## Features
- Medication timeline with smart scheduling
- Photo verification for medication intake
- AI-powered prescription analysis
- Health journal tracking
- Caregiver notifications

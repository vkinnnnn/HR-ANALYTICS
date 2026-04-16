# Running Workforce IQ on Port 8119

## Backend (Port 8119)

```bash
cd backend
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8119
```

Server will start at: `http://localhost:8119`

## Frontend (Port 3000)

In a separate terminal:

```bash
cd frontend
npm run dev
```

Frontend will start at: `http://localhost:3000`

The frontend is already configured to use port 8119 for API calls.

## Testing Flow

1. Start backend on 8119:
   ```bash
   cd backend && python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8119
   ```

2. Start frontend on 3000 (in another terminal):
   ```bash
   cd frontend && npm run dev
   ```

3. Open browser: `http://localhost:3000`

4. Test chat and analytics queries

## API Endpoints

- Chat: `POST http://localhost:8119/api/brain/chat`
- Stream: `POST http://localhost:8119/api/chat/stream`
- Health: `GET http://localhost:8119/api/brain/health`
- Reports: `GET http://localhost:8119/api/brain/report/summary`
- Memory: `GET http://localhost:8119/api/brain/memory/{user_id}`

## Data Directory

The backend loads data from: `wh_Dataset/` (at project root)

Ensure the data files exist:
- `wh_Dataset/function_wh.csv`
- `wh_Dataset/wh_history_full.csv`

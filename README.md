# Voice Agent Studio

A Retell-inspired workspace for building voice agents, editing call workflows, running browser test calls, and reviewing call transcripts.

## Run locally

1. Install the frontend dependencies with `npm install`.
2. Install Python 3.11 or newer. Run `backend/setup.bat` once to create an isolated backend environment and install its packages.
3. Copy `backend/.env.example` to `backend/.env`. Add a Groq or NVIDIA API key to enable Conductor, simulated calls, and live agent turns. Agent storage starts without a model key.
4. Run `backend/start.bat` to start the API, then run `npm run dev` from the project folder to start the dashboard.

The frontend forwards `/api` requests to the backend at `http://localhost:8000`. FastAPI's interactive API reference is available at `http://localhost:8000/docs`. The local SQLite database is `backend/voice_agent.db`; existing agent, call, and Conductor session data is copied forward on startup.

## Voice backend

The backend provides agent and workflow storage, workflow checks and version restore, saved releases, business knowledge sources, saved test scenarios and run history, call transcripts and analytics, Conductor chat and website research, and browser call sessions. Browser test calls use the configured LLM and are saved when ended. Configure a public HTTPS endpoint plus Twilio and Deepgram credentials before directing phone traffic to the webhook.

The request rate limits currently run in memory and are intended for a single local development server. This project does not yet provide user sign-in, workspace isolation, billing, high-availability deployment, or production compliance controls. Keep the backend private while using local development; configure authentication and tenant isolation before exposing it to the public internet.

## Deployment

This project is configured to be deployed as two separate components: a backend REST API (using Railway) and a frontend dashboard (using Vercel).

### Deploying the Backend (Railway)

1. Connect your GitHub repository to [Railway](https://railway.app/).
2. Create a new service from your GitHub repo. If you need to deploy only the backend, you may need to set the root directory to `/backend` in the Railway service settings.
3. Add the necessary environment variables in the Railway Variables tab (e.g., `GROQ_API_KEY`, `NVIDIA_API_KEY`).
4. Railway should automatically detect the Python environment. Make sure it runs the FastAPI server (e.g., via a `Procfile` or start command: `uvicorn api.main:app --host 0.0.0.0 --port $PORT`). 

### Deploying the Frontend (Vercel)

1. Connect your GitHub repository to [Vercel](https://vercel.com/).
2. Select standard Vite settings (Build Command: `npm run build`, Output Directory: `dist`).
3. Set the environment variable `VITE_API_URL` to point to your Railway backend URL if needed to overwrite the default `/api` base url.
4. Click **Deploy**.

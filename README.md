# Chatti App

Full-stack real-time chat app built with **React + Vite (frontend)** and **Node.js + Express + Socket.IO (backend)**, using **Supabase** for auth, database, and storage.

## Screenshots

<p align="center">
  <img alt="Chat" src="frontend/public/Chatti.png" width="31%" />
</p>

## Features

- Email/password auth and Google sign-in
- Profile editing with image upload
- Contact search and add user flow
- Real-time messaging with Socket.IO
- Image messaging (stored in Supabase Storage)
- Voice messaging (record, preview, send, playback)
- Read state handling and conversation previews
- Responsive chat UI for mobile and desktop

## Project Structure

```text
Relatime-Chat-App/
├─ backend/        # Express API + Socket.IO
└─ frontend/       # React + Vite client
```

## Prerequisites

- Node.js 18+
- npm 9+
- Supabase project (URL + keys)

## Environment Variables

Create `backend/.env`:

```env
PORT=5001

SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

SUPABASE_STORAGE_BUCKET=Chatti - App

# Optional table overrides
PROFILES_TABLE=profiles
MESSAGES_TABLE=messages
CONVERSATION_MEMBER_USER_COLUMN=
MESSAGE_SENDER_COLUMN=
MESSAGE_BODY_COLUMN=
MESSAGE_IMAGE_COLUMN=
MESSAGE_AUDIO_COLUMN=
```

Optional frontend env (`frontend/.env`):

```env
VITE_API_BASE_URL=http://localhost:5001
```

## Install

From repo root:

```bash
cd backend
npm install

cd ../frontend
npm install
```

## Run (Development)

Terminal 1:

```bash
cd backend
npm run dev
```

Terminal 2:

```bash
cd frontend
npm run dev
```

Frontend default: `http://localhost:5173`  
Backend default: `http://localhost:5001`

## Build

```bash
cd frontend
npm run build
```

## Deployment (Vercel + Render)

This project is best deployed as:

- **Frontend** on Vercel (Vite static build)
- **Backend** on Render (Node web service with Socket.IO)

### 1) Deploy backend on Render

Use the included [`render.yaml`](render.yaml) with **Blueprint** deploy, or create a Web Service manually.

If deploying manually in Render dashboard:

- Root directory: `backend`
- Build command: `npm install`
- Start command: `npm start`

Set these environment variables in Render:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_STORAGE_BUCKET=Chatti - App

# Optional overrides
PROFILES_TABLE=profiles
MESSAGES_TABLE=messages
CONVERSATION_MEMBER_USER_COLUMN=
MESSAGE_SENDER_COLUMN=
MESSAGE_BODY_COLUMN=
MESSAGE_IMAGE_COLUMN=
MESSAGE_AUDIO_COLUMN=
```

After deploy, copy your backend URL, e.g.:

`https://relatime-chat-backend.onrender.com`

### 2) Deploy frontend on Vercel

In Vercel:

- Import this repo
- Set **Root Directory** to `frontend`
- Vercel will detect Vite (or use included [`frontend/vercel.json`](frontend/vercel.json))

Set this env variable in Vercel:

```env
VITE_API_BASE_URL=https://relatime-chat-backend.onrender.com
```

Then deploy/redeploy.

### 3) Verify

- Open frontend URL from Vercel
- Confirm backend health at:
  `https://relatime-chat-backend.onrender.com/api/health`
- Test sign in + send message flow

## Main Scripts

### Backend

- `npm run dev` — start backend with nodemon
- `npm start` — start backend with node

### Frontend

- `npm run dev` — start Vite dev server
- `npm run build` — production build
- `npm run preview` — preview built app
- `npm run lint` — run ESLint

## API Overview

- Auth: signup/signin/google/me/update profile
- Profiles: search, get by phone, upsert
- Contacts: list + add
- Conversations: list by owner
- Messages: list, send, mark read
- Health: backend health check route

## Notes

- For media messages, Supabase Storage bucket access/policies must allow upload/read for your configured auth flow.
- If you update backend routes/config, restart backend server.

## License

Private project.

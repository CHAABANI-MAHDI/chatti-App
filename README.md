# Chatti App

Full-stack real-time chat app built with **React + Vite (frontend)** and **Node.js + Express + Socket.IO (backend)**, using **Supabase** for auth, database, and storage.

## Screenshots

<p align="center">
  <img alt="Sign Up" src="frontend/public/sign-up.png" width="31%" />
  <img alt="Sign In" src="frontend/public/sign-in.png" width="31%" />
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

# Backend

Minimal Express backend starter for Chat Firebase App.

## Run

1. Install dependencies:
   npm install
2. Copy environment file:
   copy .env.example .env
3. Start dev server:
   npm run dev

Health check endpoint:

- GET /api/health

## Contacts API (Add user by phone)

- GET /contacts/:phone -> returns saved contacts for the owner phone.
- POST /contacts -> add contact relation.
  - Body: `{ "ownerPhone": "+216...", "contactPhone": "+216..." }`

### Required Supabase table

Contacts are resolved from existing conversation tables:

```sql
create table if not exists public.conversations (
   id uuid primary key default gen_random_uuid(),
   created_by uuid not null,
   is_group boolean not null default false,
   created_at timestamptz not null default now()
);

create table if not exists public.conversation_members (
   conversation_id uuid not null,
   user_id uuid not null,
   role text,
   joined_at timestamptz not null default now(),
   primary key (conversation_id, user_id)
);
```

## Messages API

- GET /conversations/:phone -> contact list with `lastMessage`, `lastMessageAt`, `unread`.
- GET /messages?ownerPhone=+216...&contactPhone=+216... -> full conversation messages.
- POST /messages -> send message.
  - Body: `{ "senderPhone": "+216...", "receiverPhone": "+216...", "text": "hello" }`
- POST /messages/read -> mark incoming messages as read for one conversation.
  - Body: `{ "ownerPhone": "+216...", "contactPhone": "+216..." }`

### Required Supabase table

Create a `messages` table (or set `MESSAGES_TABLE` env var):

```sql
create table if not exists public.messages (
   id uuid primary key default gen_random_uuid(),
   conversation_id uuid not null,
   sender_id uuid not null,
   body text not null,
   created_at timestamptz not null default now()
);

create index if not exists messages_conversation_idx
   on public.messages (conversation_id, created_at desc);
```

## OTP / SMS notes

If you get Twilio error `21212` (`Invalid From Number`) when test OTPs are disabled in Supabase:

- Open Supabase Dashboard -> Auth -> Phone.
- Verify your Twilio sender config is valid.
- Use either:
  - A real Twilio phone number in E.164 format (`+1...`), or
  - A Twilio Messaging Service SID (`MG...`).
- Do not use a Twilio Verify Service SID (`VA...`) as a sender value.

Supabase "Test Phone Numbers and OTPs" bypasses real SMS delivery, so misconfiguration appears only when tests are disabled.

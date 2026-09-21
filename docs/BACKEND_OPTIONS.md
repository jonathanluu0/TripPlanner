# Backend Options — Decision Guide

This guide expands §6 of DESIGN.md with detailed analysis of each backend option for linking friends and joining a trip.

## Option A: Supabase (Recommended)

**Best for:** Teams wanting production-ready infrastructure with zero DevOps, good free tier, and instant realtime.

### Auth
- Magic-link email or Google OAuth via Supabase Auth (simple, guest-friendly).
- Trip creator or invited users authenticate; guests can join with a display name without creating an account.
- `user_id` nullable in `trip_members` so placeholder members (created before they join) can later claim their identity.

### Invite codes & join flow
1. Creator shares invite link: `/join/K7Q2MX` (6-char alphanumeric code in trips table, unique index).
2. Friend opens link, calls `findTripByInviteCode('K7Q2MX')` → retrieves trip.
3. Friend signs in (or skips for guest) → sees a form: "Join as [display name] or claim existing member?"
4. If claiming: calls `join_trip(code, display_name, claim_member_id)` RPC.
5. If new: calls `join_trip(code, display_name, null)` → creates new trip_members row and links user_id.
6. Lands on trip; realtime channel subscribed via `subscribe()`.

**Claiming flow:** Creator pre-adds placeholder members (name + color only, user_id null). When a friend joins, they optionally select "I'm Alex" → RPC updates that member's user_id.

### Realtime
- Supabase realtime channels: subscribe to `trip:${tripId}` for any table changes (members, cars, receipts, etc.).
- Built-in conflict resolution (last-write-wins on changes).
- Client automatically syncs Zustand state on updates.

### Image storage
- Supabase Storage bucket `receipts/`:
  - Path: `receipts/${tripId}/${receiptId}.jpg`
  - Signed URL generation for client display (24hr expiry).
  - RLS: only trip members can read/write.

### Pros & cons
**Pros:**
- No backend infrastructure to run; Supabase handles scaling.
- Free tier: Auth, Postgres, realtime, 1GB storage → fits a friend group indefinitely.
- Secure: server-side RLS and RPC prevent unauthorized access.
- Native Postgres → complex queries, aggregation, migrations easy.
- Magic link removes password friction.

**Cons:**
- Vendor lock-in (data lives in Supabase's Postgres).
- Realtime has per-connection limits on the free tier (100 connections).

### Setup steps
1. Create Supabase project → note API URL and anon key.
2. Run `supabase/schema.sql` via the SQL editor.
3. Deploy parse-receipt Edge Function: `supabase functions deploy parse-receipt`.
4. Set secrets: `supabase secrets set ANTHROPIC_API_KEY=sk-...`
5. Create Storage bucket: `supabase storage create-bucket receipts --public=false`.
6. Set `.env`: `VITE_BACKEND=supabase`, `VITE_SUPABASE_URL=...`, `VITE_SUPABASE_ANON_KEY=...`
7. Create auth policy and RLS rules (included in schema.sql).

### TripRepository interface
```ts
// SupabaseRepository implementation
class SupabaseRepository implements TripRepository {
  async listTrips(userId?: string): Promise<Trip[]> {
    // SELECT * FROM trips WHERE ? IN trip_members
  }
  async getTrip(id: string): Promise<Trip | null> {
    // SELECT * FROM trips WHERE id = ? (with RLS check)
  }
  async saveTrip(trip: Trip): Promise<void> {
    // Upsert trips + nested members/cars/receipts via triggers or multi-insert
  }
  async deleteTrip(id: string): Promise<void> {
    // DELETE FROM trips WHERE id = ? (with RLS)
  }
  async findTripByInviteCode(code: string): Promise<Trip | null> {
    // SELECT * FROM trips WHERE invite_code = ?
  }
  subscribe(tripId: string, callback: (trip: Trip) => void): () => void {
    // supabase.channel(`trip:${tripId}`).on('*', callback).subscribe()
  }
}
```

---

## Option B: Firebase

**Best for:** Teams comfortable with NoSQL, wanting tight Google ecosystem integration, or deploying to GCP.

### Auth
- Firebase Authentication: email, Google, phone. Optional anonymous auth for guests.
- Firestore: users collection stores profile (user_id, displayName, trips array).

### Invite codes & join flow
1. Creator shares `/join/K7Q2MX`.
2. Friend opens link, calls `findTripByInviteCode('K7Q2MX')` → queries trips collection (filtered by invite_code).
3. Friend signs in or uses anonymous auth.
4. Calls join function (e.g., HTTP callable function or direct Firestore):
   - If claiming: updates the placeholder member doc's `uid` field.
   - If new: adds new document to trip → members subcollection.
5. Lands on trip; realtime listener attached.

**Claiming flow:** Similar to Supabase; placeholder members stored as docs with no uid, later claimed.

### Realtime
- Firestore listeners: `.onSnapshot(tripDoc.collection('members'), callback)` automatically syncs.
- Changes propagate <100ms; built-in conflict resolution.

### Image storage
- Cloud Storage bucket `receipts/`:
  - Path: `gs://bucket/trips/${tripId}/${receiptId}.jpg`
  - Signed URLs or public read via security rules.
  - RLS: only authenticated users in trip → members can read.

### Pros & cons
**Pros:**
- Fully managed; zero DevOps.
- Generous free tier: 50k reads/day, 20k writes/day, 1GB storage.
- Native realtime Firestore listeners.
- Tight Google integration (GCP, ML APIs).

**Cons:**
- NoSQL complexity: harder to aggregate (e.g., all balances across trip) without app logic.
- Cost scaling: pay per read/write (not storage), can spike with large trips.
- Vendor lock-in.
- Requires learning Firestore security rules (different mental model from SQL).

### Setup steps
1. Create Firebase project (or link to GCP project).
2. Enable Firestore, Authentication, Cloud Storage.
3. Deploy receipt parsing as Cloud Function (Node.js or Python).
4. Copy security rules from Firestore UI (or via firebase-tools).
5. Create `receipts` storage bucket with RLS rules.
6. Set `.env`: `VITE_BACKEND=firebase`, `VITE_FIREBASE_CONFIG=...`

### TripRepository interface
```ts
class FirebaseRepository implements TripRepository {
  async listTrips(userId?: string): Promise<Trip[]> {
    // query trips collection where members array contains userId
  }
  async getTrip(id: string): Promise<Trip | null> {
    // doc(`trips/${id}`).get() + subcollections
  }
  async saveTrip(trip: Trip): Promise<void> {
    // writeBatch: trips doc + members subcollection
  }
  async deleteTrip(id: string): Promise<void> {
    // deleteDoc(`trips/${id}`) + cascade
  }
  async findTripByInviteCode(code: string): Promise<Trip | null> {
    // query trips where inviteCode == code
  }
  subscribe(tripId: string, callback: (trip: Trip) => void): () => void {
    // onSnapshot(tripDoc, ...) + subcollection listeners
  }
}
```

---

## Option C: Custom Node/Hono + Postgres + Lucia/Auth.js

**Best for:** Full control, complex business logic, existing Postgres investment, or when costs matter at scale.

### Auth
- Lucia (lightweight session library) or Auth.js with Postgres session store.
- OAuth providers + email/password.
- Sessions stored in `sessions` table; validated on each request.

### Invite codes & join flow
1. Creator shares `/join/K7Q2MX`.
2. Friend opens link, fetches trip via `GET /api/trips/by-code/:code`.
3. Friend signs in via your custom auth endpoint.
4. Calls `POST /api/trips/:id/join?code=K7Q2MX&displayName=Alex` (with auth token).
   - Server validates invite code against trip.
   - If claiming: updates member.user_id.
   - If new: inserts into trip_members.
5. Lands on trip; WebSocket connection opened (see Realtime below).

**Claiming flow:** Same as above; placeholder members in trip_members table.

### Realtime
- WebSocket server (e.g., via ws library, Hono WebSockets, or Socket.io):
  - Client connects to `ws://server/trips/${tripId}`.
  - Server broadcasts schema changes to all connected clients.
  - Requires heartbeat/reconnect logic; you own reliability.
- Alternatively: polling at 2–5s intervals (simpler, less efficient).

### Image storage
- S3, R2 (Cloudflare), or self-hosted:
  - Server generates signed URLs for client upload.
  - Path: `receipts/${tripId}/${receiptId}`.
  - Bucket policy restricts access to authenticated users owning the trip.

### Pros & cons
**Pros:**
- Full control: deploy anywhere, own data, no vendor lock-in.
- Can optimize for cost at scale (PostgreSQL is cheap).
- Familiar SQL; easier complex queries.
- Custom business logic (e.g., auto-settlement rules).

**Cons:**
- High initial effort: auth, sessions, realtime, hosting.
- Must run & maintain server (Docker, K8s, managed platforms, or Lambda).
- Realtime is DIY; no built-in conflict resolution.
- Cost: domain, hosting, database (Heroku, Railway, Neon, etc.).

### Setup steps
1. Set up Hono or Express.js project; add Lucia or Auth.js.
2. Provision Postgres (Neon, Railway, Supabase Postgres-only, or self-hosted).
3. Run schema.sql.
4. Implement auth endpoints: `/login`, `/signup`, `/logout`.
5. Implement trip endpoints: `/api/trips`, `/api/trips/:id/join`, etc.
6. Set up WebSocket server and handle trip subscriptions.
7. Deploy to Vercel Edge Functions, Netlify Functions, Railway, Render, or EC2.
8. Configure S3/R2 bucket and signing logic.
9. Set `.env`: `VITE_BACKEND=custom`, `VITE_API_URL=https://...`

### TripRepository interface
```ts
class CustomRepository implements TripRepository {
  async listTrips(userId?: string): Promise<Trip[]> {
    // GET /api/trips (auth required)
  }
  async getTrip(id: string): Promise<Trip | null> {
    // GET /api/trips/:id
  }
  async saveTrip(trip: Trip): Promise<void> {
    // POST /api/trips/:id (auth + ownership check)
  }
  async deleteTrip(id: string): Promise<void> {
    // DELETE /api/trips/:id
  }
  async findTripByInviteCode(code: string): Promise<Trip | null> {
    // GET /api/trips/by-code/:code (public)
  }
  subscribe(tripId: string, callback: (trip: Trip) => void): () => void {
    // WebSocket: ws.send({ type: 'subscribe', tripId })
    // On message: callback(trip)
  }
}
```

---

## Option D: No-account share links + PocketBase

**Best for:** Offline-first, zero backend complexity, small groups, or MVP validation.

### Auth
- None. Trip is serialized as shareable link or QR code; no user concept.
- Alternatively: PocketBase (lightweight self-hosted) with simple email auth.

### Invite codes & join flow
1. Creator shares a link encoding the entire trip as base64 or URL params: `/join?trip=eyJ...`.
2. Friend opens link; app deserializes JSON and loads trip into local Zustand state.
3. Friend adds themselves to members list locally.
4. No backend call; all changes are local until they export/share the trip file.

**Alternative (PocketBase):** Same flow, but trip is stored in PocketBase's Postgres; free tier is self-hosted.

### Realtime
- None. Updates are manual (export → re-import, or manual sync endpoints).
- Friend 1 edits locally, exports JSON, sends to Friend 2 via email/Discord.

### Image storage
- None. Receipts are stored as base64 data URLs in the trip JSON (bloats the link, ~5KB per receipt).
- Alternative: User saves trip to local file, images embedded.

### Pros & cons
**Pros:**
- Zero infrastructure; app works 100% offline.
- No auth, no login friction.
- Perfect for small groups (2–6 people) for a single trip.
- Easy to mvp and validate UX.

**Cons:**
- No realtime co-editing; requires manual sync.
- Shareable links become very long if the trip is large.
- Images bloat the link/file.
- No history or versioning.
- Does not scale beyond one trip or a few people.

### Setup steps
1. Implement local export/import: `Trip → JSON.stringify() → base64 → URL`.
2. On join link load: `URL → base64 → JSON.parse() → Zustand`.
3. Optionally: set up PocketBase (run `pocketbase serve` locally) for persistence.
4. Set `.env`: `VITE_BACKEND=local`.

### TripRepository interface
```ts
class LocalRepository implements TripRepository {
  async listTrips(): Promise<Trip[]> {
    // localStorage.getItem('trips') → JSON.parse()
  }
  async getTrip(id: string): Promise<Trip | null> {
    // Find in localStorage trips
  }
  async saveTrip(trip: Trip): Promise<void> {
    // localStorage.setItem('trips', JSON.stringify(...))
  }
  async deleteTrip(id: string): Promise<void> {
    // Remove from localStorage
  }
  async findTripByInviteCode(code: string): Promise<Trip | null> {
    // Search localStorage; or decode from URL
  }
  subscribe(): () => void {
    // No-op; or use Zustand listener
  }
}
```

---

## Recommendation

**Start with Option A (Supabase)** for production:
- Zero DevOps: focus on app, not infrastructure.
- RLS + SECURITY DEFINER RPC prevent accidental data leaks.
- Free tier supports a friend group indefinitely.
- Realtime "just works"; magic-link auth is frictionless.
- Easy upgrade path: if you outgrow free tier, scale to paid tiers or switch backends later.

**Use Option D (Local) for an offline MVP** or Option B (Firebase) if you already use GCP.

---

## Receipt Parsing Backends

After upload, `app/pages/ReceiptUpload.tsx` routes the receipt to a parser. Three implementations:

### 1. tesseract.js (client-side, free, default)
- Runs in browser; no API key, no server call.
- **Accuracy:** ~70–80% on clear photos, lower on receipts with poor contrast.
- **Extraction:** heuristic regex (look for $ amounts, common item keywords).
- **Setup:** `npm install tesseract.js`
- **Code:** `src/features/receipts/parsers/tesseract.ts` (already stubbed).

**Pros:** Instant, no backend, no key exposure.
**Cons:** Slow (5–30s), lower accuracy, can't understand context (e.g., "tax" vs item name).

### 2. Claude vision via server function (recommended for production)
- Client sends image to `/api/parse-receipt` (or Supabase Edge Function).
- Server calls Anthropic `claude-opus-4-1-vision-20250714` with the image + structured JSON prompt.
- Returns merchant, date, items, tax, tip, fees, total, confidence.
- **Accuracy:** 95%+ on legible receipts.
- **Setup:** Supabase Edge Function or custom Node.js endpoint.
- **Code:** `server/parse-receipt/index.ts` (Deno/Edge Function included).

**Pros:** High accuracy, understands context, handles messy receipts, extracts fine details (tax/tips/fees).
**Cons:** Small per-call cost (≈$0.01), requires Anthropic key (server-side), 1–2s latency.

### 3. Google Document AI / AWS Textract
- Cloud-native receipt OCR APIs.
- Google Document AI: specialized receipt processor, ~95% accuracy, ~$0.15 per page.
- AWS Textract: general-purpose, ~90%, $0.015 per page.

**Pros:** Industry-standard, high accuracy, auditable.
**Cons:** Higher cost, setup complexity (IAM, signing), vendor lock-in.

### Configuration in the app
```ts
// env vars in .env
VITE_RECEIPT_PARSER = 'tesseract' | 'claude' | 'gpt4-vision' | 'textract'
VITE_RECEIPT_API_URL = 'https://...' // for claude, textract, etc.

// parsers/index.ts
import tesseractParser from './tesseract'
import claudeParser from './claude'

const PARSERS = {
  tesseract: tesseractParser,
  claude: claudeParser,
  textract: textractParser,
}

const parser = PARSERS[import.meta.env.VITE_RECEIPT_PARSER]
const receipt = await parser.parse(file)
```

**Summary:** Start with tesseract for MVP (free, instant). Migrate to Claude vision in production (98% accuracy, $0.01/receipt, server-side key).

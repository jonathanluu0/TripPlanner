# Group Trip Planner — Design

Organizational web app for a friend group to sort out a trip: who's coming, who rides in which car, who sleeps where, and who owes what.

## 1. Stack

| Layer | Choice | Why |
|---|---|---|
| Build | Vite + React 18 + TypeScript (TSX, strict) | Fast dev server, simple deploy |
| UI | Mantine (core, hooks, dropzone, notifications, modals, dates) + @tabler/icons-react | Requested; complete component set |
| Drag & drop | @dnd-kit/core (+ sortable/utilities) | Accessible, touch-friendly, works with any markup |
| State | zustand (with `persist` middleware for the local adapter) | Tiny, no boilerplate |
| Routing | react-router-dom v6 | |
| OCR (client default) | tesseract.js | Free, runs in browser, no key needed |
| OCR (recommended prod) | Claude vision via a server function | Far better at item/tax/tip/fee extraction; key stays server-side |
| Backend | Pluggable `TripRepository` interface; `LocalRepository` ships, Supabase recommended (see §6) | App works offline before a backend is chosen |

Money is always stored as **integer cents**. Format only at render time.

## 2. Screens

```
/                     Home: my trips list, "Create trip", "Join with code"
/trip/:tripId         Trip shell (header with name, dates, invite code, member avatars)
   ├─ ?tab=people      Attendees: add/remove names, invite link/code, avatar colors
   ├─ ?tab=logistics   Feature 1: Cars + Sleeping boards with drag-and-drop attendees
   └─ ?tab=expenses    Features 2 & 3: receipts list, upload, review, split, balances
```

Layout: Mantine `AppShell` with header (logo, trip switcher, color-scheme toggle) and a `Tabs` bar in the trip view. Responsive: cards in a `SimpleGrid` (1 col mobile / 2 tablet / 3 desktop). Light + dark mode supported.

Visual tone: friendly, travel-y. Primary color `teal`, accent `orange` for money, rounded `md` radius, each attendee gets a stable avatar color (hash of id) so the same person reads the same everywhere.

## 3. Data model (`src/types.ts`)

```ts
type ID = string;           // nanoid / uuid
type Cents = number;        // integer

interface Member { id: ID; name: string; color: string; userId?: ID }   // userId set once they join with an account

interface Trip {
  id: ID; name: string; destination?: string;
  startDate?: string; endDate?: string;        // ISO date
  inviteCode: string;                           // 6 chars, e.g. "K7Q2MX"
  members: Member[];
  cars: Car[];
  sleepingSpots: SleepingSpot[];
  receipts: Receipt[];
  createdAt: string;
}

interface Car { id: ID; label: string; seats: number; driverIds: ID[]; passengerIds: ID[] }

type SleepingKind = 'Bedroom' | 'Couch' | 'Airbed' | 'Other';
interface SleepingSpot { id: ID; kind: SleepingKind; label: string; capacity: number; occupantIds: ID[] }

interface ExtraCost { id: ID; label: string; amount: Cents }
interface ReceiptItem { id: ID; name: string; basePrice: Cents; quantity: number; extras: ExtraCost[] }
interface Fee { id: ID; label: string; amount: Cents }       // service fee, delivery, resort fee...

type ReceiptStatus = 'parsing' | 'needs_review' | 'confirmed';
interface Receipt {
  id: ID; merchant: string; date?: string; imageDataUrl?: string;
  items: ReceiptItem[];
  tax: Cents; tip: Cents; fees: Fee[];
  total: Cents;                                 // printed total (as parsed / edited)
  paidById?: ID;                                // who fronted the bill
  split: { mode: 'even'; count: number; participantIds: ID[] };
  status: ReceiptStatus;
  parser?: 'tesseract' | 'claude' | 'manual';
  confidence?: number;                          // 0..1 from parser
  createdAt: string;
}
```

Derived (never stored): item line total = `(basePrice + Σextras) × quantity`; computed total = Σ lines + tax + tip + Σfees; `mismatch = computed !== total`.

## 4. Feature specs

### Feature 1 — Cars & sleeping arrangements (drag-and-drop)
- **Attendee pool** (sticky sidebar on desktop, horizontal scroll strip on mobile): draggable chips for every member. A chip shows a small badge if the person is not yet in any car / any bed.
- **Car card**: editable label (e.g. "Jon's Civic"), seats count, **Driver(s)** drop zone and **Passengers** drop zone. Each zone also has a name input (Mantine `Autocomplete` over members; typing a new name + Enter creates the member and assigns them). Chips inside have an ✕ to remove. Seat counter "3 / 5" turns red when over capacity (warn, don't block).
- **Sleeping card**: kind `SegmentedControl`/`Select` (Bedroom / Couch / Airbed / Other), label ("Master bedroom"), capacity, **Occupants** drop zone + name input.
- A person can be in only one car (driver OR passenger) and one sleeping spot — dropping moves them. Dragging a chip from one card to another moves it; dropping back on the pool unassigns.
- "Add car" / "Add sleeping spot" buttons; delete with confirm.

### Feature 2 — Receipt upload, parsing, split
- `Dropzone` accepting images (camera on mobile via `capture="environment"`). Image shown as thumbnail.
- Parser extracts: merchant, date, line items (name + base price + qty), tax, tip, miscellaneous service fees, total. Returns `confidence`.
- Parser is behind an interface: `ReceiptParser.parse(file) => Promise<ParsedReceipt>`. Implementations: `tesseractParser` (client default, heuristic regex over OCR text), `claudeParser` (POST to `VITE_RECEIPT_API_URL`), `manualParser` (empty form).
- **Split evenly**: `NumberInput` "Split between N people" (defaults to member count) → shows per-person amount (remainder cents distributed to the first people so it sums exactly). Optional `MultiSelect` of which members are in the split (fills N).
- **Fronted by**: `Select` of members.
- Expenses tab footer: **Balances** — net per member and a minimal "who pays whom" settlement list.

### Feature 3 — Review & correction
- After parsing, a **Review modal** opens: "Does this look right?" with the receipt image side-by-side with the parsed values.
  - ✅ **Looks good** → status `confirmed`.
  - ✏️ **Edit** → every field becomes editable (items table, tax, tip, fees, total).
  - 📷 **Retake / re-upload** → replaces image and reparses.
- Items table maps **item name ↔ base price** (and qty). Each row has **"+ Extra cost"** which appends `{label, amount}` extras to that item (e.g. "+ guac $2.50", "+ shared fee share"). Line total updates live.
- Summary shows parsed total vs computed total; a yellow `Alert` if they differ, with a "Set total to computed" button.
- Receipts stay `needs_review` (badge) until confirmed; unconfirmed receipts are excluded from balances with a note.

## 5. Code layout

```
src/
  main.tsx, App.tsx, theme.ts, types.ts
  lib/        money.ts (format/parse/splitEven), ids.ts, colors.ts, settle.ts
  store/      tripStore.ts   (zustand: all trip mutations; single source of truth)
  backend/    repository.ts (interface), localRepository.ts, supabaseRepository.ts (stub), index.ts
  components/ AppLayout.tsx, MemberAvatar.tsx, MemberChip.tsx, ...
  pages/      HomePage.tsx, TripPage.tsx, JoinPage.tsx
  features/
    people/     PeoplePanel.tsx
    logistics/  LogisticsBoard.tsx, CarCard.tsx, SleepingCard.tsx, AttendeePool.tsx, DropZone.tsx
    receipts/   ReceiptsPanel.tsx, ReceiptUpload.tsx, ReviewModal.tsx, ItemsTable.tsx,
                SplitControls.tsx, BalancesCard.tsx, parsers/{index,tesseract,claude,heuristics}.ts
docs/        DESIGN.md, BACKEND_OPTIONS.md
supabase/    schema.sql (tables + RLS)
server/      parse-receipt/ (Claude vision function example)
```

## 6. Backend options (linking friends & joining a trip)

| Option | Friends link / join | Realtime co-editing | Receipt images | Effort | Cost |
|---|---|---|---|---|---|
| **A. Supabase (recommended)** | Auth (magic link / Google), `trips.invite_code`, `trip_members` table, RLS so only members read a trip | Postgres realtime channels | Supabase Storage | Low | Free tier fits a friend group |
| B. Firebase | Auth + Firestore docs, invite code lookup, security rules | Firestore listeners | Cloud Storage | Low | Free tier |
| C. Custom (Node/Hono + Postgres + Lucia/Auth.js) | Full control; invite endpoints | WebSockets you run | S3/R2 | High | Hosting |
| D. No-account share links (Local + link) | Trip JSON encoded in a shareable link / PocketBase single binary | none / basic | local | Very low | Free |

Join flow (all options): creator gets an invite link `/join/K7Q2MX` → friend opens it → signs in (or enters a display name for guest mode) → either claims an existing placeholder member ("I'm Alex") or is added as a new member → lands on the trip.

Receipt ML in production: Supabase Edge Function / Cloudflare Worker calls Claude vision with a JSON-schema prompt; the API key never ships to the browser.

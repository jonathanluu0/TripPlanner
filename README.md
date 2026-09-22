# Group Trip Planner

A friendly web app to organize group trips: who's going, who rides in which car, who sleeps where, and who owes what.

Built with **React 18 + TypeScript + Mantine UI + Vite**.

## Features

### Feature 1: Cars & Sleeping arrangements
Drag-and-drop interface to assign attendees to cars (driver/passenger roles) and sleeping spots (bedroom/couch/airbed). One person per car assignment, one spot per person. Seat counters and capacity warnings included.

### Feature 2: Receipt upload & parsing
Upload photos of receipts. Claude vision (via a server function) or tesseract.js extracts: merchant, date, line items, tax, tip, fees, and total. Then review, edit, and confirm the data before splitting the expense.

### Feature 3: Expense tracking & settlement
Split receipts evenly among attendees. See running balances and a minimal settlement list (who pays whom). Only confirmed receipts count toward balances.

## Quick start

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone and install
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your backend choice
# (see env vars section below)

# Start dev server
npm run dev
```

Open http://localhost:5173 (Vite default) and create a trip.

### Build for production

```bash
npm run build
npm run preview  # test production build locally
```

## Environment variables

Create a `.env` file (copy from `.env.example`):

```bash
# Backend choice: 'supabase' | 'firebase' | 'custom' | 'local'
VITE_BACKEND=supabase

# Supabase (required if VITE_BACKEND=supabase)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...

# Receipt parser: 'tesseract' (default, client-side) | 'claude' (server, recommended)
VITE_RECEIPT_PARSER=claude

# If using Claude parser, URL to your Edge Function or server endpoint
VITE_RECEIPT_API_URL=https://your-project.supabase.co/functions/v1/parse-receipt

# Firebase (optional, if VITE_BACKEND=firebase)
# VITE_FIREBASE_PROJECT_ID=your-project
# VITE_FIREBASE_API_KEY=AIzaSy...
# etc.

# Custom backend API (optional, if VITE_BACKEND=custom)
# VITE_API_URL=https://api.example.com
```

## Folder layout

```
.
├── src/
│   ├── main.tsx                    # React entry point
│   ├── App.tsx                     # Router & layout
│   ├── theme.ts                    # Mantine theme (colors, shadows)
│   ├── types.ts                    # TypeScript interfaces (Trip, Receipt, etc.)
│   ├── lib/
│   │   ├── money.ts                # Format cents, parse currency, split evenly
│   │   ├── ids.ts                  # nanoid utilities
│   │   ├── colors.ts               # Hash-based member avatar colors
│   │   └── settle.ts               # Settlement algorithm (who pays whom)
│   ├── store/
│   │   └── tripStore.ts            # Zustand state (trip mutations, persistence)
│   ├── backend/
│   │   ├── repository.ts           # TripRepository interface
│   │   ├── localRepository.ts      # In-memory/localStorage adapter
│   │   ├── supabaseRepository.ts   # Supabase adapter (RLS, realtime)
│   │   └── index.ts                # Factory to select backend
│   ├── components/
│   │   ├── AppLayout.tsx           # Mantine AppShell wrapper
│   │   ├── MemberAvatar.tsx        # Colored avatar chip
│   │   ├── MemberChip.tsx          # Draggable member pill
│   │   └── ...
│   ├── pages/
│   │   ├── HomePage.tsx            # /: trips list, create, join
│   │   ├── TripPage.tsx            # /trip/:tripId shell
│   │   ├── JoinPage.tsx            # /join/:code
│   │   └── NotFoundPage.tsx
│   └── features/
│       ├── people/
│       │   └── PeoplePanel.tsx     # Tab: attendees, invite link/code
│       ├── logistics/
│       │   ├── LogisticsBoard.tsx  # Tab: cars + sleeping spots
│       │   ├── CarCard.tsx         # Car with drivers/passengers drop zones
│       │   ├── SleepingCard.tsx    # Sleeping spot with occupants
│       │   ├── AttendeePool.tsx    # Sticky pool of unassigned members
│       │   ├── DropZone.tsx        # @dnd-kit drop target
│       │   └── DetailsInputs.tsx   # Name, capacity, kind controls
│       └── receipts/
│           ├── ReceiptsPanel.tsx   # Tab: receipts list, upload, balances
│           ├── ReceiptUpload.tsx   # Dropzone, camera, upload UX
│           ├── ReviewModal.tsx     # Parse review & edit modal
│           ├── ItemsTable.tsx      # Receipt items table with edit controls
│           ├── SplitControls.tsx   # Split count, participant selector
│           ├── BalancesCard.tsx    # Summary card with settlement list
│           └── parsers/
│               ├── index.ts        # Parser interface & factory
│               ├── tesseract.ts    # OCR + regex parser (client)
│               ├── claude.ts       # POST to server function (recommended)
│               ├── manual.ts       # Empty form (manual entry)
│               └── heuristics.ts   # Regex helpers
├── docs/
│   ├── DESIGN.md                   # Full spec (stack, screens, data model, features)
│   └── BACKEND_OPTIONS.md          # Backend decision guide & setup
├── supabase/                       # Database (see supabase/README.md)
│   ├── schemas/                    # Source of truth: one file per table / function
│   ├── migrations/                 # Timestamped changes applied to Supabase
│   └── tests/                      # pgTAP security tests
├── server/
│   └── parse-receipt/
│       ├── index.ts                # Deno Edge Function (Claude vision)
│       └── README.md               # Deploy & test instructions
├── .env.example                    # Environment template
├── README.md                        # This file
├── package.json
├── tsconfig.json
├── vite.config.ts
└── index.html
```

## Backend options

The app is pluggable: start with **Local** (offline, zero setup) and migrate to **Supabase** (recommended, realtime + RLS) later.

See **[docs/BACKEND_OPTIONS.md](docs/BACKEND_OPTIONS.md)** for detailed comparison:
- **A. Supabase (recommended):** Magic-link auth, RLS, realtime, free tier
- **B. Firebase:** Firestore, Google auth, generous free tier
- **C. Custom:** Full control, Node/Hono + Postgres, you host it
- **D. Local / PocketBase:** Zero backend, share via link, offline-first

## Receipt parsing

Three parsers available; configure via `VITE_RECEIPT_PARSER`:

1. **tesseract.js** (default): OCR in browser, ~70–80% accuracy, free, slow (5–30s)
2. **Claude vision** (recommended): Server function to Anthropic, 95%+ accuracy, ~$0.01/receipt
3. **Manual**: Empty form for hand entry

See **[docs/BACKEND_OPTIONS.md § Receipt Parsing Backends](docs/BACKEND_OPTIONS.md#receipt-parsing-backends)** for details and cost estimates.

## Development

### Scripts

```bash
npm run dev        # Start Vite dev server
npm run build      # Build for production
npm run preview    # Preview production build
npm run lint       # (if configured)
npm run type-check # (if configured)
```

### Design decisions

- **Zustand + persist:** Minimalist state; survives page reload for offline work.
- **TripRepository interface:** Swap backends without app code changes (SupabaseRepository, FirebaseRepository, LocalRepository).
- **Integer cents:** No floating-point rounding errors in money calculations.
- **Stable avatar colors:** Hash of member ID → same color everywhere.

### Key files to start with

1. **[src/types.ts](src/types.ts):** Data model (Trip, Member, Receipt, etc.)
2. **[src/store/tripStore.ts](src/store/tripStore.ts):** All mutations (Zustand)
3. **[src/backend/repository.ts](src/backend/repository.ts):** Backend interface
4. **[docs/DESIGN.md](docs/DESIGN.md):** Full spec

## Deployment

### Frontend (Supabase + Vercel / Netlify)

```bash
# Build
npm run build

# Deploy to Vercel
vercel --prod

# Or Netlify
netlify deploy --prod --dir=dist
```

### Backend (Supabase)

See **[server/parse-receipt/README.md](server/parse-receipt/README.md)** for Edge Function deployment.

## Architecture

**Frontend state:** Zustand (app/store/tripStore.ts) is the single source of truth.

**Persistence:** LocalRepository writes to localStorage; SupabaseRepository syncs via Postgres + RLS + realtime channels.

**Realtime:** Supabase realtime listeners auto-sync to Zustand on changes; Firebase listeners do the same.

**Offline:** App works offline with Local backend; switch to Supabase to enable sharing.

## License

(Add your license here)

## Contributing

(Add contribution guidelines here)

## Links

- [Full design spec](docs/DESIGN.md)
- [Backend comparison](docs/BACKEND_OPTIONS.md)
- [Supabase database](supabase/README.md)
- [Receipt parser deployment](server/parse-receipt/README.md)

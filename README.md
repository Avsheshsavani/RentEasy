# RentEase — Property Management PWA

A complete property management application for rental room owners in India.

## Features

### Super Admin
- Manage property owners (create, enable/disable)
- View all properties across the platform
- Platform-wide analytics

### Owner
- Manage multiple properties and rooms
- Add/manage tenants with owner-controlled login
- Enter monthly electricity meter readings
- Auto-generate monthly bills (rent + electricity + previous dues)
- Confirm payments (UPI screenshot, cash, Razorpay)
- Track advance payments and deposits

### Tenant
- View current and past bills
- Pay via UPI QR, manual UPI, or cash
- View electricity meter readings
- Download receipts

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **State**: Zustand + TanStack Query
- **Backend**: Supabase (PostgreSQL + Auth + Edge Functions)
- **PWA**: Service Worker + Web Manifest

## Project Structure

```
rentease/
├── src/
│   ├── apps/
│   │   ├── super-admin/    # Super admin screens
│   │   ├── owner/          # Owner screens
│   │   └── tenant/         # Tenant screens
│   ├── components/
│   │   ├── ui/             # Reusable UI components
│   │   ├── layout/         # Layout components
│   │   └── auth/           # Auth components
│   ├── hooks/              # Custom hooks
│   ├── lib/                # Utilities and Supabase client
│   ├── stores/             # Zustand stores
│   └── types/              # TypeScript types
├── supabase/
│   ├── migrations/         # SQL migrations
│   └── functions/          # Edge Functions
└── public/                 # Static assets and PWA files
```

## Setup

### 1. Install Dependencies

```bash
cd rentease
npm install
```

### 2. Configure Environment

Create `.env` file:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Setup Supabase

1. Create a new Supabase project
2. Run migrations in order:

```bash
# Using Supabase CLI
supabase link --project-ref YOUR_PROJECT_REF
supabase db push

# Or manually via SQL editor
# Run each file in supabase/migrations/ in order
```

3. Deploy Edge Functions:

```bash
supabase functions deploy create-owner --no-verify-jwt
supabase functions deploy toggle-owner --no-verify-jwt
supabase functions deploy create-tenant --no-verify-jwt
supabase functions deploy toggle-tenant --no-verify-jwt
supabase functions deploy set-tenant-login --no-verify-jwt
supabase functions deploy razorpay-webhook
```

4. Set secrets:

```bash
supabase secrets set RAZORPAY_WEBHOOK_SECRET=your_secret
```

### 4. Create Super Admin

Create the first super admin manually:

1. Create a user in Supabase Auth (email + password)
2. Insert into `super_admins` table:

```sql
INSERT INTO super_admins (id, name, email, phone)
VALUES ('auth-user-uuid', 'Admin Name', 'admin@example.com', '9876543210');
```

### 5. Run Development Server

```bash
npm run dev
```

## Deployment

### Build for Production

```bash
npm run build
```

### Deploy to Vercel/Netlify

Simply connect your repository and deploy. The app is a static SPA.

## Database Schema

### Tables
- `super_admins` - Platform administrators
- `owners` - Property owners
- `properties` - Buildings/locations
- `rooms` - Individual rental units
- `tenants` - Rent holders
- `leases` - Room-tenant assignments
- `electricity_readings` - Monthly meter readings
- `bills` - Monthly bills
- `payments` - Payment records
- `vacate_requests` - Tenant vacate workflow
- `notifications` - In-app notifications

### Key Features
- Row Level Security on all tables
- Auto-calculated fields (units consumed, bill balance)
- Triggers for room occupancy sync
- Bill generation function
- Advance payment tracking

## API Endpoints (Edge Functions)

| Function | Called By | Purpose |
|----------|-----------|---------|
| `create-owner` | Super Admin | Create new owner account |
| `toggle-owner` | Super Admin | Enable/disable owner |
| `create-tenant` | Owner | Create new tenant account |
| `set-tenant-login` | Owner | Set or reset tenant email/password for login |
| `toggle-tenant` | Owner | Enable/disable tenant |
| `razorpay-webhook` | Razorpay | Auto-confirm payments |

## License

MIT

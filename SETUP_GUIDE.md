# RentEase - Complete Setup Guide

## Step 1: Run Database Migrations

### Option A: Via Supabase Dashboard (Recommended)

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: `tthqsfdklsvzoqjgxzvp`
3. Click **SQL Editor** in the left sidebar
4. Click **+ New Query**
5. Copy the entire contents of `supabase/combined_migration.sql`
6. Paste into the SQL Editor
7. Click **Run** (or press Cmd+Enter)

**Note:** The `pg_cron` extension might fail if not enabled on your plan. That's okay - automatic bill generation won't work, but you can generate bills manually.

### If “Generate bills” fails with `previous_dues` / `23502` (NULL)

That means the live database still has an older `generate_bills_for_month` function (editing migration `010` in Git does not re-run it on Supabase). **Run once** in **SQL Editor** the full contents of:

`supabase/migrations/011_fix_generate_bills_prev_dues.sql`

That replaces the function with a version that never inserts NULL into `previous_dues`. (Same SQL as `supabase/fix_generate_bills_for_month.sql`.)

### Tenant Pay tab + bill `id` (migration `012`)

Run once in **SQL Editor** the file `supabase/migrations/012_tenant_bill_pay_rpc.sql`. It adds `get_tenant_bill_for_pay`, then **drops and recreates** `v_tenant_current_bill` and `v_tenant_bill_history` (PostgreSQL cannot `CREATE OR REPLACE VIEW` when the first column is renamed from `bill_id` to `id`). Each bill row then has **`id`** and **`bill_id`** for payments and **Pay this bill** links. Uses `CASCADE` on drop only if another object depended on those views (unusual).

### Option B: Via Supabase CLI

```bash
# Install Supabase CLI (if not installed)
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref tthqsfdklsvzoqjgxzvp

# Push migrations
supabase db push
```

---

## Step 2: Create Super Admin Account

### 2a. Create Auth User in Supabase Dashboard

1. Go to **Authentication** → **Users** in Supabase Dashboard
2. Click **Add User** → **Create new user**
3. Enter:
   - **Email:** your-email@example.com
   - **Password:** your-secure-password
   - Check ✅ **Auto Confirm User**
4. Click **Create User**
5. **Copy the User UID** (you'll need this in the next step)

### 2b. Insert Super Admin Record

1. Go to **SQL Editor**
2. Run this query (replace with your details):

```sql
INSERT INTO super_admins (id, name, email, phone)
VALUES (
  'YOUR-USER-UUID-HERE',  -- Paste the UUID from step 2a
  'Your Name',
  'your-email@example.com',
  '9876543210'
);
```

Example:
```sql
INSERT INTO super_admins (id, name, email, phone)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Ramesh Patel',
  'ramesh@example.com',
  '9876543210'
);
```

---

## Step 3: Deploy Edge Functions

### Option A: Via Supabase Dashboard

Edge Functions need to be deployed via CLI. But first, enable Edge Functions in your project:

1. Go to **Edge Functions** in the sidebar
2. Click **Enable Edge Functions** if prompted

### Option B: Via Supabase CLI (Required)

```bash
cd rentease

# Login to Supabase (if not already)
supabase login

# Link to your project
supabase link --project-ref tthqsfdklsvzoqjgxzvp

# Deploy all Edge Functions
# Use --no-verify-jwt for functions that check the JWT inside the function.
# Otherwise the API gateway may return 401 before your code runs (common with ES256 tokens).
supabase functions deploy create-owner --no-verify-jwt
supabase functions deploy toggle-owner --no-verify-jwt
supabase functions deploy create-tenant --no-verify-jwt
supabase functions deploy toggle-tenant --no-verify-jwt
supabase functions deploy set-tenant-login --no-verify-jwt
supabase functions deploy razorpay-webhook

# Set secrets (if using Razorpay)
supabase secrets set RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_here
```

---

## Step 4: Configure Supabase Auth

### Enable Phone Auth (for Tenants)

1. Go to **Authentication** → **Providers**
2. Enable **Phone** provider
3. Configure SMS provider (Twilio, MessageBird, etc.)

### Or use Email Auth for all users

Tenants can also login via email if you modify the `create-tenant` Edge Function.

---

## Step 5: Test the App

1. Start the dev server:
   ```bash
   cd rentease
   npm run dev
   ```

2. Open http://localhost:5173

3. Login with your Super Admin email/password

4. You should see the Super Admin Dashboard

---

## Troubleshooting

### "pg_cron extension not available"

The free tier doesn't include pg_cron. Remove these lines from the migration:
- The entire `001_extensions.sql` content about pg_cron
- Any `cron.schedule()` calls in `010_bill_generation.sql`

Bills will need to be generated manually via the "Generate Bills" button.

### "RLS policy violation"

Make sure you:
1. Created the super_admin record with the correct auth user UUID
2. The UUID matches exactly (no extra spaces)

### "Edge Function not found"

Deploy the functions using CLI:
```bash
supabase functions deploy create-owner
```

### "CORS error"

Edge Functions should work with any origin. If issues persist, check the function logs:
```bash
supabase functions logs create-owner
```

---

## Quick Reference

| Action | Where |
|--------|-------|
| Run SQL | Supabase Dashboard → SQL Editor |
| Create users | Supabase Dashboard → Authentication → Users |
| View tables | Supabase Dashboard → Table Editor |
| Deploy functions | CLI: `supabase functions deploy <name>` |
| View function logs | CLI: `supabase functions logs <name>` |

---

## Environment Variables

Your `.env` file should have:

```env
VITE_SUPABASE_URL=https://tthqsfdklsvzoqjgxzvp.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_rnUC343xuX4Kac52SXtgFg_IwGz13PJ.
```

These are already configured in your project.

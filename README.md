# Loopi Routines PWA

Touch-first Progressive Web App for managing child routines. Built with Vite + React, integrates with Supabase for simple email/password authentication, and is installable on iPad or any modern device.

## Prerequisites

- Node.js 18+
- npm 9+ (or pnpm / yarn if you prefer)
- A Supabase project (free tier works fine)

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy the example environment file and update with your Supabase project values:
   ```bash
   cp .env.example .env
   ```

   - `VITE_SUPABASE_URL`: Found in Supabase dashboard under **Project Settings → API → Project URL**.
   - `VITE_SUPABASE_ANON_KEY`: Located in the same section under **Project API keys → anon public**.

3. Start the development server:
   ```bash
   npm run dev
   ```

   The app is available at <http://localhost:5173>. Vite hot module reload keeps the PWA shell fast during iteration.

4. Build for production:
   ```bash
   npm run build
   npm run preview
   ```

## Supabase Notes

- Email/password auth is enabled out of the box for new projects. If you previously disabled it, go to **Authentication → Providers** and toggle **Email** on.
- Authentication state is persisted locally so users stay signed in across launches.
- Extend the data model with tables (e.g. `routines`, `tasks`, `task_logs`) and call Supabase from the `RoutineBoard` component when you are ready to sync routines between devices.

## PWA & iPad Installation

- The app ships with a custom service worker (`public/sw.js`) and manifest (`public/manifest.webmanifest`) so it installs cleanly and keeps previously fetched screens available offline.
- During development, Vite serves the PWA in dev mode. For a real iPad test, run `npm run build && npm run preview` so the service worker takes control.
- On iPad (Safari):
  1. Visit your dev server URL (ensure the iPad can reach your machine, e.g. via local network or tunneling).
  2. Tap the `Share` icon → **Add to Home Screen**.
  3. Launch from the home screen icon for full-screen, standalone experience.
- iPad hints:
  - The layout targets one-hand reach: large tap targets, minimal chrome, resilient to landscape/portrait changes.
  - You can customize icons by replacing the PNG files in `public/icons/`.

## Project Structure

- `src/App.tsx` – session handling and routing between auth screen and routines board.
- `src/components/AuthForm.tsx` – Supabase email/password sign in & sign up.
- `src/components/RoutineBoard.tsx` – touch-optimized routine UI (currently shows local sample data).
- `src/lib/supabaseClient.ts` – lazy Supabase client creation with environment guard.
- `src/styles.css` – global styling tuned for tablet form factor.

## Next Steps

- Replace the placeholder routines with data fetched from Supabase tables.
- Add parental/admin configuration for routines and per-child assignments.
- Track completion history and sync to Supabase to unlock analytics and streaks.
- Integrate push notifications (e.g. via Supabase Edge Functions) for reminders.

## Database Migrations

The Supabase schema is versioned under `supabase/migrations/`. The initial migration creates tables for templates,
tasks, routine runs, run task instances, and applies RLS policies so each user only sees their own data.

Preview the SQL in `supabase/migrations/20240914120000_initial_schema.sql`.

To apply migrations against a remote project (requires the Supabase CLI and `SUPABASE_DB_URL` in your environment):

```bash
# First time only: npm install -g supabase
export SUPABASE_DB_URL="postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres"
npm run db:migrate
```

`supabase db push` will apply any pending files in `supabase/migrations/` to the target database.

## Local Supabase Development

The repository is already `supabase init`-ed (see `supabase/config.toml`). To run everything locally:

1. Install the Supabase CLI if needed:
   ```bash
   npm install -g supabase
   ```
2. Start the local stack (Postgres, Auth, Storage, Studio, etc.):
   ```bash
    npm run supabase:start
   ```
   The CLI will print connection details, including a local anon/public key.

3. Point the web app at the local instance by updating `.env` (or copy `.env.local.example` to `.env.local`):
   ```bash
   VITE_SUPABASE_URL=http://127.0.0.1:54321
   VITE_SUPABASE_ANON_KEY=<anon-key-from-supabase-start>
   ```

4. Apply migrations to the local database (automatically runs on `supabase start`, but safe to re-run):
   ```bash
   npm run db:migrate
   ```

5. Reset the local database (drops, recreates, re-applies migrations, and runs `supabase/seed.sql`) when you need a clean slate:
   ```bash
   npm run db:reset
   ```

6. Want predictable data for manual testing? With the local stack running, execute the Snaplet script:
   ```bash
   npx tsx seed.ts
   ```
   This truncates every table and seeds a demo account (`a@a.com / LoopiDemo1!`) plus a starter routine template so you can sign in immediately.

While the local stack is running you can develop normally with `npm run dev`. Supabase Studio will be available at <http://127.0.0.1:54323>.

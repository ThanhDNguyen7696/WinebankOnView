# WineBank Website Front-End

This project has been split into reusable pages, styles and scripts so it can grow into a full website.

## Run locally

1. Copy `.env.example` to `.env.local` and fill in your Supabase project URL and anon key.
2. Run `npm run config` to generate `JS/supabase-config.js` from `.env.local`.
3. Start a small local server:

```bash
python3 -m http.server 5500
```

Then open `http://localhost:5500` in a browser. You can also use the
**Live Server** extension in VS Code.

Re-run `npm run config` any time you change `.env.local`. `JS/supabase-config.js`
is generated and gitignored — do not edit or commit it directly.

## Current pages

- `index.html` — expandable home-page shell
- `login.html` — member login
- `signup.html` — account creation
- `reset-password.html` — set a new password from the email link
- `member-dashboard.html` — member dashboard
- `food.html` — dining information and current menu link
- `admin.html` — protected food-menu upload screen

## Structure

- `css/global.css` — global colours, header, footer and shared buttons
- `css/auth.css` — shared login/signup layout
- `css/home.css` — homepage styling
- `css/dashboard.css` — dashboard styling
- `JS/navigation.js` — shared responsive navigation
- `JS/common.js` — reusable validation and UI helpers
- `JS/login.js` — Supabase login logic
- `JS/signup.js` — Supabase signup logic
- `JS/dashboard.js` — member dashboard session state
- `JS/reset-password.js` — password reset logic
- `JS/age-verification.js` — reusable age-verification functions
- `JS/admin.js` — Supabase admin login and PDF upload
- `JS/menu.js` — resolves the current Supabase menu URL
- `scripts/generate-supabase-config.mjs` — writes `JS/supabase-config.js` from `.env.local`

## Menu administration setup

The Food page keeps using the existing menu PDF until Supabase is configured.

1. Create a Supabase project.
2. Run `supabase/setup.sql` in **SQL Editor**.
3. Create the owner account in **Authentication > Users**.
4. Run the final commented SQL statement in `supabase/setup.sql`, replacing the example email.
5. Copy `.env.example` to `.env.local`, fill in the project URL and anon key, then run `npm run config`.
6. Open `/admin.html`, sign in and publish the first PDF.

The anon key is designed to be public. Never place a Supabase service-role key in this repository. Storage policies restrict uploads to rows in `admin_users`.

`.env.local` is gitignored. For a hosted deployment, set `SUPABASE_URL` and `SUPABASE_ANON_KEY` as environment variables and run `npm run build` as the build step.

## Authentication

Member registration, login, password reset, session handling and logout use Supabase Auth (`JS/login.js`, `JS/signup.js`, `JS/dashboard.js`, `JS/reset-password.js`). Names, phone details and consent selections are stored in Supabase user metadata. Passwords and sessions are not stored in `localStorage`.

Add the deployed website URL and `http://localhost:5500` to **Supabase > Authentication > URL Configuration** so email confirmations and password resets can redirect back to the site.

# WineBank Website Front-End

This project has been split into reusable pages, styles and scripts so it can grow into a full website.

## Run locally

From the project folder, start a small local server:

```bash
python3 -m http.server 5500
```

Then open `http://localhost:5500` in a browser. You can also use the
**Live Server** extension in VS Code.

## Current pages

- `index.html` — expandable home-page shell
- `login.html` — member login
- `signup.html` — account creation
- `member-dashboard.html` — demo dashboard
- `food.html` — dining information and current menu link
- `admin.html` — protected food-menu upload screen

## Structure

- `css/global.css` — global colours, header, footer and shared buttons
- `css/auth.css` — shared login/signup layout
- `css/home.css` — homepage styling
- `css/dashboard.css` — dashboard styling
- `JS/navigation.js` — shared responsive navigation
- `JS/common.js` — reusable validation and UI helpers
- `JS/login.js` — login logic
- `JS/signup.js` — signup logic
- `JS/dashboard.js` — dashboard demo state
- `JS/age-verification.js` — reusable age-verification functions
- `JS/admin.js` — Supabase admin login and PDF upload
- `JS/menu.js` — resolves the current Supabase menu URL

## Menu administration setup

The Food page keeps using the existing menu PDF until Supabase is configured.

1. Create a Supabase project.
2. Run `supabase/setup.sql` in **SQL Editor**.
3. Create the owner account in **Authentication > Users**.
4. Run the final commented SQL statement in `supabase/setup.sql`, replacing the example email.
5. Copy `.env.example` to `.env.local`, enter the project URL and publishable key, then run `npm run config`.
6. Open `/admin.html`, sign in and publish the first PDF.

The anon key is designed to be public. Never place a Supabase service-role key in this repository. Storage policies restrict uploads to rows in `admin_users`.

`.env.local` is ignored by Git. For Vercel, add `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` under Project Settings > Environment Variables and use `npm run build` as the build command. The generated browser configuration still contains the publishable key by design; authorization is enforced by Supabase row-level security.

## Authentication

Member registration, login, password reset, session handling and logout use Supabase Auth. Names, phone details and consent selections are stored in Supabase user metadata. Passwords and sessions are not stored in application `localStorage` code.

Add the deployed website URL and local development URL to **Supabase > Authentication > URL Configuration** so email confirmations and password resets can return to the website.

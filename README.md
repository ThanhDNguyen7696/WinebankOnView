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

## Important

The current authentication is a front-end demo using `localStorage`. It is not secure and is not a real login system.

When the backend is ready, replace the demo sections in:

- `JS/login.js`
- `JS/signup.js`

with real API calls, for example:

- `POST /api/auth/login`
- `POST /api/auth/signup`

Do not store real passwords in localStorage.

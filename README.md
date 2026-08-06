# WineBank Website Front-End

This project has been split into reusable pages, styles and scripts so it can grow into a full website.

## Run in VS Code

1. Open the `winebank-website` folder in VS Code.
2. Install the **Live Server** extension by Ritwick Dey.
3. Right-click `index.html`.
4. Select **Open with Live Server**.

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
- `js/common.js` — reusable validation and UI helpers
- `js/login.js` — login logic
- `js/signup.js` — signup logic
- `js/dashboard.js` — dashboard demo state
- `js/age-verification.js` — reusable age-verification functions

## Important

The current authentication is a front-end demo using `localStorage`. It is not secure and is not a real login system.

When the backend is ready, replace the demo sections in:

- `js/login.js`
- `js/signup.js`

with real API calls, for example:

- `POST /api/auth/login`
- `POST /api/auth/signup`

Do not store real passwords in localStorage.

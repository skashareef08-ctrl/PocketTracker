# PocketTracker — Full Stack Expense Tracker

A responsive expense-tracking app with:
- User signup/login (passwords hashed with bcrypt)
- JWT authentication
- MongoDB persistence; each user only sees their own expenses
- Add, edit, delete, search, and category-filter expenses
- All-time totals, this-month total, transaction count, average expense
- Category breakdown, spending bars, and monthly summary
- Light/dark theme

## Requirements
- Node.js 18+ (Node.js 20 LTS recommended)
- MongoDB Community Server running locally **or** a MongoDB Atlas connection string
- npm (comes with Node.js)

## 1. Install Node.js
Download and install Node.js from https://nodejs.org/. Choose the LTS version.
Verify in a terminal:
```bash
node -v
npm -v
```

## 2. Start MongoDB
### Local MongoDB
Install MongoDB Community Server and make sure its service is running. Default URI:
`mongodb://127.0.0.1:27017/pockettracker`

### MongoDB Atlas (cloud)
Create a cluster at https://www.mongodb.com/atlas, create a database user, allow your current IP in Network Access, and copy the connection string. Replace its password placeholder and use it as `MONGODB_URI` in `.env`.

## 3. Configure the project
Open this folder in VS Code. In the terminal, run:
```bash
npm install
```
Copy `.env.example` to a new file named `.env`.

Windows PowerShell:
```powershell
Copy-Item .env.example .env
```
Open `.env` and set a long random JWT secret (at least 32 characters). Example format:
```env
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017/pockettracker
JWT_SECRET=use_a_long_random_secret_here_please
```
Do not share `.env` or commit it to GitHub.

## 4. Run the app
```bash
npm start
```
Open **http://localhost:3000** in your browser. Create an account and start adding expenses.

For auto-restart while developing:
```bash
npm run dev
```

## Project structure
```text
PocketTracker/
├── server.js
├── package.json
├── .env.example
├── .gitignore
├── README.md
└── public/
    ├── index.html
    ├── style.css
    └── app.js
```

## API routes
| Method | Route | Purpose |
|---|---|---|
| POST | `/api/auth/signup` | Create user |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Current user (auth required) |
| GET | `/api/expenses` | List current user's expenses |
| POST | `/api/expenses` | Create expense |
| PUT | `/api/expenses/:id` | Update own expense |
| DELETE | `/api/expenses/:id` | Delete own expense |
| GET | `/api/health` | Server health check |

## Notes
- This is a learning/demo project. For production, add rate limiting, email verification, password reset, stronger session handling (prefer secure HttpOnly cookies), CSRF protection if using cookies, and deployment HTTPS.
- JWT is stored in localStorage in this starter. Avoid using this pattern for sensitive production applications.
- The date is stored as a MongoDB Date. The browser submits the selected date as a date-only string; check timezone behavior if you deploy across time zones.

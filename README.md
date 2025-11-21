Eaglercraft 1.12 Hosting — Minimal Example

This project is a minimal starter for hosting Eaglercraft 1.12 servers with a simple website, signup/login, and a basic dashboard.

Important: This is an example/demo. For production, secure the JWT secret, enable HTTPS, review cookie settings, add rate-limiting, input validation, and email verification.

Features

- User authentication (signup/login, password reset)
- GitHub OAuth (mock, ready for real OAuth)
- Server management (create, start, stop)
- Live console with WebSocket
- Player count tracking
- Real-time UI updates
- Cloudflare Pages compatible

Quick start

1. Install dependencies

```bash
npm install
```

2. (Optional) copy `.env.example` to `.env` and edit values

```bash
cp .env.example .env
# edit .env
```

3. Start the server

```bash
npm run dev   # or `npm start`
```

4. Open http://localhost:3000 in your browser

Deployment

**Cloudflare Pages**: See [CLOUDFLARE_DEPLOYMENT.md](./CLOUDFLARE_DEPLOYMENT.md) for full setup instructions.

**Quick summary**:
- Push code to GitHub
- Connect repo to Cloudflare Pages
- Set build output to `public/`
- Deploy backend separately (Railway, Render, etc.)
- Update API URLs in frontend JS files

Files

- `server.js` — Express server and API
- `db.js` — SQLite DB and helpers (creates `data/database.sqlite3`)
- `public/` — static frontend files (index, login, signup, servers, console)
- `_redirects` — SPA routing for Cloudflare Pages

Security notes

- The demo uses JWT cookies. For production, set `COOKIE_SECURE=true` and serve over HTTPS.
- Replace `JWT_SECRET` with a strong secret and store it safely.
- Add rate limiting and stronger validation for signup/login.



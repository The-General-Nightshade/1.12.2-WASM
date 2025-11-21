# Deployment Guide: Cloudflare Pages + Backend API

This app has a frontend (hosted on Cloudflare Pages) and a backend Node.js API. Here's how to deploy:

## Option 1: Cloudflare Pages (Frontend Only) + External Backend

### Frontend (Cloudflare Pages)
1. Push code to GitHub
2. In Cloudflare Pages Dashboard:
   - Connect repository
   - Build command: (leave blank or `npm run build`)
   - Build output directory: `public`
3. Cloudflare Pages will serve your static files with SPA routing (via `_redirects`)

### Backend (Your choice of host)
- **Recommended**: Railway, Render, Heroku (Free tier often has restrictions)
- Deploy `server.js` with your dependencies
- Set environment variables in hosting dashboard:
  ```
  JWT_SECRET=<secure-random-string>
  SMTP_HOST=smtp.gmail.com
  SMTP_PORT=587
  SMTP_USER=<your-email>
  SMTP_PASS=<app-password>
  SMTP_FROM=noreply@yourhost.com
  APP_URL=https://your-backend-url.com
  COOKIE_SECURE=true
  ```

### Connect Frontend to Backend
Update `public/js/*.js` files to use your backend URL:
```javascript
// Change API calls from /api/... to https://your-backend-url/api/...
const API_BASE = 'https://your-backend-url.com';
```

## Option 2: Cloudflare Workers (Full-Stack on Cloudflare)

### Setup
```bash
npm install -g wrangler
wrangler init
```

### Configure `wrangler.toml`
```toml
name = "eaglercraft-hosting"
main = "server.js"
type = "javascript"

[env.production]
routes = [
  { pattern = "example.com/*", zone_name = "example.com" }
]
```

### Deploy
```bash
wrangler publish --env production
```

## Option 3: Separate Deployments (Recommended for Full Control)

### Frontend (Cloudflare Pages)
- Build: `npm run build`
- Output: `public/`
- GitHub integration: Automatic deploys on push

### Backend (Separate VPS/Container)
```bash
npm install
npm start
```

Set `APP_URL` to your backend domain in the environment.

## Environment Variables

Create `.env` on your host:
```
JWT_SECRET=your-secret-key-here
PORT=3000
COOKIE_SECURE=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=app-password
SMTP_FROM=noreply@hosting.com
APP_URL=https://your-domain.com
GITHUB_CLIENT_ID=<optional>
GITHUB_CLIENT_SECRET=<optional>
```

## Database

The app uses SQLite (`data/database.sqlite3`). For production:
- **Local storage**: Works fine for small deployments
- **PostgreSQL**: Replace `sqlite3` with `pg` in package.json and update `db.js`
- **Cloud**: Use managed PostgreSQL from Railway, Render, etc.

## CORS & API Access

If frontend (Cloudflare Pages) and backend are on different domains:
- CORS is already enabled in `server.js`
- Make sure `app.use(cors())` is in place
- API calls use `credentials: 'include'` to send cookies across domains

## Testing

Locally (before deployment):
```bash
npm install
npm start
# Open http://localhost:3000
```

After deployment to Cloudflare Pages:
1. Visit `https://your-pages-url.pages.dev`
2. Update JS files to point to backend URL
3. Test signup, login, server creation, console

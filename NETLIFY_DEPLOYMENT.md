# Netlify Deployment Guide

## Problem: "Page Not Found" on Netlify Drag-and-Drop

When you drag-and-drop files to Netlify without connecting to Git:
- ❌ `netlify.toml` is **ignored** (not processed)
- ❌ `_headers` file is **ignored** (not processed)
- ❌ You get "page not found" on the root URL

**Solution**: Use **Git-based deployment** (recommended) or follow the manual steps below.

## Option A: Git-Based Deployment (RECOMMENDED)

This is the **best and easiest** way to ensure all files work correctly.

### Steps:

1. **Push to GitHub**:
```bash
git add .
git commit -m "Netlify optimization: headers, precompress, and lag fixes"
git push origin main
```

2. **Connect to Netlify**:
   - Go to https://netlify.com
   - Click **"Add new site"** → **"Import an existing project"**
   - Select **GitHub** and choose your repo
   - Click **Deploy**
   - Netlify will automatically read `netlify.toml` and `_headers` ✅

3. **Verify**:
   - Open your site URL
   - Press F12 → Network tab
   - Reload page
   - Check response headers for `Cache-Control`, `Strict-Transport-Security`, etc.

## Option B: Drag-and-Drop + Manual Headers Fix

If you must use drag-and-drop (not recommended), Netlify won't read `netlify.toml`. You must set headers manually:

### Steps:

1. **Drag-and-drop your site files to Netlify** (as you did before)

2. **Set headers manually in Netlify Dashboard**:
   - Go to your site → **Site Settings** → **Headers**
   - Click **"Add headers rule"**
   - Add these rules (copy from `netlify.toml` section):

```
Path: /*
Headers:
  Cache-Control: public, max-age=0, must-revalidate
  X-Content-Type-Options: nosniff
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload

Path: /wasm/*
Headers:
  Cache-Control: public, max-age=31536000, immutable

Path: /
Headers:
  Content-Type: text/html; charset=utf-8
```

3. **Set redirects manually**:
   - Go to **Site Settings** → **Build & Deploy** → **Post processing**
   - Enable **"Pretty URLs"** (converts `/page` to `/page/index.html`)
   - Go to **Redirects** and add:
     ```
     From: /*
     To: /index.html
     Status: 200
     ```

4. **Redeploy**:
   - Delete the current deployment
   - Drag-and-drop files again
   - Or re-run a Git deployment

## Option C: Use Netlify CLI (Advanced)

If you want full control and automation:

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Build (precompress)
chmod +x ./precompress.sh
./precompress.sh

# Deploy
netlify deploy --prod --dir=.
```

## Verify Deployment Works

After deploying, check:

1. **Root URL works**:
   ```
   https://your-site.netlify.app/
   → Should load /index.html (not 404)
   ```

2. **WASM URL works**:
   ```
   https://your-site.netlify.app/wasm/
   → Should load /wasm/index.html
   ```

3. **Headers are correct** (F12 → Network):
   - Click `index.html` or any `.js` file
   - Look for response headers:
     - `Cache-Control: public, max-age=0, must-revalidate` (HTML)
     - `Cache-Control: public, max-age=31536000, immutable` (JS/CSS)
     - `Strict-Transport-Security: max-age=31536000...` (all)

4. **Debug panel works**:
   ```
   https://your-site.netlify.app/wasm/index.html?debug
   → Check relay latency, ping, etc.
   ```

## Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| 404 on root URL | Redirect not set | Add `[[redirects]] from="/*" to="/index.html"` in netlify.toml or manually in Dashboard |
| _headers ignored | Drag-and-drop deploy | Use Git-based deployment instead |
| netlify.toml ignored | Drag-and-drop deploy | Use Git-based deployment instead |
| Slow load times | Wrong cache headers | Verify headers in Network tab; should be `max-age=31536000` for JS/WASM |
| Precompressed files not used | Brotli not installed on Netlify | Netlify will still serve gzip; add brotli in build dependencies if needed |

## Quick Checklist

- [ ] `netlify.toml` at repo root
- [ ] `_headers` at repo root
- [ ] `index.html` at repo root
- [ ] `wasm/index.html` exists
- [ ] `wasm/chunk-throttle.js`, `chunk-worker.js`, etc. exist
- [ ] Deployed via **Git** (not drag-and-drop)
- [ ] Checked response headers (F12 → Network)
- [ ] Root URL and `/wasm/` URL both return 200 (not 404)

## Support

If you still get 404 after following these steps:

1. Check Netlify build logs (Deploys → recent build → Build log)
2. Verify files are in repo root:
   - `netlify.toml`
   - `_headers` (only for Apache/Nginx, not needed for Netlify if using `netlify.toml`)
   - `index.html`
3. Force redeploy: Go to **Deploys** → **Trigger deploy** → **Deploy site**

---

**TL;DR**: Use Git deployment (GitHub → Netlify) instead of drag-and-drop. Netlify will read `netlify.toml` automatically, set headers, and prevent 404 errors. ✅

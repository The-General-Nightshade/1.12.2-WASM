# Netlify Deployment Guide

## Quick Start

### Option 1: Git-connected Deploy (Recommended)

1. **Push your repo to GitHub** (or GitLab):
   ```bash
   git add .
   git commit -m "Add Netlify optimization"
   git push origin main
   ```

2. **Connect to Netlify**:
   - Go to https://app.netlify.com
   - Click "New site from Git"
   - Select your GitHub repo
   - **Leave settings default** (Netlify will auto-detect `netlify.toml`)
   - Click "Deploy site"

3. **Verify deployment**:
   - Wait for build to finish (you'll see "Deploy successful")
   - Click the site URL
   - Test: `https://your-site.netlify.app/wasm/index.html`
   - Enable debug: `https://your-site.netlify.app/wasm/index.html?debug`

### Option 2: Drag-and-Drop Deploy

1. **Prepare local folder**:
   ```bash
   # Make sure all files are in the repo root
   ls -la  # check you see: _headers, netlify.toml, index.html, wasm/, etc.
   ```

2. **Drag to Netlify**:
   - Go to https://app.netlify.com/drop
   - Drag the repository folder into the drop zone
   - Wait for deploy
   - Test site URL

## File Structure (must be at repo root)

```
.
├── _headers          ✅ Required for Netlify
├── _redirects        ✅ Netlify routing (optional but recommended)
├── netlify.toml      ✅ Build config
├── precompress.sh    ✅ Pre-compression script
├── index.html        ✅ Main entry
├── wasm/
│   ├── index.html    ✅ WASM entry
│   ├── bootstrap.js
│   ├── chunk-throttle.js
│   ├── chunk-worker.js
│   ├── chunk-worker-proxy.js
│   ├── movement-tuner.js
│   ├── low-quality-mode.js
│   └── network-optimization.js
├── classes.js
├── assets.epk (or assets.epw)
└── lang/

```

## Troubleshooting

### "Page not found" or 404 errors

**Cause 1: Files not in repo root**
- Netlify publishes everything in the repo by default
- Make sure `_headers`, `netlify.toml`, `index.html`, `wasm/` are at repo root (not in a subfolder)

**Fix**:
```bash
# From repo root, verify structure:
ls -la _headers netlify.toml index.html wasm/index.html
# Should all exist and be readable
```

**Cause 2: Git not syncing changes**
- You manually uploaded files to Netlify but git repo is out of sync

**Fix**:
```bash
# Commit all changes
git add .
git commit -m "Add Netlify config"
git push
# Then redeploy in Netlify (Site settings → Deploys → Trigger deploy)
```

**Cause 3: Netlify cache**
- Files cached from old deploy

**Fix**:
- In Netlify: Site settings → Deploys → Clear cache and deploy site
- Or: Site settings → Build & deploy → Trigger deploy

### Headers not being applied

Check in browser:
1. Open DevTools (F12)
2. Network tab
3. Reload page
4. Click any file (e.g., `index.html` or `classes.js`)
5. Look at Response Headers
6. Should see: `Cache-Control: public, max-age=...`

If not present:
- Netlify hasn't picked up `_headers` or `netlify.toml`
- Try: Clear cache and deploy (Netlify UI)

### Precompression not working

Check build logs in Netlify:
1. Site settings → Deploys
2. Click the latest deploy
3. Look for output like: `Precompressing assets...`
4. If errors, `precompress.sh` might not have execute permissions

**Fix**:
```bash
chmod +x ./precompress.sh
git add precompress.sh
git commit -m "Make precompress executable"
git push
```

### WASM/EPW files serving with wrong MIME type

**Cause**: Netlify doesn't know the MIME type

**Fix**: Already in `_headers` and `netlify.toml`, but verify:
- Check Network tab for `assets.epw` or `.wasm` file
- Response header should show `Content-Type: application/octet-stream` (for `.epw`) or `application/wasm`

If not:
- Force clear: Site settings → Deploys → Clear cache and deploy

## Performance Check

1. Load `https://your-site.netlify.app/wasm/index.html?debug`
2. Check:
   - `Ping`: should be low (< 100ms usually)
   - `Relay latency`: should show e.g., `deev.is: 45ms | lax1dude: 120ms | ayunami: 200ms`
3. Open Network tab (F12)
4. Reload
5. Check response headers for first few files:
   - `Cache-Control: public, max-age=...`
   - `Content-Encoding: br` or `Content-Encoding: gzip` (if precompressed)

## If still having issues

1. **Check Netlify logs**:
   - Site settings → Deploys → Click latest → "Deploy log"
   - Look for errors

2. **Verify files uploaded**:
   - Netlify: Site settings → Files
   - Should see all files listed (index.html, wasm/*, classes.js, etc.)

3. **Try a fresh deploy**:
   ```bash
   git push
   # Wait a few seconds, Netlify auto-deploys
   # Check site URL
   ```

4. **Last resort: Contact Netlify support** with:
   - Your site URL
   - Screenshot of file structure in "Netlify Files"
   - Netlify build log (screenshot)


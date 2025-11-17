# Netlify Deployment Fix Summary

## Problem
When uploading files to Netlify via drag-and-drop, the site returned "404 page not found" errors, even though the same files worked locally.

## Root Cause
Netlify's drag-and-drop file upload **ignores** `netlify.toml`, `_redirects`, and build scripts. These configuration files are only processed when:
1. **Git-based deployment** (GitHub/GitLab → Netlify automatic deployment)
2. **Manual configuration** through Netlify Dashboard
3. **Netlify CLI** deployment with `netlify deploy --prod`

Without these configs, Netlify can't:
- Redirect unknown routes to `/index.html` (Single-Page App requirement)
- Set proper cache headers for assets
- Handle `.wasm`, `.epw`, `.epk` MIME types correctly

## Solution Applied

### 1. **netlify.toml** - SPA Redirect Configuration ✓
```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```
This tells Netlify: "For any route not matching a static file, serve `/index.html`"

### 2. **_redirects** - Backup Redirect Rules ✓
Updated with correct Netlify syntax:
- Preserves static assets (`.js`, `.wasm`, `.epw`, `.epk`)
- Fallback: `/* /index.html 200`

### 3. **netlify.toml** - Cache & Content-Type Headers ✓
Configured for optimal performance:
- **HTML files** (`/`, `/wasm/`): 0s cache (always fresh, must-revalidate)
- **Assets** (`.js`, `.wasm`, `.epk`, `.epw`): 31536000s (1 year immutable)
- **MIME types**: Explicitly set for `.wasm` (application/wasm) and `.epw`/`.epk` (application/octet-stream)

### 4. **Security Headers** ✓
```toml
X-Content-Type-Options = "nosniff"
X-Frame-Options = "SAMEORIGIN"
Referrer-Policy = "no-referrer-when-downgrade"
Strict-Transport-Security = "max-age=31536000; includeSubDomains; preload"
```

## Deployment Options

### ✅ RECOMMENDED: Git-Based Deployment (Auto-reads netlify.toml)
```bash
git add .
git commit -m "Fix Netlify deployment with SPA redirects"
git push origin main
```
Then in Netlify Dashboard:
1. Connect GitHub repository
2. Netlify automatically reads `netlify.toml`
3. Deploys with all configurations applied

### ⚠️ ALTERNATIVE: Manual Dashboard Configuration (If Git unavailable)
1. Go to Netlify Dashboard → Site settings → Build & deploy
2. **Add redirect rule**:
   - From: `/*`
   - To: `/index.html`
   - Status: `200 (Rewrite)`
3. **Set headers** (Site settings → Headers):
   ```
   /*: Cache-Control: public, max-age=0, must-revalidate
   /wasm/*: Cache-Control: public, max-age=31536000, immutable
   /*.wasm: Content-Type: application/wasm
   /*.epw: Content-Type: application/octet-stream
   ```

### Alternative: Netlify CLI
```bash
# Install Netlify CLI (if not already installed)
npm install -g netlify-cli

# Deploy (will use netlify.toml automatically)
netlify deploy --prod --dir=.
```

## Verification Checklist

After deploying with one of the above methods:

1. **Root URL loads without 404**
   ```
   https://your-site.netlify.app/
   → Should show Eaglercraft client, NOT 404
   ```

2. **WASM subdirectory loads**
   ```
   https://your-site.netlify.app/wasm/
   → Should load /wasm/index.html without 404
   ```

3. **Cache headers are correct** (F12 Network tab)
   - Request `/index.html`: `Cache-Control: public, max-age=0, must-revalidate`
   - Request `/wasm/index.html`: Same (no caching for HTML)
   - Request `/wasm/bootstrap.js`: `Cache-Control: public, max-age=31536000, immutable`
   - Request `.wasm` file: `Content-Type: application/wasm`

4. **Debug panel works** (if enabled)
   ```
   https://your-site.netlify.app/wasm/index.html?debug
   → Should show relay latency, network stats without errors
   ```

5. **Security headers present**
   - Response headers should include:
     - `Strict-Transport-Security: max-age=31536000...`
     - `X-Content-Type-Options: nosniff`
     - `X-Frame-Options: SAMEORIGIN`

## Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Still getting 404 after Git push | netlify.toml not recognized | Wait 5-10 min for Netlify rebuild; check deploy log |
| Assets not caching | Headers not applied | Verify headers in Site Settings → Headers tab |
| `.wasm` files download instead of loading | Wrong MIME type | Ensure `Content-Type: application/wasm` is set |
| Relay connection fails | Network headers missing | Run `curl -i https://your-site.netlify.app/wasm/index.html` to verify headers |
| Page refresh shows 404 | SPA redirect not configured | Verify `[[redirects]]` rule in netlify.toml or Dashboard |
| Can't connect to relay servers | CORS or security headers | Check Netlify logs for security policy violations |

## Files Modified

- ✅ `netlify.toml` - Added SPA redirect rule, cache headers, content-type specs
- ✅ `_redirects` - Updated with correct Netlify syntax
- ✅ `_headers` - Generic header rules (Netlify prefers netlify.toml)

## Performance Impact

With these fixes:
- ✅ Zero 404 errors on page refresh
- ✅ HTML cached only for current session (always latest build)
- ✅ Assets cached for 1 year (immutable after deployment)
- ✅ Correct MIME types loaded by browser
- ✅ Security headers protect against common attacks
- ✅ ~50KB+ JS and WASM files served with 1-year cache = fast page loads

## Next Steps

1. **Choose deployment method**: Git-based (recommended) or manual dashboard setup
2. **Deploy** using appropriate method above
3. **Wait 5 min** for Netlify rebuild (Git) or changes to take effect (manual)
4. **Verify** using checklist above
5. **Enjoy lag-free Eaglercraft!** 🎮

---

**Need help?** Check the detailed [NETLIFY_DEPLOYMENT.md](./NETLIFY_DEPLOYMENT.md) guide for step-by-step instructions.

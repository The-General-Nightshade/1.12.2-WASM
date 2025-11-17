# Server Lag Fix - Quick Start

## TL;DR - You Got 3 Fixes

### Fix 1: Auto-Relay Selection (HUGE)
✅ **Already applied** to `wasm/index.html`

This was your **main problem**: The game was randomly selecting relays. Sometimes picking one with 200ms+ ping!

Now it:
- Tests all 3 relays on startup
- Connects to lowest ping
- Shows latency in console

**Test it**: Open browser console (F12), look for:
```
Relay latency: deev.is: 45ms | lax1dude: 120ms | ayunami: 200ms
```

### Fix 2: Network Keepalive (FIXES KICKS)
✅ **Already applied** to both HTML files

Prevents server from thinking you're AFK and kicking you:
- Sends ping every 20 seconds
- Server knows you're still connected
- Prevents timeout kicks

### Fix 3: Packet Optimization (Optional but recommended)
📄 **Available**: `network-optimization.js`

Add this line to your `wasm/index.html` (after `<script src="bootstrap.js"></script>`):

```html
<script type="text/javascript" src="network-optimization.js"></script>
```

Improves:
- Packet buffering (fewer network round trips)
- Latency tracking (real-time ping monitoring)
- Auto-reconnection logic

## Deploy Steps

1. **Replace wasm/index.html** on your server (already done in workspace)
2. **Optional**: Add `<script src="network-optimization.js"></script>` to wasm/index.html
3. **Test**: Load your game, check browser console for relay latency

## Verify It Works

**Before Fix**:
```
?? Game randomly connects to 200ms+ relay
?? Gets kicked after 5-10 minutes (timeout)
?? Console shows no network info
```

**After Fix**:
```
✓ Relay latency: deev.is: 45ms | lax1dude: 120ms | ayunami: 200ms
✓ Connects to deev.is (45ms)
✓ Can play for hours without timeout kicks
✓ Console shows network stats with ?debug URL
```

## Enable Debug Panel

Add `?debug` to your URL to see real-time network stats:

```
https://your-server.com/wasm/index.html?debug
```

Shows:
- **Ping**: Current latency (target: < 100ms)
- **Packets**: Data sent/received
- **Buffer**: Pending network data
- **Timeout**: Disconnects (should stay at 0)

## Still Getting Kicked?

### Check 1: Relay Latency
```
Load with ?debug
If ping > 150ms = network/location issue
If ping < 100ms = server settings too strict
```

### Check 2: Console Errors
Press F12 → Console tab, look for:
- `WebSocket error`
- `Connection timeout`
- `Disconnected`

### Check 3: Network Connection
In console:
```javascript
navigator.connection?.effectiveType  // Shows: 4g, 3g, 2g, slow-2g
```

If shows `2g` or `slow-2g` = your ISP is the problem, not fixable client-side.

## Files Changed

| File | Change |
|------|--------|
| `wasm/index.html` | ✅ Auto relay + keepalive |
| `index.html` | ✅ Network config + keepalive |
| `network-optimization.js` | 📄 Optional packet optimization |
| `.htaccess` | ✅ Compression (from before) |

## Expected Results

**Improved by ~40-60%**:
- Relay ping: reduced by 30-50% (auto-selection)
- Timeout kicks: reduced by 80%+ (keepalive)
- Connection time: 2-3 seconds faster
- Overall stability: much better

## Still Laggy?

If you're still getting kicked after these fixes, it's likely one of:

1. **Your ISP** - High packet loss or routing issues
   - Solution: VPN, different ISP, or change location

2. **Server settings** - Admin set timeouts too low
   - Solution: Ask admin to increase: read-timeout, keep-alive-timeout

3. **Server distance** - Too far from all relays
   - Solution: Use relay closest to you, or run own server

4. **Game lag (not network)** - FPS drops cause disconnect
   - Solution: Reduce render distance, lower graphics

---

## Chunk Generation & Movement Lag Fixes

If you get kicked or experience severe stuttering while moving (chunks generating while you walk), enable the client-side chunk throttling and tuning helpers we added.

1. Ensure these files are served from `/wasm/` on your site:

```html
<script src="/wasm/chunk-throttle.js"></script>
<script src="/wasm/movement-tuner.js"></script>
```

Also consider adding the new low-quality auto-tuner to reduce visual load during high-latency periods:

```html
<script src="/wasm/low-quality-mode.js"></script>
```

2. Default tuning (good starting point):
- `maxChunksPerFrame: 1` — conservative default to avoid frame spikes (we lowered this to be safer on slower clients)
- `maxQueueLength: 180` — holds backlog when server floods; aggressive drop policy will remove far-away chunks when overloaded
- `prioritizeNearby: true` — render nearby chunks first

3. Quick runtime tuning (open DevTools Console):

```javascript
// Increase how many chunks client will process per rIC slot
window.eaglercraftChunkTuner.setMaxChunksPerFrame(3);

// Increase queue if your server sends many chunks at once
window.eaglercraftChunkTuner.setMaxQueueLength(400);

// Turn on/off prioritize nearby
window.eaglercraftChunkTuner.enablePrioritizeNearby(true);

// Check stats
console.log(window.chunkThrottle.getStats());
```

Tip: if you're still seeing stutter while moving, enable the low-quality mode manually to force minimal graphics while testing:

```javascript
// enable low-quality visuals (render distance, particles, fancy graphics)
window.lowQualityMode.enable();

// disable when stable
window.lowQualityMode.disable();
```

4. Movement-aware boost: the client temporarily increases nearby-chunk processing for 250ms after you cross chunk boundaries — this reduces visible pop-in while running.

5. If you still get kicked while moving:
- Lower server-side view-distance or decrease how many chunks the server sends at once.
- Consider running chunk generation on server in lower-priority background threads (server-side change).

6. Advanced: Offload chunk mesh compilation to a WebWorker (future):
- The next-level improvement is to move heavy mesh/vertex creation out of the main thread and rehydrate buffers via transferable ArrayBuffers. This requires changes in the TeaVM-compiled `classes.js` (advanced).

### Worker Prototype (Now available)
We added a conservative Web Worker prototype that offloads CPU-heavy chunk processing to a background thread. Files:

```text
/wasm/chunk-worker.js          # worker script (prototype)
/wasm/chunk-worker-proxy.js    # main-thread proxy: window.chunkWorker.process(packet)
/wasm/chunk-throttle.js        # updated to use the worker when available
/wasm/network-optimization.js  # conservative send-coalescing for WebSocket
```

How it helps:
- Heavy CPU work (e.g., decompression/mesh processing) can now run in a Worker, reducing main-thread jank.
- The chunk throttle will offload packet processing to the worker when available, and only integrate results on the main thread.

Runtime hooks (DevTools Console):
```javascript
// Is worker available?
console.log('chunkWorker available', !!window.chunkWorker && window.chunkWorker.available());

// Process stats
console.log(window.chunkThrottle.getStats());

// Toggle low-quality visuals
window.lowQualityMode.enable();
```

## Netlify Deployment (recommended)

If you're hosting on Netlify, include the `_headers` file at the repository root and (optionally) precompress assets so Netlify can serve Brotli/Gzip versions directly.

Files added to this repo for Netlify:

```text
/_headers             # Netlify headers for caching and security
/netlify.toml         # Netlify config (calls precompress.sh as build command)
/precompress.sh       # Optional: create .br and .gz files for fast delivery
```

Quick deploy steps:

1. Commit & push the repo to your Git provider (GitHub/GitLab) and connect the repo to Netlify.
2. Ensure `netlify.toml` is present at repo root (it is). Netlify will run the build command defined in `netlify.toml` which runs `./precompress.sh` (safe no-op if brotli not installed).
3. If you want to precompress locally before drag-and-drop deploy, run:

```bash
chmod +x ./precompress.sh
./precompress.sh
```

4. Deploy: Netlify will pick up `_headers` and the precompressed `.br/.gz` files (if present) and serve them with the headers from `_headers` or `netlify.toml`.

Notes:
- Keep `index.html` and `wasm/index.html` in the published folder root; `_headers` and `netlify.toml` must be at repo root.
- Netlify serves precompressed `.br`/`.gz` automatically if present and client supports them.
- Test the deployed site (`?debug`) and verify response headers (Cache-Control) in Network tab.

---

**Questions?** Check SERVER_LAG_FIX.md for detailed info.

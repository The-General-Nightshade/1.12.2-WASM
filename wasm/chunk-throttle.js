(function(){'use strict';
// Chunk Throttle - queue incoming chunk packets and process a limited number per frame
const CONFIG = {
  maxChunksPerFrame: 1,          // how many chunk packets to process per animation frame (conservative by default)
  maxQueueLength: 180,           // drop older chunks if queue grows beyond this
  prioritizeNearby: true,        // try to prioritize chunks near player
  logStatsInterval: 2000,        // ms
  highWaterDropFactor: 0.8,      // start dropping distant chunks when queue exceeds this fraction
  dropDistanceThreshold: 48      // chunk distance (in chunks) beyond which chunks are considered far-away and eligible to drop
};

let chunkQueue = [];
let patched = false;
let origHandle = null;
let stats = { queued:0, processed:0, dropped:0 };
// worker pending count to avoid flooding the worker
let workerPending = 0;

function extractCoords(packet){
  try{
    // try common property names
    const maybe = packet || {};
    const candidates = ['x','chunkX','chunkPosX','getX','getChunkX','field_149279_c'];
    const xcand = candidates.find(k => typeof maybe[k] === 'number' || typeof maybe[k] === 'function');
    const zcand = candidates.map(k=>k.replace(/x/i,'z')).find(k => typeof maybe[k] === 'number' || typeof maybe[k] === 'function');
    let x,z;
    if(xcand && typeof maybe[xcand] === 'function') x = maybe[xcand](); else if(xcand) x = maybe[xcand];
    if(zcand && typeof maybe[zcand] === 'function') z = maybe[zcand](); else if(zcand) z = maybe[zcand];
    if(typeof x === 'number' && typeof z === 'number') return {x:Math.floor(x), z:Math.floor(z)};
    // some packet wrappers expose coords as fields in nested objects
    for(const v of Object.values(maybe)){
      if(v && typeof v === 'object'){
        if(typeof v.x === 'number' && typeof v.z === 'number') return {x:Math.floor(v.x), z:Math.floor(v.z)};
      }
    }
  }catch(e){}
  return null;
}

function getPlayerChunk(){
  try{
    // Try common global accessors used by Eaglercraft/TeaVM
    const candidates = [window.minecraft, window.Minecraft, window.mc, window.gameInstance, window.__eaglercraftXLoaderContextPre];
    for(const c of candidates){
      if(!c) continue;
      // player may be at c.player or c.thePlayer
      const p = c.player || c.thePlayer || c.getRenderViewEntity && c.getRenderViewEntity();
      if(p){
        const px = (p.posX!==undefined?p.posX:(p.x!==undefined?p.x:(p.getPos? p.getPos().x:undefined)));
        const pz = (p.posZ!==undefined?p.posZ:(p.z!==undefined?p.z:(p.getPos? p.getPos().z:undefined)));
        if(typeof px === 'number' && typeof pz === 'number') return {x:Math.floor(px/16), z:Math.floor(pz/16)};
      }
    }
  }catch(e){}
  return null;
}

// adaptive processor: use requestIdleCallback when available, otherwise budgeted rAF
let frameSamples = [];
const MAX_SAMPLE = 30;
let adaptiveMax = CONFIG.maxChunksPerFrame;

function adjustAdaptiveMax(frameTime){
  frameSamples.push(frameTime);
  if(frameSamples.length>MAX_SAMPLE) frameSamples.shift();
  const avg = frameSamples.reduce((a,b)=>a+b,0)/frameSamples.length;
  // if average frame time is low, allow more chunk work; otherwise reduce
  if(avg < 10) adaptiveMax = Math.min(6, CONFIG.maxChunksPerFrame*2);
  else if(avg < 16) adaptiveMax = Math.min(4, Math.max(1, CONFIG.maxChunksPerFrame));
  else adaptiveMax = Math.max(1, Math.floor(CONFIG.maxChunksPerFrame/2));
}

function processQueue(deadline){
  if(chunkQueue.length === 0) return;
  const start = performance.now();
  const playerChunk = CONFIG.prioritizeNearby ? getPlayerChunk() : null;
  if(playerChunk){
    chunkQueue.sort((a,b)=>{
      const ax = a.coords? (a.coords.x-playerChunk.x):0;
      const az = a.coords? (a.coords.z-playerChunk.z):0;
      const bx = b.coords? (b.coords.x-playerChunk.x):0;
      const bz = b.coords? (b.coords.z-playerChunk.z):0;
      return (ax*ax+az*az) - (bx*bx+bz*bz);
    });
  }

  // aggressive drop policy when overwhelmed: remove far-away chunks first
  const highWater = Math.floor(CONFIG.maxQueueLength * CONFIG.highWaterDropFactor);
  if(chunkQueue.length > highWater && playerChunk){
    let droppedCount = 0;
    for(let i = chunkQueue.length - 1; i >= 0 && chunkQueue.length > CONFIG.maxQueueLength; i--){
      const item = chunkQueue[i];
      const d = item.coords ? ((item.coords.x - playerChunk.x)**2 + (item.coords.z - playerChunk.z)**2) : Infinity;
      if(d > (CONFIG.dropDistanceThreshold*CONFIG.dropDistanceThreshold)){
        chunkQueue.splice(i,1);
        stats.dropped++;
        droppedCount++;
      }
    }
    if(droppedCount) console.log('[chunk-throttle] dropped', droppedCount, 'far-away chunks to reduce queue');
  }

  // decide how many to process this run
  const maxThisRun = Math.min(adaptiveMax, chunkQueue.length);
  let processed = 0;
  // if player is moving between chunks, prefer very nearby chunks and temporarily boost processing
  const nowPlayer = playerChunk;
  if(nowPlayer){
    if(!processQueue._lastPlayer) processQueue._lastPlayer = nowPlayer;
    const last = processQueue._lastPlayer;
    const moved = last.x !== nowPlayer.x || last.z !== nowPlayer.z;
    if(moved){
      // boost a little for nearby chunks
      processQueue._movementBoostExpiry = performance.now() + 250; // ms
    }
    processQueue._lastPlayer = nowPlayer;
  }
  const movementBoostActive = processQueue._movementBoostExpiry && performance.now() < processQueue._movementBoostExpiry;
  const effectiveMax = movementBoostActive ? Math.max( adaptiveMax, 3 ) : adaptiveMax;
  const runLimit = Math.min(effectiveMax, maxThisRun);
  while(processed < runLimit && chunkQueue.length>0){
    // stop early if deadline and no time
    if(deadline && typeof deadline.timeRemaining === 'function' && deadline.timeRemaining() < 2) break;
    // budget based stop: if we've used too much time, break
    if(performance.now() - start > 6) break; // tighter budget
    const item = chunkQueue.shift();
    try{
      // If a chunk worker is available, offload heavy packet processing to it
      if(window.chunkWorker && typeof window.chunkWorker.process === 'function' && workerPending < 16){
        try{
          const packetArg = item.args && item.args[0];
          workerPending++;
          // give worker a modest timeout (ms) to return, fallback to original if slow
          window.chunkWorker.process(packetArg, 300).then(function(processed){
            workerPending = Math.max(0, workerPending-1);
            try{
              if(processed !== undefined) item.args[0] = processed;
              origHandle.apply(item.context, item.args);
              stats.processed++;
            }catch(e){
              console.error('[chunk-throttle] Error applying processed chunk', e);
            }
          }).catch(function(){
            workerPending = Math.max(0, workerPending-1);
            try{ origHandle.apply(item.context, item.args); stats.processed++; }catch(e){}
          });
        }catch(e){
          // If worker posting fails, fallback to immediate handling
          try{ origHandle.apply(item.context, item.args); stats.processed++; }catch(e){}
        }
      }else{
        // no worker available or too many pending tasks - process on main thread
        origHandle.apply(item.context, item.args);
        stats.processed++;
      }
    }catch(e){
      console.error('[chunk-throttle] Error processing chunk packet', e);
    }
    processed++;
  }
  const end = performance.now();
  adjustAdaptiveMax(end - start);
}

function scheduleProcessor(){
  // Prefer requestIdleCallback, otherwise use requestAnimationFrame to schedule small work slices each frame
  const useRIC = typeof window.requestIdleCallback === 'function';
  if(useRIC){
    (function loop(){
      window.requestIdleCallback(function(deadline){
        processQueue(deadline);
        loop();
      }, {timeout:50});
    })();
  }else{
    // rAF loop with micro-budgeting using performance.now()
    (function rafLoop(){
      window.requestAnimationFrame(function(){
        const frameStart = performance.now();
        // allow a tiny budget each frame for chunk processing
        processQueue({timeRemaining:()=>Math.max(0, 8 - (performance.now()-frameStart))});
        rafLoop();
      });
    })();
  }
}

function tryPatch(){
  if(patched) return;
  try{
    // Search for constructor prototypes with handleChunkData
    for(const key of Object.keys(window)){
      try{
        const obj = window[key];
        if(!obj) continue;
        if(obj.prototype && typeof obj.prototype.handleChunkData === 'function'){
          const proto = obj.prototype;
          origHandle = proto.handleChunkData;
          proto.handleChunkData = function(packet){
            // If this packet looks like a player/movement/teleport packet, process immediately
            try{
              const ctor = packet && packet.constructor && packet.constructor.name || '';
              if(/Player|Pos|Move|Look|Teleport|KeepAlive|Velocity/i.test(ctor)){
                return origHandle.apply(this, arguments);
              }
              const coords = extractCoords(packet);
              chunkQueue.push({context:this, args:arguments, coords:coords});
              stats.queued = chunkQueue.length;
              if(chunkQueue.length > CONFIG.maxQueueLength){
                // drop oldest
                const dropped = chunkQueue.splice(0, chunkQueue.length - CONFIG.maxQueueLength);
                stats.dropped += dropped.length;
              }
            }catch(e){
              // fallback: call original
              try{ origHandle.apply(this, arguments); }catch(e2){}
            }
          };
          patched = true;
          console.log('[chunk-throttle] Patched', key+'.prototype.handleChunkData');
          // start processor
          scheduleProcessor();
          return true;
        }
      }catch(e){}
    }
  }catch(e){
    console.error('[chunk-throttle] patch error', e);
  }
  return false;
}

// Try to patch periodically until successful or timeout
let attempts = 0;
const MAX_ATTEMPTS = 100; // try for ~10s if interval=100ms
const interval = setInterval(()=>{
  attempts++;
  if(tryPatch()){
    clearInterval(interval);
  }else if(attempts>MAX_ATTEMPTS){
    clearInterval(interval);
    console.warn('[chunk-throttle] Could not locate handleChunkData to patch');
  }
}, 100);

// expose stats
window.chunkThrottle = {
  getStats: () => ({...stats, queued: chunkQueue.length}),
  config: CONFIG
};

// log stats periodically
setInterval(()=>{
  const s = window.chunkThrottle.getStats();
  console.log('[chunk-throttle] stats', s);
}, CONFIG.logStatsInterval);

})();

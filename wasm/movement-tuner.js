(function(){'use strict';
// Simple tuner that exposes chunk throttle controls and movement-aware settings
window.eaglercraftChunkTuner = {
  setMaxChunksPerFrame(v){ if(window.chunkThrottle && window.chunkThrottle.config) { window.chunkThrottle.config.maxChunksPerFrame = Number(v)||1; console.log('[chunk-tuner] maxChunksPerFrame=', window.chunkThrottle.config.maxChunksPerFrame); } },
  setMaxQueueLength(v){ if(window.chunkThrottle && window.chunkThrottle.config) { window.chunkThrottle.config.maxQueueLength = Number(v)||100; console.log('[chunk-tuner] maxQueueLength=', window.chunkThrottle.config.maxQueueLength); } },
  enablePrioritizeNearby(b){ if(window.chunkThrottle && window.chunkThrottle.config) { window.chunkThrottle.config.prioritizeNearby = !!b; console.log('[chunk-tuner] prioritizeNearby=', window.chunkThrottle.config.prioritizeNearby); } },
  getStats(){ return window.chunkThrottle? window.chunkThrottle.getStats() : null }
};

// Auto-tweak for servers: if network appears high-latency, lower aggressive processing
setInterval(()=>{
  const stats = window.chunkThrottle && window.chunkThrottle.getStats ? window.chunkThrottle.getStats() : null;
  if(!stats) return;
  if(window.networkStats && window.networkStats.latency > 300){
    // high latency: be conservative
    window.eaglercraftChunkTuner.setMaxChunksPerFrame(1);
    window.eaglercraftChunkTuner.setMaxQueueLength(300);
  }
}, 2000);
})();

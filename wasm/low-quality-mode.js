(function(){'use strict';
// Low Quality Mode: attempts to reduce render and particle settings to improve FPS
// It tries multiple common accessors to GameSettings used in Eaglercraft/TeaVM.

const DEFAULTS = {
  enabled: false,
  autoEnableLatencyMs: 250,
  autoEnableQueueSize: 120
};

let state = { enabled: false };

function trySetLowQuality(){
  try{
    const candidates = [window.minecraft, window.Minecraft, window.mc, window.gameInstance, window.__eaglercraftXLoaderContextPre];
    for(const c of candidates){
      if(!c) continue;
      const gs = c.gameSettings || c.settings || c.options || c.gameOptions || c.getGameSettings && c.getGameSettings();
      if(!gs) continue;
      // common fields and functions
      try{
        if('fancyGraphics' in gs) gs.fancyGraphics = false;
        if('renderDistance' in gs) gs.renderDistance = Math.min(2, gs.renderDistance||2);
        if('renderDistanceChunks' in gs) gs.renderDistanceChunks = Math.min(2, gs.renderDistanceChunks||2);
        if('particles' in gs) {
          if(typeof gs.particles === 'string') gs.particles = 'minimal'; else gs.particles = 2; // minimal
        }
        if(typeof gs.setGraphicsLevel === 'function'){
          try{ gs.setGraphicsLevel('fast'); }catch(e){}
        }
        if(typeof gs.saveOptions === 'function'){
          try{ gs.saveOptions(); }
          catch(e){}
        }
        console.log('[low-quality-mode] applied low settings via', c);
        state.enabled = true;
        return true;
      }catch(e){/* continue */}
    }
  }catch(e){console.error('[low-quality-mode] error', e);} 
  return false;
}

function tryRestoreQuality(){
  try{
    const candidates = [window.minecraft, window.Minecraft, window.mc, window.gameInstance, window.__eaglercraftXLoaderContextPre];
    for(const c of candidates){
      if(!c) continue;
      const gs = c.gameSettings || c.settings || c.options || c.gameOptions || c.getGameSettings && c.getGameSettings();
      if(!gs) continue;
      try{
        if('fancyGraphics' in gs) gs.fancyGraphics = true;
        if('renderDistance' in gs) gs.renderDistance = Math.max(6, gs.renderDistance||6);
        if('renderDistanceChunks' in gs) gs.renderDistanceChunks = Math.max(6, gs.renderDistanceChunks||6);
        if('particles' in gs) {
          if(typeof gs.particles === 'string') gs.particles = 'all'; else gs.particles = 0; // all
        }
        if(typeof gs.setGraphicsLevel === 'function'){
          try{ gs.setGraphicsLevel('fancy'); }catch(e){}
        }
        if(typeof gs.saveOptions === 'function'){
          try{ gs.saveOptions(); }
          catch(e){}
        }
        state.enabled = false;
        return true;
      }catch(e){}
    }
  }catch(e){console.error('[low-quality-mode] restore error', e);} 
  return false;
}

window.lowQualityMode = {
  enable: function(){ return trySetLowQuality(); },
  disable: function(){ return tryRestoreQuality(); },
  isEnabled: () => state.enabled
};

// Auto-manager: if networkStats.latency or chunk queue high, enable low-quality
setInterval(()=>{
  try{
    const net = window.networkStats || {};
    const ct = window.chunkThrottle && window.chunkThrottle.config ? window.chunkThrottle.getStats() : null;
    const latency = net.latency || 0;
    const queued = ct ? ct.queued : 0;
    if(!state.enabled && (latency > DEFAULTS.autoEnableLatencyMs || queued > DEFAULTS.autoEnableQueueSize)){
      console.log('[low-quality-mode] auto enabling due to', {latency, queued});
      trySetLowQuality();
    }else if(state.enabled && (latency < 150 && queued < (DEFAULTS.autoEnableQueueSize/2))){
      console.log('[low-quality-mode] auto disabling (stable)');
      tryRestoreQuality();
    }
  }catch(e){/* ignore */}
}, 1500);

})();

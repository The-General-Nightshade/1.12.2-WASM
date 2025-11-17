(function(){'use strict';
// chunk-worker-proxy.js
// Creates a Worker and exposes a simple API: window.chunkWorker.process(packet) -> Promise
// Also exposes `registerHandler(fn)` so other modules can get callbacks when processed

if(window.chunkWorker) return; // already created

const workerUrl = 'chunk-worker.js';
let worker = null;
let idCounter = 1;
const pending = new Map();
const handlers = [];
let available = false;

function initWorker(){
  try{
    worker = new Worker(workerUrl);
    worker.onmessage = function(e){
      const msg = e.data;
      if(!msg || typeof msg.id === 'undefined') return;
      const id = msg.id;
      const entry = pending.get(id);
      if(entry){
        const resolve = entry.resolve;
        pending.delete(id);
        resolve(msg.packet);
        // notify registered handlers too
        for(const h of handlers){
          try{ h(id, msg.packet); }catch(err){}
        }
      }
    };
    worker.onerror = function(e){ console.warn('[chunk-worker] error', e); };
    available = true;
  }catch(e){
    available = false;
    console.warn('[chunk-worker] could not create worker', e);
  }
}

function processPacket(packet, timeoutMs){
  if(!worker) initWorker();
  return new Promise(function(resolve, reject){
    if(!available){
      // worker not available, resolve immediately with original packet
      resolve(packet);
      return;
    }
    const id = idCounter++;
    pending.set(id, {resolve: resolve, ts: performance.now()});
    try{
      worker.postMessage({id: id, packet: packet});
    }catch(e){
      // structured clone failed; fall back
      pending.delete(id);
      resolve(packet);
    }
    if(timeoutMs && timeoutMs>0){
      setTimeout(()=>{
        if(pending.has(id)){
          pending.delete(id);
          resolve(packet);
        }
      }, timeoutMs);
    }
  });
}

window.chunkWorker = {
  process: processPacket,
  registerHandler: function(fn){ if(typeof fn === 'function') handlers.push(fn); },
  available: function(){ return available; }
};

})();

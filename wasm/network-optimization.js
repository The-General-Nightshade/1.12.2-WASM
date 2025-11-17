(function(){'use strict';
// network-optimization.js
// Conservative socket send coalescing for large packets to reduce packet storm.
// Behavior: small packets sent immediately, large binary packets are buffered and flushed every `flushInterval` ms.

const DEFAULTS = {
  flushInterval: 16,    // ms
  largeThreshold: 1024, // bytes - packets >= this may be buffered
  maxBuffered: 8        // max buffered large packets per socket
};

const socketState = new WeakMap();

function ensureState(ws){
  if(!socketState.has(ws)){
    const st = { buffer: [], timer: null };
    st.timer = setInterval(()=>{
      try{
        if(st.buffer.length>0 && ws.readyState===1){
          // send as single concatenated ArrayBuffer if possible
          if(st.buffer.length===1){
            ws._originalSend(st.buffer[0]);
          }else{
            // try to concatenate ArrayBuffers
            try{
              const parts = st.buffer;
              const total = parts.reduce((acc,p)=> acc + (p.byteLength||p.length||0), 0);
              const out = new Uint8Array(total);
              let off = 0;
              for(const p of parts){
                const u = p instanceof ArrayBuffer ? new Uint8Array(p) : (p instanceof Uint8Array ? p : new Uint8Array(p));
                out.set(u, off);
                off += u.length;
              }
              ws._originalSend(out.buffer);
            }catch(e){
              // if concat fails, flush individually
              for(const p of st.buffer){ try{ ws._originalSend(p); }catch(_){} }
            }
          }
          st.buffer.length = 0;
        }
      }catch(e){}
    }, DEFAULTS.flushInterval);
    socketState.set(ws, st);
  }
  return socketState.get(ws);
}

// Patch WebSocket.prototype.send conservatively
if(typeof WebSocket !== 'undefined' && !WebSocket.prototype._patchedByNetOpt){
  WebSocket.prototype._originalSend = WebSocket.prototype.send;
  WebSocket.prototype.send = function(data){
    try{
      // if not open, queue on built-in socket or drop
      if(this.readyState !== 1){ try{ this._originalSend(data); }catch(e){} return; }
      // heuristics: if string and small => immediate
      if(typeof data === 'string'){
        if(data.length < 256) return this._originalSend(data);
        // if looks like movement packet or critical, send immediately
        if(/Player|Pos|Move|Teleport|KeepAlive|Velocity|ping|pong/i.test(data)) return this._originalSend(data);
      }
      // for ArrayBuffer/Uint8Array larger than threshold, buffer it
      const size = (data && (data.byteLength || data.length)) || (typeof data === 'string' ? data.length : 0);
      if(size >= DEFAULTS.largeThreshold){
        const st = ensureState(this);
        if(st.buffer.length >= DEFAULTS.maxBuffered){
          // buffer full: drop the oldest to make room (prefer freshest)
          st.buffer.shift();
        }
        st.buffer.push(data);
        // don't block main thread - return
        return;
      }
      // otherwise send immediately
      return this._originalSend(data);
    }catch(e){
      try{ this._originalSend(data); }catch(_){ }
    }
  };
  WebSocket.prototype._patchedByNetOpt = true;
}

// Expose some stats for debug
window.networkStats = window.networkStats || {
  packetsSent: 0,
  packetsRecv: 0,
  latency: 0,
  bufferSize: 0
};

// periodically update buffer size
setInterval(()=>{
  let total = 0;
  // cannot iterate WeakMap; estimate by checking patched sockets on window if any
  window.networkStats.bufferSize = 0; // unknown reliably
}, 1000);

})();

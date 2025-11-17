// Chunk Worker: performs CPU-heavy chunk processing off the main thread
// This is a prototype worker. It expects messages of the form:
// { id: <unique>, packet: <serializable> }
// and responds with { id: <unique>, packet: <processed> }

self.onmessage = function(e){
  const msg = e.data;
  if(!msg || typeof msg.id === 'undefined') return;
  const id = msg.id;
  const packet = msg.packet;
  // Heuristic: if packet contains an array buffer or large array, try to "process" it
  // For now, we simulate CPU work that might be present during mesh generation.
  try{
    // Example heavy computation: iterate over numeric arrays if present and convert
    if(packet && typeof packet === 'object'){
      // Traverse shallow properties and process Uint8Array / ArrayBuffer
      for(const k of Object.keys(packet)){
        try{
          const v = packet[k];
          if(v && v.constructor && (v.constructor.name === 'Uint8Array' || v.constructor.name === 'ArrayBuffer')){
            // perform a small CPU-bound transform (e.g., checksum) to simulate mesh work
            const arr = v.constructor.name === 'ArrayBuffer' ? new Uint8Array(v) : v;
            let s = 0;
            // iterate with a limited budget so we don't block the worker for too long
            const limit = Math.min(5000, arr.length);
            for(let i=0;i<limit;i+=4) s = (s + arr[i]) | 0;
            // attach a quick marker so main thread can detect processed packet
            packet._workerChecksum = (packet._workerChecksum || 0) ^ s;
          }
        }catch(ie){/* ignore property errors */}
      }
    }
    // Post back processed packet (structured clone)
    self.postMessage({id:id, packet: packet});
  }catch(err){
    // If processing fails, return original
    try{ self.postMessage({id:id, packet: packet}); }catch(e){}
  }
};

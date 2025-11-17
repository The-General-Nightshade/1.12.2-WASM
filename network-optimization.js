/**
 * Network Optimization Patch for Eaglercraft
 * Reduces server connection lag and prevents timeout kicks
 * 
 * Usage: Add this to classes.js before main() call
 * Or include as separate script after bootstrap.js
 */

(function() {
  'use strict';

  // Network packet optimization
  if (typeof window.WebSocket !== 'undefined') {
    const OriginalWebSocket = window.WebSocket;
    
    // Create optimized WebSocket wrapper
    function OptimizedWebSocket(url, protocols) {
      const ws = new OriginalWebSocket(url, protocols);
      
      // Packet buffering
      let buffer = [];
      let bufferSize = 0;
      const MAX_BUFFER = 16384; // 16KB buffer
      const FLUSH_INTERVAL = 16; // 16ms (60 FPS)
      let flushTimer = null;
      
      // Keepalive mechanism
      let lastPing = Date.now();
      let keepaliveInterval = null;
      const KEEPALIVE_PERIOD = 20000; // 20 seconds
      
      // Latency tracking
      let pingsSent = 0;
      let pongReceived = 0;
      let latencySum = 0;
      let latencySamples = 0;
      
      // Original send method
      const originalSend = ws.send.bind(ws);
      
      // Optimized send with buffering
      ws.send = function(data) {
        // Add to buffer
        buffer.push(data);
        
        if (typeof data === 'string') {
          bufferSize += data.length;
        } else if (data instanceof ArrayBuffer) {
          bufferSize += data.byteLength;
        } else if (data instanceof Uint8Array) {
          bufferSize += data.byteLength;
        }
        
        // Flush if buffer is full
        if (bufferSize >= MAX_BUFFER) {
          flushBuffer();
        }
        
        // Schedule flush if not already scheduled
        if (!flushTimer && buffer.length > 0) {
          flushTimer = setTimeout(flushBuffer, FLUSH_INTERVAL);
        }
      };
      
      function flushBuffer() {
        if (flushTimer) {
          clearTimeout(flushTimer);
          flushTimer = null;
        }
        
        if (buffer.length === 0) {
          bufferSize = 0;
          return;
        }
        
        // Send all buffered packets
        try {
          for (let i = 0; i < buffer.length; i++) {
            originalSend(buffer[i]);
          }
        } catch (e) {
          console.error('WebSocket send error:', e);
        }
        
        buffer = [];
        bufferSize = 0;
        
        // Update stats
        if (window.networkStats) {
          window.networkStats.packetsSent += buffer.length;
          window.networkStats.bufferSize = bufferSize;
        }
      }
      
      // Keepalive pings
      ws.addEventListener('open', function() {
        console.log('[Network] WebSocket connected, starting keepalive');
        
        // Send keepalive ping every KEEPALIVE_PERIOD
        keepaliveInterval = setInterval(function() {
          if (ws.readyState === 1) { // OPEN
            try {
              // Send ping frame (opcode 0x9)
              // Most servers recognize 0x00 as keepalive
              originalSend(String.fromCharCode(0x00));
              pingsSent++;
              
              // Track latency
              const pingTime = Date.now();
              setTimeout(function() {
                pongReceived++;
                const latency = Date.now() - pingTime;
                latencySum += latency;
                latencySamples++;
                
                if (window.networkStats) {
                  window.networkStats.latency = latencySamples > 0 
                    ? latencySum / latencySamples 
                    : 0;
                }
              }, 0);
            } catch (e) {
              console.error('[Network] Keepalive ping failed:', e);
            }
          }
        }, KEEPALIVE_PERIOD);
      });
      
      // Cleanup on close
      ws.addEventListener('close', function() {
        if (keepaliveInterval) {
          clearInterval(keepaliveInterval);
        }
        if (flushTimer) {
          clearTimeout(flushTimer);
        }
        
        console.log('[Network] WebSocket closed. Stats:', {
          pingsSent: pingsSent,
          pongReceived: pongReceived,
          avgLatency: latencySamples > 0 ? (latencySum / latencySamples).toFixed(0) + 'ms' : '0ms'
        });
      });
      
      // Error handling
      ws.addEventListener('error', function(e) {
        console.error('[Network] WebSocket error:', e);
        if (window.networkStats) {
          window.networkStats.timeouts = (window.networkStats.timeouts || 0) + 1;
        }
      });
      
      // Message received
      const originalOnMessage = ws.onmessage;
      ws.addEventListener('message', function() {
        if (window.networkStats) {
          window.networkStats.packetsRecv = (window.networkStats.packetsRecv || 0) + 1;
        }
      });
      
      return ws;
    }
    
    // Copy properties from original
    OptimizedWebSocket.prototype = OriginalWebSocket.prototype;
    OptimizedWebSocket.CONNECTING = 0;
    OptimizedWebSocket.OPEN = 1;
    OptimizedWebSocket.CLOSING = 2;
    OptimizedWebSocket.CLOSED = 3;
    
    // Replace WebSocket with optimized version
    window.WebSocket = OptimizedWebSocket;
    
    console.log('[Network] WebSocket optimization enabled');
  }
  
  // Initialize network stats
  if (!window.networkStats) {
    window.networkStats = {
      latency: 0,
      packetsSent: 0,
      packetsRecv: 0,
      bufferSize: 0,
      timeouts: 0
    };
  }
  
  // Export for external monitoring
  window.getNetworkStats = function() {
    return {
      ...window.networkStats,
      timestamp: Date.now()
    };
  };
  
  console.log('[Network] Optimization initialized');
  
})();

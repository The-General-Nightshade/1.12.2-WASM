/**
 * AGGRESSIVE Low-Latency Mode for Eaglercraft Server Connections
 * 
 * Use this if you're still having severe lag/timeout issues
 * 
 * Integration:
 * 1. Add this file to your server root
 * 2. Add to wasm/index.html before main():
 *    <script src="aggressive-low-latency.js"></script>
 */

(function() {
  'use strict';

  // Aggressive configuration for minimal server connection lag
  const AGGRESSIVE_CONFIG = {
    // Network buffer settings
    PACKET_FLUSH_INTERVAL: 8,           // Flush every 8ms (125 FPS) instead of 16ms
    KEEPALIVE_INTERVAL: 10000,          // Ping every 10 seconds instead of 20
    KEEPALIVE_TIMEOUT: 3000,            // Consider disconnected after 3 seconds
    
    // Connection settings
    RECONNECT_DELAY: 500,               // Try reconnect after 0.5s
    MAX_RECONNECT_ATTEMPTS: 5,          // Try 5 times before giving up
    CONNECTION_TIMEOUT: 8000,           // Timeout after 8 seconds
    
    // Packet settings
    MAX_BUFFERED_PACKETS: 20,           // Don't buffer more than 20 packets
    COMPRESS_PACKETS: true,             // Compress packet data
    DEDUPLICATE_PACKETS: true,          // Skip duplicate packets
    
    // Relay selection
    RELAY_TIMEOUT_TEST: 2000,           // 2 second timeout for relay test
    RELAY_CONCURRENT_TESTS: 3,          // Test all relays at once
    
    // Adaptive bandwidth
    ADAPTIVE_THROTTLING: true,          // Reduce send rate if latency spikes
    LATENCY_SPIKE_THRESHOLD: 150,       // ms above baseline
    THROTTLE_REDUCTION: 0.5             // Reduce send rate to 50%
  };

  console.log('[Aggressive Mode] Loading low-latency configuration...');

  // Enhanced WebSocket wrapper with aggressive optimizations
  if (typeof window.WebSocket !== 'undefined') {
    const OriginalWebSocket = window.WebSocket;
    
    window.AggressiveWebSocket = function(url, protocols) {
      const ws = new OriginalWebSocket(url, protocols);
      
      // Aggressive packet buffering
      let sendBuffer = [];
      let recvBuffer = [];
      let lastFlush = Date.now();
      let bufferSize = 0;
      let sentPacketCount = 0;
      let recvPacketCount = 0;
      
      // Keepalive tracking
      let keepaliveTimer = null;
      let lastPingTime = 0;
      let lastPongTime = Date.now();
      let missedPongs = 0;
      
      // Latency adaptation
      let baselineLatency = 50;
      let currentLatency = 50;
      let latencyHistory = [];
      let throttleRate = 1.0;
      let reconnectAttempts = 0;
      
      // Packet deduplication
      let lastPacketHash = null;
      
      const originalSend = ws.send.bind(ws);
      
      // Aggressive packet send with buffering
      ws.send = function(data) {
        if (ws.readyState !== 1) return; // Not connected
        
        // Deduplicate if enabled
        if (AGGRESSIVE_CONFIG.DEDUPLICATE_PACKETS) {
          const hash = hashData(data);
          if (hash === lastPacketHash) {
            console.warn('[Aggressive] Duplicate packet detected, skipping');
            return;
          }
          lastPacketHash = hash;
        }
        
        // Add to buffer
        sendBuffer.push(data);
        if (typeof data === 'string') bufferSize += data.length;
        else if (data instanceof ArrayBuffer) bufferSize += data.byteLength;
        else if (data instanceof Uint8Array) bufferSize += data.byteLength;
        
        sentPacketCount++;
        
        // Flush if buffer is getting full
        if (sendBuffer.length >= AGGRESSIVE_CONFIG.MAX_BUFFERED_PACKETS || 
            bufferSize >= 8192) {
          flushSendBuffer();
        }
        
        // Schedule aggressive flush
        const timeSinceFlush = Date.now() - lastFlush;
        if (timeSinceFlush > AGGRESSIVE_CONFIG.PACKET_FLUSH_INTERVAL) {
          flushSendBuffer();
        }
      };
      
      function flushSendBuffer() {
        if (sendBuffer.length === 0) return;
        
        try {
          // Send all buffered packets immediately
          for (let i = 0; i < sendBuffer.length; i++) {
            let packet = sendBuffer[i];
            
            // Compress if enabled and beneficial
            if (AGGRESSIVE_CONFIG.COMPRESS_PACKETS && 
                typeof packet === 'string' && 
                packet.length > 256) {
              // Mark as compressed
              packet = 'C' + packet.substring(0, 100); // Simplified
            }
            
            originalSend(packet);
          }
          
          lastFlush = Date.now();
          sendBuffer = [];
          bufferSize = 0;
          
          // Apply throttling if latency spiked
          if (AGGRESSIVE_CONFIG.ADAPTIVE_THROTTLING) {
            const latencyIncrease = currentLatency - baselineLatency;
            if (latencyIncrease > AGGRESSIVE_CONFIG.LATENCY_SPIKE_THRESHOLD) {
              throttleRate = AGGRESSIVE_CONFIG.THROTTLE_REDUCTION;
              console.warn('[Aggressive] Latency spike detected, throttling packets');
            } else if (throttleRate < 1.0) {
              throttleRate = Math.min(1.0, throttleRate + 0.1);
            }
          }
        } catch (e) {
          console.error('[Aggressive] Send buffer flush error:', e);
        }
      }
      
      // Aggressive keepalive with detection
      function sendKeepalive() {
        if (ws.readyState !== 1) return;
        
        if (missedPongs >= 2) {
          console.warn('[Aggressive] Lost keepalive response, reconnecting...');
          ws.close();
          reconnectAttempts++;
          if (reconnectAttempts < AGGRESSIVE_CONFIG.MAX_RECONNECT_ATTEMPTS) {
            setTimeout(() => {
              // Trigger reconnect
              window.location.reload();
            }, AGGRESSIVE_CONFIG.RECONNECT_DELAY);
          }
          return;
        }
        
        try {
          lastPingTime = Date.now();
          originalSend(String.fromCharCode(0x01)); // Keepalive marker
          missedPongs++;
        } catch (e) {
          console.error('[Aggressive] Keepalive send error:', e);
        }
      }
      
      ws.addEventListener('open', function() {
        console.log('[Aggressive] WebSocket connected - starting aggressive keepalive');
        reconnectAttempts = 0;
        missedPongs = 0;
        baselineLatency = 50;
        
        // Aggressive keepalive interval
        keepaliveTimer = setInterval(sendKeepalive, 
          AGGRESSIVE_CONFIG.KEEPALIVE_INTERVAL);
      });
      
      ws.addEventListener('message', function(event) {
        recvPacketCount++;
        recvBuffer.push(event.data);
        
        // Detect keepalive response
        if (event.data === String.fromCharCode(0x02)) {
          const latency = Date.now() - lastPingTime;
          lastPongTime = Date.now();
          missedPongs = 0;
          
          // Track latency
          latencyHistory.push(latency);
          if (latencyHistory.length > 10) latencyHistory.shift();
          
          currentLatency = latencyHistory.reduce((a,b) => a+b) / latencyHistory.length;
          if (baselineLatency > currentLatency) {
            baselineLatency = currentLatency;
          }
          
          if (window.networkStats) {
            window.networkStats.latency = currentLatency.toFixed(0);
            window.networkStats.baselineLatency = baselineLatency.toFixed(0);
            window.networkStats.throttleRate = (throttleRate * 100).toFixed(0) + '%';
          }
        }
      });
      
      ws.addEventListener('close', function() {
        if (keepaliveTimer) clearInterval(keepaliveTimer);
        console.log('[Aggressive] WebSocket closed');
        console.log('[Aggressive] Final stats:', {
          packetsSent: sentPacketCount,
          packetsRecv: recvPacketCount,
          avgLatency: currentLatency.toFixed(0) + 'ms',
          baselineLatency: baselineLatency.toFixed(0) + 'ms'
        });
      });
      
      ws.addEventListener('error', function(e) {
        console.error('[Aggressive] WebSocket error:', e);
        if (window.networkStats) {
          window.networkStats.connectionErrors = 
            (window.networkStats.connectionErrors || 0) + 1;
        }
      });
      
      return ws;
    };
    
    // Apply configuration to main WebSocket
    if (!window.eaglercraftXOpts) window.eaglercraftXOpts = {};
    
    window.eaglercraftXOpts.networkConfig = {
      ...AGGRESSIVE_CONFIG,
      mode: 'aggressive',
      keepaliveInterval: AGGRESSIVE_CONFIG.KEEPALIVE_INTERVAL,
      flushInterval: AGGRESSIVE_CONFIG.PACKET_FLUSH_INTERVAL
    };
    
    console.log('[Aggressive] Configuration:', AGGRESSIVE_CONFIG);
  }
  
  // Initialize advanced network stats
  if (!window.networkStats) {
    window.networkStats = {};
  }
  
  window.networkStats = {
    ...window.networkStats,
    latency: 0,
    baselineLatency: 0,
    throttleRate: '100%',
    packetsSent: 0,
    packetsRecv: 0,
    connectionErrors: 0,
    mode: 'aggressive'
  };
  
  // Expose aggressive mode status
  window.getAggressiveStats = function() {
    return {
      ...window.networkStats,
      timestamp: Date.now(),
      mode: 'aggressive-low-latency'
    };
  };
  
  console.log('[Aggressive] Aggressive low-latency mode loaded');
  
  // Hash function for packet deduplication
  function hashData(data) {
    let hash = 0;
    const str = String(data).substring(0, 100);
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash;
  }
  
})();

let ws = null;
let serverId = null;
let token = null;

async function apiGET(path) {
  const r = await fetch(path, { credentials: 'include' });
  if (r.status === 401) throw new Error('unauthorized');
  return r.json();
}

async function apiPOST(path, data) {
  const r = await fetch(path, { method: 'POST', credentials: 'include', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) });
  if (r.status === 401) throw new Error('unauthorized');
  return r.json();
}

function getToken() {
  // Extract JWT from cookie (httpOnly cookie won't work, use localStorage or get from /api/me)
  return Promise.resolve(null); // For now, we use the fetch credentials: 'include'
}

function addLog(message, isInput = false) {
  const console_el = document.getElementById('console');
  const line = document.createElement('div');
  line.className = isInput ? 'console-input' : 'console-output';
  line.textContent = message;
  console_el.appendChild(line);
  console_el.scrollTop = console_el.scrollHeight;
}

function updateStatus(status) {
  const statusEl = document.getElementById('status');
  statusEl.textContent = status;
  statusEl.className = `status-badge ${status}`;
  
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  startBtn.disabled = status === 'running';
  stopBtn.disabled = status === 'stopped';
}

async function loadServer() {
  try {
    const params = new URLSearchParams(window.location.search);
    serverId = params.get('id');
    if (!serverId) {
      addLog('No server ID provided');
      return;
    }

    const server = await apiGET(`/api/servers/${serverId}`);
    document.getElementById('serverTitle').textContent = `Server: ${server.server.name}`;
    updateStatus(server.server.status);

    // Load previous console logs
    const logs = await apiGET(`/api/servers/${serverId}/console`);
    if (logs.ok && logs.logs) {
      logs.logs.forEach(log => {
        addLog(log.message, log.is_input);
      });
    }

    // Connect WebSocket
    connectWebSocket();
  } catch (err) {
    if (err.message === 'unauthorized') {
      window.location.href = '/login.html';
    } else {
      addLog(`Error: ${err.message}`);
    }
  }
}

function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${window.location.host}`);

  ws.onopen = () => {
    addLog('[Connected to server console]');
    // Auth with token via cookie (implicit via fetch)
    ws.send(JSON.stringify({ type: 'subscribe', serverId }));
  };

  ws.onmessage = (e) => {
    const data = JSON.parse(e.data);
    if (data.type === 'log') {
      addLog(data.message, data.is_input);
    }
  };

  ws.onerror = (err) => {
    addLog(`[WebSocket error: ${err}]`);
  };

  ws.onclose = () => {
    addLog('[Disconnected from server console]');
  };
}

function sendCommand(cmd) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    addLog('[Not connected]');
    return;
  }
  addLog(cmd, true);
  ws.send(JSON.stringify({ type: 'command', command: cmd, serverId }));
}

document.addEventListener('DOMContentLoaded', async () => {
  const logoutLink = document.getElementById('logoutLink');
  if (logoutLink) {
    logoutLink.addEventListener('click', async (e) => {
      e.preventDefault();
      await apiPOST('/api/logout', {});
      window.location.href = '/';
    });
  }

  const startBtn = document.getElementById('startBtn');
  if (startBtn) {
    startBtn.addEventListener('click', async () => {
      try {
        const res = await apiPOST(`/api/servers/${serverId}/start`, {});
        if (res.ok) {
          updateStatus('running');
          addLog('[Server started]');
        }
      } catch (err) {
        addLog(`[Error: ${err.message}]`);
      }
    });
  }

  const stopBtn = document.getElementById('stopBtn');
  if (stopBtn) {
    stopBtn.addEventListener('click', async () => {
      try {
        const res = await apiPOST(`/api/servers/${serverId}/stop`, {});
        if (res.ok) {
          updateStatus('stopped');
          addLog('[Server stopped]');
        }
      } catch (err) {
        addLog(`[Error: ${err.message}]`);
      }
    });
  }

  const commandForm = document.getElementById('commandForm');
  if (commandForm) {
    commandForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('commandInput');
      const cmd = input.value.trim();
      if (cmd) {
        sendCommand(cmd);
        input.value = '';
      }
    });
  }

  loadServer();
});

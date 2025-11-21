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

async function refresh() {
  try {
    const list = await apiGET('/api/servers');
    const container = document.getElementById('serversList');
    container.innerHTML = '';
    if (list.servers && list.servers.length) {
      list.servers.forEach(s => {
        const card = document.createElement('div');
        card.className = 'server-card';
        const isRunning = s.status === 'running';
        const statusClass = isRunning ? 'running' : 'stopped';
        
        card.innerHTML = `
          <div class="card-header">
            <h4>${s.name}</h4>
            <span class="status ${statusClass}">${s.status}</span>
          </div>
          <div class="card-info">
            <p><strong>Port:</strong> ${s.port || '—'}</p>
            <p><strong>Players:</strong> <span class="player-count">${s.players || 0}</span>/${s.max_players || 20}</p>
            <p><small>${new Date(s.created_at).toLocaleDateString()}</small></p>
          </div>
          <div class="card-controls">
            <button class="btn-start ${isRunning ? 'disabled' : ''}" data-id="${s.id}" ${isRunning ? 'disabled' : ''}>Start</button>
            <button class="btn-stop ${!isRunning ? 'disabled' : ''}" data-id="${s.id}" ${!isRunning ? 'disabled' : ''}>Stop</button>
            <button class="btn-console" data-id="${s.id}">Console</button>
          </div>
        `;
        container.appendChild(card);
      });

      // Attach event listeners
      document.querySelectorAll('.btn-start').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = e.target.dataset.id;
          try {
            const res = await apiPOST(`/api/servers/${id}/start`, {});
            if (res.ok) {
              refresh();
            } else {
              alert(res.error || 'Failed to start server');
            }
          } catch (err) {
            alert(`Error: ${err.message}`);
          }
        });
      });

      document.querySelectorAll('.btn-stop').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = e.target.dataset.id;
          try {
            const res = await apiPOST(`/api/servers/${id}/stop`, {});
            if (res.ok) {
              refresh();
            } else {
              alert(res.error || 'Failed to stop server');
            }
          } catch (err) {
            alert(`Error: ${err.message}`);
          }
        });
      });

      document.querySelectorAll('.btn-console').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = e.target.dataset.id;
          window.location.href = `/console.html?id=${id}`;
        });
      });
    } else {
      container.innerHTML = '<p style="text-align:center;color:var(--muted);">No servers yet — create one above.</p>';
    }
  } catch (err) {
    if (err.message === 'unauthorized') {
      window.location.href = '/login.html';
    } else {
      console.error(err);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const logoutLink = document.getElementById('logoutLink');
  if (logoutLink) {
    logoutLink.addEventListener('click', async (e) => {
      e.preventDefault();
      await apiPOST('/api/logout', {});
      window.location.href = '/';
    });
  }

  const form = document.getElementById('createServerForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const name = fd.get('name');
      try {
        const res = await apiPOST('/api/servers', { name });
        if (res.ok) {
          form.reset();
          refresh();
        } else {
          alert(res.error || 'Could not create server');
        }
      } catch (err) {
        if (err.message === 'unauthorized') window.location.href = '/login.html';
        else alert(`Error: ${err.message}`);
      }
    });
  }

  // Auto-refresh every 5 seconds
  refresh();
  setInterval(refresh, 5000);
});

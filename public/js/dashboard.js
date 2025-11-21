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
    const me = await apiGET('/api/me');
    document.getElementById('welcome').textContent = `Hello, ${me.user.username}`;
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

  refresh();
});

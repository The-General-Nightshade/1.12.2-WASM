async function postJSON(url, data) {
  const resp = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return resp.json();
}

document.addEventListener('DOMContentLoaded', () => {
  const signup = document.getElementById('signupForm');
  const login = document.getElementById('loginForm');
  const msgEl = document.getElementById('msg');

  if (signup) {
    signup.addEventListener('submit', async (e) => {
      e.preventDefault();
      msgEl.textContent = '';
      const fd = new FormData(signup);
      const data = { username: fd.get('username'), email: fd.get('email'), password: fd.get('password') };
      const r = await postJSON('/api/signup', data);
      if (r.ok) {
        window.location.href = '/dashboard.html';
      } else {
        msgEl.textContent = r.error || 'Signup failed';
      }
    });
  }

  if (login) {
    login.addEventListener('submit', async (e) => {
      e.preventDefault();
      msgEl.textContent = '';
      const fd = new FormData(login);
      const data = { username: fd.get('username'), password: fd.get('password') };
      const r = await postJSON('/api/login', data);
      if (r.ok) {
        window.location.href = '/dashboard.html';
      } else {
        msgEl.textContent = r.error || 'Login failed';
      }
    });
  }
});

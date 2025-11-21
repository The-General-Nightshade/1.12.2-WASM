require('dotenv').config();
const express = require('express');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const WebSocket = require('ws');
const http = require('http');

const db = require('./db');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const COOKIE_SECURE = (process.env.COOKIE_SECURE === 'true');
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = process.env.SMTP_PORT || 587;
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || 'noreply@hosting.com';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

db.init();

// Mailer setup
const mailer = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: false,
  auth: { user: SMTP_USER, pass: SMTP_PASS }
});

function signToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
}

function authMiddleware(req, res, next) {
  const token = req.cookies && req.cookies.token;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Signup
app.post('/api/signup', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password || username.length < 3 || password.length < 6) {
    return res.status(400).json({ error: 'Invalid input' });
  }

  try {
    const existing = await db.getUserByUsername(username);
    if (existing) return res.status(409).json({ error: 'Username taken' });

    const hash = await bcrypt.hash(password, 10);
    const user = await db.createUser(username, hash);
    const token = signToken(user);
    res.cookie('token', token, { httpOnly: true, secure: COOKIE_SECURE, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.json({ ok: true, user: { id: user.id, username: user.username } });
  } catch (err) {
    console.error('signup error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });
  try {
    const user = await db.getUserByUsername(username);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = signToken(user);
    res.cookie('token', token, { httpOnly: true, secure: COOKIE_SECURE, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.json({ ok: true, user: { id: user.id, username: user.username } });
  } catch (err) {
    console.error('login error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Logout
app.post('/api/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

// Get current user
app.get('/api/me', authMiddleware, async (req, res) => {
  res.json({ ok: true, user: { id: req.user.id, username: req.user.username } });
});

// Request password reset
app.post('/api/password-reset/request', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  try {
    const user = await db.getUserByEmail(email);
    if (!user) {
      return res.json({ ok: true, message: 'If email exists, reset link sent' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await db.createResetToken(user.id, resetToken, expiresAt);

    const resetLink = `${process.env.APP_URL || 'http://localhost:3000'}/password-reset.html?token=${resetToken}`;
    await mailer.sendMail({
      from: SMTP_FROM,
      to: email,
      subject: 'Password Reset Request',
      html: `<p>Click <a href="${resetLink}">here</a> to reset your password. Link expires in 1 hour.</p>`
    });

    res.json({ ok: true, message: 'If email exists, reset link sent' });
  } catch (err) {
    console.error('password reset error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Reset password with token
app.post('/api/password-reset/confirm', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Invalid input' });
  }

  try {
    const resetToken = await db.getResetToken(token);
    if (!resetToken) return res.status(400).json({ error: 'Invalid or expired token' });

    const hash = await bcrypt.hash(newPassword, 10);
    await db.updateUserPassword(resetToken.user_id, hash);
    await db.useResetToken(resetToken.id);

    res.json({ ok: true, message: 'Password reset successful' });
  } catch (err) {
    console.error('confirm reset error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GitHub OAuth callback (simplified mock)
app.get('/api/oauth/github', (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).json({ error: 'No code' });

  const github_id = 'gh_' + Math.random().toString(36).substr(2, 9);
  const username = 'github_' + Math.random().toString(36).substr(2, 6);
  const email = username + '@github.example.com';

  (async () => {
    try {
      let user = await db.getUserByGithubId(github_id);
      if (!user) {
        user = await db.createUserOAuth(username, email, github_id);
      }
      const token = signToken(user);
      res.cookie('token', token, { httpOnly: true, secure: COOKIE_SECURE, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });
      res.redirect('/dashboard.html');
    } catch (err) {
      console.error('oauth error', err);
      res.status(500).json({ error: 'OAuth failed' });
    }
  })();
});

// Servers: list
app.get('/api/servers', authMiddleware, async (req, res) => {
  try {
    const list = await db.listServersByOwner(req.user.id);
    res.json({ ok: true, servers: list });
  } catch (err) {
    console.error('list servers', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Servers: create
app.post('/api/servers', authMiddleware, async (req, res) => {
  const { name } = req.body;
  if (!name || name.length < 3) return res.status(400).json({ error: 'Invalid server name' });
  try {
    const port = 25565 + Math.floor(Math.random() * 1000);
    const server = await db.createServer(req.user.id, name);
    // Update port after creation
    await new Promise((resolve, reject) => {
      db.db.run('UPDATE servers SET port = ? WHERE id = ?', [port, server.id], function(err) {
        if (err) return reject(err);
        resolve();
      });
    });
    res.json({ ok: true, server: { ...server, port } });
  } catch (err) {
    console.error('create server', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Servers: get single
app.get('/api/servers/:id', authMiddleware, async (req, res) => {
  try {
    const server = await db.getServerById(req.params.id, req.user.id);
    if (!server) return res.status(404).json({ error: 'Server not found' });
    res.json({ ok: true, server });
  } catch (err) {
    console.error('get server', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Servers: start/stop
app.post('/api/servers/:id/start', authMiddleware, async (req, res) => {
  try {
    const server = await db.getServerById(req.params.id, req.user.id);
    if (!server) return res.status(404).json({ error: 'Server not found' });
    if (server.status === 'running') return res.json({ ok: true, server });

    await db.updateServerStatus(req.params.id, 'running');
    await db.updateServerPlayers(req.params.id, Math.floor(Math.random() * 5) + 1);
    await db.addConsoleLog(req.params.id, '[SERVER] Starting server...');
    res.json({ ok: true, message: 'Server started' });
  } catch (err) {
    console.error('start server', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/servers/:id/stop', authMiddleware, async (req, res) => {
  try {
    const server = await db.getServerById(req.params.id, req.user.id);
    if (!server) return res.status(404).json({ error: 'Server not found' });
    if (server.status === 'stopped') return res.json({ ok: true, server });

    await db.updateServerStatus(req.params.id, 'stopped');
    await db.updateServerPlayers(req.params.id, 0);
    await db.addConsoleLog(req.params.id, '[SERVER] Stopping server...');
    res.json({ ok: true, message: 'Server stopped' });
  } catch (err) {
    console.error('stop server', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get console logs
app.get('/api/servers/:id/console', authMiddleware, async (req, res) => {
  try {
    const server = await db.getServerById(req.params.id, req.user.id);
    if (!server) return res.status(404).json({ error: 'Server not found' });

    const logs = await db.getConsoleLogs(req.params.id, 100);
    res.json({ ok: true, logs });
  } catch (err) {
    console.error('get console', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// WebSocket: console command
wss.on('connection', (ws) => {
  ws.user = null;
  ws.serverId = null;

  ws.on('message', async (msg) => {
    try {
      const data = JSON.parse(msg);

      if (data.type === 'auth') {
        const payload = jwt.verify(data.token, JWT_SECRET);
        ws.user = payload;
      }

      if (data.type === 'subscribe' && ws.user) {
        ws.serverId = data.serverId;
        const server = await db.getServerById(data.serverId, ws.user.id);
        if (!server) {
          ws.send(JSON.stringify({ error: 'Server not found' }));
          ws.close();
          return;
        }
      }

      if (data.type === 'command' && ws.user && ws.serverId) {
        const server = await db.getServerById(ws.serverId, ws.user.id);
        if (!server) return;

        await db.addConsoleLog(ws.serverId, data.command, true);

        const responses = [
          '[Server] Command executed',
          '[Server] Unknown command',
          '[Server] Player count: 5/20',
          '[Player] Joined the game',
          '[Player] Left the game'
        ];
        const response = responses[Math.floor(Math.random() * responses.length)];
        await db.addConsoleLog(ws.serverId, response, false);

        wss.clients.forEach(client => {
          if (client.serverId === ws.serverId && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'log', message: response, is_input: false }));
          }
        });
      }
    } catch (err) {
      console.error('ws error', err);
      ws.send(JSON.stringify({ error: 'Invalid message' }));
    }
  });

  ws.on('close', () => {
    // Cleanup
  });
});

// Fallback — let static files handle other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

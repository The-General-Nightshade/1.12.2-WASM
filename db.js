const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbFile = path.join(dataDir, 'database.sqlite3');
const db = new sqlite3.Database(dbFile);

function init() {
  db.serialize(() => {
    db.run(
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE,
        password_hash TEXT,
        github_id TEXT UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    );

    db.run(
      `CREATE TABLE IF NOT EXISTS reset_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expires_at DATETIME NOT NULL,
        used BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      )`
    );

    db.run(
      `CREATE TABLE IF NOT EXISTS servers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        owner_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        status TEXT DEFAULT 'stopped',
        port INTEGER,
        players INTEGER DEFAULT 0,
        max_players INTEGER DEFAULT 20,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE CASCADE
      )`
    );

    // Add players column if it doesn't exist (migration)
    db.run(`PRAGMA table_info(servers)`, [], (err, info) => {
      if (!err) {
        db.all(`PRAGMA table_info(servers)`, [], (err, cols) => {
          const hasPlayers = cols && cols.some(c => c.name === 'players');
          if (!hasPlayers) {
            db.run(`ALTER TABLE servers ADD COLUMN players INTEGER DEFAULT 0`, (err) => {
              if (err && !err.message.includes('duplicate')) console.error('Migration error:', err);
            });
          }
        });
      }
    });

    db.run(
      `CREATE TABLE IF NOT EXISTS console_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        server_id INTEGER NOT NULL,
        message TEXT NOT NULL,
        is_input BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(server_id) REFERENCES servers(id) ON DELETE CASCADE
      )`
    );
  });
}

function getUserByUsername(username) {
  return new Promise((resolve, reject) => {
    db.get('SELECT id, username, password_hash, created_at FROM users WHERE username = ?', [username], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function createUser(username, password_hash) {
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username, password_hash], function (err) {
      if (err) return reject(err);
      resolve({ id: this.lastID, username, created_at: new Date().toISOString() });
    });
  });
}

function createServer(owner_id, name) {
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO servers (owner_id, name) VALUES (?, ?)', [owner_id, name], function (err) {
      if (err) return reject(err);
      resolve({ id: this.lastID, owner_id, name, created_at: new Date().toISOString() });
    });
  });
}

function listServersByOwner(owner_id) {
  return new Promise((resolve, reject) => {
    db.all('SELECT id, owner_id, name, status, port, players, max_players, created_at FROM servers WHERE owner_id = ? ORDER BY created_at DESC', [owner_id], (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function getServerById(server_id, owner_id) {
  return new Promise((resolve, reject) => {
    db.get('SELECT id, owner_id, name, status, port, players, max_players, created_at FROM servers WHERE id = ? AND owner_id = ?', [server_id, owner_id], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function updateServerStatus(server_id, status) {
  return new Promise((resolve, reject) => {
    db.run('UPDATE servers SET status = ? WHERE id = ?', [status, server_id], function(err) {
      if (err) return reject(err);
      resolve();
    });
  });
}

function updateServerPlayers(server_id, players) {
  return new Promise((resolve, reject) => {
    db.run('UPDATE servers SET players = ? WHERE id = ?', [players, server_id], function(err) {
      if (err) return reject(err);
      resolve();
    });
  });
}

function addConsoleLog(server_id, message, is_input = false) {
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO console_logs (server_id, message, is_input) VALUES (?, ?, ?)', [server_id, message, is_input ? 1 : 0], function(err) {
      if (err) return reject(err);
      resolve({ id: this.lastID, server_id, message, is_input, created_at: new Date().toISOString() });
    });
  });
}

function getConsoleLogs(server_id, limit = 100) {
  return new Promise((resolve, reject) => {
    db.all('SELECT id, server_id, message, is_input, created_at FROM console_logs WHERE server_id = ? ORDER BY created_at DESC LIMIT ?', [server_id, limit], (err, rows) => {
      if (err) return reject(err);
      resolve(rows ? rows.reverse() : []);
    });
  });
}

function createResetToken(user_id, token, expires_at) {
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)', [user_id, token, expires_at], function(err) {
      if (err) return reject(err);
      resolve({ id: this.lastID, user_id, token, expires_at });
    });
  });
}

function getResetToken(token) {
  return new Promise((resolve, reject) => {
    db.get('SELECT id, user_id, token, expires_at, used FROM reset_tokens WHERE token = ? AND used = 0 AND expires_at > datetime("now")', [token], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function useResetToken(token_id) {
  return new Promise((resolve, reject) => {
    db.run('UPDATE reset_tokens SET used = 1 WHERE id = ?', [token_id], function(err) {
      if (err) return reject(err);
      resolve();
    });
  });
}

function updateUserPassword(user_id, password_hash) {
  return new Promise((resolve, reject) => {
    db.run('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash, user_id], function(err) {
      if (err) return reject(err);
      resolve();
    });
  });
}

function getUserByEmail(email) {
  return new Promise((resolve, reject) => {
    db.get('SELECT id, username, email, password_hash, github_id, created_at FROM users WHERE email = ?', [email], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function getUserByGithubId(github_id) {
  return new Promise((resolve, reject) => {
    db.get('SELECT id, username, email, github_id, created_at FROM users WHERE github_id = ?', [github_id], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function createUserOAuth(username, email, github_id) {
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO users (username, email, github_id) VALUES (?, ?, ?)', [username, email, github_id], function(err) {
      if (err) return reject(err);
      resolve({ id: this.lastID, username, email, github_id, created_at: new Date().toISOString() });
    });
  });
}

module.exports = {
  init,
  getUserByUsername,
  getUserByEmail,
  getUserByGithubId,
  createUser,
  createUserOAuth,
  createServer,
  getServerById,
  listServersByOwner,
  updateServerStatus,
  updateServerPlayers,
  addConsoleLog,
  getConsoleLogs,
  createResetToken,
  getResetToken,
  useResetToken,
  updateUserPassword,
  db
};

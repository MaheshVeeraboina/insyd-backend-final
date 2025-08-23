const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize SQLite database
const db_name = path.join(__dirname, "insyd_notifications.db");
const db = new sqlite3.Database(db_name, (err) => {
  if (err) console.error("Database connection error:", err.message);
  else console.log("Connected to SQLite database");
});

// Create Users table
db.run(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE
)`);

// Create Notifications table with is_read column
db.run(`CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  is_read INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
)`);

// ======= Routes =======

// Root route
app.get('/', (req, res) => {
  res.send('Insyd Backend (SQL) with Read Status is running on port 3001');
});

// --- Users Routes ---
app.get('/api/users', (req, res) => {
  const sql = "SELECT * FROM users";
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ users: rows });
  });
});

app.post('/api/users', (req, res) => {
  const { name, email } = req.body;
  const sql = "INSERT INTO users (name, email) VALUES (?, ?)";
  db.run(sql, [name, email], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, name, email });
  });
});

// --- Notifications Routes ---
app.get('/api/notifications', (req, res) => {
  const sql = "SELECT * FROM notifications ORDER BY created_at DESC";
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ notifications: rows });
  });
});

app.get('/api/notifications/:id', (req, res) => {
  const { id } = req.params;
  const sql = "SELECT * FROM notifications WHERE id = ?";
  db.get(sql, [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ notification: row });
  });
});

app.post('/api/notifications', (req, res) => {
  const { title, message, user_id } = req.body;
  const sql = "INSERT INTO notifications (title, message, user_id) VALUES (?, ?, ?)";
  db.run(sql, [title, message, user_id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, title, message, user_id, is_read: 0 });
  });
});

app.delete('/api/notifications/:id', (req, res) => {
  const { id } = req.params;
  const sql = "DELETE FROM notifications WHERE id = ?";
  db.run(sql, [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: `Notification ${id} deleted` });
  });
});

// --- Mark notification as read ---
// Mark notification as read
app.put('/api/notifications/:id/read', (req, res) => {
  const { id } = req.params;
  const sql = "UPDATE notifications SET is_read = 1 WHERE id = ?";
  db.run(sql, [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) {
      // No row updated → ID not found
      return res.status(404).json({ error: `Notification ${id} not found` });
    }
    res.json({ message: `Notification ${id} marked as read` });
  });
});


// ======= Start server =======
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

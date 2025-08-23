const express = require('express');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const path = require('path');

const app = express();
app.use(express.json());

const DB_PATH = path.join(__dirname, 'insydNotification.db');

let db = null;

async function initializeDbAndServer() {
  try {
    db = await open({
      filename: DB_PATH,
      driver: sqlite3.Database,
    });

    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        user_id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        email TEXT,
        preferences TEXT DEFAULT 'in-app'
      );
      CREATE TABLE IF NOT EXISTS events (
        event_id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        source_user_id INTEGER,
        target_user_id INTEGER,
        data TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS notifications (
        notification_id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        content TEXT,
        status TEXT DEFAULT 'unread',
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (user_id)
      );
    `);

    app.listen(3001, () => {
      console.log('Server running at http://localhost:3001/');
    });
  } catch (error) {
    console.error(`DB Initialization error: ${error.message}`);
    process.exit(1);
  }
}

// Process event to create notification
async function processEvent(event) {
  if (event.target_user_id) {
    const content = `${event.type} from user ${event.source_user_id}`;
    await db.run(
      `INSERT INTO notifications (user_id, type, content, status) VALUES (?, ?, ?, 'unread')`,
      event.target_user_id,
      event.type,
      content
    );
  }
}

// Routes

// Health check
app.get('/', (req, res) => {
  res.send('Insyd Notification Backend is running!');
});

// Create user
app.post('/users', async (req, res) => {
  const { username, email, preferences } = req.body;
  try {
    const result = await db.run(
      `INSERT INTO users (username, email, preferences) VALUES (?, ?, ?)`,
      username,
      email,
      preferences || 'in-app'
    );
    res.status(201).json({ user_id: result.lastID });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user info
app.get('/users/:user_id', async (req, res) => {
  const { user_id } = req.params;
  try {
    const user = await db.get(`SELECT * FROM users WHERE user_id = ?`, user_id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create event
app.post('/events', async (req, res) => {
  const { type, source_user_id, target_user_id, data } = req.body;
  try {
    const result = await db.run(
      `INSERT INTO events (type, source_user_id, target_user_id, data) VALUES (?, ?, ?, ?)`,
      type,
      source_user_id,
      target_user_id,
      data || ''
    );
    const eventId = result.lastID;
    await processEvent({ event_id: eventId, type, source_user_id, target_user_id, data });
    res.status(201).json({ event_id: eventId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get notifications for a user
app.get('/notifications/:user_id', async (req, res) => {
  const { user_id } = req.params;
  try {
    const notifications = await db.all(
      `SELECT * FROM notifications WHERE user_id = ? ORDER BY timestamp DESC LIMIT 50`,
      user_id
    );
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark notification as read
app.post('/notifications/:notification_id/read', async (req, res) => {
  const { notification_id } = req.params;
  try {
    const result = await db.run(
      `UPDATE notifications SET status = 'read' WHERE notification_id = ?`,
      notification_id
    );
    if (result.changes === 0) return res.status(404).json({ error: 'Notification not found' });
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

initializeDbAndServer();

module.exports = app;

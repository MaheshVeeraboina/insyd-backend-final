const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3001;

// HTTP server for Socket.io
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database
const dbPath = path.join(__dirname, "insyd.db");
const db = new sqlite3.Database(dbPath);

// DB helpers
const dbAll = (query, params = []) =>
  new Promise((res, rej) => db.all(query, params, (err, rows) => (err ? rej(err) : res(rows))));
const dbRun = (query, params = []) =>
  new Promise((res, rej) =>
    db.run(query, params, function (err) {
      if (err) rej(err);
      else res({ id: this.lastID, changes: this.changes });
    })
  );
const dbGet = (query, params = []) =>
  new Promise((res, rej) => db.get(query, params, (err, row) => (err ? rej(err) : res(row))));

// Initialize tables & sample users
function initializeDatabase() {
  db.run(
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      preferences TEXT DEFAULT '{"notifications": true}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  );
  db.run(
    `CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT DEFAULT 'unread',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  );

  // Insert sample users if none
  db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
    if (err) return console.error(err);
    if (row.count === 0) {
      const sampleUsers = [
        ["alex_architect", "alex@insyd.com"],
        ["maya_designer", "maya@insyd.com"],
        ["david_planner", "david@insyd.com"],
        ["sara_engineer", "sara@insyd.com"],
        ["john_builder", "john@insyd.com"]
      ];
      const stmt = db.prepare("INSERT INTO users (username, email) VALUES (?, ?)");
      sampleUsers.forEach(([u, e]) => stmt.run(u, e));
      stmt.finalize();
      console.log("✅ Sample users inserted");
    }
  });
}

// API routes
app.get("/api/users", async (req, res) => {
  try {
    const users = await dbAll("SELECT id, username, email FROM users");
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/events", async (req, res) => {
  try {
    const { type, source_user_id, target_user_id, comment, post_title } = req.body;
    const sourceUser = await dbGet("SELECT username FROM users WHERE id = ?", [source_user_id]);
    if (!sourceUser) return res.status(404).json({ error: "Source user not found" });

    let content = "";
    if (type === "like") content = `${sourceUser.username} liked your post`;
    else if (type === "comment") content = `${sourceUser.username} commented: "${comment}"`;
    else if (type === "follow") content = `${sourceUser.username} started following you`;
    else if (type === "post") content = `${sourceUser.username} posted: "${post_title}"`;

    if (type !== "post" && !target_user_id)
      return res.status(400).json({ error: "target_user_id required" });

    const notificationsToInsert = type === "post"
      ? await dbAll("SELECT id FROM users WHERE id != ?", [source_user_id]) // all users except author
      : [{ id: target_user_id }];

    for (const user of notificationsToInsert) {
      const result = await dbRun(
        "INSERT INTO notifications (user_id, type, content) VALUES (?, ?, ?)",
        [user.id, type, content]
      );
      io.to(`user_${user.id}`).emit("new_notification", { id: result.id, type, content, status: "unread" });
    }

    res.json({ message: "Event processed" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/notifications/:userId", async (req, res) => {
  const { userId } = req.params;
  const notifications = await dbAll(
    "SELECT id, type, content, status, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC",
    [userId]
  );
  res.json({ notifications });
});

app.patch("/api/notifications/:id/read", async (req, res) => {
  const { id } = req.params;
  await dbRun("UPDATE notifications SET status='read' WHERE id=?", [id]);
  res.json({ message: "Marked as read" });
});

// Socket.io
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
  socket.on("join", (userId) => socket.join(`user_${userId}`));
});

// Initialize DB and start server
initializeDatabase();
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));


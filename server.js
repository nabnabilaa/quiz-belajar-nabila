// Academy Quiz — score server (Aiven for MySQL)
// Saves best scores per player/topic/session. Credentials come from .env (never hard-coded).
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

// ---- Build the MySQL pool from .env -------------------------------------------------
function buildPool() {
  // Prefer discrete vars; fall back to parsing DATABASE_URL if provided.
  let cfg = {
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE || 'defaultdb',
  };
  if ((!cfg.host || !cfg.user) && process.env.DATABASE_URL) {
    const u = new URL(process.env.DATABASE_URL);
    cfg = {
      host: u.hostname,
      port: Number(u.port || 3306),
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: u.pathname.replace(/^\//, '') || 'defaultdb',
    };
  }
  if (!cfg.host || !cfg.user || !cfg.password) {
    console.error('\n[config] Missing DB credentials. Copy .env.example to .env and fill it in.\n');
    process.exit(1);
  }

  // Aiven requires SSL. Use the CA certificate you downloaded from the Aiven console.
  const caPath = process.env.MYSQL_SSL_CA || './ca.pem';
  let ssl;
  if (fs.existsSync(caPath)) {
    ssl = { ca: fs.readFileSync(caPath, 'utf8'), rejectUnauthorized: true };
  } else {
    console.warn(`[ssl] CA file not found at ${caPath}. Falling back to encrypted-but-unverified TLS.`);
    console.warn('[ssl] For full security, download the CA cert from Aiven and save it as ca.pem.');
    ssl = { rejectUnauthorized: false };
  }

  return mysql.createPool({
    ...cfg, ssl,
    waitForConnections: true, connectionLimit: 5, namedPlaceholders: false,
  });
}

const pool = buildPool();

// ---- Ensure the table exists --------------------------------------------------------
async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS quiz_scores (
      id INT AUTO_INCREMENT PRIMARY KEY,
      player VARCHAR(64) NOT NULL DEFAULT 'me',
      topic VARCHAR(32) NOT NULL,
      session_no INT NOT NULL,
      best_score INT NOT NULL,
      total INT NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_player_topic_session (player, topic, session_no)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

// ---- App ----------------------------------------------------------------------------
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'academy_quiz.html')));

app.get('/api/health', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ ok: true, db: true }); }
  catch (e) { res.status(500).json({ ok: false, db: false, error: e.message }); }
});

// Get every best score for a player -> { "logic:0": 47, "programming:3": 50, ... }
app.get('/api/scores', async (req, res) => {
  const player = String(req.query.player || 'me').slice(0, 64);
  try {
    const [rows] = await pool.query(
      'SELECT topic, session_no, best_score FROM quiz_scores WHERE player = ?', [player]);
    const out = {};
    for (const r of rows) out[`${r.topic}:${r.session_no}`] = r.best_score;
    res.json(out);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Save a score (keeps the maximum) -> { best: <stored best> }
app.post('/api/scores', async (req, res) => {
  let { player, topic, session, score, total } = req.body || {};
  player = String(player || 'me').slice(0, 64);
  topic = String(topic || '').slice(0, 32);
  session = Number(session); score = Number(score); total = Number(total || 50);
  if (!topic || !Number.isInteger(session) || !Number.isInteger(score)) {
    return res.status(400).json({ error: 'Invalid payload' });
  }
  try {
    await pool.query(
      `INSERT INTO quiz_scores (player, topic, session_no, best_score, total)
       VALUES (?,?,?,?,?)
       ON DUPLICATE KEY UPDATE best_score = GREATEST(best_score, VALUES(best_score)),
                               total = VALUES(total)`,
      [player, topic, session, score, total]);
    const [rows] = await pool.query(
      'SELECT best_score FROM quiz_scores WHERE player=? AND topic=? AND session_no=?',
      [player, topic, session]);
    res.json({ best: rows.length ? rows[0].best_score : score });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

if (process.env.VERCEL !== '1') {
  ensureSchema()
    .then(() => app.listen(PORT, () => {
      console.log(`\n✅ Academy Quiz running:  http://localhost:${PORT}`);
      console.log(`   Scores are saving to your Aiven MySQL database.\n`);
    }))
    .catch((e) => {
      console.error('\n❌ Could not connect to the database:', e.message);
      console.error('   Check your .env values and that ca.pem is present.\n');
      process.exit(1);
    });
} else {
  // Untuk Vercel, jalankan skema secara asinkron lalu ekspor app
  ensureSchema().catch(console.error);
}

module.exports = app;

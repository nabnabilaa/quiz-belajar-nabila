-- Score table (the server also creates this automatically on startup).
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

-- See your saved scores:
-- SELECT player, topic, session_no, best_score, total, updated_at
-- FROM quiz_scores ORDER BY topic, session_no;

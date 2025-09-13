const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

module.exports = async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET") {
    const week = parseInt((req.query && req.query.week) || "0", 10);
    if (!week) return res.status(400).json({ error: "week obrigatório" });
    try {
      const { rows } = await pool.query(
        `SELECT week, game_id, user_name, pick, updated_at
         FROM picks
         WHERE week = $1
         ORDER BY game_id, user_name`,
        [week]
      );
      return res.status(200).json(rows);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "db_error" });
    }
  }

  if (req.method === "POST") {
    try {
      const payload = Array.isArray(req.body) ? req.body : [req.body];
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const text = `
          INSERT INTO picks (week, game_id, user_name, pick)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (week, game_id, user_name)
          DO UPDATE SET pick = EXCLUDED.pick, updated_at = NOW()
          RETURNING week, game_id, user_name, pick, updated_at
        `;
        const results = [];
        for (const item of payload) {
          const { week, gameId, user, pick } = item || {};
          if (!week || !gameId || !user || !pick) continue;
          const r = await client.query(text, [week, String(gameId), String(user), String(pick)]);
          results.push(r.rows[0]);
        }
        await client.query("COMMIT");
        return res.status(200).json({ saved: results.length, rows: results });
      } catch (e) {
        await client.query("ROLLBACK");
        console.error(e);
        return res.status(500).json({ error: "db_error" });
      } finally {
        client.release();
      }
    } catch (e) {
      console.error(e);
      return res.status(400).json({ error: "invalid_payload" });
    }
  }

  return res.status(405).json({ error: "method_not_allowed" });
};

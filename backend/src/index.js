const express = require("express");
const { Pool } = require("pg");
const fs = require("fs");

const app = express();
const PORT = 3001;

// Lecture du secret Docker Compose
const dbPassword = fs.readFileSync(
  "/run/secrets/db_password",
  "utf8"
).trim();

// Connexion PostgreSQL
const pool = new Pool({
  host: process.env.DB_HOST || "db",
  port: 5432,
  user: process.env.DB_USER || "postgres",
  password: dbPassword,
  database: process.env.DB_NAME || "evaluation"
});

// Vérification de l'API
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok"
  });
});

// Récupération d'une instruction PostgreSQL
app.get("/api/instruction", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM instructions ORDER BY id LIMIT 1"
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "No instruction found"
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Erreur PostgreSQL"
    });
  }
});

// Démarrage du serveur
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend démarré sur le port ${PORT}`);
});
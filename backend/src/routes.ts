import { Router } from "express";
import { pool } from "./db";

const router = Router();

router.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", database: "connected", timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: "error", database: "unavailable" });
  }
});

router.get("/devices", async (_req, res) => {
  const result = await pool.query(`
    SELECT d.*,
      (SELECT row_to_json(t) FROM (
        SELECT temperature, pressure, vibration, voltage, current, machine_status, recorded_at
        FROM telemetry WHERE device_id=d.id ORDER BY recorded_at DESC LIMIT 1
      ) t) AS latest_telemetry
    FROM devices d ORDER BY d.created_at
  `);
  res.json(result.rows);
});

router.post("/devices", async (req, res) => {
  const { id, name, location, deviceType, thresholds } = req.body || {};
  if (!id || !name) return res.status(400).json({ error: "id and name are required" });
  try {
    const result = await pool.query(
      `INSERT INTO devices (id,name,location,device_type,thresholds)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [String(id), String(name), location || "Unassigned", deviceType || "Industrial sensor",
        JSON.stringify(thresholds || { temperature: 80, pressure: 8, vibration: 5 })]
    );
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    res.status(error.code === "23505" ? 409 : 500).json({ error: error.code === "23505" ? "Device ID already exists" : "Could not create device" });
  }
});

router.get("/devices/:id", async (req, res) => {
  const result = await pool.query("SELECT * FROM devices WHERE id=$1", [req.params.id]);
  if (!result.rowCount) return res.status(404).json({ error: "Device not found" });
  res.json(result.rows[0]);
});

router.patch("/devices/:id", async (req, res) => {
  const { name, location, thresholds } = req.body || {};
  const result = await pool.query(
    `UPDATE devices SET
      name=COALESCE($2,name),
      location=COALESCE($3,location),
      thresholds=COALESCE($4,thresholds)
     WHERE id=$1 RETURNING *`,
    [req.params.id, name ?? null, location ?? null, thresholds ? JSON.stringify(thresholds) : null]
  );
  if (!result.rowCount) return res.status(404).json({ error: "Device not found" });
  res.json(result.rows[0]);
});

router.get("/devices/:id/telemetry", async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 60, 1), 500);
  const result = await pool.query(
    `SELECT * FROM telemetry WHERE device_id=$1 ORDER BY recorded_at DESC LIMIT $2`,
    [req.params.id, limit]
  );
  res.json(result.rows.reverse());
});

router.get("/telemetry/latest", async (_req, res) => {
  const result = await pool.query(`
    SELECT DISTINCT ON (device_id) * FROM telemetry
    ORDER BY device_id, recorded_at DESC
  `);
  res.json(result.rows);
});

router.get("/alerts", async (req, res) => {
  const status = req.query.status;
  const result = status
    ? await pool.query(
        `SELECT a.*, d.name AS device_name FROM alerts a JOIN devices d ON d.id=a.device_id
         WHERE a.status=$1 ORDER BY a.created_at DESC LIMIT 100`, [status])
    : await pool.query(
        `SELECT a.*, d.name AS device_name FROM alerts a JOIN devices d ON d.id=a.device_id
         ORDER BY a.created_at DESC LIMIT 100`);
  res.json(result.rows);
});

router.patch("/alerts/:id/acknowledge", async (req, res) => {
  const result = await pool.query(
    `UPDATE alerts SET status='acknowledged', acknowledged_at=NOW()
     WHERE id=$1 AND status='open' RETURNING *`, [req.params.id]
  );
  if (!result.rowCount) return res.status(404).json({ error: "Open alert not found" });
  res.json(result.rows[0]);
});

router.patch("/alerts/:id/resolve", async (req, res) => {
  const result = await pool.query(
    `UPDATE alerts SET status='resolved', resolved_at=NOW()
     WHERE id=$1 AND status <> 'resolved' RETURNING *`, [req.params.id]
  );
  if (!result.rowCount) return res.status(404).json({ error: "Alert not found" });
  res.json(result.rows[0]);
});

export default router;

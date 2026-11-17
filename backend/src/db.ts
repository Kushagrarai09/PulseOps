import { Pool } from "pg";
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY, name TEXT NOT NULL,
      location TEXT NOT NULL DEFAULT 'Unassigned',
      device_type TEXT NOT NULL DEFAULT 'Industrial sensor',
      status TEXT NOT NULL DEFAULT 'offline', last_seen TIMESTAMPTZ,
      thresholds JSONB NOT NULL DEFAULT '{"temperature":80,"pressure":8,"vibration":5}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS telemetry (
      id BIGSERIAL PRIMARY KEY, device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
      temperature DOUBLE PRECISION NOT NULL, pressure DOUBLE PRECISION NOT NULL,
      vibration DOUBLE PRECISION NOT NULL, voltage DOUBLE PRECISION NOT NULL,
      current DOUBLE PRECISION NOT NULL, machine_status TEXT NOT NULL,
      recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_telemetry_device_recorded ON telemetry(device_id, recorded_at DESC);
    CREATE TABLE IF NOT EXISTS alerts (
      id BIGSERIAL PRIMARY KEY, device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
      severity TEXT NOT NULL, metric TEXT NOT NULL, message TEXT NOT NULL,
      value DOUBLE PRECISION NOT NULL, status TEXT NOT NULL DEFAULT 'open',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), acknowledged_at TIMESTAMPTZ, resolved_at TIMESTAMPTZ
    );
  `);
  const seeds = [
    ["press-001","Hydraulic Press 01","Factory Floor A","Hydraulic press"],
    ["motor-002","Conveyor Motor 02","Assembly Line B","Electric motor"],
    ["pump-003","Cooling Pump 03","Utility Room","Water pump"]
  ];
  for (const [id,name,location,type] of seeds) {
    await pool.query(
      `INSERT INTO devices (id,name,location,device_type) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING`,
      [id,name,location,type]
    );
  }
}

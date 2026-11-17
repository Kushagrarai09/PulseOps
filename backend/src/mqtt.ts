import mqtt, { MqttClient } from "mqtt";
import { Server } from "socket.io";
import { pool } from "./db";
import { TelemetryMessage } from "./types";
const metricLimits = ["temperature","pressure","vibration"] as const;
export function startMqtt(io: Server): MqttClient {
  const client = mqtt.connect(process.env.MQTT_URL || "mqtt://localhost:1883", { reconnectPeriod:3000, connectTimeout:10000 });
  client.on("connect", () => {
    console.log("Connected to MQTT broker");
    client.subscribe("iiot/devices/+/telemetry", error => { if (error) console.error("MQTT subscribe error:",error.message); });
  });
  client.on("error", error => console.error("MQTT error:",error.message));
  client.on("message", async (topic,buffer) => {
    try {
      const match=topic.match(/^iiot\/devices\/([^/]+)\/telemetry$/);
      if (!match) return;
      const deviceId=match[1];
      const data=JSON.parse(buffer.toString()) as TelemetryMessage;
      const required=["temperature","pressure","vibration","voltage","current"];
      if (!required.every(key=>Number.isFinite(Number((data as any)[key])))) { console.warn("Rejected invalid telemetry from",deviceId); return; }
      const deviceResult=await pool.query("SELECT id, thresholds FROM devices WHERE id=$1",[deviceId]);
      if (!deviceResult.rowCount) { console.warn(`Ignoring telemetry from unregistered device: ${deviceId}`); return; }
      const recordedAt=data.timestamp && !Number.isNaN(Date.parse(data.timestamp)) ? new Date(data.timestamp) : new Date();
      const inserted=await pool.query(
        `INSERT INTO telemetry (device_id,temperature,pressure,vibration,voltage,current,machine_status,recorded_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [deviceId,data.temperature,data.pressure,data.vibration,data.voltage,data.current,data.machineStatus||"running",recordedAt]
      );
      await pool.query("UPDATE devices SET status='online',last_seen=NOW() WHERE id=$1",[deviceId]);
      io.emit("telemetry:new",inserted.rows[0]);
      io.emit("device:status",{id:deviceId,status:"online",last_seen:new Date()});
      const thresholds=deviceResult.rows[0].thresholds||{};
      for (const metric of metricLimits) {
        const limit=Number(thresholds[metric]), value=Number(data[metric]);
        if (Number.isFinite(limit)&&value>limit) {
          const recent=await pool.query(
            `SELECT id FROM alerts WHERE device_id=$1 AND metric=$2 AND status='open' AND created_at>NOW()-INTERVAL '5 minutes' LIMIT 1`,
            [deviceId,metric]
          );
          if (!recent.rowCount) {
            const alert=await pool.query(
              `INSERT INTO alerts (device_id,severity,metric,message,value) VALUES ($1,'critical',$2,$3,$4) RETURNING *`,
              [deviceId,metric,`${metric} exceeded configured limit (${limit})`,value]
            );
            io.emit("alert:new",alert.rows[0]);
          }
        }
      }
    } catch(error) { console.error("Failed to process MQTT message:",error); }
  });
  return client;
}

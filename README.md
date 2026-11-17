# PulseOps — Industrial IoT Device Monitoring Platform

PulseOps is a full-stack Industrial IoT monitoring MVP built with React, TypeScript, Node.js, PostgreSQL, MQTT, Socket.IO, Docker Compose and a Python sensor simulator.

## Features
- Device registry and online/offline status
- MQTT telemetry ingestion on `iiot/devices/{deviceId}/telemetry`
- Live browser updates using Socket.IO
- PostgreSQL storage for devices, telemetry and alerts
- Temperature, pressure and vibration threshold alerts
- Alert acknowledgement and resolution
- Historical telemetry API and dashboard charts
- Python simulator publishing sample device readings

## Run with Docker
Requirements: Docker Desktop with Docker Compose.

```bash
docker compose up --build
```

Open the dashboard at http://localhost:5173 and API health at http://localhost:4000/api/health. The simulator publishes readings every two seconds.

Stop with `docker compose down`. Remove persisted database data with `docker compose down -v`.

## Architecture
```text
Python sensor simulator -> MQTT / Mosquitto -> Node.js ingestion API -> PostgreSQL
                                                   |
                                                   +-> REST + Socket.IO -> React dashboard
```

## MQTT contract
Topic: `iiot/devices/{deviceId}/telemetry`

```json
{"temperature":62.4,"pressure":4.8,"vibration":2.1,"voltage":230.5,"current":3.2,"machineStatus":"running","timestamp":"2026-11-17T10:00:00.000Z"}
```

## API
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/devices` | List devices |
| POST | `/api/devices` | Register device |
| GET | `/api/devices/:id` | Device detail |
| PATCH | `/api/devices/:id` | Update name, location or thresholds |
| GET | `/api/devices/:id/telemetry` | Device history |
| GET | `/api/telemetry/latest` | Latest readings |
| GET | `/api/alerts` | List alerts |
| PATCH | `/api/alerts/:id/acknowledge` | Acknowledge alert |
| PATCH | `/api/alerts/:id/resolve` | Resolve alert |

## Project structure
```text
PulseOps/
├── backend/          # Express API, PostgreSQL and MQTT ingestion
├── frontend/         # React + TypeScript dashboard
├── simulator/        # Python simulated industrial devices
├── mosquitto/        # MQTT broker configuration
├── docker-compose.yml
└── README.md
```

## Development notes
This is a portfolio/demo MVP. MQTT is configured for anonymous local development, and the application does not yet include authentication, tenant isolation, device credentials, TLS, a production offline-heartbeat worker, or safety-certified controls. Do not connect it to real machinery or use it for safety-critical decisions.

## Next improvements
1. Add authentication, tenant isolation and RBAC.
2. Use per-device credentials and MQTT TLS.
3. Add heartbeat-based offline detection.
4. Add Modbus TCP gateway integration.
5. Add API, integration and browser tests.
6. Add structured logging, metrics and retention policies.

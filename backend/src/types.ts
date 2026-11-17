export type MachineStatus = "running" | "idle" | "stopped" | "fault";
export interface TelemetryMessage {
  temperature: number;
  pressure: number;
  vibration: number;
  voltage: number;
  current: number;
  machineStatus: MachineStatus;
  timestamp?: string;
}

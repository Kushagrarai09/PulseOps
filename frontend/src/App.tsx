import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, AlertTriangle, Bell, Check, ChevronDown, Cpu, Gauge, LayoutDashboard,
  Plus, Radio, RefreshCw, Server, Settings2, Thermometer, Zap
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";
import { api, Alert, Device, Telemetry, socket } from "./api";

type Tab = "overview" | "devices" | "alerts";
const fmt = (value?: number | string | null, digits = 1) =>
  value === null || value === undefined || Number.isNaN(Number(value)) ? "—" : Number(value).toFixed(digits);
const timeAgo = (value?: string | null) => {
  if (!value) return "Never connected";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
};

export default function App() {
  const [tab, setTab] = useState<Tab>("overview");
  const [devices, setDevices] = useState<Device[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [history, setHistory] = useState<Telemetry[]>([]);
  const [selected, setSelected] = useState("press-001");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ id: "", name: "", location: "", deviceType: "Industrial sensor" });

  const load = useCallback(async () => {
    try {
      setError("");
      const [deviceData, alertData] = await Promise.all([
        api<Device[]>("/devices"), api<Alert[]>("/alerts")
      ]);
      setDevices(deviceData);
      setAlerts(alertData);
      if (deviceData.length && !deviceData.some(d => d.id === selected)) setSelected(deviceData[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load dashboard");
    } finally { setLoading(false); }
  }, [selected]);

  const loadHistory = useCallback(async () => {
    if (!selected) return;
    try { setHistory(await api<Telemetry[]>(`/devices/${selected}/telemetry?limit=40`)); }
    catch { setHistory([]); }
  }, [selected]);

  useEffect(() => { load(); const timer = setInterval(load, 10000); return () => clearInterval(timer); }, [load]);
  useEffect(() => { loadHistory(); }, [loadHistory]);

  useEffect(() => {
    const onTelemetry = (reading: Telemetry) => {
      setDevices(prev => prev.map(d => d.id === reading.device_id
        ? { ...d, status: "online", last_seen: reading.recorded_at, latest_telemetry: reading } : d));
      if (reading.device_id === selected) setHistory(prev => [...prev, reading].slice(-40));
    };
    const onAlert = (alert: Alert) => setAlerts(prev => [alert, ...prev]);
    const onStatus = (payload: { id: string; status: string; last_seen: string }) =>
      setDevices(prev => prev.map(d => d.id === payload.id ? { ...d, status: payload.status, last_seen: payload.last_seen } : d));
    socket.on("telemetry:new", onTelemetry);
    socket.on("alert:new", onAlert);
    socket.on("device:status", onStatus);
    return () => {
      socket.off("telemetry:new", onTelemetry);
      socket.off("alert:new", onAlert);
      socket.off("device:status", onStatus);
    };
  }, [selected]);

  const selectedDevice = devices.find(d => d.id === selected);
  const latest = selectedDevice?.latest_telemetry;
  const onlineCount = devices.filter(d => d.status === "online").length;
  const openAlerts = alerts.filter(a => a.status === "open").length;
  const allReadings = devices.map(d => d.latest_telemetry).filter(Boolean) as Telemetry[];
  const avgTemp = allReadings.length ? allReadings.reduce((sum, r) => sum + Number(r.temperature), 0) / allReadings.length : 0;
  const chartData = useMemo(() => history.map((r, i) => ({
    time: new Date(r.recorded_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    temperature: Number(r.temperature), pressure: Number(r.pressure), vibration: Number(r.vibration), index: i
  })), [history]);

  async function addDevice(event: React.FormEvent) {
    event.preventDefault();
    try {
      const created = await api<Device>("/devices", { method: "POST", body: JSON.stringify(form) });
      setDevices(prev => [...prev, created]);
      setSelected(created.id);
      setForm({ id: "", name: "", location: "", deviceType: "Industrial sensor" });
      setShowAdd(false);
    } catch (e) { alert(e instanceof Error ? e.message : "Could not add device"); }
  }

  async function updateAlert(id: number, action: "acknowledge" | "resolve") {
    try {
      await api(`/alerts/${id}/${action}`, { method: "PATCH" });
      await load();
    } catch (e) { alert(e instanceof Error ? e.message : "Could not update alert"); }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><Activity size={21}/></div><div><strong>PulseOps</strong><span>INDUSTRIAL CLOUD</span></div></div>
        <div className="workspace"><span className="workspace-dot"/><div><b>Northstar Manufacturing</b><small>Production workspace</small></div><ChevronDown size={15}/></div>
        <p className="nav-label">WORKSPACE</p>
        <nav>
          <button className={tab === "overview" ? "nav-item active" : "nav-item"} onClick={() => setTab("overview")}><LayoutDashboard size={18}/> Overview</button>
          <button className={tab === "devices" ? "nav-item active" : "nav-item"} onClick={() => setTab("devices")}><Cpu size={18}/> Devices <span className="nav-count">{devices.length}</span></button>
          <button className={tab === "alerts" ? "nav-item active" : "nav-item"} onClick={() => setTab("alerts")}><Bell size={18}/> Alerts {openAlerts > 0 && <span className="nav-count alert-count">{openAlerts}</span>}</button>
        </nav>
        <div className="sidebar-bottom"><div className="connection"><span className="pulse-dot"/> MQTT broker connected</div><div className="profile"><div className="avatar">OP</div><div><b>Operations team</b><small>Administrator</small></div><Settings2 size={17}/></div></div>
      </aside>

      <main className="main">
        <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> {tab[0].toUpperCase() + tab.slice(1)}</div><div className="top-actions"><div className="live-indicator"><span/> LIVE DATA</div><button className="icon-btn" onClick={load} title="Refresh"><RefreshCw size={17}/></button><div className="date-label">{new Date().toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}</div></div></header>
        <section className="page-content">
          <div className="page-heading"><div><div className="eyebrow">INDUSTRIAL OPERATIONS / MONITORING</div><h1>{tab === "overview" ? "Operations overview" : tab === "devices" ? "Device registry" : "Alert center"}</h1><p>Monitor equipment health, live telemetry and operational performance.</p></div><button className="primary-btn" onClick={() => setShowAdd(true)}><Plus size={17}/> Add device</button></div>
          {error && <div className="error-banner"><AlertTriangle size={17}/>{error}<button onClick={load}>Retry</button></div>}
          {loading ? <div className="loading"><RefreshCw className="spin"/> Connecting to monitoring services…</div> : <>
            <div className="stat-grid">
              <Stat icon={<Cpu/>} label="Registered devices" value={devices.length} note="Across all locations" tone="blue"/>
              <Stat icon={<Radio/>} label="Devices online" value={onlineCount} note={`${devices.length - onlineCount} currently offline`} tone="green"/>
              <Stat icon={<AlertTriangle/>} label="Open alerts" value={openAlerts} note="Requires attention" tone="orange"/>
              <Stat icon={<Thermometer/>} label="Average temperature" value={`${fmt(avgTemp)}°`} note="Latest device readings" tone="purple"/>
            </div>

            {tab === "overview" && <>
              <div className="content-grid">
                <section className="panel chart-panel">
                  <div className="panel-heading"><div><h2>Live telemetry</h2><p>Sensor readings · {selectedDevice?.name || "Select a device"}</p></div><select value={selected} onChange={e => setSelected(e.target.value)}>{devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
                  <div className="metric-row">
                    <Metric label="Temperature" value={`${fmt(latest?.temperature)}°C`} icon={<Thermometer/>} color="orange"/>
                    <Metric label="Pressure" value={`${fmt(latest?.pressure)} bar`} icon={<Gauge/>} color="blue"/>
                    <Metric label="Vibration" value={`${fmt(latest?.vibration)} mm/s`} icon={<Activity/>} color="purple"/>
                  </div>
                  <div className="chart-title">TEMPERATURE TREND <span>Last 40 readings</span></div>
                  <div className="chart-wrap">{chartData.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><defs><linearGradient id="tempFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f59e0b" stopOpacity={0.22}/><stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#edf0f5" vertical={false}/><XAxis dataKey="time" tick={{ fontSize: 10, fill: "#8b95a7" }} tickLine={false} axisLine={false} minTickGap={35}/><YAxis tick={{ fontSize: 10, fill: "#8b95a7" }} tickLine={false} axisLine={false} width={35}/><Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e9edf3", fontSize: 12 }}/><Area type="monotone" dataKey="temperature" stroke="#f59e0b" strokeWidth={2.2} fill="url(#tempFill)" /></AreaChart></ResponsiveContainer> : <Empty text="Waiting for telemetry from this device…"/>}</div>
                </section>
                <section className="panel device-panel"><div className="panel-heading"><div><h2>Device health</h2><p>Connectivity and machine status</p></div><button className="text-btn" onClick={() => setTab("devices")}>View all</button></div><div className="device-list">{devices.map(d => <button className={`device-row ${selected === d.id ? "selected" : ""}`} key={d.id} onClick={() => setSelected(d.id)}><div className="device-icon"><Server size={18}/></div><div className="device-info"><b>{d.name}</b><small>{d.location}</small></div><div className="device-state"><span className={d.status === "online" ? "status-dot online" : "status-dot"}/><small>{d.status}</small></div></button>)}</div></section>
              </div>
              <section className="panel table-panel"><div className="panel-heading"><div><h2>Recent alerts</h2><p>Latest events requiring operator attention</p></div><button className="text-btn" onClick={() => setTab("alerts")}>All alerts</button></div><AlertTable alerts={alerts.slice(0, 5)} onUpdate={updateAlert}/></section>
            </>}

            {tab === "devices" && <section className="panel table-panel"><div className="panel-heading"><div><h2>Connected equipment</h2><p>{devices.length} registered devices in this workspace</p></div></div><div className="device-cards">{devices.map(d => <button className={`device-card ${selected === d.id ? "selected" : ""}`} key={d.id} onClick={() => setSelected(d.id)}><div className="device-card-top"><div className="device-icon"><Cpu size={19}/></div><span className={d.status === "online" ? "status-pill online-pill" : "status-pill"}>{d.status}</span></div><h3>{d.name}</h3><p>{d.device_type} · {d.location}</p><div className="device-card-data"><span>Temperature <b>{fmt(d.latest_telemetry?.temperature)}°C</b></span><span>Last seen <b>{timeAgo(d.last_seen)}</b></span></div><small className="device-id">ID: {d.id}</small></button>)}</div></section>}

            {tab === "alerts" && <section className="panel table-panel"><div className="panel-heading"><div><h2>Alert history</h2><p>Review, acknowledge and resolve abnormal readings</p></div></div><AlertTable alerts={alerts} onUpdate={updateAlert}/></section>}
          </>}
        </section>
      </main>

      {showAdd && <div className="modal-backdrop" onClick={() => setShowAdd(false)}><form className="modal" onSubmit={addDevice} onClick={e => e.stopPropagation()}><div className="modal-head"><div><h2>Register a device</h2><p>Add a device to your monitoring workspace.</p></div><button type="button" className="icon-btn" onClick={() => setShowAdd(false)}>×</button></div>{(["id","name","location","deviceType"] as const).map(key => <label className="field" key={key}><span>{key === "id" ? "Device ID" : key === "deviceType" ? "Device type" : key[0].toUpperCase() + key.slice(1)}</span><input required value={form[key]} onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))} placeholder={key === "id" ? "sensor-004" : key === "name" ? "Packaging Line Sensor" : key === "location" ? "Factory Floor C" : "Industrial sensor"}/></label>)}<div className="modal-actions"><button type="button" className="secondary-btn" onClick={() => setShowAdd(false)}>Cancel</button><button className="primary-btn" type="submit"><Plus size={16}/> Register device</button></div></form></div>}
    </div>
  );
}

function Stat({ icon, label, value, note, tone }: { icon: React.ReactNode; label: string; value: string | number; note: string; tone: string }) {
  return <div className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-note">{note}</div></div>;
}
function Metric({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  return <div className="metric"><div className={`metric-icon ${color}`}>{icon}</div><div><small>{label}</small><strong>{value}</strong></div></div>;
}
function Empty({ text }: { text: string }) { return <div className="empty">{text}</div>; }
function AlertTable({ alerts, onUpdate }: { alerts: Alert[]; onUpdate: (id: number, action: "acknowledge" | "resolve") => void }) {
  if (!alerts.length) return <Empty text="No alerts recorded. Your equipment is looking good." />;
  return <div className="table-scroll"><table><thead><tr><th>EVENT</th><th>DEVICE</th><th>SEVERITY</th><th>VALUE</th><th>TIME</th><th>STATUS / ACTION</th></tr></thead><tbody>{alerts.map(a => <tr key={a.id}><td><b>{a.metric}</b><small>{a.message}</small></td><td>{a.device_name || a.device_id}</td><td><span className="severity"><i/> {a.severity}</span></td><td>{fmt(a.value)}</td><td>{timeAgo(a.created_at)}</td><td>{a.status === "open" ? <button className="table-action" onClick={() => onUpdate(a.id, "acknowledge")}>Acknowledge</button> : a.status === "acknowledged" ? <button className="table-action" onClick={() => onUpdate(a.id, "resolve")}>Resolve</button> : <span className="resolved"><Check size={13}/> Resolved</span>}</td></tr>)}</tbody></table></div>;
}

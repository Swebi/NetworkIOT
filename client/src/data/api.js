const BASE = import.meta.env.VITE_API_URL ?? "http://192.168.42.65:8000";

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json();
}

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json();
}

/** Current occupancy, device list, history, recent scans */
export const getLiveData = () => get("/api/live");

/** Scanner status, window sizes */
export const getStatus = () => get("/api/status");

/** RSSI threshold setting */
export const getSettings = () => get("/api/settings");

/** Save RSSI threshold: { rssi_threshold: number } */
export const updateSettings = (body) => post("/api/settings", body);

async function put(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json();
}

async function del(path) {
  const res = await fetch(`${BASE}${path}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json();
}

/** Zones config + list */
export const getZones = () => get("/api/zones");
/** Save map viewport: { lat, lng, zoom } */
export const saveMapConfig = (body) => post("/api/zones/config", body);
/** Create zone: { name, color, coordinates } */
export const createZone = (body) => post("/api/zones", body);
/** Update zone fields */
export const updateZone = (id, body) => put(`/api/zones/${id}`, body);
/** Delete zone by id */
export const deleteZone = (id) => del(`/api/zones/${id}`);

/** Report scan results from an external scanner (ESP etc.) */
export const reportScan = (scanner_id, devices) =>
  post(`/api/scanner/${encodeURIComponent(scanner_id)}/report`, { devices });

/** Send a chat message to the AI with conversation history */
export const chatWithAI = (message, history = []) =>
  post("/api/ai/chat", { message, history });

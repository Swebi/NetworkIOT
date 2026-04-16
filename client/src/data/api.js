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

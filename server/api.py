"""
FastAPI server for BLE occupancy monitoring.
Run on the Pi with: uvicorn api:app --host 0.0.0.0 --port 8000
"""
import json
import os
import socket
import time
import urllib.request
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import sys
sys.path.insert(0, str(Path(__file__).parent))

import ble_scanner

SETTINGS_FILE = Path(__file__).parent / "settings.json"
ZONES_FILE = Path(__file__).parent / "zones.json"

# Per-zone alert cooldown tracking (zone_id -> last_alert_timestamp)
_alert_cooldowns: dict[str, float] = {}


def load_zones_data() -> dict:
    if ZONES_FILE.exists():
        return json.loads(ZONES_FILE.read_text())
    return {"config": None, "zones": []}


def save_zones_data(data: dict):
    ZONES_FILE.write_text(json.dumps(data, indent=2))


def load_settings() -> dict:
    if SETTINGS_FILE.exists():
        return json.loads(SETTINGS_FILE.read_text())
    return {
        "rssi_threshold": -100,
        "ntfy_topic": "",
        "alert_cooldown_minutes": 10,
        "scanner_id": "pi",
    }


def save_settings(s: dict):
    SETTINGS_FILE.write_text(json.dumps(s, indent=2))


def get_local_ip() -> str:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except Exception:
        return "unknown"


def get_scanner_data_file(scanner_id: str) -> Path:
    """Pi uses the default data file; other scanners get their own."""
    settings = load_settings()
    if scanner_id == settings.get("scanner_id", "pi"):
        return ble_scanner.DATA_FILE
    return Path(__file__).parent / f"scanner_{scanner_id}_data.json"


def load_scanner_data(scanner_id: str) -> dict:
    f = get_scanner_data_file(scanner_id)
    if f.exists():
        try:
            return json.loads(f.read_text())
        except Exception:
            pass
    return {"devices": {}, "history": [], "scan_log": []}


def save_scanner_data(scanner_id: str, data: dict):
    get_scanner_data_file(scanner_id).write_text(json.dumps(data, indent=2))


def send_ntfy_alert(topic: str, zone_name: str, count: int, threshold: int):
    try:
        message = f"Occupancy is {count} - threshold is {threshold}.".encode()
        req = urllib.request.Request(
            f"https://ntfy.sh/{topic}",
            data=message,
            headers={
                "Title": f"Zone alert: {zone_name}",
                "Priority": "high",
                "Tags": "warning",
            },
            method="POST",
        )
        urllib.request.urlopen(req, timeout=5)
        print(f"[Alert] ntfy sent for zone '{zone_name}': {count}/{threshold}", flush=True)
    except Exception as e:
        print(f"[Alert] ntfy failed: {e}", flush=True)


def check_and_alert(scanner_id: str, active_count: int):
    settings = load_settings()
    topic = settings.get("ntfy_topic", "").strip()
    if not topic:
        return
    cooldown_secs = settings.get("alert_cooldown_minutes", 10) * 60
    now = time.time()
    zones_data = load_zones_data()
    for zone in zones_data.get("zones", []):
        if zone.get("scanner_id", "pi") != scanner_id:
            continue
        threshold = zone.get("threshold")
        if threshold is None:
            continue
        if active_count > threshold:
            last = _alert_cooldowns.get(zone["id"], 0)
            if now - last > cooldown_secs:
                _alert_cooldowns[zone["id"]] = now
                send_ntfy_alert(topic, zone["name"], active_count, threshold)


def process_external_scan(scanner_id: str, discovered: dict) -> int:
    """Process a scan report from an external scanner (ESP, second Pi, etc.)."""
    now = time.time()
    data = load_scanner_data(scanner_id)

    for mac, dev in data["devices"].items():
        if mac not in discovered:
            dev["miss_count"] = dev.get("miss_count", 0) + 1

    for mac, info in discovered.items():
        random = ble_scanner.is_random_mac(mac)
        if mac not in data["devices"]:
            data["devices"][mac] = {
                "first_seen": now,
                "last_seen": now,
                "name": info.get("name", "Unknown"),
                "rssi": info.get("rssi", -100),
                "random_mac": random,
                "miss_count": 0,
            }
        else:
            data["devices"][mac]["last_seen"] = now
            data["devices"][mac]["rssi"] = info.get("rssi", -100)
            data["devices"][mac]["miss_count"] = 0
            if info.get("name") and info["name"] != "Unknown":
                data["devices"][mac]["name"] = info["name"]

    pruned = {}
    for mac, dev in data["devices"].items():
        miss = dev.get("miss_count", 0)
        limit = ble_scanner.MAX_MISSED_RANDOM if dev.get("random_mac") else ble_scanner.MAX_MISSED_SCANS
        if miss < limit:
            pruned[mac] = dev
    data["devices"] = pruned

    day_ago = now - 86400
    data["devices"] = {k: v for k, v in data["devices"].items() if v["last_seen"] > day_ago}

    settings = load_settings()
    rssi_min = settings.get("rssi_threshold", -100)
    active = ble_scanner.get_active_count(data, rssi_min=rssi_min)

    data["history"].append({"timestamp": now, "count": active})
    data["history"] = data["history"][-100:]
    data["scan_log"] = (data.get("scan_log", []) + [{"timestamp": now, "found": len(discovered), "active": active}])[-10:]

    save_scanner_data(scanner_id, data)
    print(f"[Scanner:{scanner_id}] {len(discovered)} found, {active} active", flush=True)
    return active


# Start Pi scanner and register alert callback
if ble_scanner.BLEAK_AVAILABLE:
    def _on_pi_scan(active_count: int):
        settings = load_settings()
        check_and_alert(settings.get("scanner_id", "pi"), active_count)

    ble_scanner.register_scan_callback(_on_pi_scan)
    ble_scanner.start_scanner_background()

app = FastAPI(title="BLE Occupancy API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    ip = get_local_ip()
    print(f"\n  API URL: http://{ip}:8000\n  Set in client: VITE_API_URL=http://{ip}:8000\n")


@app.get("/api/status")
def get_status():
    return {
        "scanner_running": ble_scanner.BLEAK_AVAILABLE and not ble_scanner.SCANNER_ERROR,
        "scanner_error": ble_scanner.SCANNER_ERROR,
        "bleak_available": ble_scanner.BLEAK_AVAILABLE,
        "occupancy_window_min": ble_scanner.OCCUPANCY_WINDOW // 60,
        "random_mac_window_min": ble_scanner.RANDOM_MAC_WINDOW // 60,
    }


@app.get("/api/live")
def get_live():
    settings = load_settings()
    rssi_min = settings.get("rssi_threshold", -100)
    pi_scanner_id = settings.get("scanner_id", "pi")

    data = ble_scanner.load_data()
    active = ble_scanner.get_active_count(data, rssi_min=rssi_min)

    devices_raw = data.get("devices", {})
    total_tracked = len(devices_raw)
    random_count = sum(1 for d in devices_raw.values() if d.get("random_mac"))
    stable_count = total_tracked - random_count

    scan_log_raw = data.get("scan_log", [])
    last_scan_raw = scan_log_raw[-1] if scan_log_raw else {}

    now = time.time()
    devices_list = []
    for mac, info in sorted(devices_raw.items(), key=lambda x: -x[1]["last_seen"]):
        last = info["last_seen"]
        rssi = info.get("rssi") or -100
        is_random = info.get("random_mac", False)
        window = ble_scanner.RANDOM_MAC_WINDOW if is_random else ble_scanner.OCCUPANCY_WINDOW
        in_window = (now - last) < window
        in_range = rssi >= rssi_min
        is_active = in_window and in_range
        if in_window and not in_range:
            status = "out_of_range"
        elif is_active:
            status = "active"
        else:
            status = "inactive"
        devices_list.append({
            "mac": mac,
            "name": info.get("name") or "",
            "rssi": rssi,
            "type": "random" if is_random else "stable",
            "miss_count": info.get("miss_count", 0),
            "last_seen": datetime.fromtimestamp(last).strftime("%Y-%m-%d %H:%M:%S"),
            "status": status,
        })

    # Per-zone occupancy: load each zone's assigned scanner count
    zones_data = load_zones_data()
    scanner_counts: dict[str, int] = {pi_scanner_id: active}
    zone_occupancy = {}
    for zone in zones_data.get("zones", []):
        sid = zone.get("scanner_id", "pi")
        if sid not in scanner_counts:
            sd = load_scanner_data(sid)
            scanner_counts[sid] = ble_scanner.get_active_count(sd, rssi_min=rssi_min)
        zone_occupancy[zone["id"]] = scanner_counts[sid]

    return {
        "current_occupancy": active,
        "tracked_devices": total_tracked,
        "stable_devices": stable_count,
        "random_devices": random_count,
        "last_scan": {
            "time": datetime.fromtimestamp(last_scan_raw["timestamp"]).strftime("%H:%M:%S")
            if last_scan_raw else "—",
            "found": last_scan_raw.get("found", 0),
            "active": last_scan_raw.get("active", 0),
        },
        "history": [
            {"time": datetime.fromtimestamp(h["timestamp"]).strftime("%H:%M"), "count": h["count"]}
            for h in data.get("history", [])
        ],
        "scan_log": [
            {
                "time": datetime.fromtimestamp(s["timestamp"]).strftime("%H:%M:%S"),
                "found": s.get("found", 0),
                "active": s.get("active", 0),
            }
            for s in reversed(scan_log_raw)
        ],
        "devices": devices_list,
        "zone_occupancy": zone_occupancy,
    }


# ── Settings ──────────────────────────────────────────────────────────────────

class SettingsUpdate(BaseModel):
    rssi_threshold: Optional[int] = None
    ntfy_topic: Optional[str] = None
    alert_cooldown_minutes: Optional[int] = None
    scanner_id: Optional[str] = None


@app.get("/api/settings")
def get_settings():
    return load_settings()


@app.post("/api/settings")
def update_settings(body: SettingsUpdate):
    current = load_settings()
    if body.rssi_threshold is not None:
        if not (-100 <= body.rssi_threshold <= -30):
            raise HTTPException(status_code=422, detail="rssi_threshold must be between -100 and -30")
        current["rssi_threshold"] = body.rssi_threshold
    if body.ntfy_topic is not None:
        current["ntfy_topic"] = body.ntfy_topic.strip()
    if body.alert_cooldown_minutes is not None:
        if body.alert_cooldown_minutes < 1:
            raise HTTPException(status_code=422, detail="alert_cooldown_minutes must be >= 1")
        current["alert_cooldown_minutes"] = body.alert_cooldown_minutes
    if body.scanner_id is not None:
        current["scanner_id"] = body.scanner_id.strip()
    save_settings(current)
    return current


# ── External scanner report ───────────────────────────────────────────────────

class ScannerReport(BaseModel):
    devices: dict  # mac -> {name: str, rssi: int}


@app.post("/api/scanner/{scanner_id}/report")
def scanner_report(scanner_id: str, body: ScannerReport):
    active = process_external_scan(scanner_id, body.devices)
    check_and_alert(scanner_id, active)
    return {"ok": True, "scanner_id": scanner_id, "active": active}


# ── Zones ─────────────────────────────────────────────────────────────────────

class MapConfigBody(BaseModel):
    lat: float
    lng: float
    zoom: int


class ZoneCreate(BaseModel):
    name: str
    color: str
    coordinates: list
    scanner_id: str = "pi"
    threshold: Optional[int] = None


class ZoneUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    coordinates: Optional[list] = None
    scanner_id: Optional[str] = None
    threshold: Optional[int] = None


@app.get("/api/zones")
def get_zones():
    return load_zones_data()


@app.post("/api/zones/config")
def set_map_config(body: MapConfigBody):
    data = load_zones_data()
    data["config"] = body.model_dump()
    save_zones_data(data)
    return data


@app.post("/api/zones")
def create_zone(body: ZoneCreate):
    data = load_zones_data()
    zone = {
        "id": str(int(time.time() * 1000)),
        "name": body.name,
        "color": body.color,
        "coordinates": body.coordinates,
        "scanner_id": body.scanner_id,
        "threshold": body.threshold,
    }
    data["zones"].append(zone)
    save_zones_data(data)
    return zone


@app.put("/api/zones/{zone_id}")
def update_zone(zone_id: str, body: ZoneUpdate):
    data = load_zones_data()
    for zone in data["zones"]:
        if zone["id"] == zone_id:
            if body.name is not None:
                zone["name"] = body.name
            if body.color is not None:
                zone["color"] = body.color
            if body.coordinates is not None:
                zone["coordinates"] = body.coordinates
            if body.scanner_id is not None:
                zone["scanner_id"] = body.scanner_id
            if body.threshold is not None:
                zone["threshold"] = body.threshold
            save_zones_data(data)
            return zone
    raise HTTPException(status_code=404, detail="Zone not found")


@app.delete("/api/zones/{zone_id}")
def delete_zone_endpoint(zone_id: str):
    data = load_zones_data()
    data["zones"] = [z for z in data["zones"] if z["id"] != zone_id]
    save_zones_data(data)
    return {"ok": True}


# ── AI Chat ───────────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []


@app.post("/api/ai/chat")
def ai_chat(body: ChatRequest):
    api_key = os.environ.get("GROQ_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY environment variable not set on the server.")

    settings = load_settings()
    rssi_min = settings.get("rssi_threshold", -100)
    pi_scanner_id = settings.get("scanner_id", "pi")

    data = ble_scanner.load_data()
    active = ble_scanner.get_active_count(data, rssi_min=rssi_min)

    zones_data = load_zones_data()
    scanner_counts: dict[str, int] = {pi_scanner_id: active}
    zones_info = []
    for zone in zones_data.get("zones", []):
        sid = zone.get("scanner_id", "pi")
        if sid not in scanner_counts:
            sd = load_scanner_data(sid)
            scanner_counts[sid] = ble_scanner.get_active_count(sd, rssi_min=rssi_min)
        occupancy = scanner_counts[sid]
        threshold = zone.get("threshold")
        at_risk = threshold is not None and occupancy >= threshold * 0.8
        overcrowded = threshold is not None and occupancy > threshold
        zones_info.append({
            "name": zone["name"],
            "scanner_id": sid,
            "threshold": threshold,
            "occupancy": occupancy,
            "at_risk": at_risk,
            "overcrowded": overcrowded,
        })

    devices_raw = data.get("devices", {})
    total_tracked = len(devices_raw)
    random_count = sum(1 for d in devices_raw.values() if d.get("random_mac"))
    stable_count = total_tracked - random_count

    history_pts = data.get("history", [])[-20:]
    history_str = ", ".join(str(h["count"]) for h in history_pts) if history_pts else "no data"

    if zones_info:
        zones_str = "\n".join(
            f'  - {z["name"]}: {z["occupancy"]} people'
            + (f' / threshold {z["threshold"]}' if z["threshold"] is not None else " (no threshold)")
            + (" [OVERCROWDED]" if z["overcrowded"] else " [AT RISK]" if z["at_risk"] else "")
            for z in zones_info
        )
    else:
        zones_str = "  No zones configured yet."

    system_prompt = f"""You are an AI assistant for a BLE (Bluetooth Low Energy) occupancy monitoring system.
You help facility managers understand crowd levels, identify risks, and make data-driven decisions.

Current snapshot ({datetime.now().strftime("%Y-%m-%d %H:%M:%S")}):

OVERALL:
  Active occupancy: {active} people
  Tracked devices: {total_tracked} total ({stable_count} stable MACs, {random_count} randomised MACs)
  RSSI threshold: {rssi_min} dBm

ZONES:
{zones_str}

RECENT OCCUPANCY HISTORY (oldest→newest, ~20 readings):
  {history_str}

SETTINGS:
  Alert cooldown: {settings.get("alert_cooldown_minutes", 10)} min
  Primary scanner ID: {pi_scanner_id}

Rules:
- Overcrowded = occupancy > threshold.
- At risk = occupancy >= 80% of threshold.
- Be concise (2–4 sentences) unless the user asks for detail.
- If no zones are configured, tell the user to add zones first."""

    messages = [{"role": "system", "content": system_prompt}]
    for msg in body.history[-10:]:
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": body.message})

    payload = json.dumps({
        "model": "llama-3.1-8b-instant",
        "messages": messages,
        "max_tokens": 512,
        "temperature": 0.5,
    }).encode()

    req = urllib.request.Request(
        "https://api.groq.com/openai/v1/chat/completions",
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read())
            reply = result["choices"][0]["message"]["content"]
            return {"reply": reply}
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")
        raise HTTPException(status_code=502, detail=f"Grok API error: {detail}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI request failed: {str(e)}")

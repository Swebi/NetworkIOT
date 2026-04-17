"""
FastAPI server for BLE occupancy monitoring.
Run on the Pi with: uvicorn api:app --host 0.0.0.0 --port 8000
"""
import json
import socket
import time
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import sys
sys.path.insert(0, str(Path(__file__).parent))

import ble_scanner

SETTINGS_FILE = Path(__file__).parent / "settings.json"
ZONES_FILE = Path(__file__).parent / "zones.json"


def load_zones_data() -> dict:
    if ZONES_FILE.exists():
        return json.loads(ZONES_FILE.read_text())
    return {"config": None, "zones": []}


def save_zones_data(data: dict):
    ZONES_FILE.write_text(json.dumps(data, indent=2))


def load_settings() -> dict:
    if SETTINGS_FILE.exists():
        return json.loads(SETTINGS_FILE.read_text())
    return {"rssi_threshold": -100}


def save_settings(s: dict):
    SETTINGS_FILE.write_text(json.dumps(s, indent=2))


def get_local_ip() -> str:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except Exception:
        return "unknown"


# Start scanner once at import time
if ble_scanner.BLEAK_AVAILABLE:
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
    }


class SettingsUpdate(BaseModel):
    rssi_threshold: int


@app.get("/api/settings")
def get_settings():
    return load_settings()


@app.post("/api/settings")
def update_settings(body: SettingsUpdate):
    if not (-100 <= body.rssi_threshold <= -30):
        raise HTTPException(status_code=422, detail="rssi_threshold must be between -100 and -30")
    current = load_settings()
    current["rssi_threshold"] = body.rssi_threshold
    save_settings(current)
    return current


# ── Zones ─────────────────────────────────────────────────────────────────────

class MapConfigBody(BaseModel):
    lat: float
    lng: float
    zoom: int


class ZoneCreate(BaseModel):
    name: str
    color: str
    coordinates: list


class ZoneUpdate(BaseModel):
    name: str = None
    color: str = None
    coordinates: list = None


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
            save_zones_data(data)
            return zone
    raise HTTPException(status_code=404, detail="Zone not found")


@app.delete("/api/zones/{zone_id}")
def delete_zone_endpoint(zone_id: str):
    data = load_zones_data()
    data["zones"] = [z for z in data["zones"] if z["id"] != zone_id]
    save_zones_data(data)
    return {"ok": True}

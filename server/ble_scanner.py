"""
BLE Scanner for Raspberry Pi - detects unique MAC addresses for occupancy counting.
Uses bleak for cross-platform BLE scanning. Devices emit BLE advertisements periodically.
"""
import asyncio
import json
import threading
import time
from pathlib import Path

try:
    from bleak import BleakScanner
    BLEAK_AVAILABLE = True
except ImportError:
    BLEAK_AVAILABLE = False

# Config
DATA_FILE = Path(__file__).parent / "occupancy_data.json"
SCAN_INTERVAL = 5  # seconds between scans
OCCUPANCY_WINDOW = 900  # 15 minutes - device "present" if seen in last 15 min


def load_data() -> dict:
    """Load occupancy data from JSON file."""
    if DATA_FILE.exists():
        try:
            with open(DATA_FILE, "r") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            pass
    return {
        "devices": {},  # mac -> {"first_seen": ts, "last_seen": ts}
        "history": [],  # {"timestamp": ts, "count": n} for charts
        "scan_log": []  # recent scans for debugging
    }


def save_data(data: dict) -> None:
    """Save occupancy data to JSON file."""
    with open(DATA_FILE, "w") as f:
        json.dump(data, f, indent=2)


def get_active_count(data: dict) -> int:
    """Count devices seen in the occupancy window."""
    now = time.time()
    return sum(
        1 for d in data["devices"].values()
        if (now - d["last_seen"]) < OCCUPANCY_WINDOW
    )


async def run_scan() -> dict:
    """Run a single BLE scan and return discovered devices."""
    if not BLEAK_AVAILABLE:
        return {}
    devices = await BleakScanner.discover(timeout=SCAN_INTERVAL)
    return {d.address: {"name": d.name or "Unknown", "rssi": getattr(d, "rssi", None)} for d in devices}


def scanner_loop():
    """Background loop that scans for BLE devices and updates occupancy data."""
    if not BLEAK_AVAILABLE:
        print("bleak not installed - run: pip install bleak")
        return

    while True:
        try:
            devices = asyncio.run(run_scan())
            now = time.time()

            data = load_data()
            for mac, info in devices.items():
                if mac not in data["devices"]:
                    data["devices"][mac] = {"first_seen": now, "last_seen": now, "name": info["name"]}
                else:
                    data["devices"][mac]["last_seen"] = now
                    if info["name"] and info["name"] != "Unknown":
                        data["devices"][mac]["name"] = info["name"]

            # Prune very old devices (not seen in 24h)
            day_ago = now - 86400
            data["devices"] = {k: v for k, v in data["devices"].items() if v["last_seen"] > day_ago}

            # Record history point (keep last 100)
            active = get_active_count(data)
            data["history"].append({"timestamp": now, "count": active})
            data["history"] = data["history"][-100:]

            # Log last scan
            data["scan_log"] = (data.get("scan_log", []) + [{"timestamp": now, "found": len(devices), "active": active}])[-10:]

            save_data(data)
        except Exception as e:
            print(f"Scan error: {e}")
        time.sleep(SCAN_INTERVAL)


def start_scanner_background():
    """Start the BLE scanner in a background thread."""
    t = threading.Thread(target=scanner_loop, daemon=True)
    t.start()
    return t

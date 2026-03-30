"""
BLE Scanner for Raspberry Pi - detects unique MAC addresses for occupancy counting.
Uses bleak with a persistent BleakScanner + callback to avoid the BlueZ
"adapter busy" bug that occurs when asyncio event-loops are repeatedly
created and torn down via asyncio.run().
"""
import asyncio
import json
import threading
import time
from pathlib import Path

try:
    from bleak import BleakScanner, BleakError
    BLEAK_AVAILABLE = True
except ImportError:
    BleakError = Exception  # fallback so except clauses still parse
    BLEAK_AVAILABLE = False

# Last scanner error exposed for the dashboard to display
SCANNER_ERROR: str = ""

# Config
DATA_FILE = Path(__file__).parent / "occupancy_data.json"
SCAN_DURATION = 5          # seconds each scan window lasts
SCAN_PAUSE = 2             # seconds between scan windows
OCCUPANCY_WINDOW = 900     # 15 minutes - device "present" if seen in last 15 min


def load_data() -> dict:
    """Load occupancy data from JSON file."""
    if DATA_FILE.exists():
        try:
            with open(DATA_FILE, "r") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            pass
    return {
        "devices": {},   # mac -> {"first_seen": ts, "last_seen": ts, "name": str}
        "history": [],   # {"timestamp": ts, "count": n} for charts
        "scan_log": []   # recent scans for debugging
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


def _process_scan_results(discovered: dict) -> None:
    """Merge a batch of discovered devices into the persisted data."""
    now = time.time()
    data = load_data()

    for mac, info in discovered.items():
        if mac not in data["devices"]:
            data["devices"][mac] = {
                "first_seen": now,
                "last_seen": now,
                "name": info["name"],
            }
        else:
            data["devices"][mac]["last_seen"] = now
            if info["name"] and info["name"] != "Unknown":
                data["devices"][mac]["name"] = info["name"]

    # Prune very old devices (not seen in 24 h)
    day_ago = now - 86400
    data["devices"] = {
        k: v for k, v in data["devices"].items() if v["last_seen"] > day_ago
    }

    # Record history point (keep last 100)
    active = get_active_count(data)
    data["history"].append({"timestamp": now, "count": active})
    data["history"] = data["history"][-100:]

    # Log last scan
    data["scan_log"] = (
        data.get("scan_log", [])
        + [{"timestamp": now, "found": len(discovered), "active": active}]
    )[-10:]

    save_data(data)
    print(
        f"[BLE] Scan complete: {len(discovered)} found, {active} active in window",
        flush=True,
    )


async def _scan_loop_async() -> None:
    """
    Long-running async loop that keeps a *single* BleakScanner alive.
    Each cycle: start scanning → collect for SCAN_DURATION → stop → process.
    Re-using the same scanner & event loop avoids the BlueZ D-Bus "busy" issue.
    """
    global SCANNER_ERROR

    retry_delay = SCAN_DURATION

    while True:
        discovered: dict[str, dict] = {}

        def _detection_callback(device, advertisement_data):
            """Called for every BLE advertisement received."""
            discovered[device.address] = {
                "name": device.name or advertisement_data.local_name or "Unknown",
                "rssi": advertisement_data.rssi,
            }

        scanner = BleakScanner(detection_callback=_detection_callback)

        try:
            await scanner.start()
            await asyncio.sleep(SCAN_DURATION)
            await scanner.stop()

            SCANNER_ERROR = ""
            retry_delay = SCAN_DURATION

            _process_scan_results(discovered)

        except BleakError as e:
            SCANNER_ERROR = str(e.args[0]) if e.args else str(e)
            print(f"[BLE] Bluetooth error: {SCANNER_ERROR}", flush=True)
            retry_delay = min(retry_delay * 2, 60)
            try:
                await scanner.stop()
            except Exception:
                pass

        except Exception as e:
            SCANNER_ERROR = str(e)
            print(f"[BLE] Scan error: {e}", flush=True)
            retry_delay = min(retry_delay * 2, 60)
            try:
                await scanner.stop()
            except Exception:
                pass

        await asyncio.sleep(SCAN_PAUSE if not SCANNER_ERROR else retry_delay)


def scanner_loop() -> None:
    """
    Entry point for the background thread.
    Creates ONE event loop and runs the async scan loop inside it forever.
    """
    global SCANNER_ERROR
    if not BLEAK_AVAILABLE:
        print("bleak not installed – run: pip install bleak")
        SCANNER_ERROR = "bleak not installed. Run: pip install bleak"
        return

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(_scan_loop_async())
    except Exception as e:
        SCANNER_ERROR = str(e)
        print(f"[BLE] Fatal scanner error: {e}", flush=True)
    finally:
        loop.close()


def start_scanner_background():
    """Start the BLE scanner in a background thread."""
    t = threading.Thread(target=scanner_loop, daemon=True)
    t.start()
    return t

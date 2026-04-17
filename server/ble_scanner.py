"""
BLE Scanner for Raspberry Pi - detects unique MAC addresses for occupancy counting.
Uses bleak with a persistent BleakScanner + callback to avoid the BlueZ
"adapter busy" bug that occurs when asyncio event-loops are repeatedly
created and torn down via asyncio.run().

Handles MAC address randomisation by detecting locally-administered addresses
and expiring them faster.  Tracks consecutive missed scans so devices that
leave the area are removed promptly.
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
OCCUPANCY_WINDOW = 900     # 15 min - stable-MAC device "present" threshold
RANDOM_MAC_WINDOW = 120    # 2 min - random-MAC devices expire much faster
MAX_MISSED_SCANS = 5       # remove device after this many consecutive misses
MAX_MISSED_RANDOM = 2      # stricter limit for random-MAC devices
RSSI_THRESHOLD = -100      # only count devices with RSSI above this (less negative = closer)


# Common BLE manufacturer IDs → friendly names
_MANUFACTURER_NAMES = {
    0x004C: "Apple",
    0x0006: "Microsoft",
    0x0075: "Samsung",
    0x00E0: "Google",
    0x0059: "Nordic Semi",
    0x000D: "Texas Instruments",
    0x0131: "Huawei",
    0x038F: "Xiaomi",
    0x0087: "Garmin",
    0x0157: "Fitbit",
    0x012D: "Sony",
    0x0002: "Intel",
    0x000F: "Broadcom",
    0x0310: "Qualcomm",
}


def _identify_device(device, adv_data) -> str:
    """Best-effort device identification from advertisement data."""
    # Prefer explicit name
    name = device.name or adv_data.local_name
    if name:
        return name

    # Fall back to manufacturer ID
    if adv_data.manufacturer_data:
        for company_id in adv_data.manufacturer_data:
            if company_id in _MANUFACTURER_NAMES:
                return _MANUFACTURER_NAMES[company_id]
        # Unknown manufacturer — return the hex ID for debugging
        first_id = next(iter(adv_data.manufacturer_data))
        return f"Manufacturer 0x{first_id:04X}"

    # Check service UUIDs for hints
    if adv_data.service_uuids:
        return "BLE Peripheral"

    return "Unknown"


def is_random_mac(mac: str) -> bool:
    """Check if a MAC address is locally administered (randomised).

    The second hex digit's bit-1 being set marks a locally-administered
    address, which is the pattern iOS/Android use for BLE privacy.
    """
    try:
        second_char = mac.replace("-", ":").split(":")[0][1]
        return int(second_char, 16) & 0x2 != 0
    except (IndexError, ValueError):
        return False


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


def get_active_count(data: dict, rssi_min: int | None = None) -> int:
    """Count devices seen within their applicable occupancy window.

    Args:
        rssi_min: If set, only count devices with RSSI >= this value.
                  Falls back to the global RSSI_THRESHOLD.
    """
    now = time.time()
    threshold = rssi_min if rssi_min is not None else RSSI_THRESHOLD
    count = 0
    for d in data["devices"].values():
        window = RANDOM_MAC_WINDOW if d.get("random_mac") else OCCUPANCY_WINDOW
        rssi = d.get("rssi") or -100
        if (now - d["last_seen"]) < window and rssi >= threshold:
            count += 1
    return count


def _process_scan_results(discovered: dict) -> None:
    """Merge a batch of discovered devices into the persisted data."""
    now = time.time()
    data = load_data()

    # Increment miss_count for every existing device not seen in this scan
    for mac, dev in data["devices"].items():
        if mac not in discovered:
            dev["miss_count"] = dev.get("miss_count", 0) + 1

    # Merge discovered devices
    for mac, info in discovered.items():
        random = is_random_mac(mac)
        if mac not in data["devices"]:
            data["devices"][mac] = {
                "first_seen": now,
                "last_seen": now,
                "name": info["name"],
                "rssi": info["rssi"],
                "random_mac": random,
                "miss_count": 0,
            }
        else:
            data["devices"][mac]["last_seen"] = now
            data["devices"][mac]["rssi"] = info["rssi"]
            data["devices"][mac]["miss_count"] = 0
            if info["name"] and info["name"] != "Unknown":
                data["devices"][mac]["name"] = info["name"]

    # Prune devices that have missed too many consecutive scans
    pruned: dict = {}
    for mac, dev in data["devices"].items():
        miss = dev.get("miss_count", 0)
        limit = MAX_MISSED_RANDOM if dev.get("random_mac") else MAX_MISSED_SCANS
        if miss < limit:
            pruned[mac] = dev
    data["devices"] = pruned

    # Also prune anything older than 24 h as a safety net
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
        f"[BLE] Scan complete: {len(discovered)} found, {active} active "
        f"({len(data['devices'])} tracked)",
        flush=True,
    )


async def _scan_loop_async() -> None:
    """
    Keeps a single BleakScanner open permanently — no start/stop cycling.
    BlueZ's StopDiscovery is async under the hood, so repeated start/stop
    within the same process causes InProgress errors.  Instead we hold the
    scanner open and clear the accumulator every SCAN_DURATION seconds.
    """
    global SCANNER_ERROR

    discovered: dict[str, dict] = {}

    def _detection_callback(device, advertisement_data):
        discovered[device.address] = {
            "name": _identify_device(device, advertisement_data),
            "rssi": advertisement_data.rssi,
        }

    retry_delay = SCAN_PAUSE

    while True:
        try:
            async with BleakScanner(detection_callback=_detection_callback):
                SCANNER_ERROR = ""
                print("[BLE] Scanner started — running continuously.", flush=True)
                while True:
                    await asyncio.sleep(SCAN_DURATION)
                    snapshot = dict(discovered)
                    discovered.clear()
                    _process_scan_results(snapshot)
                    await asyncio.sleep(SCAN_PAUSE)

        except BleakError as e:
            SCANNER_ERROR = str(e.args[0]) if e.args else str(e)
            print(f"[BLE] Bluetooth error: {SCANNER_ERROR}", flush=True)
            await asyncio.sleep(retry_delay)
            retry_delay = min(retry_delay * 2, 60)

        except Exception as e:
            SCANNER_ERROR = str(e)
            print(f"[BLE] Scan error: {e}", flush=True)
            await asyncio.sleep(retry_delay)
            retry_delay = min(retry_delay * 2, 60)


def scanner_loop() -> None:
    """
    Entry point for the background thread.
    Creates ONE event loop and runs the async scan loop inside it forever.
    """
    import subprocess

    global SCANNER_ERROR
    if not BLEAK_AVAILABLE:
        print("bleak not installed – run: pip install bleak")
        SCANNER_ERROR = "bleak not installed. Run: pip install bleak"
        return

    # BlueZ keeps a scan descriptor alive for a few seconds after the previous
    # process dies.  Explicitly stopping discovery clears it before we start.
    try:
        subprocess.run(
            ["bluetoothctl", "--", "scan", "off"],
            capture_output=True,
            timeout=3,
        )
        time.sleep(1)
    except Exception:
        pass

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

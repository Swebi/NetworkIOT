"""
Streamlit dashboard for BLE-based occupancy monitoring on Raspberry Pi.
Run with: streamlit run dashboard.py
"""
import time
from datetime import datetime
from pathlib import Path

import streamlit as st
import pandas as pd

# Add parent for imports
import sys
sys.path.insert(0, str(Path(__file__).parent))

import ble_scanner  # import the module so we can read mutable globals live

# Page config
st.set_page_config(
    page_title="BLE Occupancy Monitor",
    page_icon="📡",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Custom CSS — uses theme-aware CSS variables for dark/light compatibility
st.markdown("""
<style>
    [data-testid="stMetric"] {
        padding: 1rem;
        border-radius: 8px;
        border-left: 4px solid #1f77b4;
    }
</style>
""", unsafe_allow_html=True)

# Start scanner in background (only once)
if "scanner_started" not in st.session_state:
    if ble_scanner.BLEAK_AVAILABLE:
        ble_scanner.start_scanner_background()
        st.session_state.scanner_started = True
    else:
        st.session_state.scanner_started = False

# Sidebar
with st.sidebar:
    st.title("📡 BLE Occupancy")
    st.caption("Raspberry Pi Bluetooth Monitor")
    st.divider()

    if not ble_scanner.BLEAK_AVAILABLE:
        st.error("⚠️ bleak not installed")
        st.code("pip install bleak", language="bash")
    elif ble_scanner.SCANNER_ERROR:
        st.warning(f"⚠️ {ble_scanner.SCANNER_ERROR}")
        st.caption("Run `sudo bluetoothctl power on` to fix this.")
    else:
        st.success("✅ Scanner running")

    st.divider()

    rssi_threshold = st.slider(
        "RSSI filter (range)",
        min_value=-100,
        max_value=-30,
        value=-100,
        step=5,
        help="Only count devices stronger than this. -50 ≈ 1m, -65 ≈ 3-5m, -80 ≈ 10m",
    )

    st.divider()
    if st.button("🔄 Refresh"):
        st.rerun()

    st.caption(f"Stable MAC window: {ble_scanner.OCCUPANCY_WINDOW // 60} min")
    st.caption(f"Random MAC window: {ble_scanner.RANDOM_MAC_WINDOW // 60} min")

# Main content
st.title("Occupancy Dashboard")
st.caption("Unique BLE devices detected (phones, wearables, etc.)")

# Load data
data = ble_scanner.load_data()
active = ble_scanner.get_active_count(data, rssi_min=rssi_threshold)
total_tracked = len(data["devices"])
random_count = sum(1 for d in data["devices"].values() if d.get("random_mac"))
stable_count = total_tracked - random_count

# KPI row
col1, col2, col3, col4 = st.columns(4)
with col1:
    st.metric("Current Occupancy", active, help="Devices currently present (random MACs expire after 2 min)")
with col2:
    st.metric("Tracked Devices", total_tracked, help=f"{stable_count} stable + {random_count} random MAC")
with col3:
    scan_log_list = data.get("scan_log", [])
    last_scan = scan_log_list[-1] if scan_log_list else {}
    last_ts = last_scan.get("timestamp", 0)
    st.metric("Last Scan", datetime.fromtimestamp(last_ts).strftime("%H:%M:%S") if last_ts else "—")
with col4:
    st.metric("Devices in Last Scan", last_scan.get("found", 0))

st.divider()

# Charts row
col_left, col_right = st.columns(2)

with col_left:
    st.subheader("Occupancy Over Time")
    history = data.get("history", [])
    if history:
        df = pd.DataFrame(history)
        df["time"] = pd.to_datetime(df["timestamp"], unit="s")
        st.line_chart(df.set_index("time")["count"])
    else:
        st.info("No history yet — waiting for scans to complete.")

with col_right:
    st.subheader("Recent Scans")
    scan_log = data.get("scan_log", [])
    if scan_log:
        df_scans = pd.DataFrame(reversed(scan_log))
        df_scans["time"] = df_scans["timestamp"].apply(
            lambda t: datetime.fromtimestamp(t).strftime("%H:%M:%S")
        )
        st.dataframe(
            df_scans[["time", "found", "active"]].rename(
                columns={"time": "Time", "found": "Found", "active": "Active"}
            ),
            hide_index=True,
        )
    else:
        st.info("No scan data yet.")

st.divider()

# Device table
st.subheader("Detected Devices")
devices = data.get("devices", {})
if devices:
    rows = []
    now = time.time()
    for mac, info in sorted(devices.items(), key=lambda x: -x[1]["last_seen"]):
        last = info["last_seen"]
        rssi = info.get("rssi") or -100
        random = info.get("random_mac", False)
        window = ble_scanner.RANDOM_MAC_WINDOW if random else ble_scanner.OCCUPANCY_WINDOW
        in_window = (now - last) < window
        in_range = rssi >= rssi_threshold
        is_active = in_window and in_range
        rows.append({
            "MAC Address": mac,
            "Name": info.get("name", "—"),
            "RSSI": rssi,
            "Type": "Random" if random else "Stable",
            "Missed": info.get("miss_count", 0),
            "Last Seen": datetime.fromtimestamp(last).strftime("%Y-%m-%d %H:%M:%S"),
            "Status": "🟢 Active" if is_active else ("📡 Out of range" if in_window and not in_range else "⚪ Inactive"),
        })
    st.dataframe(pd.DataFrame(rows), hide_index=True)
else:
    st.info("No devices detected yet. Make sure Bluetooth is enabled and devices are nearby.")

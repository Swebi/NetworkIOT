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

# Custom CSS for a cleaner look
st.markdown("""
<style>
    .big-metric {
        font-size: 3rem;
        font-weight: 700;
        color: #1f77b4;
    }
    .stMetric {
        background: #f8f9fa;
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
    if st.button("🔄 Refresh"):
        st.rerun()

    st.caption(f"Occupancy window: {ble_scanner.OCCUPANCY_WINDOW // 60} min")

# Main content
st.title("Occupancy Dashboard")
st.caption("Unique BLE devices detected (phones, wearables, etc.)")

# Load data
data = ble_scanner.load_data()
active = ble_scanner.get_active_count(data)
total_ever = len(data["devices"])

# KPI row
col1, col2, col3, col4 = st.columns(4)
with col1:
    st.metric("Current Occupancy", active, help="Devices seen in the last 15 min")
with col2:
    st.metric("Total Unique Devices", total_ever, help="All devices ever seen (last 24 h)")
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
    for mac, info in sorted(devices.items(), key=lambda x: -x[1]["last_seen"]):
        last = info["last_seen"]
        is_active = (time.time() - last) < ble_scanner.OCCUPANCY_WINDOW
        rows.append({
            "MAC Address": mac,
            "Name": info.get("name", "—"),
            "Last Seen": datetime.fromtimestamp(last).strftime("%Y-%m-%d %H:%M:%S"),
            "Status": "🟢 Active" if is_active else "⚪ Inactive",
        })
    st.dataframe(pd.DataFrame(rows), hide_index=True)
else:
    st.info("No devices detected yet. Make sure Bluetooth is enabled and devices are nearby.")

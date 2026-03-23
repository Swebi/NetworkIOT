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

from ble_scanner import load_data, get_active_count, start_scanner_background, BLEAK_AVAILABLE, OCCUPANCY_WINDOW

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
    if BLEAK_AVAILABLE:
        start_scanner_background()
        st.session_state.scanner_started = True
    else:
        st.session_state.scanner_started = False

# Sidebar
with st.sidebar:
    st.title("📡 BLE Occupancy")
    st.caption("Raspberry Pi Bluetooth Monitor")
    st.divider()

    if not BLEAK_AVAILABLE:
        st.error("⚠️ bleak not installed")
        st.code("pip install bleak", language="bash")
    else:
        st.success("Scanner running")

    st.divider()
    if st.button("🔄 Refresh"):
        st.rerun()

    st.caption(f"Occupancy window: {OCCUPANCY_WINDOW // 60} min")

# Main content
st.title("Occupancy Dashboard")
st.caption("Unique BLE devices detected (phones, wearables, etc.)")

# Load data
data = load_data()
active = get_active_count(data)
total_ever = len(data["devices"])

# KPI row
col1, col2, col3, col4 = st.columns(4)
with col1:
    st.metric("Current occupancy", active, help="Devices seen in last 15 min")
with col2:
    st.metric("Total unique devices", total_ever, help="All devices ever seen")
with col3:
    scan_log_list = data.get("scan_log", [])
    last_scan = scan_log_list[-1] if scan_log_list else {}
    last_ts = last_scan.get("timestamp", 0)
    st.metric("Last scan", datetime.fromtimestamp(last_ts).strftime("%H:%M:%S") if last_ts else "—")
with col4:
    st.metric("Devices in last scan", last_scan.get("found", 0))

st.divider()

# Charts row
col_left, col_right = st.columns(2)

with col_left:
    st.subheader("Occupancy over time")
    history = data.get("history", [])
    if history:
        df = pd.DataFrame(history)
        df["time"] = pd.to_datetime(df["timestamp"], unit="s")
        st.line_chart(df.set_index("time")["count"])
    else:
        st.info("No history yet. Wait for scans to complete.")

with col_right:
    st.subheader("Recent scans")
    scan_log = data.get("scan_log", [])
    if scan_log:
        df_scans = pd.DataFrame(reversed(scan_log))
        df_scans["time"] = df_scans["timestamp"].apply(lambda t: datetime.fromtimestamp(t).strftime("%H:%M:%S"))
        st.dataframe(df_scans[["time", "found", "active"]].rename(columns={"time": "Time", "found": "Found", "active": "Active"}), use_container_width=True, hide_index=True)
    else:
        st.info("No scan data yet.")

st.divider()

# Device table
st.subheader("Detected devices")
devices = data.get("devices", {})
if devices:
    # Sort by last_seen descending
    rows = []
    for mac, info in sorted(devices.items(), key=lambda x: -x[1]["last_seen"]):
        last = info["last_seen"]
        is_active = (time.time() - last) < OCCUPANCY_WINDOW
        rows.append({
            "MAC Address": mac,
            "Name": info.get("name", "—"),
            "Last seen": datetime.fromtimestamp(last).strftime("%Y-%m-%d %H:%M:%S"),
            "Status": "🟢 Active" if is_active else "⚪ Inactive",
        })
    st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)
else:
    st.info("No devices detected yet. Make sure Bluetooth is enabled and devices are nearby.")

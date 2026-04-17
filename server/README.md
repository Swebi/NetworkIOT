# BLE Occupancy Monitor for Raspberry Pi

Uses the Pi's Bluetooth to detect unique MAC addresses (phones, wearables, etc.) and visualizes occupancy in a Streamlit dashboard.

## Setup on Raspberry Pi

```bash
# Install system deps (BlueZ for Bluetooth)
sudo apt update
sudo apt install -y python3-pip python3-venv libbluetooth-dev

# Create venv and install
cd server
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Run

```bash
source venv/bin/activate
streamlit run dashboard.py
```

Then open `http://<pi-ip>:8501` in a browser.

## How it works

- **BLE scanning**: Uses `bleak` to scan for Bluetooth Low Energy devices every 5 seconds
- **Occupancy**: A device counts as "present" if seen in the last 15 minutes
- **Storage**: Data is saved to `occupancy_data.json` in the server folder

## Notes

- **Bluetooth permissions**: On some setups you may need `sudo` or add your user to the `bluetooth` group: `sudo usermod -aG bluetooth $USER`
- **Privacy**: MAC addresses are randomized on many modern devices; treat counts as estimates, not exact people
- **Range**: BLE range is typically 10–30m indoors


uvicorn api:app --host 0.0.0.0 --port 8000
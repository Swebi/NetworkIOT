#!/bin/bash
# Unblock and power on the Bluetooth adapter.
# Called by bluetooth-init.service on every boot.

rfkill unblock bluetooth

# Wait for bluez to be ready (the .Busy race condition)
sleep 2

bluetoothctl power on

echo "Bluetooth powered on successfully."

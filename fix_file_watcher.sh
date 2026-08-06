#!/bin/bash
# Permanent fix for "ENOSPC: System limit for number of file watchers reached"
# Run these commands with sudo

echo "=========================================="
echo "Fixing inotify file watcher limit"
echo "=========================================="
echo ""

# Check current limit
echo "Current limit:"
cat /proc/sys/fs/inotify/max_user_watches
echo ""

# Add to sysctl.conf (permanent)
echo "Step 1: Adding to /etc/sysctl.conf..."
echo "fs.inotify.max_user_watches=524288" | sudo tee -a /etc/sysctl.conf

# Apply immediately (without reboot)
echo ""
echo "Step 2: Applying changes..."
sudo sysctl -p

# Verify
echo ""
echo "New limit (should be 524288):"
cat /proc/sys/fs/inotify/max_user_watches

echo ""
echo "=========================================="
echo "Done! The limit is now permanently increased."
echo "You can now run 'npm run dev' without issues."
echo "=========================================="


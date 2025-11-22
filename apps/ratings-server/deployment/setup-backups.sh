#!/bin/bash
set -e

echo "🌍 Setting up Earth Reclaim backup system..."

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root (sudo ./setup-backups.sh)"
    exit 1
fi

# Create directories
echo "Creating backup directories..."
mkdir -p /var/backups/earth-reclaim/{daily,wal,audit}
mkdir -p /opt/earth-reclaim

# Copy scripts
echo "Installing backup scripts..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cp "$SCRIPT_DIR/postgres-backup.sh" /opt/earth-reclaim/
cp "$SCRIPT_DIR/integrity-check.sh" /opt/earth-reclaim/
chmod +x /opt/earth-reclaim/*.sh

# Create config file
cat > /opt/earth-reclaim/config.env << 'EOF'
# Earth Reclaim Backup Configuration
DB_NAME=earth_reclaim_ratings
DB_USER=earthuser
DB_HOST=localhost

# Alert webhook (Slack, Discord, etc.)
ALERT_WEBHOOK=

# Remote backup (configure rclone separately)
REMOTE_BACKUP_ENABLED=false
REMOTE_BACKUP_TARGET=remote:earth-backups/
EOF

echo "Configuration file created at /opt/earth-reclaim/config.env"

# Set up cron jobs
echo "Setting up cron jobs..."

# Remove existing earth-reclaim cron entries
crontab -l 2>/dev/null | grep -v "earth-reclaim" > /tmp/crontab.tmp || true

# Add new entries
cat >> /tmp/crontab.tmp << 'EOF'
# Earth Reclaim - Daily backup at 3 AM
0 3 * * * source /opt/earth-reclaim/config.env && /opt/earth-reclaim/postgres-backup.sh >> /var/log/earth-reclaim-backup.log 2>&1

# Earth Reclaim - Hourly integrity check
0 * * * * source /opt/earth-reclaim/config.env && /opt/earth-reclaim/integrity-check.sh >> /var/log/earth-reclaim-integrity.log 2>&1
EOF

crontab /tmp/crontab.tmp
rm /tmp/crontab.tmp

# Create log files
touch /var/log/earth-reclaim-backup.log
touch /var/log/earth-reclaim-integrity.log
chmod 644 /var/log/earth-reclaim-*.log

# Set permissions
chown -R postgres:postgres /var/backups/earth-reclaim

echo ""
echo "✅ Backup system configured!"
echo ""
echo "📋 Next steps:"
echo "1. Edit configuration: nano /opt/earth-reclaim/config.env"
echo "2. Test backup: /opt/earth-reclaim/postgres-backup.sh"
echo "3. Test integrity: /opt/earth-reclaim/integrity-check.sh"
echo "4. Verify restore: pg_restore --list /var/backups/earth-reclaim/daily/backup_*.dump.gz"
echo ""
echo "📊 Logs:"
echo "  - Backup log: /var/log/earth-reclaim-backup.log"
echo "  - Integrity log: /var/log/earth-reclaim-integrity.log"
echo ""
echo "🔧 Optional - Configure remote backup:"
echo "  1. Install rclone: curl https://rclone.org/install.sh | sudo bash"
echo "  2. Configure: rclone config"
echo "  3. Set REMOTE_BACKUP_ENABLED=true in config.env"

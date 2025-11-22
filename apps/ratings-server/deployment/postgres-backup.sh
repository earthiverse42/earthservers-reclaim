#!/bin/bash
set -e

BACKUP_DIR="/var/backups/earth-reclaim"
RETENTION_DAYS=30
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# PostgreSQL connection
DB_NAME="${DB_NAME:-earth_reclaim_ratings}"
DB_USER="${DB_USER:-earthuser}"
DB_HOST="${DB_HOST:-localhost}"

echo "🌍 Starting Earth Reclaim backup: $TIMESTAMP"

# Create backup directory
mkdir -p "$BACKUP_DIR/daily"
mkdir -p "$BACKUP_DIR/wal"

# Full database dump with compression
pg_dump -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" \
  --format=custom \
  --file="$BACKUP_DIR/daily/backup_$TIMESTAMP.dump" \
  --verbose

# Compress it further
gzip "$BACKUP_DIR/daily/backup_$TIMESTAMP.dump"

# Generate checksum
sha256sum "$BACKUP_DIR/daily/backup_$TIMESTAMP.dump.gz" > \
  "$BACKUP_DIR/daily/backup_$TIMESTAMP.sha256"

# Backup the audit log separately (extra safety)
pg_dump -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" \
  --table=rating_audit_log \
  --format=custom \
  --file="$BACKUP_DIR/daily/audit_log_$TIMESTAMP.dump"
gzip "$BACKUP_DIR/daily/audit_log_$TIMESTAMP.dump"

# Archive WAL files (for point-in-time recovery)
if [ -d "/var/lib/postgresql/data/pg_wal" ]; then
  rsync -av /var/lib/postgresql/data/pg_wal/ "$BACKUP_DIR/wal/"
fi

# Remove backups older than retention period
find "$BACKUP_DIR/daily" -name "backup_*.gz" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR/daily" -name "audit_*.gz" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR/daily" -name "*.sha256" -mtime +$RETENTION_DAYS -delete

# Backup size
BACKUP_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
echo "✅ Backup complete. Total size: $BACKUP_SIZE"

# Optional: Upload to remote storage
# Uncomment and configure as needed:
# rclone copy "$BACKUP_DIR/daily/backup_$TIMESTAMP.dump.gz" remote:earth-backups/

# Optional: Upload to IPFS
# IPFS_HASH=$(ipfs add -q "$BACKUP_DIR/daily/backup_$TIMESTAMP.dump.gz")
# echo "$IPFS_HASH" > "$BACKUP_DIR/daily/backup_$TIMESTAMP.ipfs"
# echo "IPFS hash: $IPFS_HASH"

echo "📊 Backup details:"
echo "  - Full backup: backup_$TIMESTAMP.dump.gz"
echo "  - Audit log: audit_log_$TIMESTAMP.dump"
echo "  - Checksum: backup_$TIMESTAMP.sha256"

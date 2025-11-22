#!/bin/bash
set -e

DB_NAME="${DB_NAME:-earth_reclaim_ratings}"
DB_HOST="${DB_HOST:-localhost}"
DB_USER="${DB_USER:-earthuser}"

ALERT_WEBHOOK="${ALERT_WEBHOOK:-}"

echo "🔍 Running integrity checks at $(date)"

send_alert() {
    local message="$1"
    echo "⚠️  ALERT: $message"
    if [ -n "$ALERT_WEBHOOK" ]; then
        curl -s -X POST "$ALERT_WEBHOOK" \
            -H "Content-Type: application/json" \
            -d "{\"text\": \"Earth Reclaim Alert: $message\"}" || true
    fi
}

# Check 1: Verify audit log hash integrity (sample check)
echo "Checking audit log hash integrity..."
INVALID_COUNT=$(psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -t -c "
    WITH hash_check AS (
        SELECT
            id,
            change_hash,
            encode(digest(
                COALESCE(rating_id::text, '') || '|' ||
                domain_url || '|' ||
                user_hash || '|' ||
                COALESCE(trust_level::text, '') || '|' ||
                COALESCE(bias_level::text, '') || '|' ||
                COALESCE(comment, '')
            , 'sha256'), 'hex') as computed_hash
        FROM rating_audit_log
        ORDER BY id DESC
        LIMIT 1000
    )
    SELECT COUNT(*) FROM hash_check
    WHERE change_hash != computed_hash
" | tr -d ' ')

if [ "$INVALID_COUNT" -gt 0 ]; then
    send_alert "Audit log integrity compromised! $INVALID_COUNT invalid hashes found."
else
    echo "✅ Audit log hashes valid (checked last 1000 entries)"
fi

# Check 2: Look for suspicious mass deletions
echo "Checking for suspicious deletions..."
RECENT_DELETES=$(psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -t -c "
    SELECT COUNT(*) FROM rating_audit_log
    WHERE action_type = 'DELETE'
    AND changed_at > NOW() - INTERVAL '1 hour'
" | tr -d ' ')

if [ "$RECENT_DELETES" -gt 100 ]; then
    send_alert "Unusual deletion activity: $RECENT_DELETES deletions in last hour!"
else
    echo "✅ Deletion activity normal ($RECENT_DELETES in last hour)"
fi

# Check 3: Verify ratings have audit trail
echo "Checking for orphaned ratings..."
ORPHANED_COUNT=$(psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -t -c "
    SELECT COUNT(*) FROM domain_ratings r
    WHERE NOT EXISTS (
        SELECT 1 FROM rating_audit_log a
        WHERE a.rating_id = r.id
    )
" | tr -d ' ')

if [ "$ORPHANED_COUNT" -gt 0 ]; then
    send_alert "Found $ORPHANED_COUNT ratings without audit trail!"
else
    echo "✅ All ratings have audit entries"
fi

# Check 4: Verify aggregates are up to date
echo "Checking aggregate freshness..."
STALE_AGGREGATES=$(psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -t -c "
    SELECT COUNT(*) FROM domain_rating_aggregates
    WHERE updated_at < NOW() - INTERVAL '1 day'
" | tr -d ' ')

if [ "$STALE_AGGREGATES" -gt 0 ]; then
    echo "⚠️  $STALE_AGGREGATES aggregates are more than 1 day old"
fi

# Check 5: Database connection and performance
echo "Checking database health..."
DB_SIZE=$(psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -t -c "
    SELECT pg_size_pretty(pg_database_size('$DB_NAME'))
" | tr -d ' ')

TOTAL_RATINGS=$(psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -t -c "
    SELECT COUNT(*) FROM domain_ratings
" | tr -d ' ')

TOTAL_AUDIT=$(psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -t -c "
    SELECT COUNT(*) FROM rating_audit_log
" | tr -d ' ')

echo "📊 Database stats:"
echo "  - Size: $DB_SIZE"
echo "  - Total ratings: $TOTAL_RATINGS"
echo "  - Audit entries: $TOTAL_AUDIT"

# Check 6: Replication lag (if replica)
REPLICATION_LAG=$(psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -t -c "
    SELECT EXTRACT(EPOCH FROM (NOW() - pg_last_xact_replay_timestamp()))
    WHERE pg_is_in_recovery()
" 2>/dev/null | tr -d ' ')

if [ -n "$REPLICATION_LAG" ] && [ "$REPLICATION_LAG" != "" ]; then
    if (( $(echo "$REPLICATION_LAG > 60" | bc -l) )); then
        send_alert "Replication lag is ${REPLICATION_LAG}s!"
    else
        echo "✅ Replication lag: ${REPLICATION_LAG}s"
    fi
fi

echo ""
echo "✅ Integrity check complete at $(date)"

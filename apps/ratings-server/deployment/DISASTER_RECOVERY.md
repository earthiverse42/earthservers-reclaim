# Earth Reclaim - Disaster Recovery

## Overview

This document outlines procedures for recovering the Earth Reclaim ratings database in various disaster scenarios.

## Backup Locations

- **Daily backups**: `/var/backups/earth-reclaim/daily/`
- **WAL archives**: `/var/backups/earth-reclaim/wal/`
- **Remote backups**: Configure rclone for cloud storage
- **IPFS backups**: Optional decentralized backup

---

## Scenario 1: Database Corruption

### Symptoms
- Application errors accessing database
- PostgreSQL reporting corruption
- Inconsistent query results

### Recovery Steps

```bash
# 1. Stop the application
systemctl stop earth-ratings

# 2. Find latest backup
ls -la /var/backups/earth-reclaim/daily/backup_*.dump.gz | tail -5

# 3. Verify backup integrity
sha256sum -c /var/backups/earth-reclaim/daily/backup_YYYYMMDD_HHMMSS.sha256

# 4. Drop corrupted database
dropdb earth_reclaim_ratings

# 5. Create fresh database
createdb earth_reclaim_ratings

# 6. Restore from backup
gunzip -c /var/backups/earth-reclaim/daily/backup_YYYYMMDD_HHMMSS.dump.gz | \
  pg_restore -d earth_reclaim_ratings

# 7. Verify integrity
psql -d earth_reclaim_ratings -c "SELECT COUNT(*) FROM domain_ratings"
psql -d earth_reclaim_ratings -c "SELECT COUNT(*) FROM rating_audit_log"

# 8. Run integrity check
./integrity-check.sh

# 9. Restart application
systemctl start earth-ratings
```

---

## Scenario 2: Malicious Data Modification

### Symptoms
- Unexpected changes to ratings
- Hash mismatches in audit log
- Suspicious DELETE activity in audit log

### Recovery Steps

```bash
# 1. Stop the application immediately
systemctl stop earth-ratings

# 2. Identify the extent of damage
psql -d earth_reclaim_ratings -c "
    SELECT action_type, COUNT(*), MIN(changed_at), MAX(changed_at)
    FROM rating_audit_log
    WHERE changed_at > NOW() - INTERVAL '24 hours'
    GROUP BY action_type
"

# 3. If audit log is intact, rebuild from it
```

```sql
-- Connect to database
psql -d earth_reclaim_ratings

-- Backup current state (just in case)
CREATE TABLE domain_ratings_backup AS SELECT * FROM domain_ratings;

-- Truncate corrupted table
TRUNCATE domain_ratings CASCADE;

-- Replay audit log (reconstruct all ratings from INSERT/UPDATE history)
INSERT INTO domain_ratings (id, domain_url, user_hash, trust_level, bias_level, comment, created_at, updated_at)
SELECT DISTINCT ON (rating_id)
    rating_id as id,
    domain_url,
    user_hash,
    trust_level,
    bias_level,
    comment,
    (SELECT MIN(changed_at) FROM rating_audit_log a2 WHERE a2.rating_id = a.rating_id) as created_at,
    changed_at as updated_at
FROM rating_audit_log a
WHERE action_type IN ('INSERT', 'UPDATE')
  AND rating_id NOT IN (
    SELECT rating_id FROM rating_audit_log WHERE action_type = 'DELETE'
  )
ORDER BY rating_id, changed_at DESC;

-- Reset sequence
SELECT setval('domain_ratings_id_seq', (SELECT MAX(id) FROM domain_ratings));

-- Refresh all aggregates
INSERT INTO domain_rating_aggregates (domain_url, avg_trust_level, avg_bias_level, total_ratings, trust_distribution, bias_distribution)
SELECT
    domain_url,
    AVG(trust_level::float),
    AVG(bias_level::float),
    COUNT(*),
    jsonb_object_agg(trust_level::text, trust_count),
    jsonb_object_agg(bias_level::text, bias_count)
FROM (
    SELECT
        domain_url,
        trust_level,
        bias_level,
        COUNT(*) OVER (PARTITION BY domain_url, trust_level) as trust_count,
        COUNT(*) OVER (PARTITION BY domain_url, bias_level) as bias_count
    FROM domain_ratings
) sub
GROUP BY domain_url
ON CONFLICT (domain_url) DO UPDATE SET
    avg_trust_level = EXCLUDED.avg_trust_level,
    avg_bias_level = EXCLUDED.avg_bias_level,
    total_ratings = EXCLUDED.total_ratings,
    trust_distribution = EXCLUDED.trust_distribution,
    bias_distribution = EXCLUDED.bias_distribution,
    updated_at = NOW();
```

```bash
# 4. Verify reconstruction
./integrity-check.sh

# 5. Restart application
systemctl start earth-ratings
```

---

## Scenario 3: Primary Server Failure

### Symptoms
- Server unreachable
- Database connection failures

### Recovery Steps (If Using Replica)

```bash
# On replica server:

# 1. Verify replica is caught up
psql -c "SELECT pg_last_xact_replay_timestamp()"

# 2. Promote replica to primary
sudo -u postgres pg_ctl promote -D /var/lib/postgresql/16/main

# 3. Update DNS/load balancer to point to new primary
# (varies by infrastructure)

# 4. Update application config
export DATABASE_URL="postgres://user:pass@new-primary:5432/earth_reclaim_ratings"

# 5. Restart application pointing to new primary
systemctl restart earth-ratings

# 6. Set up new replica from old primary (when recovered)
# Follow PostgreSQL streaming replication setup
```

### Recovery Steps (No Replica)

```bash
# 1. Provision new server

# 2. Install PostgreSQL
apt-get install postgresql-16

# 3. Create database
createdb earth_reclaim_ratings

# 4. Restore from off-site backup
rclone copy remote:earth-backups/daily/backup_latest.dump.gz ./
# OR from IPFS
ipfs get $(cat latest_ipfs_hash.txt) -o backup_latest.dump.gz

# 5. Restore database
gunzip -c backup_latest.dump.gz | pg_restore -d earth_reclaim_ratings

# 6. Update DNS and restart application
```

---

## Scenario 4: Complete Data Loss

### Symptoms
- Both primary and backups inaccessible
- Catastrophic failure

### Recovery Options

1. **From IPFS (if configured)**
```bash
# Get latest IPFS hash from documentation/records
ipfs get QmXXXXXX -o backup_recovery.dump.gz
gunzip -c backup_recovery.dump.gz | pg_restore -d earth_reclaim_ratings
```

2. **From users' local caches**
   - Desktop app stores local domain ratings
   - Can rebuild aggregate data from user submissions
   - Contact community for backup assistance

3. **Fresh start with seeded data**
```bash
# Run migrations to create tables
cargo run -- migrate

# Seed with default domain lists
# (uses bundled .earth files from desktop app)
```

---

## Verification Checklist

After any recovery, verify:

- [ ] All tables exist: `\dt` in psql
- [ ] Rating count matches expectation
- [ ] Audit log count reasonable
- [ ] Aggregates are populated
- [ ] Hash integrity passes: `./integrity-check.sh`
- [ ] Application can read/write
- [ ] API health endpoints return healthy

---

## Prevention Measures

1. **Daily backups**: Ensure cron job running
2. **Integrity checks**: Hourly via cron
3. **Replication**: Configure streaming replica
4. **Off-site backups**: rclone to cloud storage
5. **Monitoring**: Alert on backup failures

---

## Contacts

- Database Admin: [TBD]
- On-call: [TBD]
- Cloud Provider Support: [TBD]

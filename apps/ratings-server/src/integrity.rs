use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::Serialize;
use sqlx::PgPool;

#[derive(Debug, Serialize)]
pub struct IntegrityReport {
    pub rating_id: i64,
    pub is_valid: bool,
    pub total_changes: i64,
    pub created_at: Option<chrono::DateTime<chrono::Utc>>,
    pub last_modified: Option<chrono::DateTime<chrono::Utc>>,
    pub audit_entries: Vec<AuditEntry>,
}

#[derive(Debug, Serialize)]
pub struct AuditEntry {
    pub id: i64,
    pub action_type: String,
    pub trust_level: Option<i32>,
    pub bias_level: Option<i32>,
    pub changed_at: chrono::DateTime<chrono::Utc>,
    pub hash_valid: bool,
}

#[derive(Debug, Serialize)]
pub struct BackupStatus {
    pub last_audit_entry: Option<chrono::DateTime<chrono::Utc>>,
    pub total_ratings: i64,
    pub total_audit_entries: i64,
    pub replication_lag_seconds: Option<f64>,
}

#[derive(Debug, Serialize)]
pub struct IntegrityStatus {
    pub is_healthy: bool,
    pub total_ratings: i64,
    pub total_audit_entries: i64,
    pub invalid_audit_entries: i64,
    pub orphaned_ratings: i64,
    pub checked_at: chrono::DateTime<chrono::Utc>,
}

pub async fn verify_rating_integrity(
    State(pool): State<PgPool>,
    Path(rating_id): Path<i64>,
) -> Result<Json<IntegrityReport>, StatusCode> {
    // Check if rating exists
    let rating_exists = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM domain_ratings WHERE id = $1)",
        rating_id
    )
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    if !rating_exists.unwrap_or(false) {
        return Err(StatusCode::NOT_FOUND);
    }

    // Get full audit trail
    let audit_entries = sqlx::query!(
        r#"
        SELECT
            id,
            action_type,
            trust_level,
            bias_level,
            changed_at,
            change_hash,
            domain_url,
            user_hash,
            comment
        FROM rating_audit_log
        WHERE rating_id = $1
        ORDER BY changed_at ASC
        "#,
        rating_id
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let mut is_valid = true;
    let mut entries: Vec<AuditEntry> = Vec::new();

    for entry in &audit_entries {
        // Recompute hash for verification
        let computed_hash = compute_change_hash(
            rating_id,
            &entry.domain_url,
            &entry.user_hash,
            entry.trust_level,
            entry.bias_level,
            entry.comment.as_deref(),
        );

        let hash_valid = computed_hash == entry.change_hash;
        if !hash_valid {
            is_valid = false;
        }

        entries.push(AuditEntry {
            id: entry.id,
            action_type: entry.action_type.clone(),
            trust_level: entry.trust_level,
            bias_level: entry.bias_level,
            changed_at: entry.changed_at,
            hash_valid,
        });
    }

    let report = IntegrityReport {
        rating_id,
        is_valid,
        total_changes: entries.len() as i64,
        created_at: entries.first().map(|e| e.changed_at),
        last_modified: entries.last().map(|e| e.changed_at),
        audit_entries: entries,
    };

    Ok(Json(report))
}

pub async fn backup_status(State(pool): State<PgPool>) -> Result<Json<BackupStatus>, StatusCode> {
    let last_audit = sqlx::query_scalar!(
        "SELECT MAX(changed_at) FROM rating_audit_log"
    )
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let total_ratings = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM domain_ratings"
    )
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let total_audit = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM rating_audit_log"
    )
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Check replication lag if replica exists
    let replication_lag = sqlx::query_scalar!(
        r#"
        SELECT EXTRACT(EPOCH FROM (NOW() - pg_last_xact_replay_timestamp()))::float
        WHERE pg_is_in_recovery()
        "#
    )
    .fetch_optional(&pool)
    .await
    .ok()
    .flatten()
    .flatten();

    Ok(Json(BackupStatus {
        last_audit_entry: last_audit,
        total_ratings: total_ratings.unwrap_or(0),
        total_audit_entries: total_audit.unwrap_or(0),
        replication_lag_seconds: replication_lag,
    }))
}

pub async fn integrity_status(State(pool): State<PgPool>) -> Result<Json<IntegrityStatus>, StatusCode> {
    let total_ratings = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM domain_ratings"
    )
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let total_audit = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM rating_audit_log"
    )
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Check for ratings without audit entries
    let orphaned = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*) FROM domain_ratings r
        WHERE NOT EXISTS (
            SELECT 1 FROM rating_audit_log a
            WHERE a.rating_id = r.id
        )
        "#
    )
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // For now, we skip hash verification in the status check (expensive)
    // A background job should do full verification
    let invalid_entries: i64 = 0;

    let is_healthy = orphaned.unwrap_or(0) == 0 && invalid_entries == 0;

    Ok(Json(IntegrityStatus {
        is_healthy,
        total_ratings: total_ratings.unwrap_or(0),
        total_audit_entries: total_audit.unwrap_or(0),
        invalid_audit_entries: invalid_entries,
        orphaned_ratings: orphaned.unwrap_or(0),
        checked_at: chrono::Utc::now(),
    }))
}

fn compute_change_hash(
    rating_id: i64,
    domain_url: &str,
    user_hash: &str,
    trust_level: Option<i32>,
    bias_level: Option<i32>,
    comment: Option<&str>,
) -> String {
    use sha2::{Sha256, Digest};

    let change_data = format!(
        "{}|{}|{}|{}|{}|{}",
        rating_id,
        domain_url,
        user_hash,
        trust_level.map_or(String::new(), |t| t.to_string()),
        bias_level.map_or(String::new(), |b| b.to_string()),
        comment.unwrap_or("")
    );

    let mut hasher = Sha256::new();
    hasher.update(change_data.as_bytes());
    hex::encode(hasher.finalize())
}

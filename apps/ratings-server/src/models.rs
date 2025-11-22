use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Serialize, Deserialize)]
pub struct SubmitRatingRequest {
    pub domain_url: String,
    pub user_hash: String,
    pub trust_level: i32,
    pub bias_level: i32,
    pub comment: Option<String>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct Rating {
    pub id: i64,
    pub domain_url: String,
    pub user_hash: String,
    pub trust_level: i32,
    pub bias_level: i32,
    pub comment: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct RatingAggregate {
    pub domain_url: String,
    pub avg_trust_level: f64,
    pub avg_bias_level: f64,
    pub total_ratings: i64,
    pub trust_distribution: serde_json::Value,
    pub bias_distribution: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VoteRequest {
    pub voter_hash: String,
    pub is_helpful: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ReportRequest {
    pub reporter_hash: String,
    pub reason: String,
}

use crate::models::*;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use sqlx::PgPool;

pub async fn submit_rating(
    State(pool): State<PgPool>,
    Json(req): Json<SubmitRatingRequest>,
) -> Result<Json<Rating>, StatusCode> {
    // Validate input
    if req.trust_level < 1 || req.trust_level > 5 {
        return Err(StatusCode::BAD_REQUEST);
    }
    if req.bias_level < 1 || req.bias_level > 4 {
        return Err(StatusCode::BAD_REQUEST);
    }

    // Insert or update rating
    let rating = sqlx::query_as!(
        Rating,
        r#"
        INSERT INTO domain_ratings (domain_url, user_hash, trust_level, bias_level, comment)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (domain_url, user_hash)
        DO UPDATE SET
            trust_level = $3,
            bias_level = $4,
            comment = $5,
            updated_at = NOW()
        RETURNING id, domain_url, user_hash, trust_level, bias_level, comment, created_at, updated_at
        "#,
        req.domain_url,
        req.user_hash,
        req.trust_level,
        req.bias_level,
        req.comment,
    )
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Refresh aggregates
    refresh_aggregates(&pool, &req.domain_url).await?;

    Ok(Json(rating))
}

pub async fn get_domain_rating(
    State(pool): State<PgPool>,
    Path(domain): Path<String>,
) -> Result<Json<RatingAggregate>, StatusCode> {
    let aggregate = sqlx::query_as!(
        RatingAggregate,
        r#"
        SELECT
            domain_url,
            avg_trust_level,
            avg_bias_level,
            total_ratings,
            trust_distribution,
            bias_distribution
        FROM domain_rating_aggregates
        WHERE domain_url = $1
        "#,
        domain
    )
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    match aggregate {
        Some(agg) => Ok(Json(agg)),
        None => Err(StatusCode::NOT_FOUND),
    }
}

pub async fn get_domain_reviews(
    State(pool): State<PgPool>,
    Path(domain): Path<String>,
) -> Result<Json<Vec<Rating>>, StatusCode> {
    let ratings = sqlx::query_as!(
        Rating,
        r#"
        SELECT id, domain_url, user_hash, trust_level, bias_level, comment, created_at, updated_at
        FROM domain_ratings
        WHERE domain_url = $1
        ORDER BY created_at DESC
        LIMIT 50
        "#,
        domain
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(ratings))
}

pub async fn vote_helpful(
    State(pool): State<PgPool>,
    Path(rating_id): Path<i64>,
    Json(req): Json<VoteRequest>,
) -> Result<StatusCode, StatusCode> {
    sqlx::query!(
        r#"
        INSERT INTO rating_votes (rating_id, voter_hash, is_helpful)
        VALUES ($1, $2, $3)
        ON CONFLICT (rating_id, voter_hash)
        DO UPDATE SET is_helpful = $3
        "#,
        rating_id,
        req.voter_hash,
        req.is_helpful,
    )
    .execute(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(StatusCode::CREATED)
}

pub async fn report_rating(
    State(pool): State<PgPool>,
    Path(rating_id): Path<i64>,
    Json(req): Json<ReportRequest>,
) -> Result<StatusCode, StatusCode> {
    sqlx::query!(
        r#"
        INSERT INTO rating_reports (rating_id, reporter_hash, reason)
        VALUES ($1, $2, $3)
        "#,
        rating_id,
        req.reporter_hash,
        req.reason,
    )
    .execute(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Database error: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(StatusCode::CREATED)
}

async fn refresh_aggregates(pool: &PgPool, domain_url: &str) -> Result<(), StatusCode> {
    // Calculate and update aggregates
    sqlx::query!(
        r#"
        INSERT INTO domain_rating_aggregates
            (domain_url, avg_trust_level, avg_bias_level, total_ratings, trust_distribution, bias_distribution)
        SELECT
            $1 as domain_url,
            COALESCE(AVG(trust_level::float), 0) as avg_trust_level,
            COALESCE(AVG(bias_level::float), 0) as avg_bias_level,
            COUNT(*) as total_ratings,
            COALESCE(
                jsonb_object_agg(
                    trust_level::text,
                    trust_count
                ) FILTER (WHERE trust_level IS NOT NULL),
                '{}'::jsonb
            ) as trust_distribution,
            COALESCE(
                jsonb_object_agg(
                    bias_level::text,
                    bias_count
                ) FILTER (WHERE bias_level IS NOT NULL),
                '{}'::jsonb
            ) as bias_distribution
        FROM (
            SELECT
                trust_level,
                bias_level,
                COUNT(*) OVER (PARTITION BY trust_level) as trust_count,
                COUNT(*) OVER (PARTITION BY bias_level) as bias_count
            FROM domain_ratings
            WHERE domain_url = $1
        ) sub
        GROUP BY 1
        ON CONFLICT (domain_url)
        DO UPDATE SET
            avg_trust_level = EXCLUDED.avg_trust_level,
            avg_bias_level = EXCLUDED.avg_bias_level,
            total_ratings = EXCLUDED.total_ratings,
            trust_distribution = EXCLUDED.trust_distribution,
            bias_distribution = EXCLUDED.bias_distribution,
            updated_at = NOW()
        "#,
        domain_url
    )
    .execute(pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to refresh aggregates: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(())
}

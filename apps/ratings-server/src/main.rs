mod api;
mod db;
mod integrity;
mod models;

use axum::{routing::get, Router};
use sqlx::PgPool;
use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "info".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Load environment variables
    dotenv::dotenv().ok();

    // Connect to database
    let database_url = std::env::var("DATABASE_URL")
        .expect("DATABASE_URL must be set");

    let pool = PgPool::connect(&database_url)
        .await
        .expect("Failed to connect to database");

    // Run migrations
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("Failed to run migrations");

    // Configure CORS
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Build router
    let app = Router::new()
        .route("/", get(health_check))
        .route("/api/ratings", axum::routing::post(api::submit_rating))
        .route("/api/ratings/:domain", axum::routing::get(api::get_domain_rating))
        .route("/api/ratings/:domain/reviews", axum::routing::get(api::get_domain_reviews))
        .route("/api/ratings/:rating_id/vote", axum::routing::post(api::vote_helpful))
        .route("/api/ratings/:rating_id/report", axum::routing::post(api::report_rating))
        // Health & Integrity endpoints
        .route("/api/health/backup", get(integrity::backup_status))
        .route("/api/health/integrity", get(integrity::integrity_status))
        .route("/api/ratings/:rating_id/verify", get(integrity::verify_rating_integrity))
        .layer(cors)
        .with_state(pool);

    // Start server
    let port: u16 = std::env::var("PORT")
        .unwrap_or_else(|_| "3000".to_string())
        .parse()
        .expect("PORT must be a number");

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("Earth Reclaim Ratings Server listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn health_check() -> &'static str {
    "Earth Reclaim Ratings Server - OK"
}

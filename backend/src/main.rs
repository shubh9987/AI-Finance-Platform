use axum::{
    http::{
        HeaderValue,
        Method,
    },
    middleware as axum_middleware,
    Router,
};
use sqlx::postgres::PgPoolOptions;
use tokio::net::TcpListener;
use tower_http::cors::CorsLayer;

mod config;
mod controllers;
mod db;
mod middleware;
mod models;
mod routes;
mod schemas;
mod services;
mod state;

use config::Config;
use middleware::auth::require_auth;
use state::AppState;

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt::init();

    let config = Config::from_env();

    // =========================
    // Database
    // =========================

    let db = PgPoolOptions::new()
        .max_connections(10)
        .connect(&config.database_url)
        .await
        .expect("Failed to connect to PostgreSQL");

    println!("Connected to PostgreSQL successfully!");

    let state = AppState {
        db,
        config: config.clone(),
    };

    // =========================
    // CORS
    // =========================

    let cors = CorsLayer::new()
        .allow_origin(
            "http://localhost:3000"
                .parse::<HeaderValue>()
                .unwrap(),
        )
        .allow_credentials(true)
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::PATCH,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([
            axum::http::header::CONTENT_TYPE,
            axum::http::header::AUTHORIZATION,
        ]);

    // =========================
    // Public routes
    // =========================

    let public_routes = routes::auth::routes();

    // =========================
    // Protected routes
    // =========================

    let protected_routes = Router::new()
        .nest("/accounts", routes::accounts::routes())
        .nest("/transactions", routes::transactions::routes())
        .nest("/budget", routes::budget::routes())
        .nest("/dashboard", routes::dashboard::routes())
        .layer(axum_middleware::from_fn_with_state(
            state.clone(),
            require_auth,
        ));

    // =========================
    // Main application
    // =========================

    let app = Router::new()
        .nest("/auth", public_routes)
        .merge(protected_routes)
        .layer(cors)
        .with_state(state);

    // =========================
    // Server
    // =========================

    let port = std::env::var("PORT")
        .unwrap_or_else(|_| "8080".to_string());

    let address = format!("0.0.0.0:{}", port);

    let listener = TcpListener::bind(&address)
        .await
        .expect("Failed to bind to server port");

    println!("Welth backend running on http://{}", address);

    axum::serve(listener, app)
        .await
        .expect("Server failed");
}
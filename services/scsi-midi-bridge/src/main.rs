mod config;
mod routes;
mod s2p_client;

use std::net::SocketAddr;
use std::sync::Arc;

use axum::routing::{get, post};
use axum::Router;
use clap::Parser;
use tokio::sync::{broadcast, Mutex};
use tower_http::cors::CorsLayer;
use tracing_subscriber::EnvFilter;

use config::Config;
use routes::AppState;
use s2p_client::{MidiStreamClient, S2pClient};

#[tokio::main]
async fn main() {
    // Initialize tracing — defaults to INFO, override with RUST_LOG env var
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .with_target(false)
        .with_timer(tracing_subscriber::fmt::time::uptime())
        .init();

    let config = Config::parse();

    let s2p = S2pClient::new(
        config.s2p_host.clone(),
        config.s2p_port,
        config.target_id,
    );

    let midi_stream = MidiStreamClient::new(
        config.s2p_host.clone(),
        config.midi_port,
        config.target_id,
    );

    let (ws_tx, _) = broadcast::channel::<Vec<u8>>(64);

    let state = Arc::new(AppState {
        s2p: Mutex::new(s2p),
        midi_stream: Mutex::new(midi_stream),
        ws_tx,
    });

    let app = Router::new()
        .route("/health", get(|| async { axum::Json(serde_json::json!({"ok": true})) }))
        .route("/status", get(routes::status))
        .route("/scsi/scan", get(routes::scsi_scan))
        .route("/sds/send", post(routes::sds_send))
        .route("/sds/poll", get(routes::sds_poll))
        .route("/sds/stream", get(routes::sds_stream))
        .with_state(state)
        .layer(CorsLayer::permissive());

    let addr = SocketAddr::from(([0, 0, 0, 0], config.port));
    tracing::info!(
        version = env!("CARGO_PKG_VERSION"),
        addr = %addr,
        s2p_host = %config.s2p_host,
        s2p_port = config.s2p_port,
        midi_port = config.midi_port,
        target_id = config.target_id,
        "scsi-midi-bridge starting"
    );

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

mod config;
mod routes;
mod s2p_client;
mod scsi_midi;
mod worker;

use std::net::SocketAddr;
use std::sync::Arc;

use axum::routing::{get, post};
use axum::Router;
use clap::Parser;
use tokio::sync::broadcast;
use tower_http::cors::CorsLayer;
use tracing_subscriber::EnvFilter;

use config::Config;
use s2p_client::S2pClient;
use worker::{AppState, ScsiWork};

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

    let (ws_tx, _) = broadcast::channel::<Vec<u8>>(64);
    let (scsi_tx, scsi_rx) = tokio::sync::mpsc::channel::<ScsiWork>(16);

    let state = Arc::new(AppState {
        scsi_tx,
        ws_tx: ws_tx.clone(),
    });

    // Spawn the single SCSI worker — owns s2p exclusively
    tokio::spawn(worker::scsi_worker(scsi_rx, s2p, ws_tx));

    let app = Router::new()
        .route("/health", get(|| async { axum::Json(serde_json::json!({"ok": true})) }))
        .route("/status", get(routes::status))
        .route("/scsi/scan", get(routes::scsi_scan))
        .route("/sds/send", post(routes::sds_send))
        .route("/sds/poll", get(routes::sds_poll))
        .route("/sds/stream", get(routes::sds_stream))
        .route("/scsi/exec", post(routes::scsi_exec))
        .route("/scsi/midi-send-flag", post(routes::midi_send_flag))
        .route("/scsi/inquiry/:target_id", get(routes::scsi_inquiry))
        .route("/scsi/capacity/:target_id", get(routes::scsi_capacity))
        .route("/scsi/read", post(routes::scsi_read))
        .route("/scsi/write", post(routes::scsi_write))
        .with_state(state)
        .layer(CorsLayer::permissive());

    let addr = SocketAddr::from(([0, 0, 0, 0], config.port));
    let build_id = format!("{}@{}", env!("BUILD_GIT_HASH"), env!("BUILD_TIMESTAMP"));
    tracing::info!(
        version = env!("CARGO_PKG_VERSION"),
        build_id = %build_id,
        addr = %addr,
        s2p_host = %config.s2p_host,
        s2p_port = config.s2p_port,
        target_id = config.target_id,
        "scsi-midi-bridge starting"
    );

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

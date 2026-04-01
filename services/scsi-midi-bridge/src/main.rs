use axum::{routing::get, Router, Json};
use serde::Serialize;
use std::net::SocketAddr;
use tower_http::cors::CorsLayer;

const DEFAULT_PORT: u16 = 7033;
const S2PEXEC_DEFAULT: &str = "/opt/scsi2pi/bin/s2pexec";

#[derive(Serialize)]
struct Status {
    version: String,
    scsi2pi_version: String,
    board_id: u8,
    sampler_reachable: bool,
}

#[derive(Serialize)]
struct ScsiDevice {
    id: u8,
    vendor: String,
    product: String,
    revision: String,
}

#[derive(Serialize)]
struct Health {
    ok: bool,
}

fn s2pexec_path() -> String {
    std::env::var("S2PEXEC_PATH").unwrap_or_else(|_| S2PEXEC_DEFAULT.to_string())
}

async fn health() -> Json<Health> {
    Json(Health { ok: true })
}

async fn status() -> Json<Status> {
    let scsi2pi_version = get_s2pexec_version().await.unwrap_or_else(|_| "unknown".to_string());
    let sampler_reachable = check_sampler_reachable().await;

    Json(Status {
        version: env!("CARGO_PKG_VERSION").to_string(),
        scsi2pi_version,
        board_id: 7,
        sampler_reachable,
    })
}

async fn scsi_scan() -> Json<Vec<ScsiDevice>> {
    let mut devices = Vec::new();
    for id in 0..=6u8 {
        if let Ok(device) = inquiry(id).await {
            devices.push(device);
        }
    }
    Json(devices)
}

async fn get_s2pexec_version() -> Result<String, String> {
    let output = tokio::process::Command::new(s2pexec_path())
        .arg("--version")
        .output()
        .await
        .map_err(|e| e.to_string())?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout.lines().next().unwrap_or("unknown").trim().to_string())
}

async fn check_sampler_reachable() -> bool {
    inquiry(6).await.is_ok()
}

async fn inquiry(scsi_id: u8) -> Result<ScsiDevice, String> {
    let output = tokio::process::Command::new(s2pexec_path())
        .args(["-i", &scsi_id.to_string(), "-c", "12:00:00:00:60:00"])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(format!("INQUIRY failed for ID {}", scsi_id));
    }

    let data = output.stdout;
    if data.len() < 36 {
        return Err(format!("INQUIRY response too short: {} bytes", data.len()));
    }

    let vendor = String::from_utf8_lossy(&data[8..16]).trim().to_string();
    let product = String::from_utf8_lossy(&data[16..32]).trim().to_string();
    let revision = String::from_utf8_lossy(&data[32..36]).trim().to_string();

    Ok(ScsiDevice { id: scsi_id, vendor, product, revision })
}

async fn sds_send_stub() -> (axum::http::StatusCode, &'static str) {
    (axum::http::StatusCode::NOT_IMPLEMENTED, "Phase 4: not yet implemented")
}

async fn sds_stream_stub() -> (axum::http::StatusCode, &'static str) {
    (axum::http::StatusCode::NOT_IMPLEMENTED, "Phase 5: not yet implemented")
}

#[tokio::main]
async fn main() {
    let port: u16 = std::env::args()
        .position(|a| a == "--port")
        .and_then(|i| std::env::args().nth(i + 1))
        .and_then(|p| p.parse().ok())
        .unwrap_or(DEFAULT_PORT);

    let app = Router::new()
        .route("/health", get(health))
        .route("/status", get(status))
        .route("/scsi/scan", get(scsi_scan))
        .route("/sds/send", axum::routing::post(sds_send_stub))
        .route("/sds/stream", get(sds_stream_stub))
        .layer(CorsLayer::permissive());

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    eprintln!("scsi-midi-bridge v{} listening on {}", env!("CARGO_PKG_VERSION"), addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

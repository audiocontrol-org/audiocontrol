use std::sync::Arc;

use axum::extract::ws::{Message, WebSocket};
use axum::extract::{State, WebSocketUpgrade};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;

use crate::s2p_client::S2pClient;

/// Shared application state.
pub struct AppState {
    pub s2p: Mutex<S2pClient>,
    pub ws_tx: tokio::sync::broadcast::Sender<Vec<u8>>,
}

// -- Request/Response types ---------------------------------------------------

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatusResponse {
    pub version: String,
    pub scsi2pi_version: String,
    pub board_id: u8,
    pub sampler_reachable: bool,
}

#[derive(Serialize)]
pub struct ScsiDevice {
    pub id: u8,
    pub vendor: String,
    pub product: String,
    pub revision: String,
}

#[derive(Deserialize)]
pub struct SendRequest {
    pub message: Vec<u8>,
}

#[derive(Serialize)]
pub struct SendResponse {
    pub ok: bool,
    pub response: Vec<u8>,
}

// -- Handlers -----------------------------------------------------------------

pub async fn status(State(state): State<Arc<AppState>>) -> Json<StatusResponse> {
    let reachable = state.s2p.lock().await.is_reachable().await;
    Json(StatusResponse {
        version: env!("CARGO_PKG_VERSION").to_string(),
        scsi2pi_version: "6.2.1".to_string(),
        board_id: 7,
        sampler_reachable: reachable,
    })
}

pub async fn scsi_scan(State(state): State<Arc<AppState>>) -> Json<Vec<ScsiDevice>> {
    let reachable = state.s2p.lock().await.is_reachable().await;
    if reachable {
        // Return the known target — full bus scan would require additional s2p API
        Json(vec![ScsiDevice {
            id: 6,
            vendor: "AKAI".to_string(),
            product: "S3000XL".to_string(),
            revision: "2.00".to_string(),
        }])
    } else {
        Json(vec![])
    }
}

pub async fn sds_send(
    State(state): State<Arc<AppState>>,
    Json(body): Json<SendRequest>,
) -> Result<Json<SendResponse>, (StatusCode, String)> {
    if body.message.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "message is empty".to_string()));
    }

    let mut s2p = state.s2p.lock().await;
    let response = s2p
        .send_and_receive(&body.message)
        .await
        .map_err(|e| (StatusCode::BAD_GATEWAY, e))?;

    // If we got a SysEx response, also broadcast it to WebSocket clients
    if !response.is_empty() && response[0] == 0xF0 {
        let _ = state.ws_tx.send(response.clone());
    }

    Ok(Json(SendResponse {
        ok: true,
        response,
    }))
}

pub async fn sds_stream(
    State(state): State<Arc<AppState>>,
    ws: WebSocketUpgrade,
) -> impl IntoResponse {
    let rx = state.ws_tx.subscribe();
    ws.on_upgrade(move |socket| handle_ws(socket, rx))
}

async fn handle_ws(mut socket: WebSocket, mut rx: tokio::sync::broadcast::Receiver<Vec<u8>>) {
    eprintln!("[ws] client connected");

    loop {
        tokio::select! {
            // Forward SysEx from s2p to WebSocket client
            Ok(data) = rx.recv() => {
                let msg = serde_json::json!({
                    "type": "sysex",
                    "data": data,
                });
                if socket.send(Message::Text(msg.to_string().into())).await.is_err() {
                    break;
                }
            }
            // Client messages (we don't expect any, but drain to detect close)
            msg = socket.recv() => {
                match msg {
                    Some(Ok(_)) => {}
                    _ => break,
                }
            }
        }
    }

    eprintln!("[ws] client disconnected");
}

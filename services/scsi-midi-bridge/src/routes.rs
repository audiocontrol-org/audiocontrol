use std::sync::Arc;
use std::time::Instant;

use axum::extract::ws::{Message, WebSocket};
use axum::extract::{State, WebSocketUpgrade};
use axum::http::{HeaderMap, StatusCode};
use axum::response::IntoResponse;
use axum::Json;
use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;
use tracing::{info, info_span, Instrument};
use uuid::Uuid;

use crate::s2p_client::{MidiStreamClient, S2pClient};

/// Shared application state.
pub struct AppState {
    pub s2p: Mutex<S2pClient>,
    pub midi_stream: Mutex<MidiStreamClient>,
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
    /// If true (default), poll for a response after sending.
    /// Set to false for fire-and-forget writes.
    #[serde(default = "default_true")]
    pub expect_response: bool,
}

fn default_true() -> bool {
    true
}

#[derive(Serialize)]
pub struct SendResponse {
    pub ok: bool,
    pub response: Vec<u8>,
}

// -- Helpers ------------------------------------------------------------------

fn extract_request_id(headers: &HeaderMap) -> String {
    headers
        .get("x-request-id")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
        .unwrap_or_else(|| Uuid::new_v4().to_string()[..8].to_string())
}

// -- Handlers -----------------------------------------------------------------

pub async fn status(State(state): State<Arc<AppState>>) -> Json<StatusResponse> {
    // Check reachability via s2p protobuf API (TCP connect check).
    // Do NOT use the midi_stream mutex here — a stuck SCSI operation holding
    // the mutex would make /status hang, which cascades to block all clients.
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
    headers: HeaderMap,
    State(state): State<Arc<AppState>>,
    Json(body): Json<SendRequest>,
) -> Result<Json<SendResponse>, (StatusCode, String)> {
    let req_id = extract_request_id(&headers);
    let span = info_span!("sds_send", req_id = %req_id, msg_bytes = body.message.len());

    async move {
        let t0 = Instant::now();

        if body.message.is_empty() {
            return Err((StatusCode::BAD_REQUEST, "message is empty".to_string()));
        }

        // Try streaming client first
        let response = {
            let mut stream = state.midi_stream.lock().await;
            stream.send_and_receive(&body.message).await
        };

        let response = match response {
            Ok(data) => data,
            Err(e) => {
                tracing::warn!("Streaming client failed ({e}), falling back to protobuf");
                let mut s2p = state.s2p.lock().await;
                if body.expect_response {
                    s2p.send_and_receive(&body.message)
                        .await
                        .map_err(|e| (StatusCode::BAD_GATEWAY, e))?
                } else {
                    s2p.send_sysex(&body.message)
                        .await
                        .map_err(|e| (StatusCode::BAD_GATEWAY, e))?;
                    Vec::new()
                }
            }
        };

        let elapsed = t0.elapsed();
        info!(
            total_ms = elapsed.as_millis() as u64,
            response_bytes = response.len(),
            "request complete"
        );

        // If we got a SysEx response, also broadcast it to WebSocket clients
        if !response.is_empty() && response[0] == 0xF0 {
            let _ = state.ws_tx.send(response.clone());
        }

        Ok(Json(SendResponse {
            ok: true,
            response,
        }))
    }
    .instrument(span)
    .await
}

/// Poll for pending SysEx data from the device without sending anything.
/// Used for SDS streaming: the device sends data packets autonomously
/// after the initial handshake. The transport calls this in a loop.
pub async fn sds_poll(
    State(state): State<Arc<AppState>>,
) -> Result<Json<SendResponse>, (StatusCode, String)> {
    let s2p = state.s2p.lock().await;

    // Poll for any pending data
    let pending = s2p.poll().await.map_err(|e| (StatusCode::BAD_GATEWAY, e))?;
    if pending == 0 {
        return Ok(Json(SendResponse {
            ok: true,
            response: vec![],
        }));
    }

    let data = s2p.read(pending).await.map_err(|e| (StatusCode::BAD_GATEWAY, e))?;

    Ok(Json(SendResponse {
        ok: true,
        response: data,
    }))
}

pub async fn sds_stream(
    State(state): State<Arc<AppState>>,
    ws: WebSocketUpgrade,
) -> impl IntoResponse {
    let rx = state.ws_tx.subscribe();
    ws.on_upgrade(move |socket| handle_ws(socket, rx, state))
}

async fn handle_ws(
    mut socket: WebSocket,
    mut rx: tokio::sync::broadcast::Receiver<Vec<u8>>,
    state: Arc<AppState>,
) {
    info!("WebSocket client connected");

    loop {
        tokio::select! {
            // Forward broadcast SysEx to WebSocket client
            Ok(data) = rx.recv() => {
                let msg = serde_json::json!({
                    "type": "sysex",
                    "data": data,
                });
                if socket.send(Message::Text(msg.to_string().into())).await.is_err() {
                    break;
                }
            }
            // Handle client messages
            msg = socket.recv() => {
                match msg {
                    Some(Ok(Message::Text(text))) => {
                        // Parse send request
                        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&text) {
                            if parsed["type"] == "send" {
                                if let Some(arr) = parsed["message"].as_array() {
                                    let message: Vec<u8> = arr.iter()
                                        .filter_map(|v| v.as_u64().map(|n| n as u8))
                                        .collect();

                                    if !message.is_empty() {
                                        // Try streaming client first
                                        let response = {
                                            let mut stream = state.midi_stream.lock().await;
                                            stream.send_and_receive(&message).await
                                        };

                                        let response = match response {
                                            Ok(data) => data,
                                            Err(_) => {
                                                let mut s2p = state.s2p.lock().await;
                                                s2p.send_and_receive(&message).await.unwrap_or_default()
                                            }
                                        };

                                        let reply = serde_json::json!({
                                            "type": "sysex",
                                            "data": response,
                                        });
                                        if socket.send(Message::Text(reply.to_string().into())).await.is_err() {
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                    }
                    Some(Ok(_)) => {} // Ignore binary, ping, pong
                    _ => break, // Connection closed or error
                }
            }
        }
    }

    info!("WebSocket client disconnected");
}

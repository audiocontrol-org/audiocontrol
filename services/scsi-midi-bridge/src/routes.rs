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

#[derive(Deserialize)]
pub struct ScsiExecRequest {
    pub target_id: u8,
    #[serde(default)]
    pub lun: u8,
    pub cdb: Vec<u8>,
    #[serde(default)]
    pub data_out: Vec<u8>,
    #[serde(default)]
    pub expected_data_in: u32,
}

#[derive(Serialize)]
pub struct ScsiExecResponse {
    pub status: u8,
    pub sense_data: Vec<u8>,
    pub data_in: Vec<u8>,
    pub bytes_transferred: u32,
}

#[derive(Deserialize)]
pub struct ScsiReadRequest {
    pub target_id: u8,
    pub lba: u32,
    pub count: u16,
}

#[derive(Deserialize)]
pub struct ScsiWriteRequest {
    pub target_id: u8,
    pub lba: u32,
    pub data: Vec<u8>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScsiCapacityResponse {
    pub block_count: u32,
    pub block_size: u32,
}

#[derive(Serialize)]
pub struct ScsiInquiryResponse {
    pub device_type: u8,
    pub vendor: String,
    pub product: String,
    pub revision: String,
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

// -- SCSI disk handlers -------------------------------------------------------

pub async fn scsi_exec(
    State(state): State<Arc<AppState>>,
    Json(body): Json<ScsiExecRequest>,
) -> Result<Json<ScsiExecResponse>, (StatusCode, String)> {
    let s2p = state.s2p.lock().await;
    let result = s2p
        .execute_scsi(
            body.target_id,
            body.lun,
            &body.cdb,
            &body.data_out,
            body.expected_data_in,
            3,
        )
        .await
        .map_err(|e| (StatusCode::BAD_GATEWAY, e))?;

    Ok(Json(ScsiExecResponse {
        status: result.status,
        sense_data: result.sense_data,
        data_in: result.data_in,
        bytes_transferred: result.bytes_transferred,
    }))
}

pub async fn scsi_inquiry(
    State(state): State<Arc<AppState>>,
    axum::extract::Path(target_id): axum::extract::Path<u8>,
) -> Result<Json<ScsiInquiryResponse>, (StatusCode, String)> {
    let s2p = state.s2p.lock().await;
    // INQUIRY CDB: 12 00 00 00 24 00 (request 36 bytes)
    let cdb = vec![0x12, 0x00, 0x00, 0x00, 0x24, 0x00];
    let result = s2p
        .execute_scsi(target_id, 0, &cdb, &[], 36, 3)
        .await
        .map_err(|e| (StatusCode::BAD_GATEWAY, e))?;

    if result.status != 0 {
        return Err((
            StatusCode::BAD_GATEWAY,
            format!("INQUIRY failed: status {}", result.status),
        ));
    }

    let data = &result.data_in;
    let device_type = if !data.is_empty() {
        data[0] & 0x1F
    } else {
        0xFF
    };
    let vendor = if data.len() >= 16 {
        String::from_utf8_lossy(&data[8..16]).trim().to_string()
    } else {
        String::new()
    };
    let product = if data.len() >= 32 {
        String::from_utf8_lossy(&data[16..32]).trim().to_string()
    } else {
        String::new()
    };
    let revision = if data.len() >= 36 {
        String::from_utf8_lossy(&data[32..36]).trim().to_string()
    } else {
        String::new()
    };

    Ok(Json(ScsiInquiryResponse {
        device_type,
        vendor,
        product,
        revision,
    }))
}

pub async fn scsi_capacity(
    State(state): State<Arc<AppState>>,
    axum::extract::Path(target_id): axum::extract::Path<u8>,
) -> Result<Json<ScsiCapacityResponse>, (StatusCode, String)> {
    let s2p = state.s2p.lock().await;
    // READ CAPACITY(10) CDB: 25 00 00 00 00 00 00 00 00 00
    let cdb = vec![0x25, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
    let result = s2p
        .execute_scsi(target_id, 0, &cdb, &[], 8, 3)
        .await
        .map_err(|e| (StatusCode::BAD_GATEWAY, e))?;

    if result.status != 0 {
        return Err((
            StatusCode::BAD_GATEWAY,
            format!("READ CAPACITY failed: status {}", result.status),
        ));
    }

    let data = &result.data_in;
    if data.len() < 8 {
        return Err((
            StatusCode::BAD_GATEWAY,
            "READ CAPACITY response too short".to_string(),
        ));
    }

    let block_count = u32::from_be_bytes([data[0], data[1], data[2], data[3]]) + 1;
    let block_size = u32::from_be_bytes([data[4], data[5], data[6], data[7]]);

    Ok(Json(ScsiCapacityResponse {
        block_count,
        block_size,
    }))
}

pub async fn scsi_read(
    State(state): State<Arc<AppState>>,
    Json(body): Json<ScsiReadRequest>,
) -> Result<Json<ScsiExecResponse>, (StatusCode, String)> {
    let s2p = state.s2p.lock().await;
    // READ(10) CDB: 28 00 [LBA 4 bytes BE] 00 [count 2 bytes BE] 00
    let lba_bytes = body.lba.to_be_bytes();
    let count_bytes = body.count.to_be_bytes();
    let cdb = vec![
        0x28, 0x00,
        lba_bytes[0], lba_bytes[1], lba_bytes[2], lba_bytes[3],
        0x00,
        count_bytes[0], count_bytes[1],
        0x00,
    ];
    // Assume 512-byte blocks (can be refined after READ CAPACITY)
    let expected = (body.count as u32) * 512;
    let result = s2p
        .execute_scsi(body.target_id, 0, &cdb, &[], expected, 10)
        .await
        .map_err(|e| (StatusCode::BAD_GATEWAY, e))?;

    Ok(Json(ScsiExecResponse {
        status: result.status,
        sense_data: result.sense_data,
        data_in: result.data_in,
        bytes_transferred: result.bytes_transferred,
    }))
}

pub async fn scsi_write(
    State(state): State<Arc<AppState>>,
    Json(body): Json<ScsiWriteRequest>,
) -> Result<Json<ScsiExecResponse>, (StatusCode, String)> {
    let s2p = state.s2p.lock().await;
    let block_size: u32 = 512;
    let block_count = (body.data.len() as u32 + block_size - 1) / block_size;
    let lba_bytes = body.lba.to_be_bytes();
    let count_bytes = (block_count as u16).to_be_bytes();
    let cdb = vec![
        0x2A, 0x00,
        lba_bytes[0], lba_bytes[1], lba_bytes[2], lba_bytes[3],
        0x00,
        count_bytes[0], count_bytes[1],
        0x00,
    ];
    let result = s2p
        .execute_scsi(body.target_id, 0, &cdb, &body.data, 0, 10)
        .await
        .map_err(|e| (StatusCode::BAD_GATEWAY, e))?;

    Ok(Json(ScsiExecResponse {
        status: result.status,
        sense_data: result.sense_data,
        data_in: result.data_in,
        bytes_transferred: result.bytes_transferred,
    }))
}

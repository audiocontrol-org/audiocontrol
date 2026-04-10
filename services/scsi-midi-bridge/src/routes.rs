use std::sync::Arc;
use std::time::{Duration, Instant};

use axum::extract::ws::{Message, WebSocket};
use axum::extract::{State, WebSocketUpgrade};
use axum::http::{HeaderMap, StatusCode};
use axum::response::IntoResponse;
use axum::Json;
use serde::{Deserialize, Serialize};
use tokio::sync::{mpsc, oneshot};
use tracing::{info, info_span, Instrument};
use uuid::Uuid;

use crate::worker::{AppState, ScsiWork};

/// Submit a work item and await the reply with a timeout.
async fn submit_and_await<T>(
    scsi_tx: &mpsc::Sender<ScsiWork>,
    timeout: Duration,
    make_work: impl FnOnce(oneshot::Sender<T>) -> ScsiWork,
) -> Result<T, (StatusCode, String)> {
    let (tx, rx) = oneshot::channel();
    scsi_tx.send(make_work(tx)).await
        .map_err(|_| (StatusCode::SERVICE_UNAVAILABLE, "SCSI worker not running".to_string()))?;
    tokio::time::timeout(timeout, rx)
        .await
        .map_err(|_| (StatusCode::GATEWAY_TIMEOUT, "SCSI operation timed out".to_string()))?
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "worker channel closed".to_string()))
}

// -- Request/Response types ---------------------------------------------------

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatusResponse {
    pub version: String,
    pub build_id: String,
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

pub async fn status(
    State(state): State<Arc<AppState>>,
) -> Result<Json<StatusResponse>, (StatusCode, String)> {
    let reachable = submit_and_await(
        &state.scsi_tx,
        Duration::from_secs(3),
        |reply| ScsiWork::IsReachable { reply },
    ).await?;

    Ok(Json(StatusResponse {
        version: env!("CARGO_PKG_VERSION").to_string(),
        build_id: format!("{}@{}", env!("BUILD_GIT_HASH"), env!("BUILD_TIMESTAMP")),
        scsi2pi_version: "6.2.1".to_string(),
        board_id: 7,
        sampler_reachable: reachable,
    }))
}

pub async fn scsi_scan(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<ScsiDevice>>, (StatusCode, String)> {
    let reachable = submit_and_await(
        &state.scsi_tx,
        Duration::from_secs(3),
        |reply| ScsiWork::IsReachable { reply },
    ).await?;

    if reachable {
        // Return the known target — full bus scan would require additional s2p API
        Ok(Json(vec![ScsiDevice {
            id: 6,
            vendor: "AKAI".to_string(),
            product: "S3000XL".to_string(),
            revision: "2.00".to_string(),
        }]))
    } else {
        Ok(Json(vec![]))
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

        // 10s timeout: send_and_receive does enable + send + up to 30 polls
        // (100ms each) + disable. The enable/disable overhead per request
        // means 5s was too tight.
        let response = submit_and_await(
            &state.scsi_tx,
            Duration::from_secs(10),
            |reply| ScsiWork::SysExSendReceive {
                message: body.message,
                expect_response: body.expect_response,
                reply,
            },
        ).await?
        .map_err(|e| (StatusCode::BAD_GATEWAY, e))?;

        let elapsed = t0.elapsed();
        info!(
            total_ms = elapsed.as_millis() as u64,
            response_bytes = response.len(),
            "request complete"
        );

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
    let data = submit_and_await(
        &state.scsi_tx,
        Duration::from_secs(3),
        |reply| ScsiWork::Poll { reply },
    ).await?
    .map_err(|e| (StatusCode::BAD_GATEWAY, e))?;

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

    // Channel for streaming download messages back to the WS handler
    let (dl_tx, mut dl_rx) = tokio::sync::mpsc::channel::<serde_json::Value>(64);

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
            // Forward download progress messages to WebSocket client
            Some(dl_msg) = dl_rx.recv() => {
                if socket.send(Message::Text(dl_msg.to_string().into())).await.is_err() {
                    break;
                }
            }
            // Handle client messages
            msg = socket.recv() => {
                match msg {
                    Some(Ok(Message::Text(text))) => {
                        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&text) {
                            let msg_type = parsed["type"].as_str().unwrap_or("");

                            match msg_type {
                                "send" => {
                                    handle_ws_send(&mut socket, &state, &parsed).await;
                                }
                                "sample-download" => {
                                    handle_ws_sample_download(
                                        &state, &parsed, dl_tx.clone(),
                                    ).await;
                                }
                                "sample-upload" => {
                                    handle_ws_sample_upload(
                                        &state, &parsed, dl_tx.clone(),
                                    ).await;
                                }
                                _ => {}
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

/// Handle a "send" WebSocket message (SysEx send+receive).
async fn handle_ws_send(
    socket: &mut WebSocket,
    state: &Arc<AppState>,
    parsed: &serde_json::Value,
) {
    if let Some(arr) = parsed["message"].as_array() {
        let message: Vec<u8> = arr.iter()
            .filter_map(|v| v.as_u64().map(|n| n as u8))
            .collect();

        if !message.is_empty() {
            let result = submit_and_await(
                &state.scsi_tx,
                Duration::from_secs(5),
                |reply| ScsiWork::SysExSendReceive {
                    message,
                    expect_response: true,
                    reply,
                },
            ).await;

            let response = match result {
                Ok(Ok(data)) => data,
                Ok(Err(_)) | Err(_) => Vec::new(),
            };

            let reply = serde_json::json!({
                "type": "sysex",
                "data": response,
            });
            let _ = socket.send(Message::Text(reply.to_string().into())).await;
        }
    }
}

/// Handle a "sample-download" WebSocket message.
/// Submits the download to the SCSI worker and forwards progress via the WS channel.
async fn handle_ws_sample_download(
    state: &Arc<AppState>,
    parsed: &serde_json::Value,
    tx: mpsc::Sender<serde_json::Value>,
) {
    // Accept both snake_case and camelCase field names for compatibility
    let target_id = parsed["target_id"].as_u64()
        .or_else(|| parsed["targetId"].as_u64())
        .unwrap_or(6) as u8;
    let sample_number = parsed["sample_number"].as_u64()
        .or_else(|| parsed["sampleNumber"].as_u64())
        .unwrap_or(0) as u16;
    let channel = parsed["channel"].as_u64().unwrap_or(0) as u8;
    let scsi_tx = state.scsi_tx.clone();

    tokio::spawn(async move {
        info!(target_id, sample_number, channel, "starting sample download task");

        // Progress channel: worker pushes header + data messages here
        let (progress_tx, mut progress_rx) = mpsc::channel::<serde_json::Value>(128);
        let tx_forward = tx.clone();
        let tx_done = tx.clone();

        // Forward progress messages to the WS handler channel
        let forward_handle = tokio::spawn(async move {
            while let Some(msg) = progress_rx.recv().await {
                let _ = tx_forward.send(msg).await;
            }
        });

        // Submit download work item
        let (reply_tx, reply_rx) = oneshot::channel();
        let send_result = scsi_tx.send(ScsiWork::SdsDownload {
            target_id,
            sample_number,
            channel,
            progress: progress_tx,
            reply: reply_tx,
        }).await;

        if send_result.is_err() {
            let _ = tx_done.send(serde_json::json!({"type": "sample-error", "error": "SCSI worker not running"})).await;
            return;
        }

        // Wait for the download to complete (60s timeout)
        let result = match tokio::time::timeout(Duration::from_secs(60), reply_rx).await {
            Ok(Ok(r)) => r,
            Ok(Err(_)) => Err("worker channel closed".to_string()),
            Err(_) => Err("download timed out (60s)".to_string()),
        };

        // Wait for all progress messages to be forwarded
        let _ = forward_handle.await;

        match result {
            Ok(total) => {
                let msg = serde_json::json!({
                    "type": "sample-complete",
                    "totalSamples": total,
                });
                let _ = tx_done.send(msg).await;
            }
            Err(e) => {
                let msg = serde_json::json!({
                    "type": "sample-error",
                    "error": e,
                });
                let _ = tx_done.send(msg).await;
            }
        }
    });
}

/// Handle a "sample-upload" WebSocket message.
/// Expects all samples in the message body (suitable for samples that fit in a
/// single WebSocket frame — large samples will need chunked streaming later).
async fn handle_ws_sample_upload(
    state: &Arc<AppState>,
    parsed: &serde_json::Value,
    tx: mpsc::Sender<serde_json::Value>,
) {
    let target_id = parsed["target_id"].as_u64().unwrap_or(6) as u8;
    let sample_number = parsed["sample_number"].as_u64().unwrap_or(0) as u16;
    let channel = parsed["channel"].as_u64().unwrap_or(0) as u8;
    let sample_rate = parsed["sample_rate"].as_u64().unwrap_or(44100) as u32;

    let samples: Vec<i16> = parsed["samples"]
        .as_array()
        .map(|arr| arr.iter().filter_map(|v| v.as_i64().map(|n| n as i16)).collect())
        .unwrap_or_default();

    if samples.is_empty() {
        let msg = serde_json::json!({"type": "sample-error", "error": "no samples provided"});
        let _ = tx.send(msg).await;
        return;
    }

    let scsi_tx = state.scsi_tx.clone();

    tokio::spawn(async move {
        let total = samples.len() as u32;
        info!(target_id, sample_number, total, sample_rate, "starting sample upload task");

        // Progress channel: worker pushes upload-progress messages here
        let (progress_tx, mut progress_rx) = mpsc::channel::<serde_json::Value>(128);
        let tx_forward = tx.clone();
        let tx_done = tx.clone();

        let forward_handle = tokio::spawn(async move {
            while let Some(msg) = progress_rx.recv().await {
                let _ = tx_forward.send(msg).await;
            }
        });

        // Submit upload work item
        let (reply_tx, reply_rx) = oneshot::channel();
        let send_result = scsi_tx.send(ScsiWork::SdsUpload {
            target_id,
            sample_number,
            channel,
            sample_rate,
            samples,
            progress: progress_tx,
            reply: reply_tx,
        }).await;

        if send_result.is_err() {
            let _ = tx_done.send(serde_json::json!({"type": "sample-error", "error": "SCSI worker not running"})).await;
            return;
        }

        // Timeout scales with sample count: ~200ms per 40-sample packet + margin.
        // Minimum 60s, no upper cap — large samples can take many minutes.
        let packets = (total as u64 + 39) / 40;
        let timeout_secs = (packets / 4).max(60);
        info!(total, packets, timeout_secs, "SDS upload timeout");

        let result = match tokio::time::timeout(Duration::from_secs(timeout_secs), reply_rx).await {
            Ok(Ok(r)) => r,
            Ok(Err(_)) => Err("worker channel closed".to_string()),
            Err(_) => Err("upload timed out (120s)".to_string()),
        };

        // Wait for all progress messages to be forwarded
        let _ = forward_handle.await;

        match result {
            Ok(total) => {
                let msg = serde_json::json!({
                    "type": "upload-complete",
                    "totalSamples": total,
                });
                let _ = tx_done.send(msg).await;
            }
            Err(e) => {
                let msg = serde_json::json!({
                    "type": "sample-error",
                    "error": e,
                });
                let _ = tx_done.send(msg).await;
            }
        }
    });
}

// -- SCSI disk handlers -------------------------------------------------------

pub async fn scsi_exec(
    State(state): State<Arc<AppState>>,
    Json(body): Json<ScsiExecRequest>,
) -> Result<Json<ScsiExecResponse>, (StatusCode, String)> {
    // Use caller's implicit 3s SCSI timeout + 2s buffer for the request timeout
    let timeout = Duration::from_secs(3 + 2);
    let result = submit_and_await(
        &state.scsi_tx,
        timeout,
        |reply| ScsiWork::ScsiExec {
            target_id: body.target_id,
            lun: body.lun,
            cdb: body.cdb,
            data_out: body.data_out,
            expected_data_in: body.expected_data_in,
            timeout_seconds: 3,
            reply,
        },
    ).await?
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
    // INQUIRY CDB: 12 00 00 00 24 00 (request 36 bytes)
    let cdb = vec![0x12, 0x00, 0x00, 0x00, 0x24, 0x00];
    let result = submit_and_await(
        &state.scsi_tx,
        Duration::from_secs(5),
        |reply| ScsiWork::ScsiExec {
            target_id,
            lun: 0,
            cdb,
            data_out: Vec::new(),
            expected_data_in: 36,
            timeout_seconds: 3,
            reply,
        },
    ).await?
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
    // READ CAPACITY(10) CDB: 25 00 00 00 00 00 00 00 00 00
    let cdb = vec![0x25, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
    let result = submit_and_await(
        &state.scsi_tx,
        Duration::from_secs(5),
        |reply| ScsiWork::ScsiExec {
            target_id,
            lun: 0,
            cdb,
            data_out: Vec::new(),
            expected_data_in: 8,
            timeout_seconds: 3,
            reply,
        },
    ).await?
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
    let result = submit_and_await(
        &state.scsi_tx,
        Duration::from_secs(12),
        |reply| ScsiWork::ScsiExec {
            target_id: body.target_id,
            lun: 0,
            cdb,
            data_out: Vec::new(),
            expected_data_in: expected,
            timeout_seconds: 10,
            reply,
        },
    ).await?
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
    let result = submit_and_await(
        &state.scsi_tx,
        Duration::from_secs(12),
        |reply| ScsiWork::ScsiExec {
            target_id: body.target_id,
            lun: 0,
            cdb,
            data_out: body.data,
            expected_data_in: 0,
            timeout_seconds: 10,
            reply,
        },
    ).await?
    .map_err(|e| (StatusCode::BAD_GATEWAY, e))?;

    Ok(Json(ScsiExecResponse {
        status: result.status,
        sense_data: result.sense_data,
        data_in: result.data_in,
        bytes_transferred: result.bytes_transferred,
    }))
}

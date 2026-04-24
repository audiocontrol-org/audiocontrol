//! Single-threaded SCSI work queue.
//!
//! All SCSI and MIDI operations are serialized through a single worker task
//! that owns the S2pClient. Handlers submit work items via an mpsc channel
//! and receive results via oneshot channels.

use tokio::sync::{mpsc, oneshot};
use tracing::info;

use crate::s2p_client::{S2pClient, ScsiExecResult};
use crate::scsi_midi;

/// Work item for the SCSI worker queue.
pub enum ScsiWork {
    /// Check if device is reachable
    IsReachable {
        reply: oneshot::Sender<bool>,
    },
    /// Send SysEx via SCSI CDB and receive response.
    /// When `expect_response` is false, sends fire-and-forget (no poll).
    SysExSendReceive {
        message: Vec<u8>,
        expect_response: bool,
        reply: oneshot::Sender<Result<Vec<u8>, String>>,
    },
    /// Send SysEx via CDB 0x0C with explicit CDB[5] flag and drain MIDI response.
    /// Test harness for issue #315 / Path F.1 — proves whether `flag=0x80` commits
    /// data by enabling write-then-readback inside a single bridge request.
    SysExSendWithFlag {
        target_id: u8,
        message: Vec<u8>,
        flag: u8,
        reply: oneshot::Sender<Result<Vec<u8>, String>>,
    },
    /// Poll for pending MIDI data
    Poll {
        reply: oneshot::Sender<Result<Vec<u8>, String>>,
    },
    /// Raw SCSI command execution
    ScsiExec {
        target_id: u8,
        lun: u8,
        cdb: Vec<u8>,
        data_out: Vec<u8>,
        expected_data_in: u32,
        timeout_seconds: u32,
        reply: oneshot::Sender<Result<ScsiExecResult, String>>,
    },
    /// SDS sample upload via scsi_midi::upload_sample
    SdsUpload {
        target_id: u8,
        sample_number: u16,
        channel: u8,
        sample_rate: u32,
        samples: Vec<i16>,
        /// Override the default SDS batch size (packets/CDB). None = use default.
        /// Test-only knob for Phase 3.2 optimization work (task #25).
        batch_size: Option<usize>,
        /// Override the default SDS pipeline depth (in-flight batches).
        /// None = use default (1, synchronous). Test-only knob for Phase 3.3 (task #26).
        pipeline_depth: Option<usize>,
        progress: mpsc::Sender<serde_json::Value>,
        reply: oneshot::Sender<Result<u32, String>>,
    },
    /// ASPACK fast sample upload via scsi_midi::upload_sample_aspack
    AspackUpload {
        target_id: u8,
        sample_number: u16,
        channel: u8,
        sample_rate: u32,
        samples: Vec<i16>,
        progress: mpsc::Sender<serde_json::Value>,
        reply: oneshot::Sender<Result<u32, String>>,
    },
    /// SDS sample download via scsi_midi::download_sample
    SdsDownload {
        target_id: u8,
        sample_number: u16,
        channel: u8,
        progress: mpsc::Sender<serde_json::Value>,
        reply: oneshot::Sender<Result<u32, String>>,
    },
}

/// Shared application state.
pub struct AppState {
    pub scsi_tx: mpsc::Sender<ScsiWork>,
    pub ws_tx: tokio::sync::broadcast::Sender<Vec<u8>>,
}

/// Single SCSI worker task that processes operations sequentially.
/// Owns s2p exclusively — no mutexes needed.
pub async fn scsi_worker(
    mut rx: mpsc::Receiver<ScsiWork>,
    mut s2p: S2pClient,
    ws_tx: tokio::sync::broadcast::Sender<Vec<u8>>,
) {
    while let Some(work) = rx.recv().await {
        match work {
            ScsiWork::IsReachable { reply } => {
                let _ = reply.send(s2p.is_reachable().await);
            }
            ScsiWork::SysExSendReceive { message, expect_response, reply } => {
                let result = if expect_response {
                    s2p.send_and_receive(&message).await
                } else {
                    s2p.scsi_midi_send(s2p.target_id, &message).await.map(|_| Vec::new())
                };
                // Broadcast to WebSocket clients on success
                if let Ok(ref data) = result {
                    if !data.is_empty() && data[0] == 0xF0 {
                        let _ = ws_tx.send(data.clone());
                    }
                }
                let _ = reply.send(result);
            }
            ScsiWork::SysExSendWithFlag { target_id: _target_id, message, flag, reply } => {
                let result = s2p.send_with_flag_and_receive(&message, flag).await;
                if let Ok(ref data) = result {
                    if !data.is_empty() && data[0] == 0xF0 {
                        let _ = ws_tx.send(data.clone());
                    }
                }
                let _ = reply.send(result);
            }
            ScsiWork::Poll { reply } => {
                let result = async {
                    let count = s2p.scsi_midi_poll(s2p.target_id).await?;
                    if count > 0 {
                        s2p.scsi_midi_read(s2p.target_id, count).await
                    } else {
                        Ok(Vec::new())
                    }
                }.await;
                let _ = reply.send(result);
            }
            ScsiWork::ScsiExec { target_id, lun, cdb, data_out, expected_data_in, timeout_seconds, reply } => {
                let result = s2p.execute_scsi(
                    target_id, lun, &cdb, &data_out, expected_data_in, timeout_seconds,
                ).await;
                let _ = reply.send(result);
            }
            ScsiWork::SdsUpload { target_id, sample_number, channel, sample_rate, samples, batch_size, pipeline_depth, progress, reply } => {
                let cancelled = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
                let cancelled_clone = cancelled.clone();
                let result = scsi_midi::upload_sample(
                    &s2p, target_id, sample_number, channel, sample_rate, &samples, batch_size, pipeline_depth,
                    |sent, total| {
                        let msg = serde_json::json!({
                            "type": "upload-progress",
                            "transferred": sent,
                            "total": total,
                        });
                        // If the progress receiver is gone (WebSocket disconnected),
                        // signal cancellation so upload_sample stops sending packets.
                        if progress.try_send(msg).is_err() {
                            cancelled_clone.store(true, std::sync::atomic::Ordering::Relaxed);
                        }
                    },
                    &cancelled,
                ).await;
                let _ = reply.send(result);
            }
            ScsiWork::AspackUpload { target_id, sample_number, channel, sample_rate, samples, progress, reply } => {
                let cancelled = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
                let cancelled_clone = cancelled.clone();
                let result = scsi_midi::upload_sample_aspack(
                    &s2p, target_id, sample_number, channel, sample_rate, &samples,
                    |sent, total| {
                        let msg = serde_json::json!({
                            "type": "upload-progress",
                            "transferred": sent,
                            "total": total,
                        });
                        if progress.try_send(msg).is_err() {
                            cancelled_clone.store(true, std::sync::atomic::Ordering::Relaxed);
                        }
                    },
                    &cancelled,
                ).await;
                let _ = reply.send(result);
            }
            ScsiWork::SdsDownload { target_id, sample_number, channel, progress, reply } => {
                let result = scsi_midi::download_sample(
                    &s2p, target_id, sample_number, channel,
                    |header| {
                        let msg = serde_json::json!({
                            "type": "sample-header",
                            "name": header.name,
                            "sampleRate": header.sample_rate,
                            "sampleCount": header.sample_count,
                        });
                        let _ = progress.try_send(msg);
                    },
                    |pcm_chunk, transferred, total| {
                        let samples: Vec<i16> = pcm_chunk.to_vec();
                        let msg = serde_json::json!({
                            "type": "sample-data",
                            "samples": samples,
                            "transferred": transferred,
                            "total": total,
                        });
                        let _ = progress.try_send(msg);
                    },
                ).await;
                let _ = reply.send(result);
            }
        }
    }
    info!("SCSI worker shutting down — channel closed");
}

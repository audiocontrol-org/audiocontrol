//! SCSI MIDI sample download via SDS (Sample Dump Standard) over SCSI.
//!
//! Uses vendor-specific CDBs (0x09, 0x0C, 0x0D, 0x0E) to tunnel MIDI
//! SysEx through the SCSI bus. All SCSI commands execute locally on the Pi,
//! avoiding per-packet network round-trips.

use crate::s2p_client::{S2pClient, SampleDownloadHeader};
use tracing::{debug, info, warn};

/// Akai character encoding table.
/// 0-9: '0'-'9', 10: ' ', 11-36: 'A'-'Z', 37-62: 'a'-'z', 63: '#', 64: '+', 65: '-', 66: '.'
fn akai_char(code: u8) -> char {
    match code {
        0..=9 => (b'0' + code) as char,
        10 => ' ',
        11..=36 => (b'A' + code - 11) as char,
        37..=62 => (b'a' + code - 37) as char,
        63 => '#',
        64 => '+',
        65 => '-',
        66 => '.',
        _ => '?',
    }
}

/// Decode a nibble-encoded byte: low nibble first, high nibble second.
fn decode_nibble_byte(low: u8, high: u8) -> u8 {
    (low & 0x0F) | ((high & 0x0F) << 4)
}

/// Extract complete SysEx messages (F0..F7) from a byte buffer.
/// Returns extracted messages and the remaining unprocessed bytes.
fn extract_sysex_messages(buf: &[u8]) -> (Vec<Vec<u8>>, Vec<u8>) {
    let mut messages = Vec::new();
    let mut remaining = Vec::new();
    let mut i = 0;

    while i < buf.len() {
        if buf[i] == 0xF0 {
            // Find matching F7
            if let Some(end_offset) = buf[i + 1..].iter().position(|&b| b == 0xF7) {
                let end = i + 1 + end_offset + 1; // inclusive of F7
                messages.push(buf[i..end].to_vec());
                i = end;
            } else {
                // Incomplete message — keep as remaining
                remaining.extend_from_slice(&buf[i..]);
                break;
            }
        } else {
            // Skip non-SysEx bytes (realtime messages, etc.)
            i += 1;
        }
    }

    (messages, remaining)
}

/// Download a sample from the S3000XL via SDS over SCSI.
///
/// Calls `on_header` with sample metadata, then `on_data` with decoded PCM
/// chunks as they arrive. All SCSI commands execute locally on the Pi.
///
/// Returns total number of samples received.
pub async fn download_sample<F, G>(
    s2p: &S2pClient,
    target_id: u8,
    sample_number: u16,
    channel: u8,
    mut on_header: F,
    mut on_data: G,
) -> Result<u32, String>
where
    F: FnMut(SampleDownloadHeader),
    G: FnMut(&[i16], u32, u32), // (pcm_chunk, transferred_total, sample_count_total)
{
    // 1. Enable MIDI mode
    info!(target_id, "enabling SCSI MIDI mode");
    s2p.scsi_midi_enable(target_id).await?;

    let result = download_sample_inner(
        s2p, target_id, sample_number, channel, &mut on_header, &mut on_data,
    ).await;

    // 5. Always disable MIDI mode, even on error
    info!(target_id, "disabling SCSI MIDI mode");
    let _ = s2p.scsi_midi_disable(target_id).await;

    result
}

async fn download_sample_inner<F, G>(
    s2p: &S2pClient,
    target_id: u8,
    sample_number: u16,
    channel: u8,
    on_header: &mut F,
    on_data: &mut G,
) -> Result<u32, String>
where
    F: FnMut(SampleDownloadHeader),
    G: FnMut(&[i16], u32, u32),
{
    // 2. Request sample header via RSDATA
    let sn_lo = (sample_number & 0x7F) as u8;
    let sn_hi = ((sample_number >> 7) & 0x7F) as u8;
    let rsdata_req = vec![0xF0, 0x47, channel, 0x0A, 0x48, sn_lo, sn_hi, 0xF7];
    info!(sample_number, "requesting sample header (RSDATA)");
    s2p.scsi_midi_send(target_id, &rsdata_req).await?;

    // Poll+read the header response
    let header_data = poll_and_read(s2p, target_id, 20).await?;
    let (header_msgs, _) = extract_sysex_messages(&header_data);

    // Find the RSDATA response (F0 47 ch 0B 48 ...)
    let rsdata_resp = header_msgs.iter()
        .find(|m| m.len() > 5 && m[0] == 0xF0 && m[1] == 0x47 && m[3] == 0x0B && m[4] == 0x48)
        .ok_or_else(|| "no RSDATA response received".to_string())?;

    info!(
        rsdata_len = rsdata_resp.len(),
        rsdata_hex = %rsdata_resp.iter().map(|b| format!("{:02X}", b)).collect::<Vec<_>>().join(" "),
        "raw RSDATA response"
    );
    let header = parse_rsdata_header(rsdata_resp)?;
    let total_samples = header.sample_count;
    info!(
        name = %header.name,
        sample_rate = header.sample_rate,
        sample_count = total_samples,
        "sample header received"
    );
    on_header(header);

    if total_samples == 0 {
        return Ok(0);
    }

    // 3. Send RSPACK to request sample data transfer
    // Count uses 7-bit encoding per byte (same as C++ reference):
    //   byte0 = cnt & 0x7F, byte1 = (cnt >> 7) & 0x7F, etc.
    let cnt = total_samples;
    let rspack = vec![
        0xF0, 0x47, channel, 0x0C, 0x48,
        sn_lo, sn_hi,
        0x00, 0x00, 0x00, 0x00, // offset = 0 (4 bytes, 7-bit)
        (cnt & 0x7F) as u8,
        ((cnt >> 7) & 0x7F) as u8,
        ((cnt >> 14) & 0x7F) as u8,
        ((cnt >> 21) & 0x7F) as u8,
        0x01, // SDS format
        0x00, // reserved
        0xF7,
    ];
    info!(total_samples, "sending RSPACK to start SDS transfer");
    s2p.scsi_midi_send(target_id, &rspack).await?;

    // 4. Poll+read+parse loop for SDS data packets
    let mut samples_received: u32 = 0;
    let mut accumulator: Vec<u8> = Vec::new();
    let mut consecutive_empty = 0u32;
    let max_empty_polls = 50; // 50 * 100ms = 5s timeout

    while samples_received < total_samples {
        let data = poll_and_read_nonblocking(s2p, target_id).await?;

        if data.is_empty() {
            consecutive_empty += 1;
            if consecutive_empty > max_empty_polls {
                warn!(
                    samples_received,
                    total_samples,
                    "download timed out waiting for data"
                );
                break;
            }
            tokio::time::sleep(std::time::Duration::from_millis(100)).await;
            continue;
        }

        consecutive_empty = 0;
        accumulator.extend_from_slice(&data);

        let (messages, leftover) = extract_sysex_messages(&accumulator);
        accumulator = leftover;

        for msg in &messages {
            if msg.len() < 5 {
                continue;
            }

            // SDS Dump Header: F0 7E ch 01 ...
            if msg[1] == 0x7E && msg[3] == 0x01 {
                debug!("received SDS Dump Header, sending ACK");
                let ack = vec![0xF0, 0x7E, channel, 0x7F, 0x00, 0xF7];
                s2p.scsi_midi_send(target_id, &ack).await?;
            }
            // SDS Data Packet: F0 7E ch 02 pp [120 data bytes] cc F7
            else if msg[1] == 0x7E && msg[3] == 0x02 {
                let packet_num = msg[4];
                let pcm_samples = decode_sds_packet(msg);

                let count = pcm_samples.len() as u32;
                samples_received += count;
                let clamped = samples_received.min(total_samples);

                on_data(&pcm_samples, clamped, total_samples);

                // Send ACK for this packet
                let ack = vec![0xF0, 0x7E, channel, 0x7F, packet_num, 0xF7];
                s2p.scsi_midi_send(target_id, &ack).await?;

                debug!(
                    packet_num,
                    chunk_samples = count,
                    progress = format!("{}/{}", clamped, total_samples),
                    "SDS data packet"
                );
            }
            // SDS ACK/NAK/WAIT — log but don't act
            else if msg[1] == 0x7E && (msg[3] == 0x7F || msg[3] == 0x7E || msg[3] == 0x7C) {
                debug!(msg_type = msg[3], "SDS handshake message");
            }
        }
    }

    info!(samples_received, total_samples, "sample download complete");
    Ok(samples_received)
}

// ==========================================================================
// Upload: browser → device
// ==========================================================================

/// Upload a sample to the S3000XL via SDS over SCSI.
///
/// Calls `on_progress` after each packet with (samples_sent, total_samples).
/// All SCSI commands execute locally on the Pi.
pub async fn upload_sample<F>(
    s2p: &S2pClient,
    target_id: u8,
    sample_number: u16,
    channel: u8,
    sample_rate: u32,
    samples: &[i16],
    batch_size: Option<usize>,
    pipeline_depth: Option<usize>,
    mut on_progress: F,
    cancelled: &std::sync::Arc<std::sync::atomic::AtomicBool>,
) -> Result<u32, String>
where
    F: FnMut(u32, u32),
{
    let total = samples.len() as u32;
    info!(target_id, sample_number, total, sample_rate, batch_size = ?batch_size, pipeline_depth = ?pipeline_depth, "starting sample upload");

    s2p.scsi_midi_enable(target_id).await?;
    let result = upload_sample_inner(
        s2p, target_id, sample_number, channel, sample_rate, samples, batch_size, pipeline_depth, &mut on_progress, cancelled,
    ).await;
    let _ = s2p.scsi_midi_disable(target_id).await;
    result
}

async fn upload_sample_inner<F>(
    s2p: &S2pClient,
    target_id: u8,
    sample_number: u16,
    channel: u8,
    sample_rate: u32,
    samples: &[i16],
    batch_size_override: Option<usize>,
    pipeline_depth_override: Option<usize>,
    on_progress: &mut F,
    cancelled: &std::sync::Arc<std::sync::atomic::AtomicBool>,
) -> Result<u32, String>
where
    F: FnMut(u32, u32),
{
    let total = samples.len() as u32;
    let sn_lo = (sample_number & 0x7F) as u8;
    let sn_hi = ((sample_number >> 7) & 0x7F) as u8;

    // 1. Build and send SDS Dump Header
    if sample_rate == 0 {
        return Err("sample_rate must be > 0".to_string());
    }
    let period_ns = 1_000_000_000u32 / sample_rate;
    let dump_header = vec![
        0xF0, 0x7E, channel, 0x01,       // SDS Dump Header
        sn_lo, sn_hi,                     // sample number (7-bit)
        16,                               // bits per sample
        (period_ns & 0x7F) as u8,         // period (3 bytes, 7-bit)
        ((period_ns >> 7) & 0x7F) as u8,
        ((period_ns >> 14) & 0x7F) as u8,
        (total & 0x7F) as u8,            // sample length (3 bytes, 7-bit)
        ((total >> 7) & 0x7F) as u8,
        ((total >> 14) & 0x7F) as u8,
        0, 0, 0,                          // loop start = 0
        0, 0, 0,                          // loop end = 0
        0,                                // loop type = off
        0xF7,
    ];

    info!("sending SDS Dump Header");
    s2p.scsi_midi_send(target_id, &dump_header).await?;
    wait_for_ack(s2p, target_id, 30).await
        .map_err(|e| format!("no ACK for dump header: {e}"))?;

    // 2. Send data packets in batches for throughput.
    // Batching multiple SDS packets into a single SCSI MIDI send + read
    // amortizes the ~113ms per-SCSI-command overhead. Batch of 20 gives ~9x
    // speedup (25ms/pkt vs 227ms/pkt).
    let samples_per_packet = 40usize;
    // Phase 3.2 (task #25): batch_size tunable per-request. Phase 3.2 sweep showed
    // batch=20 is the local optimum on this device (larger batches degrade due to
    // device-side MIDI buffering). See `sds-phase-3.2-batch-sweep.md`.
    let batch_size = batch_size_override.unwrap_or(20);
    // Phase 3.3 (task #26): pipeline_depth controls how many batches stay
    // "in flight" (sent but not ACK-read). depth=1 = previous behavior
    // (synchronous send→read per batch). depth=N keeps N batches buffered on the
    // device, overlapping bridge-side send/read with device-side processing.
    let pipeline_depth = pipeline_depth_override.unwrap_or(1).max(1);
    let mut pkt_num: u8 = 0;
    let mut offset = 0usize;

    // Track in-flight batches: each entry is the packet count of a sent-but-not-yet-read batch.
    let mut in_flight: std::collections::VecDeque<usize> = std::collections::VecDeque::new();
    let mut last_log_offset = 0usize;

    // Helper: read and validate ACKs for one batch
    async fn drain_one_batch_acks(
        s2p: &S2pClient,
        target_id: u8,
        packets_in_batch: usize,
    ) -> Result<std::time::Duration, String> {
        let t0 = std::time::Instant::now();
        let ack_data = s2p.scsi_midi_read(target_id, (packets_in_batch * 6) as u32).await?;
        let elapsed = t0.elapsed();
        let (messages, _) = extract_sysex_messages(&ack_data);
        for msg in &messages {
            if msg.len() >= 6 && msg[1] == 0x7E {
                match msg[3] {
                    0x7F => {} // ACK — continue
                    0x7E => return Err("NAK received during batch upload".to_string()),
                    0x7D => return Err("transfer cancelled by device".to_string()),
                    0x7C => {} // Wait — device is processing, ACK should follow
                    _ => {}
                }
            }
        }
        Ok(elapsed)
    }

    while offset < samples.len() || !in_flight.is_empty() {
        if cancelled.load(std::sync::atomic::Ordering::Relaxed) {
            info!("SDS upload cancelled by client disconnect");
            // Try to drain any in-flight ACKs to leave the device in a clean state.
            while let Some(packets) = in_flight.pop_front() {
                let _ = s2p.scsi_midi_read(target_id, (packets * 6) as u32).await;
            }
            return Err("upload cancelled".to_string());
        }

        // Send next batch if pipeline isn't full and there's data left.
        let can_send = offset < samples.len() && in_flight.len() < pipeline_depth;
        if can_send {
            let mut batch_data: Vec<u8> = Vec::new();
            let mut packets_in_batch = 0usize;
            while packets_in_batch < batch_size && offset < samples.len() {
                let pkt = encode_sds_data_packet(channel, pkt_num, samples, offset, samples_per_packet);
                batch_data.extend_from_slice(&pkt);
                offset += samples_per_packet;
                pkt_num = (pkt_num + 1) & 0x7F;
                packets_in_batch += 1;
            }
            s2p.scsi_midi_send(target_id, &batch_data).await?;
            in_flight.push_back(packets_in_batch);
        }

        // Drain when: pipeline is now full, OR there's no more data to send (final drain).
        let must_drain = in_flight.len() >= pipeline_depth || offset >= samples.len();
        if must_drain {
            if let Some(packets) = in_flight.pop_front() {
                let ack_ms = drain_one_batch_acks(s2p, target_id, packets).await?;

                let sent = (offset as u32).min(total);
                on_progress(sent, total);

                // Log roughly every 10 batches to avoid log spam
                if last_log_offset == 0
                    || offset.saturating_sub(last_log_offset) >= batch_size * samples_per_packet * 10
                {
                    info!(
                        batch_packets = packets,
                        ack_drain_ms = ack_ms.as_millis() as u64,
                        per_pkt_ms = (ack_ms.as_millis() as u64) / (packets as u64).max(1),
                        in_flight = in_flight.len(),
                        pipeline_depth,
                        progress = format!("{}/{}", sent, total),
                        "SDS batch timing"
                    );
                    last_log_offset = offset;
                }
            }
        }
    }

    info!(total, "sample upload complete");
    Ok(total)
}

// =========================================================================
// ASPACK fast upload (10x faster than SDS)
// =========================================================================

/// Upload a sample using ASPACK (Akai proprietary protocol).
///
/// Algorithm:
/// 1. Create sample slot via minimal SDS (dump header + 1 silence packet)
/// 2. Write real PCM data via ASPACK chunks (avoids block boundaries)
/// 3. Progress reported per chunk
///
/// Throughput: ~16-23 KB/s vs ~2.2 KB/s for batched SDS.
pub async fn upload_sample_aspack<F>(
    s2p: &S2pClient,
    target_id: u8,
    sample_number: u16,
    channel: u8,
    sample_rate: u32,
    samples: &[i16],
    mut on_progress: F,
    cancelled: &std::sync::Arc<std::sync::atomic::AtomicBool>,
) -> Result<u32, String>
where
    F: FnMut(u32, u32),
{
    let total = samples.len() as u32;
    if sample_rate == 0 {
        return Err("sample_rate must be > 0".to_string());
    }

    info!(target_id, sample_number, total, sample_rate, "starting ASPACK upload");

    s2p.scsi_midi_enable(target_id).await?;
    let result = upload_sample_aspack_inner(
        s2p, target_id, sample_number, channel, sample_rate, samples, &mut on_progress, cancelled,
    ).await;
    let _ = s2p.scsi_midi_disable(target_id).await;
    result
}

async fn upload_sample_aspack_inner<F>(
    s2p: &S2pClient,
    target_id: u8,
    sample_number: u16,
    channel: u8,
    sample_rate: u32,
    samples: &[i16],
    on_progress: &mut F,
    cancelled: &std::sync::Arc<std::sync::atomic::AtomicBool>,
) -> Result<u32, String>
where
    F: FnMut(u32, u32),
{
    let total = samples.len() as u32;

    // Phase 1: Create sample slot via minimal SDS (dump header + 1 data packet)
    info!("ASPACK phase 1: creating sample slot via minimal SDS");
    let period_ns = 1_000_000_000u32 / sample_rate;
    let sn_lo = (sample_number & 0x7F) as u8;
    let sn_hi = ((sample_number >> 7) & 0x7F) as u8;

    // Declare the real sample count in the SDS header so the device
    // allocates the correct memory size. Then send 1 data packet (40 samples)
    // to trigger sample creation in RSLIST. ASPACK overwrites with real data.
    let len_lo = (total & 0x7F) as u8;
    let len_mid = ((total >> 7) & 0x7F) as u8;
    let len_hi = ((total >> 14) & 0x7F) as u8;
    let dump_header = vec![
        0xF0, 0x7E, channel, 0x01,
        sn_lo, sn_hi, 16,
        (period_ns & 0x7F) as u8,
        ((period_ns >> 7) & 0x7F) as u8,
        ((period_ns >> 14) & 0x7F) as u8,
        len_lo, len_mid, len_hi,        // length = actual sample count
        0, 0, 0, 0, 0, 0, 0,           // loop start/end/type = 0
        0xF7,
    ];

    s2p.scsi_midi_send(target_id, &dump_header).await?;
    wait_for_ack(s2p, target_id, 30).await
        .map_err(|e| format!("no ACK for dump header: {e}"))?;

    // Send 1 data packet (40 samples of silence) to commit the sample to RSLIST.
    // The dump header alone doesn't create the sample — the device needs at least
    // one data packet. (SCSI-NOTES: "minimum viable creation: 1 header + 1 packet")
    let silence_pkt = encode_sds_data_packet(channel, 0, &[0i16; 40], 0, 40);
    s2p.scsi_midi_send(target_id, &silence_pkt).await?;
    wait_for_ack(s2p, target_id, 30).await
        .map_err(|e| format!("no ACK for data packet: {e}"))?;

    info!("ASPACK phase 1 complete: sample slot created");

    // Brief pause for device to commit
    tokio::time::sleep(std::time::Duration::from_millis(100)).await;

    // Phase 2: Write real PCM data via ASPACK chunks
    // Use chunk size 8191 to avoid Akai block boundaries (N×8192 rejected).
    // Max single chunk is ~67000 samples (262 KB SysEx).
    let chunk_size = if total <= 60000 { total as usize } else { 8191usize };
    let mut offset = 0usize;

    info!(total, chunk_size, "ASPACK phase 2: writing PCM data");

    // Find the RSLIST index of the newly created sample.
    // Query via raw CDBs (send RSLIST request, poll, read response).
    let rslist_msg = vec![0xF0, 0x47, channel, 0x04, 0x48, 0xF7];
    s2p.scsi_midi_send(target_id, &rslist_msg).await?;

    // Poll for response
    let mut rslist_resp = Vec::new();
    for _ in 0..30 {
        let pending = s2p.scsi_midi_poll(target_id).await?;
        if pending > 0 {
            rslist_resp = s2p.scsi_midi_read(target_id, pending).await?;
            break;
        }
        tokio::time::sleep(std::time::Duration::from_millis(10)).await;
    }

    let sample_count = if rslist_resp.len() > 6 { (rslist_resp.len() - 6) / 24 } else { 0 };
    let rslist_index = if sample_count > 0 { sample_count - 1 } else {
        return Err("sample not found in RSLIST after SDS creation".to_string());
    };

    info!(rslist_index, sample_count, "found sample in RSLIST");

    while offset < samples.len() {
        if cancelled.load(std::sync::atomic::Ordering::Relaxed) {
            info!("ASPACK upload cancelled");
            return Err("upload cancelled".to_string());
        }

        let count = std::cmp::min(chunk_size, samples.len() - offset);

        // Build ASPACK message: F0 47 cc 0D 48 [idx 4n] [offset 8n] [count 8n] [data 4n*count] F7
        let mut msg = Vec::with_capacity(5 + 4 + 8 + 8 + count * 4 + 1);
        msg.push(0xF0);
        msg.push(0x47);
        msg.push(channel);
        msg.push(0x0D); // ASPACK opcode
        msg.push(0x48); // S3000XL device ID

        // Sample index (nibble-encoded, 2 bytes = 4 nibbles)
        let idx = rslist_index as u16;
        msg.push((idx & 0x0F) as u8);
        msg.push(((idx >> 4) & 0x0F) as u8);
        msg.push(((idx >> 8) & 0x0F) as u8);
        msg.push(((idx >> 12) & 0x0F) as u8);

        // Offset (nibble-encoded, 4 bytes = 8 nibbles)
        let off = offset as u32;
        for i in 0..4 {
            let byte = ((off >> (i * 8)) & 0xFF) as u8;
            msg.push(byte & 0x0F);
            msg.push((byte >> 4) & 0x0F);
        }

        // Count (nibble-encoded, 4 bytes = 8 nibbles)
        let cnt = count as u32;
        for i in 0..4 {
            let byte = ((cnt >> (i * 8)) & 0xFF) as u8;
            msg.push(byte & 0x0F);
            msg.push((byte >> 4) & 0x0F);
        }

        // PCM data (nibble-encoded, 4 nibbles per 16-bit sample)
        for i in 0..count {
            let s = if offset + i < samples.len() { samples[offset + i] as u16 } else { 0u16 };
            msg.push((s & 0x0F) as u8);
            msg.push(((s >> 4) & 0x0F) as u8);
            msg.push(((s >> 8) & 0x0F) as u8);
            msg.push(((s >> 12) & 0x0F) as u8);
        }

        msg.push(0xF7);

        let t0 = std::time::Instant::now();
        s2p.scsi_midi_send(target_id, &msg).await?;

        // Poll for REPLY (flag 0x00 required)
        let mut got_reply = false;
        for _ in 0..30 {
            let pending = s2p.scsi_midi_poll(target_id).await?;
            if pending > 0 {
                let reply = s2p.scsi_midi_read(target_id, pending).await?;
                if reply.len() >= 4 && reply[3] == 0x16 {
                    got_reply = true;
                    break;
                }
            }
        }

        if !got_reply {
            return Err(format!("no REPLY for ASPACK chunk at offset {offset}"));
        }

        let chunk_ms = t0.elapsed().as_millis() as u64;
        offset += count;
        let sent = (offset as u32).min(total);
        on_progress(sent, total);

        if offset <= chunk_size || offset % (chunk_size * 5) < chunk_size {
            info!(
                offset,
                chunk_ms,
                progress = format!("{}/{}", sent, total),
                "ASPACK chunk"
            );
        }
    }

    info!(total, "ASPACK upload complete");
    Ok(total)
}

// =========================================================================
// SDS encoding helpers
// =========================================================================

/// Encode a 16-bit PCM sample into 3 SDS bytes (7-bit encoding, MSB first).
fn encode_sds_sample(sample: i16) -> [u8; 3] {
    let raw = sample as u16;
    [
        ((raw >> 9) & 0x7F) as u8,
        ((raw >> 2) & 0x7F) as u8,
        ((raw << 5) & 0x60) as u8,
    ]
}

/// Build an SDS Data Packet (F0 7E ch 02 pp [120 bytes] checksum F7).
fn encode_sds_data_packet(
    channel: u8,
    pkt_num: u8,
    samples: &[i16],
    offset: usize,
    samples_per_packet: usize,
) -> Vec<u8> {
    let mut pkt = Vec::with_capacity(127);
    pkt.push(0xF0);
    pkt.push(0x7E);
    pkt.push(channel);
    pkt.push(0x02); // Data Packet
    pkt.push(pkt_num & 0x7F);

    let mut checksum = 0x7Eu8 ^ channel ^ 0x02u8 ^ (pkt_num & 0x7F);

    for i in 0..samples_per_packet {
        let s = if offset + i < samples.len() {
            samples[offset + i]
        } else {
            0 // pad with silence
        };
        let enc = encode_sds_sample(s);
        checksum ^= enc[0];
        checksum ^= enc[1];
        checksum ^= enc[2];
        pkt.extend_from_slice(&enc);
    }

    pkt.push(checksum & 0x7F);
    pkt.push(0xF7);
    pkt
}

/// Poll+read until we get an ACK (F0 7E ch 7F pp F7).
/// Returns Ok on ACK, Err on timeout or NAK.
async fn wait_for_ack(s2p: &S2pClient, target_id: u8, max_retries: u32) -> Result<(), String> {
    // Try reading the ACK directly — skip the poll. The sampler should have
    // the 6-byte ACK ready by the time the SCSI read arrives. This saves one
    // SCSI round trip (~110ms) per packet.
    for attempt in 0..max_retries {
        let data = s2p.scsi_midi_read(target_id, 6).await?;
        if data.is_empty() || data.iter().all(|&b| b == 0) {
            // No data yet — brief pause then retry
            tokio::time::sleep(std::time::Duration::from_millis(
                if attempt < 3 { 1 } else { 10 }
            )).await;
            continue;
        }
        let (messages, _) = extract_sysex_messages(&data);
        for msg in &messages {
            if msg.len() >= 6 && msg[1] == 0x7E {
                match msg[3] {
                    0x7F => return Ok(()),                          // ACK
                    0x7E => return Err("NAK received".to_string()), // NAK
                    0x7D => return Err("transfer cancelled by device".to_string()), // Cancel
                    0x7C => continue,                               // Wait — retry
                    _ => {}
                }
            }
        }
    }
    Err("timeout waiting for ACK: max retries exceeded".to_string())
}

// ==========================================================================
// Shared helpers
// ==========================================================================

/// Decode 16-bit PCM samples from an SDS Data Packet.
/// SDS uses 7-bit encoding: each 16-bit sample is 3 bytes (MSB first).
/// raw = (p[0] << 9) | (p[1] << 2) | (p[2] >> 5), interpreted as i16.
fn decode_sds_packet(msg: &[u8]) -> Vec<i16> {
    // SDS packet: F0 7E ch 02 pp [data...] checksum F7
    // Data starts at byte 5, ends 2 bytes before the end (checksum + F7)
    if msg.len() < 8 {
        return Vec::new();
    }
    let data = &msg[5..msg.len() - 2];
    let mut samples = Vec::new();

    // Each sample is 3 bytes in 7-bit encoding
    let mut i = 0;
    while i + 2 < data.len() {
        let raw = ((data[i] as u16) << 9)
            | ((data[i + 1] as u16) << 2)
            | ((data[i + 2] as u16) >> 5);
        samples.push(raw as i16);
        i += 3;
    }

    samples
}

/// Decode a nibble-encoded u16 (little-endian) from 4 nibbles.
fn decode_nibble_u16(nibbles: &[u8], offset: usize) -> u16 {
    let b0 = decode_nibble_byte(nibbles[offset], nibbles[offset + 1]) as u16;
    let b1 = decode_nibble_byte(nibbles[offset + 2], nibbles[offset + 3]) as u16;
    b0 | (b1 << 8)
}

/// Decode a nibble-encoded u32 (little-endian) from 8 nibbles.
fn decode_nibble_u32(nibbles: &[u8], offset: usize) -> u32 {
    let b0 = decode_nibble_byte(nibbles[offset], nibbles[offset + 1]) as u32;
    let b1 = decode_nibble_byte(nibbles[offset + 2], nibbles[offset + 3]) as u32;
    let b2 = decode_nibble_byte(nibbles[offset + 4], nibbles[offset + 5]) as u32;
    let b3 = decode_nibble_byte(nibbles[offset + 6], nibbles[offset + 7]) as u32;
    b0 | (b1 << 8) | (b2 << 16) | (b3 << 24)
}

/// Parse an RSDATA response to extract sample name, length, and rate.
///
/// Nibble layout (from Akai S2800/S3000 SysEx specification):
///   Offset  Field     Size (bytes → nibbles)
///   0       SHIDENT   1 → 2
///   2       SBANDW    1 → 2
///   4       SPITCH    1 → 2
///   6       SHNAME    12 → 24
///   30      SSRVLD    1 → 2
///   32      SLOOPS    1 → 2
///   34      SALOOP    1 → 2
///   36      SHLOOP    1 → 2
///   38      SPTYPE    1 → 2
///   40      STUNO     2 → 4
///   44      SLOCAT    4 → 8
///   52      SLNGTH    4 → 8   ← sample count
///   60      SSTART    4 → 8
///   68      SMPEND    4 → 8
///   76      loops     48 → 96  (4 × 12 bytes)
///   172     SLXY      48 → 96  (4 × 12 bytes)
///   268     SSPARE    1 → 2
///   270     SWCOMM    1 → 2
///   272     SSPAIR    2 → 4
///   276     SSRATE    2 → 4   ← sample rate
fn parse_rsdata_header(msg: &[u8]) -> Result<SampleDownloadHeader, String> {
    // RSDATA response: F0 47 ch 0B 48 sn_lo sn_hi [nibble-encoded header...] F7
    if msg.len() < 10 {
        return Err("RSDATA response too short".to_string());
    }

    // Nibble-encoded payload starts after F0 47 ch 0B 48 sn_lo sn_hi (index 7)
    let nibbles = &msg[7..msg.len() - 1]; // exclude trailing F7

    // SHNAME: 12 bytes = 24 nibbles starting at nibble offset 6
    // (after SHIDENT:2 + SBANDW:2 + SPITCH:2)
    let name_start = 6;
    let mut name = String::new();
    if name_start + 24 <= nibbles.len() {
        for i in 0..12 {
            let ni = name_start + i * 2;
            let byte = decode_nibble_byte(nibbles[ni], nibbles[ni + 1]);
            name.push(akai_char(byte));
        }
    }
    let name = name.trim_end().to_string();

    // SLNGTH: 4 bytes = 8 nibbles at offset 52
    let sample_count = if 52 + 8 <= nibbles.len() {
        decode_nibble_u32(nibbles, 52)
    } else {
        0
    };

    // SSRATE: 2 bytes = 4 nibbles at offset 276
    let sample_rate = if 276 + 4 <= nibbles.len() {
        decode_nibble_u16(nibbles, 276) as u32
    } else {
        44100 // fallback if response is truncated
    };

    Ok(SampleDownloadHeader {
        name,
        sample_rate,
        sample_count,
    })
}

/// Poll and read all available MIDI data, retrying up to `max_retries` times.
async fn poll_and_read(s2p: &S2pClient, target_id: u8, max_retries: u32) -> Result<Vec<u8>, String> {
    let mut result = Vec::new();

    for attempt in 0..max_retries {
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;

        let pending = s2p.scsi_midi_poll(target_id).await?;
        if pending > 0 {
            let data = s2p.scsi_midi_read(target_id, pending).await?;
            result.extend_from_slice(&data);

            // Check if more data follows
            tokio::time::sleep(std::time::Duration::from_millis(50)).await;
            let more = s2p.scsi_midi_poll(target_id).await?;
            if more > 0 {
                let data2 = s2p.scsi_midi_read(target_id, more).await?;
                result.extend_from_slice(&data2);
            }
            return Ok(result);
        }

        debug!(attempt = attempt + 1, "poll_and_read: no data yet");
    }

    if result.is_empty() {
        Err("poll_and_read: no data after max retries".to_string())
    } else {
        Ok(result)
    }
}

/// Non-blocking poll+read: returns whatever is available, or empty vec.
async fn poll_and_read_nonblocking(s2p: &S2pClient, target_id: u8) -> Result<Vec<u8>, String> {
    let pending = s2p.scsi_midi_poll(target_id).await?;
    if pending == 0 {
        return Ok(Vec::new());
    }
    s2p.scsi_midi_read(target_id, pending).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_akai_char() {
        assert_eq!(akai_char(0), '0');
        assert_eq!(akai_char(9), '9');
        assert_eq!(akai_char(10), ' ');
        assert_eq!(akai_char(11), 'A');
        assert_eq!(akai_char(36), 'Z');
        assert_eq!(akai_char(37), 'a');
        assert_eq!(akai_char(62), 'z');
        assert_eq!(akai_char(63), '#');
    }

    #[test]
    fn test_decode_nibble_byte() {
        assert_eq!(decode_nibble_byte(0x05, 0x0A), 0xA5);
        assert_eq!(decode_nibble_byte(0x0F, 0x0F), 0xFF);
        assert_eq!(decode_nibble_byte(0x00, 0x00), 0x00);
    }

    #[test]
    fn test_extract_sysex_messages() {
        let buf = vec![0xF0, 0x01, 0x02, 0xF7, 0xF0, 0x03, 0xF7];
        let (msgs, remaining) = extract_sysex_messages(&buf);
        assert_eq!(msgs.len(), 2);
        assert_eq!(msgs[0], vec![0xF0, 0x01, 0x02, 0xF7]);
        assert_eq!(msgs[1], vec![0xF0, 0x03, 0xF7]);
        assert!(remaining.is_empty());
    }

    #[test]
    fn test_extract_sysex_incomplete() {
        let buf = vec![0xF0, 0x01, 0x02, 0xF7, 0xF0, 0x03];
        let (msgs, remaining) = extract_sysex_messages(&buf);
        assert_eq!(msgs.len(), 1);
        assert_eq!(remaining, vec![0xF0, 0x03]);
    }

    #[test]
    fn test_decode_sds_packet() {
        // Minimal SDS packet: F0 7E 00 02 00 [3 data bytes] checksum F7
        let msg = vec![0xF0, 0x7E, 0x00, 0x02, 0x00, 0x40, 0x00, 0x00, 0x00, 0xF7];
        let samples = decode_sds_packet(&msg);
        // 3 data bytes = 1 sample: (0x40 << 9) | (0x00 << 2) | (0x00 >> 5) = 0x8000
        assert_eq!(samples.len(), 1);
        assert_eq!(samples[0], i16::MIN); // 0x8000 as i16 = -32768
    }

    #[test]
    fn test_parse_rsdata_header() {
        // Build a synthetic RSDATA response with known values.
        // Format: F0 47 ch 0B 48 sn_lo sn_hi [nibblized header...] F7
        //
        // Nibble layout:
        //   0-1: SHIDENT (1 byte)
        //   2-3: SBANDW (1 byte)
        //   4-5: SPITCH (1 byte)
        //   6-29: SHNAME (12 bytes)
        //   30-51: various fields (SSRVLD..SLOCAT = 11 bytes)
        //   52-59: SLNGTH (4 bytes) = sample count
        //   60-275: other fields
        //   276-279: SSRATE (2 bytes) = sample rate

        // We need at least 280 nibble bytes after the SysEx header
        let mut msg = vec![0xF0, 0x47, 0x00, 0x0B, 0x48, 0x00, 0x00]; // header + sn
        let mut nibbles = vec![0u8; 280];

        // SHIDENT at 0: don't care
        // SBANDW at 2: don't care
        // SPITCH at 4: don't care

        // SHNAME at 6: encode "SCSITEST    " (12 chars)
        // Akai encoding: 10=' ', 11='A', 12='B', 13='C', ... S=29, C=13, I=19, T=30, E=15
        let name_akai: [u8; 12] = [29, 13, 29, 19, 30, 15, 29, 30, 10, 10, 10, 10];
        for (i, &ch) in name_akai.iter().enumerate() {
            nibbles[6 + i * 2] = ch & 0x0F;
            nibbles[6 + i * 2 + 1] = (ch >> 4) & 0x0F;
        }

        // SLNGTH at 52: encode 256 (0x00000100) as 4 LE bytes nibblized
        // byte 0 = 0x00 → nibbles 0x00, 0x00
        // byte 1 = 0x01 → nibbles 0x01, 0x00
        // byte 2 = 0x00 → nibbles 0x00, 0x00
        // byte 3 = 0x00 → nibbles 0x00, 0x00
        nibbles[52] = 0x00; nibbles[53] = 0x00;
        nibbles[54] = 0x01; nibbles[55] = 0x00;
        nibbles[56] = 0x00; nibbles[57] = 0x00;
        nibbles[58] = 0x00; nibbles[59] = 0x00;

        // SSRATE at 276: encode 44100 (0xAC44) as 2 LE bytes nibblized
        // byte 0 = 0x44 → nibbles 0x04, 0x04
        // byte 1 = 0xAC → nibbles 0x0C, 0x0A
        nibbles[276] = 0x04; nibbles[277] = 0x04;
        nibbles[278] = 0x0C; nibbles[279] = 0x0A;

        msg.extend_from_slice(&nibbles);
        msg.push(0xF7);

        let header = parse_rsdata_header(&msg).unwrap();
        assert_eq!(header.name, "SCSITEST");
        assert_eq!(header.sample_count, 256);
        assert_eq!(header.sample_rate, 44100);
    }

    #[test]
    fn test_decode_nibble_u16() {
        // 44100 = 0xAC44 → LE bytes 0x44, 0xAC → nibbles 0x04 0x04 0x0C 0x0A
        let nibbles = [0x04, 0x04, 0x0C, 0x0A];
        assert_eq!(decode_nibble_u16(&nibbles, 0), 44100);
    }

    #[test]
    fn test_decode_nibble_u32() {
        // 256 = 0x00000100 → LE bytes 0x00 0x01 0x00 0x00
        let nibbles = [0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00];
        assert_eq!(decode_nibble_u32(&nibbles, 0), 256);

        // 100000 = 0x000186A0 → LE bytes 0xA0 0x86 0x01 0x00
        let nibbles2 = [0x00, 0x0A, 0x06, 0x08, 0x01, 0x00, 0x00, 0x00];
        assert_eq!(decode_nibble_u32(&nibbles2, 0), 100000);
    }

    #[test]
    fn test_encode_decode_sds_round_trip() {
        // Encode some samples, build a packet, decode it, and verify round-trip
        let original: Vec<i16> = vec![0, 32767, -32768, 1234, -5678];
        let pkt = encode_sds_data_packet(0, 0, &original, 0, 40);
        let decoded = decode_sds_packet(&pkt);

        // First 5 decoded samples should match the originals
        for i in 0..original.len() {
            assert_eq!(
                decoded[i], original[i],
                "sample {} mismatch: encoded {} decoded {}",
                i, original[i], decoded[i]
            );
        }
        // Remaining should be zero-padded
        for i in original.len()..decoded.len() {
            assert_eq!(decoded[i], 0, "pad sample {} should be 0", i);
        }
    }

    #[test]
    fn test_encode_sds_sample_extremes() {
        // Silence
        let enc = encode_sds_sample(0);
        assert_eq!(enc, [0, 0, 0]);

        // Max positive
        let enc = encode_sds_sample(32767);
        let decoded = ((enc[0] as u16) << 9) | ((enc[1] as u16) << 2) | ((enc[2] as u16) >> 5);
        assert_eq!(decoded as i16, 32767);

        // Max negative
        let enc = encode_sds_sample(-32768);
        let decoded = ((enc[0] as u16) << 9) | ((enc[1] as u16) << 2) | ((enc[2] as u16) >> 5);
        assert_eq!(decoded as i16, -32768);
    }
}

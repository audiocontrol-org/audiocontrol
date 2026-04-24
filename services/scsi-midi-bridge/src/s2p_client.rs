//! Client for s2p's protobuf API (port 6868).
//!
//! Wire protocol: "RASCSI" magic + 4-byte LE length + protobuf payload.
//! Response: 4-byte LE length + protobuf payload.
//!
//! We hand-encode the protobuf messages to avoid a build-time protoc dependency.

use std::collections::HashMap;
use std::time::Instant;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tracing::{debug, info};

// -- Protobuf encoding helpers ------------------------------------------------

fn encode_varint(mut value: u64) -> Vec<u8> {
    let mut buf = Vec::new();
    loop {
        let byte = (value & 0x7F) as u8;
        value >>= 7;
        if value == 0 {
            buf.push(byte);
            break;
        }
        buf.push(byte | 0x80);
    }
    buf
}

fn decode_varint(data: &[u8], pos: &mut usize) -> u64 {
    let mut val: u64 = 0;
    let mut shift = 0;
    while *pos < data.len() {
        let b = data[*pos];
        *pos += 1;
        val |= ((b & 0x7F) as u64) << shift;
        shift += 7;
        if b & 0x80 == 0 {
            break;
        }
    }
    val
}

/// Minimal protobuf field parser — returns field_num → value.
/// Varint fields stored as u64, length-delimited as Vec<u8>.
#[derive(Debug, Default)]
pub struct Fields {
    pub varints: HashMap<u32, u64>,
    pub bytes: HashMap<u32, Vec<u8>>,
}

impl Fields {
    pub fn parse(data: &[u8]) -> Self {
        let mut f = Fields::default();
        let mut pos = 0;
        while pos < data.len() {
            let tag = decode_varint(data, &mut pos);
            let field_num = (tag >> 3) as u32;
            let wire_type = (tag & 0x07) as u8;
            match wire_type {
                0 => {
                    let val = decode_varint(data, &mut pos);
                    f.varints.insert(field_num, val);
                }
                2 => {
                    let len = decode_varint(data, &mut pos) as usize;
                    let end = (pos + len).min(data.len());
                    f.bytes.insert(field_num, data[pos..end].to_vec());
                    pos = end;
                }
                5 => pos += 4,
                1 => pos += 8,
                _ => break,
            }
        }
        f
    }

}

// -- Protobuf message builders ------------------------------------------------

// PbOperation enum values
const SCSI_EXEC: u64 = 210;

fn op_name(op: u64) -> &'static str {
    match op {
        200 => "MIDI_INIT",
        201 => "MIDI_SEND",
        202 => "MIDI_POLL",
        203 => "MIDI_READ",
        210 => "SCSI_EXEC",
        _ => "UNKNOWN",
    }
}

// -- SCSI_EXEC message builders -----------------------------------------------

pub struct ScsiExecResult {
    pub status: u8,
    pub sense_data: Vec<u8>,
    pub data_in: Vec<u8>,
    pub bytes_transferred: u32,
}

pub struct SampleDownloadHeader {
    pub name: String,
    pub sample_rate: u32,
    pub sample_count: u32,
}

fn build_scsi_request(
    target_id: u8,
    lun: u8,
    cdb: &[u8],
    data_out: &[u8],
    expected_data_in: u32,
    timeout_seconds: u32,
) -> Vec<u8> {
    let mut buf = Vec::new();
    // field 1 (target_id), varint, tag 0x08
    buf.push(0x08);
    buf.extend(encode_varint(target_id as u64));
    // field 2 (target_lun), varint, tag 0x10
    buf.push(0x10);
    buf.extend(encode_varint(lun as u64));
    // field 3 (cdb), length-delimited, tag 0x1a
    buf.push(0x1a);
    buf.extend(encode_varint(cdb.len() as u64));
    buf.extend(cdb);
    // field 4 (data_out), length-delimited, tag 0x22 — only if non-empty
    if !data_out.is_empty() {
        buf.push(0x22);
        buf.extend(encode_varint(data_out.len() as u64));
        buf.extend(data_out);
    }
    // field 5 (expected_data_in), varint, tag 0x28 — only if > 0
    if expected_data_in > 0 {
        buf.push(0x28);
        buf.extend(encode_varint(expected_data_in as u64));
    }
    // field 6 (timeout_seconds), varint, tag 0x30 — only if > 0
    if timeout_seconds > 0 {
        buf.push(0x30);
        buf.extend(encode_varint(timeout_seconds as u64));
    }
    buf
}

fn build_scsi_command(scsi_req: &[u8]) -> Vec<u8> {
    let mut cmd = Vec::new();
    // field 1 (operation), varint
    cmd.push(0x08);
    cmd.extend(encode_varint(SCSI_EXEC));
    // field 21 (scsi_request), length-delimited: tag = (21 << 3) | 2 = 170 → varint 0xaa 0x01
    cmd.push(0xaa);
    cmd.push(0x01);
    cmd.extend(encode_varint(scsi_req.len() as u64));
    cmd.extend(scsi_req);
    cmd
}

// -- TCP client ---------------------------------------------------------------

pub struct S2pClient {
    host: String,
    port: u16,
    pub target_id: u8,
}

impl S2pClient {
    pub fn new(host: String, port: u16, target_id: u8) -> Self {
        Self {
            host,
            port,
            target_id,
        }
    }

    async fn send_command(&self, operation: u64, payload: &[u8]) -> Result<Fields, String> {
        let t0 = Instant::now();

        let addr = format!("{}:{}", self.host, self.port);
        let mut stream = TcpStream::connect(&addr)
            .await
            .map_err(|e| format!("s2p connect error: {e}"))?;
        let t_connect = t0.elapsed();

        // Send: "RASCSI" + 4-byte LE length + payload
        stream
            .write_all(b"RASCSI")
            .await
            .map_err(|e| format!("write magic: {e}"))?;
        stream
            .write_all(&(payload.len() as u32).to_le_bytes())
            .await
            .map_err(|e| format!("write length: {e}"))?;
        stream
            .write_all(payload)
            .await
            .map_err(|e| format!("write payload: {e}"))?;
        let t_send = t0.elapsed();

        // Read response: 4-byte LE length + payload
        let mut len_buf = [0u8; 4];
        stream
            .read_exact(&mut len_buf)
            .await
            .map_err(|e| format!("read length: {e}"))?;
        let resp_len = u32::from_le_bytes(len_buf) as usize;

        let mut resp_buf = vec![0u8; resp_len];
        stream
            .read_exact(&mut resp_buf)
            .await
            .map_err(|e| format!("read payload: {e}"))?;
        let t_total = t0.elapsed();

        // Temporarily at info level to diagnose SDS performance
        info!(
            op = op_name(operation),
            tcp_connect_ms = t_connect.as_millis() as u64,
            send_ms = (t_send - t_connect).as_millis() as u64,
            recv_ms = (t_total - t_send).as_millis() as u64,
            total_ms = t_total.as_millis() as u64,
            resp_bytes = resp_len,
            "s2p command"
        );

        Ok(Fields::parse(&resp_buf))
    }

    pub async fn is_reachable(&self) -> bool {
        let addr = format!("{}:{}", self.host, self.port);
        TcpStream::connect(&addr).await.is_ok()
    }

    pub async fn execute_scsi(
        &self,
        target_id: u8,
        lun: u8,
        cdb: &[u8],
        data_out: &[u8],
        expected_data_in: u32,
        timeout: u32,
    ) -> Result<ScsiExecResult, String> {
        let req = build_scsi_request(target_id, lun, cdb, data_out, expected_data_in, timeout);
        let cmd = build_scsi_command(&req);
        let result = self.send_command(SCSI_EXEC, &cmd).await?;

        // Parse ScsiResponse from field 102 in PbResult
        let scsi_resp = match result.bytes.get(&102) {
            Some(data) => Fields::parse(data),
            None => return Err("No SCSI response in result".to_string()),
        };

        let mut exec_result = ScsiExecResult {
            status: scsi_resp.varints.get(&1).copied().unwrap_or(0) as u8,
            sense_data: scsi_resp.bytes.get(&2).cloned().unwrap_or_default(),
            data_in: scsi_resp.bytes.get(&3).cloned().unwrap_or_default(),
            bytes_transferred: scsi_resp.varints.get(&4).copied().unwrap_or(0) as u32,
        };

        // If the device returned CHECK CONDITION (status=0x02) and s2p did
        // not auto-include sense data, issue REQUEST SENSE so the caller can
        // diagnose the rejection. Critical for protocol probes — without sense
        // bytes, "rejected" tells us nothing about WHY.
        //
        // We only auto-fetch for CHECK CONDITION (0x02). Other non-zero statuses
        // (BUSY 0x08, RESERVATION CONFLICT 0x18, etc.) don't carry sense data
        // and would be wasted CDBs. We also avoid recursion (REQUEST SENSE
        // itself can return CHECK CONDITION but we don't probe further).
        const CHECK_CONDITION: u8 = 0x02;
        const REQUEST_SENSE_OPCODE: u8 = 0x03;
        let is_request_sense = !cdb.is_empty() && cdb[0] == REQUEST_SENSE_OPCODE;
        if exec_result.status == CHECK_CONDITION
            && exec_result.sense_data.is_empty()
            && !is_request_sense
        {
            // REQUEST SENSE CDB: 03 00 00 00 18 00 (allocation length 0x18 = 24 bytes,
            // covers fixed-format sense including additional sense bytes 12-17).
            let sense_cdb = [0x03u8, 0x00, 0x00, 0x00, 0x18, 0x00];
            let sense_req =
                build_scsi_request(target_id, lun, &sense_cdb, &[], 0x18, timeout);
            let sense_cmd = build_scsi_command(&sense_req);
            match self.send_command(SCSI_EXEC, &sense_cmd).await {
                Ok(sense_result) => {
                    if let Some(data) = sense_result.bytes.get(&102) {
                        let sense_resp = Fields::parse(data);
                        let sense_status =
                            sense_resp.varints.get(&1).copied().unwrap_or(0) as u8;
                        let sense_bytes =
                            sense_resp.bytes.get(&3).cloned().unwrap_or_default();
                        if sense_status == 0 && !sense_bytes.is_empty() {
                            debug!(
                                sense_len = sense_bytes.len(),
                                key = sense_bytes.get(2).copied().unwrap_or(0) & 0x0F,
                                asc = sense_bytes.get(12).copied().unwrap_or(0),
                                ascq = sense_bytes.get(13).copied().unwrap_or(0),
                                "auto-fetched REQUEST SENSE on CHECK CONDITION"
                            );
                            exec_result.sense_data = sense_bytes;
                        }
                    }
                }
                Err(e) => {
                    debug!(error = %e, "REQUEST SENSE follow-up failed");
                }
            }
        }

        Ok(exec_result)
    }

    // -- SCSI MIDI transport (vendor-specific CDBs) ----------------------------

    /// Enable MIDI mode on the SCSI device (CDB 0x09).
    pub async fn scsi_midi_enable(&self, target_id: u8) -> Result<(), String> {
        let cdb = vec![0x09, 0x00, 0x01, 0x00, 0x00, 0x00];
        let _result = self.execute_scsi(target_id, 0, &cdb, &[], 0, 10).await?;
        // Status may be non-zero but device still accepts — don't fail
        Ok(())
    }

    /// Disable MIDI mode (CDB 0x09).
    pub async fn scsi_midi_disable(&self, target_id: u8) -> Result<(), String> {
        let cdb = vec![0x09, 0x00, 0x00, 0x00, 0x00, 0x00];
        self.execute_scsi(target_id, 0, &cdb, &[], 0, 10).await?;
        Ok(())
    }

    /// Send MIDI data to device via CDB 0x0C with an explicit mode/flag byte.
    ///
    /// Current bridge callers all use `0x00`, which matches the older SDS/ASPACK
    /// bridge path. A future MESA-style fast path may need to drive `0x80` for the
    /// productive SRAW payload phase.
    pub async fn scsi_midi_send_with_flag(
        &self,
        target_id: u8,
        data: &[u8],
        flag: u8,
    ) -> Result<(), String> {
        let len = data.len();
        let cdb = vec![
            0x0C, 0x00,
            ((len >> 16) & 0xFF) as u8,
            ((len >> 8) & 0xFF) as u8,
            (len & 0xFF) as u8,
            flag,
        ];
        // Send may return CHECK CONDITION but data is still accepted — ignore status
        let _ = self.execute_scsi(target_id, 0, &cdb, data, 0, 10).await;
        Ok(())
    }

    /// Send MIDI SysEx data to device (CDB 0x0C) using the legacy bridge flag `0x00`.
    pub async fn scsi_midi_send(&self, target_id: u8, data: &[u8]) -> Result<(), String> {
        self.scsi_midi_send_with_flag(target_id, data, 0x00).await
    }

    /// Poll for available MIDI bytes (CDB 0x0D). Returns 24-bit byte count.
    pub async fn scsi_midi_poll(&self, target_id: u8) -> Result<u32, String> {
        let cdb = vec![0x0D, 0x00, 0x00, 0x00, 0x00, 0x00];
        let result = self.execute_scsi(target_id, 0, &cdb, &[], 3, 10).await?;
        let d = &result.data_in;
        if d.len() >= 3 {
            Ok(((d[0] as u32) << 16) | ((d[1] as u32) << 8) | (d[2] as u32))
        } else {
            Ok(0)
        }
    }

    /// Read MIDI bytes from device (CDB 0x0E). Returns raw bytes.
    pub async fn scsi_midi_read(&self, target_id: u8, length: u32) -> Result<Vec<u8>, String> {
        let cdb = vec![
            0x0E, 0x00,
            ((length >> 16) & 0xFF) as u8,
            ((length >> 8) & 0xFF) as u8,
            (length & 0xFF) as u8,
            0x00,
        ];
        let result = self.execute_scsi(target_id, 0, &cdb, &[], length, 10).await?;
        let data = &result.data_in;
        let preview: Vec<String> = data.iter().take(20).map(|b| format!("{:02X}", b)).collect();
        info!(
            requested = length,
            received = data.len(),
            status = result.status,
            first_bytes = %preview.join(" "),
            "scsi_midi_read"
        );
        Ok(result.data_in)
    }

    /// Send SysEx, then poll+read ALL available response data. The S3000XL
    /// may send multiple SysEx messages (e.g., WAIT + Dump Header for SDS)
    /// or split large messages across poll cycles (e.g., 392-byte program
    /// header as 240 + 152 bytes). Read until no more data is pending.
    pub async fn send_and_receive(&mut self, sysex: &[u8]) -> Result<Vec<u8>, String> {
        // Enable MIDI-over-SCSI for this request. SDS transfers disable it
        // when they finish, so we must re-enable before every SysEx exchange.
        // Disable when done so serial MIDI ports remain functional.
        self.scsi_midi_enable(self.target_id).await?;
        let result = self.send_and_receive_inner(sysex).await;
        let _ = self.scsi_midi_disable(self.target_id).await;
        result
    }

    /// Like `send_and_receive`, but with explicit CDB[5] flag byte.
    /// Test harness for the MESA II 0x80 path investigation (issue #315).
    /// Drains the MIDI response in the same call so the background worker
    /// can't consume it first — required for write-then-readback testing.
    pub async fn send_with_flag_and_receive(
        &mut self,
        sysex: &[u8],
        flag: u8,
    ) -> Result<Vec<u8>, String> {
        self.scsi_midi_enable(self.target_id).await?;
        let result = self.send_with_flag_and_receive_inner(sysex, flag).await;
        let _ = self.scsi_midi_disable(self.target_id).await;
        result
    }

    async fn send_with_flag_and_receive_inner(
        &self,
        sysex: &[u8],
        flag: u8,
    ) -> Result<Vec<u8>, String> {
        // Per SCSI-NOTES.md "Complete MIDI transaction flow":
        //   enable → drain → send → poll → read → disable
        // Drain stale bytes from prior sessions BEFORE sending so the
        // post-send poll sees only the response to our send.
        let mut drain_iters = 0;
        loop {
            let pending = self.scsi_midi_poll(self.target_id).await?;
            if pending == 0 {
                break;
            }
            let _ = self.scsi_midi_read(self.target_id, pending).await?;
            drain_iters += 1;
            if drain_iters >= 5 {
                break; // safety bound
            }
        }

        self.scsi_midi_send_with_flag(self.target_id, sysex, flag).await?;
        let mut result = Vec::new();
        let mut empty_polls = 0;
        for _ in 0..30 {
            tokio::time::sleep(std::time::Duration::from_millis(100)).await;
            let pending = self.scsi_midi_poll(self.target_id).await?;
            if pending > 0 {
                let chunk = self.scsi_midi_read(self.target_id, pending).await?;
                result.extend_from_slice(&chunk);
                empty_polls = 0;
            } else if !result.is_empty() {
                empty_polls += 1;
                if empty_polls >= 2 {
                    break;
                }
            }
        }
        if let Some(end) = result.iter().rposition(|&b| b == 0xF7) {
            result.truncate(end + 1);
        }
        Ok(result)
    }

    async fn send_and_receive_inner(&self, sysex: &[u8]) -> Result<Vec<u8>, String> {
        let t_start = Instant::now();

        self.scsi_midi_send(self.target_id, sysex).await?;
        let t_after_send = t_start.elapsed();

        let mut result = Vec::new();
        let mut empty_polls = 0;
        let mut total_poll_sleep_ms: u64 = 0;
        let mut total_s2p_io_ms: u64 = 0;
        let mut poll_count = 0u32;

        for attempt in 0..30 {
            let t_sleep_start = Instant::now();
            tokio::time::sleep(std::time::Duration::from_millis(100)).await;
            total_poll_sleep_ms += t_sleep_start.elapsed().as_millis() as u64;

            let t_poll_start = Instant::now();
            let pending = self.scsi_midi_poll(self.target_id).await?;
            total_s2p_io_ms += t_poll_start.elapsed().as_millis() as u64;
            poll_count += 1;

            if pending > 0 {
                debug!(
                    attempt = attempt + 1,
                    pending_bytes = pending,
                    "poll: data ready"
                );

                let t_read_start = Instant::now();
                let chunk = self.scsi_midi_read(self.target_id, pending).await?;
                total_s2p_io_ms += t_read_start.elapsed().as_millis() as u64;

                result.extend_from_slice(&chunk);
                empty_polls = 0;
            } else if !result.is_empty() {
                empty_polls += 1;
                if empty_polls >= 2 {
                    break;
                }
            } else {
                debug!(attempt = attempt + 1, "poll: no data yet");
            }
        }

        // Trim to SysEx boundary: scsi_midi_read returns the full SCSI
        // data-in buffer which may include padding beyond the F7 end byte.
        // The parser expects exactly F0...F7 with no trailing garbage.
        if let Some(end) = result.iter().rposition(|&b| b == 0xF7) {
            result.truncate(end + 1);
        }

        let t_total = t_start.elapsed();
        info!(
            total_ms = t_total.as_millis() as u64,
            send_ms = t_after_send.as_millis() as u64,
            poll_sleep_ms = total_poll_sleep_ms,
            s2p_io_ms = total_s2p_io_ms,
            poll_count = poll_count,
            response_bytes = result.len(),
            "send_and_receive complete"
        );

        Ok(result)
    }
}

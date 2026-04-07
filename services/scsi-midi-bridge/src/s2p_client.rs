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
use tracing::{debug, info, warn};

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

    pub fn status(&self) -> bool {
        self.varints.get(&1).copied().unwrap_or(0) != 0
    }
}

// -- Protobuf message builders ------------------------------------------------

// PbOperation enum values
const MIDI_INIT: u64 = 200;
const MIDI_SEND: u64 = 201;
const MIDI_POLL: u64 = 202;
const MIDI_READ: u64 = 203;
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

fn build_midi_request(target_id: u8) -> Vec<u8> {
    let mut buf = Vec::new();
    buf.push(0x08); // field 1, varint
    buf.extend(encode_varint(target_id as u64));
    buf
}

fn build_command(operation: u64, midi_req: &[u8]) -> Vec<u8> {
    let mut cmd = Vec::new();
    // field 1 (operation), varint
    cmd.push(0x08);
    cmd.extend(encode_varint(operation));
    // field 20 (midi_request), length-delimited: tag = (20 << 3) | 2 = 162 → varint 0xa2 0x01
    cmd.push(0xa2);
    cmd.push(0x01);
    cmd.extend(encode_varint(midi_req.len() as u64));
    cmd.extend(midi_req);
    cmd
}

fn build_midi_init(target_id: u8) -> Vec<u8> {
    build_command(MIDI_INIT, &build_midi_request(target_id))
}

fn build_midi_send(target_id: u8, sysex: &[u8]) -> Vec<u8> {
    let mut req = build_midi_request(target_id);
    // field 2 (sysex_data), length-delimited
    req.push(0x12);
    req.extend(encode_varint(sysex.len() as u64));
    req.extend(sysex);
    build_command(MIDI_SEND, &req)
}

fn build_midi_poll(target_id: u8) -> Vec<u8> {
    build_command(MIDI_POLL, &build_midi_request(target_id))
}

fn build_midi_read(target_id: u8, length: u32) -> Vec<u8> {
    let mut req = build_midi_request(target_id);
    // field 3 (read_length), varint
    req.push(0x18);
    req.extend(encode_varint(length as u64));
    build_command(MIDI_READ, &req)
}

// -- SCSI_EXEC message builders -----------------------------------------------

pub struct ScsiExecResult {
    pub status: u8,
    pub sense_data: Vec<u8>,
    pub data_in: Vec<u8>,
    pub bytes_transferred: u32,
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
    target_id: u8,
    initialized: bool,
}

impl S2pClient {
    pub fn new(host: String, port: u16, target_id: u8) -> Self {
        Self {
            host,
            port,
            target_id,
            initialized: false,
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

        debug!(
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

    pub async fn ensure_init(&mut self) -> Result<(), String> {
        if self.initialized {
            debug!("MIDI_INIT: already initialized, skip");
            return Ok(());
        }
        let cmd = build_midi_init(self.target_id);
        let result = self.send_command(MIDI_INIT, &cmd).await?;
        if result.status() {
            self.initialized = true;
            info!("MIDI_INIT: success");
            Ok(())
        } else {
            Err("MIDI_INIT failed".to_string())
        }
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

        Ok(ScsiExecResult {
            status: scsi_resp.varints.get(&1).copied().unwrap_or(0) as u8,
            sense_data: scsi_resp.bytes.get(&2).cloned().unwrap_or_default(),
            data_in: scsi_resp.bytes.get(&3).cloned().unwrap_or_default(),
            bytes_transferred: scsi_resp.varints.get(&4).copied().unwrap_or(0) as u32,
        })
    }

    pub async fn send_sysex(&mut self, sysex: &[u8]) -> Result<(), String> {
        self.ensure_init().await?;
        let cmd = build_midi_send(self.target_id, sysex);
        let result = self.send_command(MIDI_SEND, &cmd).await?;
        if result.status() {
            Ok(())
        } else {
            Err("MIDI_SEND failed".to_string())
        }
    }

    /// Poll for pending response bytes. Returns the byte count.
    pub async fn poll(&self) -> Result<u32, String> {
        let cmd = build_midi_poll(self.target_id);
        let result = self.send_command(MIDI_POLL, &cmd).await?;
        if !result.status() {
            return Err("MIDI_POLL failed".to_string());
        }
        // midi_response is field 101 in PbResult
        let midi_resp = match result.bytes.get(&101) {
            Some(data) => Fields::parse(data),
            None => return Ok(0),
        };
        // pending_bytes is field 2 in PbMidiResponse
        Ok(midi_resp.varints.get(&2).copied().unwrap_or(0) as u32)
    }

    /// Read pending SysEx data.
    pub async fn read(&self, length: u32) -> Result<Vec<u8>, String> {
        let cmd = build_midi_read(self.target_id, length);
        let result = self.send_command(MIDI_READ, &cmd).await?;
        if !result.status() {
            return Err("MIDI_READ failed".to_string());
        }
        let midi_resp = match result.bytes.get(&101) {
            Some(data) => Fields::parse(data),
            None => return Ok(Vec::new()),
        };
        // data is field 1 in PbMidiResponse
        Ok(midi_resp.bytes.get(&1).cloned().unwrap_or_default())
    }

    /// Send SysEx, then poll+read ALL available response data. The S3000XL
    /// may send multiple SysEx messages (e.g., WAIT + Dump Header for SDS)
    /// or split large messages across poll cycles (e.g., 392-byte program
    /// header as 240 + 152 bytes). Read until no more data is pending.
    pub async fn send_and_receive(&mut self, sysex: &[u8]) -> Result<Vec<u8>, String> {
        let t_start = Instant::now();

        self.send_sysex(sysex).await?;
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
            let pending = self.poll().await?;
            total_s2p_io_ms += t_poll_start.elapsed().as_millis() as u64;
            poll_count += 1;

            if pending > 0 {
                debug!(
                    attempt = attempt + 1,
                    pending_bytes = pending,
                    "poll: data ready"
                );

                let t_read_start = Instant::now();
                let chunk = self.read(pending).await?;
                total_s2p_io_ms += t_read_start.elapsed().as_millis() as u64;

                result.extend_from_slice(&chunk);
                empty_polls = 0;
                // Keep reading — more data may follow in the next poll cycle
            } else if !result.is_empty() {
                // Had data but nothing pending now. Wait one more cycle in case
                // the device is still preparing the next chunk (e.g., WAIT → ACK).
                empty_polls += 1;
                if empty_polls >= 2 {
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
                    return Ok(result);
                }
            } else {
                debug!(attempt = attempt + 1, "poll: no data yet");
            }
        }

        let t_total = t_start.elapsed();
        warn!(
            total_ms = t_total.as_millis() as u64,
            poll_count = poll_count,
            response_bytes = result.len(),
            "send_and_receive: max attempts reached"
        );

        Ok(result)
    }
}

// -- MIDI streaming client (port 6870) ----------------------------------------

// Message types for the streaming protocol
const MSG_INIT: u8 = 0x01;
const MSG_SEND: u8 = 0x02;
const MSG_DATA: u8 = 0x03;
const MSG_ERROR: u8 = 0x04;

async fn write_frame(stream: &mut TcpStream, msg_type: u8, payload: &[u8]) -> Result<(), String> {
    let len = (1 + payload.len()) as u32;
    stream.write_all(&len.to_le_bytes()).await.map_err(|e| format!("write len: {e}"))?;
    stream.write_all(&[msg_type]).await.map_err(|e| format!("write type: {e}"))?;
    stream.write_all(payload).await.map_err(|e| format!("write payload: {e}"))?;
    Ok(())
}

async fn read_frame(stream: &mut TcpStream) -> Result<(u8, Vec<u8>), String> {
    let mut len_buf = [0u8; 4];
    stream.read_exact(&mut len_buf).await.map_err(|e| format!("read len: {e}"))?;
    let msg_len = u32::from_le_bytes(len_buf) as usize;
    if msg_len == 0 {
        return Err("read frame: zero-length message".to_string());
    }
    let mut type_buf = [0u8; 1];
    stream.read_exact(&mut type_buf).await.map_err(|e| format!("read type: {e}"))?;
    let payload_len = msg_len - 1;
    let mut payload = vec![0u8; payload_len];
    if payload_len > 0 {
        stream.read_exact(&mut payload).await.map_err(|e| format!("read payload: {e}"))?;
    }
    Ok((type_buf[0], payload))
}

pub struct MidiStreamClient {
    host: String,
    port: u16,
    target_id: u8,
    stream: Option<TcpStream>,
}

impl MidiStreamClient {
    pub fn new(host: String, port: u16, target_id: u8) -> Self {
        Self {
            host,
            port,
            target_id,
            stream: None,
        }
    }

    /// Connect to the streaming server and perform the init handshake.
    async fn connect(&mut self) -> Result<(), String> {
        let addr = format!("{}:{}", self.host, self.port);
        info!(addr = %addr, "midi stream: connecting");

        let t0 = Instant::now();
        let tcp = TcpStream::connect(&addr)
            .await
            .map_err(|e| format!("midi stream connect: {e}"))?;
        tcp.set_nodelay(true)
            .map_err(|e| format!("set TCP_NODELAY: {e}"))?;
        let t_connect = t0.elapsed();

        self.stream = Some(tcp);

        // Send MSG_INIT with target_id
        let stream = self.stream.as_mut().unwrap();
        write_frame(stream, MSG_INIT, &[self.target_id]).await?;

        // Read init response
        let (msg_type, payload) = read_frame(stream).await?;
        let t_init = t0.elapsed();

        match msg_type {
            MSG_INIT if !payload.is_empty() && payload[0] == 1 => {
                info!(
                    connect_ms = t_connect.as_millis() as u64,
                    init_ms = t_init.as_millis() as u64,
                    "midi stream: connected and initialized"
                );
                Ok(())
            }
            MSG_ERROR => {
                let err_msg = String::from_utf8_lossy(&payload).to_string();
                self.stream = None;
                Err(format!("midi stream init error: {err_msg}"))
            }
            _ => {
                self.stream = None;
                Err(format!(
                    "midi stream init: unexpected response type={msg_type} payload_len={}",
                    payload.len()
                ))
            }
        }
    }

    /// Ensure we have an active connection, reconnecting if needed.
    async fn ensure_connected(&mut self) -> Result<(), String> {
        if self.stream.is_some() {
            return Ok(());
        }
        self.connect().await
    }

    /// Send SysEx and read the response via the streaming protocol.
    pub async fn send_and_receive(&mut self, sysex: &[u8]) -> Result<Vec<u8>, String> {
        let t_start = Instant::now();

        self.ensure_connected().await?;
        let t_connected = t_start.elapsed();

        // Perform I/O on the stream, capturing the result to handle errors after
        // releasing the borrow so we can clear self.stream on failure.
        let io_result = Self::do_send_receive(
            self.stream.as_mut().unwrap(),
            sysex,
            t_start,
            t_connected,
        )
        .await;

        match io_result {
            Ok(payload) => Ok(payload),
            Err((clear_conn, msg)) => {
                if clear_conn {
                    self.stream = None;
                }
                Err(msg)
            }
        }
    }

    /// Inner I/O helper that borrows only the TcpStream. Returns Err((should_clear, message)).
    async fn do_send_receive(
        stream: &mut TcpStream,
        sysex: &[u8],
        t_start: Instant,
        t_connected: std::time::Duration,
    ) -> Result<Vec<u8>, (bool, String)> {
        // Send MSG_SEND with sysex payload
        write_frame(stream, MSG_SEND, sysex)
            .await
            .map_err(|e| (true, format!("midi stream send: {e}")))?;
        let t_sent = t_start.elapsed();

        debug!(
            sysex_bytes = sysex.len(),
            connect_ms = t_connected.as_millis() as u64,
            send_ms = (t_sent - t_connected).as_millis() as u64,
            "midi stream: sent MSG_SEND"
        );

        // Read response frame with timeout — SDS or slow device responses
        // may take several seconds. Don't clear connection on timeout.
        let read_result = tokio::time::timeout(
            std::time::Duration::from_secs(10),
            read_frame(stream),
        ).await;

        let (msg_type, payload) = match read_result {
            Ok(Ok(frame)) => frame,
            Ok(Err(e)) => return Err((true, format!("midi stream recv: {e}"))),
            Err(_) => return Err((false, "midi stream recv: timeout (10s)".to_string())),
        };
        let t_total = t_start.elapsed();

        match msg_type {
            MSG_DATA => {
                info!(
                    total_ms = t_total.as_millis() as u64,
                    connect_ms = t_connected.as_millis() as u64,
                    send_ms = (t_sent - t_connected).as_millis() as u64,
                    recv_ms = (t_total - t_sent).as_millis() as u64,
                    response_bytes = payload.len(),
                    "midi stream: send_and_receive complete"
                );
                Ok(payload)
            }
            MSG_ERROR => {
                let err_msg = String::from_utf8_lossy(&payload).to_string();
                warn!(
                    total_ms = t_total.as_millis() as u64,
                    error = %err_msg,
                    "midi stream: server error"
                );
                // Don't tear down the connection on application-level errors
                Err((false, format!("midi stream error: {err_msg}")))
            }
            _ => {
                warn!(
                    msg_type = msg_type,
                    payload_len = payload.len(),
                    "midi stream: unexpected message type (keeping connection)"
                );
                // Don't tear down on unexpected types — may be a protocol
                // mismatch but the TCP connection is likely still usable
                Err((false, format!(
                    "midi stream: unexpected message type={msg_type} payload_len={}",
                    payload.len()
                )))
            }
        }
    }

    /// Check if the streaming server is reachable by attempting a TCP connection.
    pub async fn is_reachable(&self) -> bool {
        let addr = format!("{}:{}", self.host, self.port);
        TcpStream::connect(&addr).await.is_ok()
    }
}

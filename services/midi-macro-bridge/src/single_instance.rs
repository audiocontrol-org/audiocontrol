//! Single-instance enforcement via lockfile + Unix socket IPC.
//!
//! At process start: try to flock(LOCK_EX|LOCK_NB) the instance.lock file.
//! - Success → we are the primary; spawn a Unix-socket listener that emits
//!   "show" requests to a callback when a secondary tries to launch.
//! - Failure → there's already a primary; connect to the socket, send a
//!   one-byte "show" command, exit 0.
//!
//! macOS-only for now (the rest of the GUI stack is too).

use std::fs::{File, OpenOptions};
use std::io::{Read, Write};
use std::os::fd::AsRawFd;
use std::os::unix::net::{UnixListener, UnixStream};
use std::sync::Arc;
use std::thread;

use crate::paths;

/// Holds the lock for the lifetime of the value. Drop to release.
pub struct InstanceLock {
    _file: File,
}

pub enum AcquireOutcome {
    Primary(InstanceLock, UnixListener),
    Secondary, // we already messaged the primary; caller exits 0
}

pub fn acquire() -> anyhow::Result<AcquireOutcome> {
    let state_dir = paths::resolve_state_dir(dirs::data_dir)
        .ok_or_else(|| anyhow::anyhow!("no data dir available; cannot acquire instance lock"))?;
    std::fs::create_dir_all(&state_dir)?;

    let lock_path = state_dir.join("instance.lock");
    let sock_path = state_dir.join("instance.sock");

    let lock_file = OpenOptions::new()
        .create(true)
        .write(true)
        .open(&lock_path)?;

    // flock LOCK_EX | LOCK_NB
    let fd = lock_file.as_raw_fd();
    let r = unsafe { libc::flock(fd, libc::LOCK_EX | libc::LOCK_NB) };
    if r != 0 {
        // Couldn't lock → secondary. Send "show" to primary.
        let mut stream = UnixStream::connect(&sock_path)?;
        stream.write_all(b"show\n")?;
        return Ok(AcquireOutcome::Secondary);
    }

    // We're primary. Replace any stale socket; create a new listener.
    let _ = std::fs::remove_file(&sock_path);
    let listener = UnixListener::bind(&sock_path)?;

    Ok(AcquireOutcome::Primary(
        InstanceLock { _file: lock_file },
        listener,
    ))
}

/// Spawn a thread that accepts incoming connections and invokes `on_show`
/// for each "show" message received.
pub fn spawn_listener_thread(listener: UnixListener, on_show: Arc<dyn Fn() + Send + Sync>) {
    thread::Builder::new()
        .name("instance-listener".into())
        .spawn(move || {
            for stream in listener.incoming() {
                let Ok(mut s) = stream else { continue };
                let mut buf = [0u8; 16];
                let _ = s.read(&mut buf);
                if buf.starts_with(b"show") {
                    on_show();
                }
            }
        })
        .expect("instance-listener thread spawn");
}

# SCSI MIDI Bridge

HTTP bridge between audiocontrol and SCSI-equipped samplers via SCSI2Pi on a Raspberry Pi.

## Build

```bash
cargo build --release
```

Cross-compile for Pi (ARM):
```bash
cross build --release --target aarch64-unknown-linux-gnu
```

## Deploy

```bash
scp target/release/scsi-midi-bridge s3k:/usr/local/bin/
scp s2p-bridge.service s3k:/etc/systemd/system/
ssh s3k "sudo systemctl daemon-reload && sudo systemctl enable --now s2p-bridge"
```

## Test

```bash
curl http://s3k:7033/health
curl http://s3k:7033/status
curl http://s3k:7033/scsi/scan
```

## API

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | /health | Health check | Implemented |
| GET | /status | Bridge + SCSI status | Implemented |
| GET | /scsi/scan | Enumerate SCSI devices | Implemented |
| POST | /sds/send | Send SysEx over SCSI | Phase 4 |
| WS | /sds/stream | Bidirectional SysEx stream | Phase 5 |

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `S2PEXEC_PATH` | `/opt/scsi2pi/bin/s2pexec` | Path to s2pexec binary |

CLI: `--port <PORT>` (default: 7033)

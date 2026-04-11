use clap::Parser;

pub const DEFAULT_PORT: u16 = 7033;
const DEFAULT_S2P_HOST: &str = "localhost";
const DEFAULT_S2P_PORT: u16 = 6868;
const DEFAULT_SCSI_TARGET_ID: u8 = 6;

#[derive(Parser, Clone)]
#[command(name = "scsi-midi-bridge", version, about = "SCSI MIDI Bridge Daemon")]
pub struct Config {
    /// Bridge HTTP listen port
    #[arg(long, default_value_t = DEFAULT_PORT)]
    pub port: u16,

    /// s2p protobuf API host
    #[arg(long, default_value = DEFAULT_S2P_HOST)]
    pub s2p_host: String,

    /// s2p protobuf API port
    #[arg(long, default_value_t = DEFAULT_S2P_PORT)]
    pub s2p_port: u16,

    /// SCSI target ID of the sampler
    #[arg(long, default_value_t = DEFAULT_SCSI_TARGET_ID)]
    pub target_id: u8,
}

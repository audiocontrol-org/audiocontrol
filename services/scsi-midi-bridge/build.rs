use std::process::Command;
use std::time::SystemTime;

fn main() {
    // Emit a build timestamp so every build gets a unique identifier.
    // Format: Unix epoch seconds. Always changes, even for identical source.
    let ts = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    println!("cargo::rustc-env=BUILD_TIMESTAMP={ts}");

    // Git hash: prefer BUILD_GIT_HASH env var (set by Makefile for Docker builds),
    // fall back to running git directly (local builds)
    let git_hash = std::env::var("BUILD_GIT_HASH")
        .ok()
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| {
            Command::new("git")
                .args(["rev-parse", "--short", "HEAD"])
                .output()
                .ok()
                .and_then(|o| String::from_utf8(o.stdout).ok())
                .unwrap_or_default()
                .trim()
                .to_string()
        });
    println!("cargo::rustc-env=BUILD_GIT_HASH={git_hash}");

    // Force rebuild every time (build ID must be unique per build)
    println!("cargo::rerun-if-changed=build.rs");
    println!("cargo::rerun-if-env-changed=FORCE_REBUILD");
}

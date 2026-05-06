//! Resolves config and state paths for the bridge.
//!
//! Resolution order for config:
//!   1. Explicit path argument (e.g., from --config CLI flag)
//!   2. `MIDI_MACRO_BRIDGE_CONFIG` environment variable
//!   3. OS-conventional default under `audiocontrol/midi-macro-bridge/`
//!   4. cwd-relative `config.toml` (legacy / dev fallback)
//!
//! State directory uses the same `audiocontrol/midi-macro-bridge/` namespace
//! under `dirs::data_dir()` (Linux: `~/.local/share`, macOS: Application Support).

use std::path::PathBuf;

const APP_NAMESPACE: &str = "audiocontrol";
const APP_NAME: &str = "midi-macro-bridge";
const CONFIG_FILENAME: &str = "config.toml";
const ENV_VAR: &str = "MIDI_MACRO_BRIDGE_CONFIG";

/// Resolve the config file path. The first resolution that yields an existing
/// path wins. If none of flag / env / OS-default / cwd files exist, returns the
/// OS-default path so the caller can produce a consistent "no config found"
/// error message that points the user at the canonical location.
pub fn resolve_config_path(
    flag: Option<&str>,
    env_lookup: impl Fn(&str) -> Option<String>,
    config_dir_lookup: impl Fn() -> Option<PathBuf>,
    cwd_lookup: impl Fn() -> Option<PathBuf>,
    exists: impl Fn(&std::path::Path) -> bool,
) -> PathBuf {
    if let Some(p) = flag {
        return PathBuf::from(p);
    }
    if let Some(p) = env_lookup(ENV_VAR) {
        return PathBuf::from(p);
    }
    if let Some(config_dir) = config_dir_lookup() {
        let default = config_dir
            .join(APP_NAMESPACE)
            .join(APP_NAME)
            .join(CONFIG_FILENAME);
        if exists(&default) {
            return default;
        }
        if let Some(cwd) = cwd_lookup() {
            let cwd_path = cwd.join(CONFIG_FILENAME);
            if exists(&cwd_path) {
                return cwd_path;
            }
        }
        return default;
    }
    cwd_lookup()
        .map(|c| c.join(CONFIG_FILENAME))
        .unwrap_or_else(|| PathBuf::from(CONFIG_FILENAME))
}

/// Resolve the state directory (where url.txt and similar runtime files
/// are written). Returns `None` only when the OS provides no data directory
/// (rare, typically a container/CI environment). Caller is responsible for
/// creating the directory if needed.
pub fn resolve_state_dir(data_lookup: impl Fn() -> Option<PathBuf>) -> Option<PathBuf> {
    data_lookup().map(|d| d.join(APP_NAMESPACE).join(APP_NAME))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    fn config_dir() -> Option<PathBuf> {
        Some(PathBuf::from("/home/test/.config"))
    }
    fn cwd() -> Option<PathBuf> {
        Some(PathBuf::from("/work"))
    }
    fn no_files(_p: &Path) -> bool {
        false
    }
    fn all_files(_p: &Path) -> bool {
        true
    }

    #[test]
    fn flag_wins_over_everything() {
        let p = resolve_config_path(
            Some("/explicit/path/config.toml"),
            |_| Some("/env/path".into()),
            config_dir,
            cwd,
            all_files,
        );
        assert_eq!(p, PathBuf::from("/explicit/path/config.toml"));
    }

    #[test]
    fn env_wins_over_defaults() {
        let p = resolve_config_path(
            None,
            |k| {
                if k == ENV_VAR {
                    Some("/env/path/config.toml".into())
                } else {
                    None
                }
            },
            config_dir,
            cwd,
            all_files,
        );
        assert_eq!(p, PathBuf::from("/env/path/config.toml"));
    }

    #[test]
    fn os_default_when_it_exists() {
        let p = resolve_config_path(None, |_| None, config_dir, cwd, |path| {
            path == Path::new("/home/test/.config/audiocontrol/midi-macro-bridge/config.toml")
        });
        assert_eq!(
            p,
            PathBuf::from("/home/test/.config/audiocontrol/midi-macro-bridge/config.toml")
        );
    }

    #[test]
    fn cwd_fallback_when_os_default_missing() {
        let p = resolve_config_path(None, |_| None, config_dir, cwd, |path| {
            path == Path::new("/work/config.toml")
        });
        assert_eq!(p, PathBuf::from("/work/config.toml"));
    }

    #[test]
    fn returns_os_default_when_nothing_exists() {
        let p = resolve_config_path(None, |_| None, config_dir, cwd, no_files);
        assert_eq!(
            p,
            PathBuf::from("/home/test/.config/audiocontrol/midi-macro-bridge/config.toml")
        );
    }

    #[test]
    fn state_dir_is_namespaced() {
        let p = resolve_state_dir(|| Some(PathBuf::from("/home/test/.local/share")));
        assert_eq!(
            p,
            Some(PathBuf::from("/home/test/.local/share/audiocontrol/midi-macro-bridge"))
        );
    }

    #[test]
    fn state_dir_returns_none_when_data_dir_missing() {
        let p = resolve_state_dir(|| None);
        assert_eq!(p, None);
    }

    #[test]
    fn falls_back_to_cwd_when_no_config_dir() {
        let p = resolve_config_path(None, |_| None, || None, cwd, no_files);
        assert_eq!(p, PathBuf::from("/work/config.toml"));
    }

    #[test]
    fn falls_back_to_bare_filename_when_no_config_dir_and_no_cwd() {
        let p = resolve_config_path(None, |_| None, || None, || None, no_files);
        assert_eq!(p, PathBuf::from("config.toml"));
    }

    #[test]
    fn flag_bypasses_existence_check() {
        let p = resolve_config_path(
            Some("/nonexistent/config.toml"),
            |_| None,
            config_dir,
            cwd,
            no_files,
        );
        assert_eq!(p, PathBuf::from("/nonexistent/config.toml"));
    }

    #[test]
    fn env_bypasses_existence_check() {
        let p = resolve_config_path(
            None,
            |k| {
                if k == ENV_VAR {
                    Some("/nonexistent/env-config.toml".into())
                } else {
                    None
                }
            },
            config_dir,
            cwd,
            no_files,
        );
        assert_eq!(p, PathBuf::from("/nonexistent/env-config.toml"));
    }
}

//! Hidden creator mode.
//!
//! Admin mode is enabled only when a local secret exists on this machine:
//!   ~/PRIVATE_KEYGEN_DO_NOT_SHARE/private_key[.txt]
//!   ~/admin.secret
//!   <app-data>/admin.secret
//!
//! `admin.secret` may contain the 128-hex Ed25519 secret key, a path to the
//! key file, or JSON with `privateKey` / `private_key`.

use crate::keygen::SecretKey;
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdminStatus {
    pub enabled: bool,
    pub private_key_path: Option<String>,
    pub public_key: Option<String>,
    pub source: Option<String>,
}

impl AdminStatus {
    fn disabled() -> Self {
        Self {
            enabled: false,
            private_key_path: None,
            public_key: None,
            source: None,
        }
    }
}

pub fn status(app_data_dir: Option<PathBuf>) -> AdminStatus {
    match find_private_key(app_data_dir) {
        Some(found) => match parse_secret_key(&found.bytes) {
            Some(signing_key) => AdminStatus {
                enabled: true,
                private_key_path: Some(found.path.display().to_string()),
                public_key: Some(signing_key.public_hex()),
                source: Some(found.source),
            },
            None => AdminStatus::disabled(),
        },
        None => AdminStatus::disabled(),
    }
}

pub fn load_signing_key(app_data_dir: Option<PathBuf>) -> Result<SecretKey, String> {
    let found = find_private_key(app_data_dir)
        .ok_or_else(|| "Admin key not found on this machine.".to_string())?;
    parse_secret_key(&found.bytes)
        .ok_or_else(|| "Admin key file is not a valid Ed25519 secret key.".to_string())
}

struct FoundKey {
    path: PathBuf,
    bytes: Vec<u8>,
    source: String,
}

fn find_private_key(app_data_dir: Option<PathBuf>) -> Option<FoundKey> {
    let mut candidates: Vec<(PathBuf, &str)> = Vec::new();

    if let Some(dir) = app_data_dir {
        candidates.push((dir.join("admin.secret"), "app-data"));
    }

    if let Some(home) = dirs::home_dir() {
        candidates.push((home.join("admin.secret"), "home"));
        candidates.push((
            home.join("PRIVATE_KEYGEN_DO_NOT_SHARE").join("private_key"),
            "keygen-folder",
        ));
        candidates.push((
            home.join("PRIVATE_KEYGEN_DO_NOT_SHARE").join("private_key.txt"),
            "keygen-folder",
        ));
        candidates.push((home.join("admin.secret.json"), "home"));
    }

    if let Ok(cwd) = std::env::current_dir() {
        candidates.push((
            cwd.join("PRIVATE_KEYGEN_DO_NOT_SHARE").join("private_key.txt"),
            "project",
        ));
        candidates.push((
            cwd.join("PRIVATE_KEYGEN_DO_NOT_SHARE").join("private_key"),
            "project",
        ));
    }

    for (path, source) in candidates {
        if !path.is_file() {
            continue;
        }

        let Ok(text) = fs::read_to_string(&path) else {
            continue;
        };
        let trimmed = text.trim();

        if trimmed.is_empty() {
            continue;
        }

        // A bare path inside admin.secret points at the real key file.
        if !trimmed.starts_with('{') && !is_hex_secret(trimmed) {
            let referenced = PathBuf::from(trimmed);
            let candidate = if referenced.is_absolute() {
                referenced
            } else {
                path.parent().unwrap_or(Path::new(".")).join(referenced)
            };

            if candidate.is_file() {
                if let Ok(bytes) = fs::read(&candidate) {
                    if parse_secret_key(&bytes).is_some() {
                        return Some(FoundKey {
                            path: candidate,
                            bytes,
                            source: source.to_string(),
                        });
                    }
                }
            }

            continue;
        }

        let bytes = text.into_bytes();
        if parse_secret_key(&bytes).is_some() {
            return Some(FoundKey {
                path,
                bytes,
                source: source.to_string(),
            });
        }
    }

    None
}

fn is_hex_secret(value: &str) -> bool {
    let count = value.chars().filter(|c| c.is_ascii_hexdigit()).count();
    count == 64 || count == 128
}

fn parse_secret_key(bytes: &[u8]) -> Option<SecretKey> {
    let text = String::from_utf8_lossy(bytes);

    let from_json = serde_json::from_str::<serde_json::Value>(text.trim()).ok().and_then(|value| {
        ["privateKey", "private_key", "key", "secret"]
            .iter()
            .find_map(|field| value.get(*field).and_then(|v| v.as_str()).map(str::to_string))
    });

    let raw = from_json.unwrap_or_else(|| text.to_string());
    let normalised = crate::hwid::normalise_machine_id(&raw);
    let decoded = hex::decode(normalised).ok()?;

    SecretKey::from_bytes(&decoded).ok()
}

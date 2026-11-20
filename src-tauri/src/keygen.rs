//! Licence key issuing — byte-for-byte compatible with AetherVocal Strip.
//!
//! The plugin signs with Monocypher's EdDSA construction, which is Ed25519
//! with BLAKE2b instead of SHA-512. We vendor Monocypher so keys are
//! bit-identical to the private `aether-keygen` utility.
//!
//! Signed message: "<PRODUCT_TAG>|v1|<32 uppercase hex>"
//! Payload:        [1u8] ++ 64-byte signature
//! Key:            "AETHER-" + BASE32(payload) grouped in fours

use serde::{Deserialize, Serialize};
use std::os::raw::{c_int, c_uchar};

pub const PROTOCOL_VERSION: &str = "v1";
pub const KEY_VERSION: u8 = 1;
pub const DEFAULT_PRODUCT_TAG: &str = "AETHER-VOCAL-STRIP";

const ALPHABET: &[u8; 32] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

extern "C" {
    fn crypto_eddsa_key_pair(
        secret_key: *mut c_uchar,
        public_key: *mut c_uchar,
        seed: *mut c_uchar,
    );
    fn crypto_eddsa_sign(
        signature: *mut c_uchar,
        secret_key: *const c_uchar,
        message: *const c_uchar,
        message_size: usize,
    );
    fn crypto_eddsa_check(
        signature: *const c_uchar,
        public_key: *const c_uchar,
        message: *const c_uchar,
        message_size: usize,
    ) -> c_int;
}

#[derive(Clone)]
pub struct SecretKey {
    bytes: [u8; 64],
}

impl SecretKey {
    /// Accepts either the plugin's 64-byte `seed || public` secret or a bare
    /// 32-byte seed. The public half is always re-derived so a truncated or
    /// mismatched file cannot produce broken keys.
    pub fn from_bytes(input: &[u8]) -> Result<Self, String> {
        let seed: [u8; 32] = match input.len() {
            32 => input.try_into().map_err(|_| "Invalid seed length")?,
            64 => input[..32].try_into().map_err(|_| "Invalid seed length")?,
            _ => return Err("Ed25519 secret key must be 32 or 64 bytes.".into()),
        };

        let mut secret = [0u8; 64];
        let mut public = [0u8; 32];
        let mut mutable_seed = seed;

        unsafe {
            crypto_eddsa_key_pair(secret.as_mut_ptr(), public.as_mut_ptr(), mutable_seed.as_mut_ptr());
        }

        Ok(Self { bytes: secret })
    }

    pub fn public_key(&self) -> [u8; 32] {
        let mut public = [0u8; 32];
        public.copy_from_slice(&self.bytes[32..]);
        public
    }

    pub fn public_hex(&self) -> String {
        hex::encode(self.public_key())
    }

    pub fn sign(&self, message: &[u8]) -> [u8; 64] {
        let mut signature = [0u8; 64];
        unsafe {
            crypto_eddsa_sign(
                signature.as_mut_ptr(),
                self.bytes.as_ptr(),
                message.as_ptr(),
                message.len(),
            );
        }
        signature
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IssuedLicense {
    pub key: String,
    pub machine_id: String,
    pub product_tag: String,
    pub issued_at: String,
    pub public_key: String,
}

pub fn signed_message(product_tag: &str, machine_id: &str) -> String {
    format!("{product_tag}|{PROTOCOL_VERSION}|{machine_id}")
}

pub fn issue(
    signing_key: &SecretKey,
    machine_id: &str,
    product_tag: &str,
) -> Result<IssuedLicense, String> {
    let canonical = crate::hwid::normalise_machine_id(machine_id);
    if canonical.len() != 32 {
        return Err("Machine ID must contain exactly 32 hex characters.".into());
    }

    let tag = sanitise_tag(product_tag);
    let message = signed_message(&tag, &canonical);
    let signature = signing_key.sign(message.as_bytes());

    Ok(IssuedLicense {
        key: encode_key(&signature),
        machine_id: canonical,
        product_tag: tag,
        issued_at: chrono::Utc::now().to_rfc3339(),
        public_key: signing_key.public_hex(),
    })
}

pub fn verify(key: &str, machine_id: &str, product_tag: &str, public_key_hex: &str) -> bool {
    let canonical = crate::hwid::normalise_machine_id(machine_id);
    let cleaned: String = key
        .chars()
        .filter(|c| !matches!(c, ' ' | '\t' | '\r' | '\n' | '-'))
        .collect::<String>()
        .to_uppercase();

    let Some(rest) = cleaned.strip_prefix("AETHER") else {
        return false;
    };

    let Some(payload) = base32_decode(rest) else {
        return false;
    };

    if payload.len() != 65 || payload[0] != KEY_VERSION {
        return false;
    }

    let Ok(public_bytes) = hex::decode(public_key_hex) else {
        return false;
    };
    let Ok(public_key): Result<[u8; 32], _> = public_bytes.try_into() else {
        return false;
    };

    let message = signed_message(&sanitise_tag(product_tag), &canonical);

    unsafe {
        crypto_eddsa_check(
            payload[1..].as_ptr(),
            public_key.as_ptr(),
            message.as_ptr(),
            message.len(),
        ) == 0
    }
}

pub fn encode_key(signature: &[u8; 64]) -> String {
    let mut payload = Vec::with_capacity(65);
    payload.push(KEY_VERSION);
    payload.extend_from_slice(signature);
    format_key(&payload)
}

pub fn format_key(payload: &[u8]) -> String {
    let encoded = base32_encode(payload);
    let mut key = String::from("AETHER");

    for chunk in encoded.as_bytes().chunks(4) {
        key.push('-');
        key.push_str(std::str::from_utf8(chunk).unwrap_or_default());
    }

    key
}

pub fn base32_encode(data: &[u8]) -> String {
    let mut out = String::with_capacity((data.len() * 8 + 4) / 5);
    let mut buffer: u32 = 0;
    let mut bits: i32 = 0;

    for byte in data {
        buffer = (buffer << 8) | *byte as u32;
        bits += 8;

        while bits >= 5 {
            bits -= 5;
            out.push(ALPHABET[((buffer >> bits) & 31) as usize] as char);
        }
    }

    if bits > 0 {
        out.push(ALPHABET[((buffer << (5 - bits)) & 31) as usize] as char);
    }

    out
}

pub fn base32_decode(text: &str) -> Option<Vec<u8>> {
    let mut buffer: u32 = 0;
    let mut bits: i32 = 0;
    let mut out = Vec::new();

    for c in text.chars() {
        let value = match c {
            'A'..='Z' => (c as u8 - b'A') as u32,
            'a'..='z' => (c as u8 - b'a') as u32,
            '2'..='7' => 26 + (c as u8 - b'2') as u32,
            _ => return None,
        };

        buffer = (buffer << 5) | value;
        bits += 5;

        if bits >= 8 {
            bits -= 8;
            out.push(((buffer >> bits) & 0xFF) as u8);
        }
    }

    Some(out)
}

pub fn sanitise_tag(value: &str) -> String {
    let cleaned: String = value
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'))
        .collect::<String>()
        .to_uppercase();

    if cleaned.is_empty() {
        DEFAULT_PRODUCT_TAG.to_string()
    } else {
        cleaned
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn base32_roundtrip_matches_plugin_rules() {
        let data: Vec<u8> = (0..65).map(|i| (i * 37) as u8).collect();
        let encoded = base32_encode(&data);
        assert_eq!(encoded.len(), 104);
        assert_eq!(base32_decode(&encoded).unwrap(), data);
    }

    #[test]
    fn key_shape_matches_aether_vocal_strip() {
        let secret = SecretKey::from_bytes(&[7u8; 32]).unwrap();
        let issued = issue(
            &secret,
            "4F2A91BC77D03E158AC60B4419EE5D73",
            DEFAULT_PRODUCT_TAG,
        )
        .unwrap();

        assert!(issued.key.starts_with("AETHER-"));
        // 65 bytes -> 104 base32 chars -> 26 groups of four.
        assert_eq!(issued.key.matches('-').count(), 26);
        assert!(verify(
            &issued.key,
            "4F2A-91BC-77D0-3E15-8AC6-0B44-19EE-5D73",
            DEFAULT_PRODUCT_TAG,
            &issued.public_key
        ));
        assert!(!verify(
            &issued.key,
            "00000000000000000000000000000000",
            DEFAULT_PRODUCT_TAG,
            &issued.public_key
        ));
    }
}

//! Exact HWID implementation used by AetherVocal Strip.
//!
//! The material is built the same way as `Source/Licensing/MachineID.cpp`:
//!   mac:     uuid=<gethostuuid>|mac=<en0 MAC>|device=<IOPlatformUUID>
//!   windows: guid=<MachineGuid>|volume=<C: serial>|name=<COMPUTERNAME>|device=<SMBIOS hash>
//! then SHA-256("AetherVocalStrip.HWID.v1|" + components) and the first
//! 16 bytes are rendered as 32 uppercase hex characters.

use serde::Serialize;
use sha2::{Digest, Sha256};

const SALT: &str = "AetherVocalStrip.HWID.v1";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MachineInfo {
    /// 32 uppercase hex characters, no separators.
    pub canonical: String,
    /// AAAA-BBBB-CCCC-DDDD-EEEE-FFFF-0000-1111
    pub formatted: String,
    pub os: String,
    pub platform_label: String,
}

pub fn machine_info() -> MachineInfo {
    let canonical = compute_canonical();
    MachineInfo {
        formatted: format_machine_id(&canonical),
        canonical,
        os: std::env::consts::OS.to_string(),
        platform_label: if cfg!(target_os = "macos") {
            "macOS".to_string()
        } else if cfg!(target_os = "windows") {
            "Windows".to_string()
        } else {
            std::env::consts::OS.to_string()
        },
    }
}

pub fn format_machine_id(canonical: &str) -> String {
    let mut out = String::with_capacity(canonical.len() + canonical.len() / 4);
    for (i, c) in canonical.chars().enumerate() {
        if i > 0 && i % 4 == 0 {
            out.push('-');
        }
        out.push(c);
    }
    out
}

/// Removes every non-hex character and uppercases the rest.
pub fn normalise_machine_id(raw: &str) -> String {
    raw.chars()
        .filter(|c| c.is_ascii_hexdigit())
        .map(|c| c.to_ascii_uppercase())
        .collect()
}

fn compute_canonical() -> String {
    let mut components: Vec<String> = Vec::new();

    #[cfg(target_os = "macos")]
    {
        if let Some(uuid) = mac::host_uuid() {
            components.push(format!("uuid={uuid}"));
        }
        if let Some(mac) = mac::primary_mac_address() {
            components.push(format!("mac={mac}"));
        }
        if let Some(device) = mac::platform_uuid() {
            components.push(format!("device={device}"));
        }
    }

    #[cfg(target_os = "windows")]
    {
        if let Some(guid) = windows_impl::machine_guid() {
            components.push(format!("guid={guid}"));
        }
        if let Some(serial) = windows_impl::volume_serial() {
            components.push(format!("volume={serial}"));
        }
        if let Some(name) = windows_impl::computer_name() {
            components.push(format!("name={name}"));
        }
        if let Some(device) = windows_impl::unique_device_id() {
            components.push(format!("device={device}"));
        }
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        if let Some(id) = linux::machine_id() {
            components.push(format!("machine={id}"));
        }
    }

    let mut material = String::from(SALT);
    for component in &components {
        material.push('|');
        material.push_str(component);
    }

    if std::env::var("AETHER_DEBUG_HWID").is_ok() {
        eprintln!("HWID components: {components:?}");
        eprintln!("HWID material: {material}");
    }

    let digest = Sha256::digest(material.as_bytes());
    hex::encode_upper(&digest[..16])
}

#[cfg(target_os = "macos")]
mod mac {
    use std::ffi::{c_char, c_void, CStr};

    extern "C" {
        fn gethostuuid(id: *mut u8, wait: *const libc::timespec) -> libc::c_int;
    }

    /// gethostuuid with the same one-second timeout the plugin uses.
    pub fn host_uuid() -> Option<String> {
        let mut uuid = [0u8; 16];
        let timeout = libc::timespec {
            tv_sec: 1,
            tv_nsec: 0,
        };

        let result = unsafe { gethostuuid(uuid.as_mut_ptr(), &timeout) };
        if result != 0 {
            return None;
        }

        Some(hex::encode_upper(uuid))
    }

    /// en0 MAC (or the first non-zero interface), formatted AA:BB:CC:DD:EE:FF.
    pub fn primary_mac_address() -> Option<String> {
        unsafe {
            let mut addresses: *mut libc::ifaddrs = std::ptr::null_mut();
            if libc::getifaddrs(&mut addresses) != 0 {
                return None;
            }

            let mut fallback: Option<String> = None;
            let mut current = addresses;

            while !current.is_null() {
                let ifa = &*current;
                let addr = ifa.ifa_addr;

                if !addr.is_null() && (*addr).sa_family as i32 == libc::AF_LINK {
                    let link = addr as *const libc::sockaddr_dl;

                    if (*link).sdl_alen >= 6 {
                        let name = if ifa.ifa_name.is_null() {
                            String::new()
                        } else {
                            CStr::from_ptr(ifa.ifa_name).to_string_lossy().into_owned()
                        };

                        let data = (*link).sdl_data.as_ptr() as *const u8;
                        let bytes = data.add((*link).sdl_nlen as usize);

                        let mut formatted = String::new();
                        let mut all_zero = true;

                        for i in 0..(*link).sdl_alen as usize {
                            let byte = *bytes.add(i);
                            if byte != 0 {
                                all_zero = false;
                            }
                            if i > 0 {
                                formatted.push(':');
                            }
                            formatted.push_str(&format!("{byte:02X}"));
                        }

                        if !all_zero {
                            if name == "en0" {
                                fallback = Some(formatted);
                                break;
                            }

                            if fallback.is_none() {
                                fallback = Some(formatted);
                            }
                        }
                    }
                }

                current = ifa.ifa_next;
            }

            libc::freeifaddrs(addresses);
            fallback
        }
    }

    #[link(name = "IOKit", kind = "framework")]
    extern "C" {
        fn IOServiceMatching(name: *const c_char) -> *mut c_void;
        fn IOServiceGetMatchingService(main_port: u32, matching: *mut c_void) -> u32;
        fn IORegistryEntryCreateCFProperty(
            entry: u32,
            key: *mut c_void,
            allocator: *mut c_void,
            options: u32,
        ) -> *mut c_void;
        fn IOObjectRelease(object: u32) -> u32;
    }

    #[link(name = "CoreFoundation", kind = "framework")]
    extern "C" {
        fn CFStringCreateWithCString(
            allocator: *const c_void,
            c_str: *const c_char,
            encoding: u32,
        ) -> *mut c_void;
        fn CFStringGetCString(
            string: *mut c_void,
            buffer: *mut c_char,
            buffer_size: isize,
            encoding: u32,
        ) -> u8;
        fn CFGetTypeID(value: *mut c_void) -> usize;
        fn CFStringGetTypeID() -> usize;
        fn CFRelease(value: *mut c_void);
    }

    const CF_STRING_ENCODING_UTF8: u32 = 0x0800_0100;

    /// Reads IOPlatformUUID through IOKit — exactly the call JUCE makes in
    /// `SystemStats::getUniqueDeviceID()`. No shelling out, so the value is
    /// identical regardless of how the app was launched.
    pub fn platform_uuid() -> Option<String> {
        unsafe {
            let matching = IOServiceMatching(b"IOPlatformExpertDevice\0".as_ptr() as *const c_char);
            if matching.is_null() {
                return None;
            }

            let service = IOServiceGetMatchingService(0, matching);
            if service == 0 {
                return None;
            }

            let key = CFStringCreateWithCString(
                std::ptr::null(),
                b"IOPlatformUUID\0".as_ptr() as *const c_char,
                CF_STRING_ENCODING_UTF8,
            );

            if key.is_null() {
                IOObjectRelease(service);
                return None;
            }

            let value = IORegistryEntryCreateCFProperty(service, key, std::ptr::null_mut(), 0);
            CFRelease(key);
            IOObjectRelease(service);

            if value.is_null() {
                return None;
            }

            if CFGetTypeID(value) != CFStringGetTypeID() {
                CFRelease(value);
                return None;
            }

            let mut buffer = [0i8; 256];
            let ok = CFStringGetCString(
                value,
                buffer.as_mut_ptr(),
                buffer.len() as isize,
                CF_STRING_ENCODING_UTF8,
            );
            CFRelease(value);

            if ok == 0 {
                return None;
            }

            let text = CStr::from_ptr(buffer.as_ptr()).to_string_lossy().into_owned();
            let cleaned: String = text.chars().filter(|c| *c != '-').collect();

            if cleaned.is_empty() {
                None
            } else {
                Some(cleaned)
            }
        }
    }

}

#[cfg(target_os = "windows")]
mod windows_impl {
    use super::*;
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStrExt;

    #[link(name = "kernel32")]
    extern "system" {
        fn GetVolumeInformationW(
            root: *const u16,
            volume_name: *mut u16,
            volume_name_size: u32,
            serial: *mut u32,
            max_component: *mut u32,
            flags: *mut u32,
            fs_name: *mut u16,
            fs_name_size: u32,
        ) -> i32;

        fn GetSystemFirmwareTable(provider: u32, table_id: u32, buffer: *mut u8, size: u32) -> u32;
    }

    pub fn machine_guid() -> Option<String> {
        use winreg::enums::HKEY_LOCAL_MACHINE;
        use winreg::RegKey;

        let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
        let key = hklm
            .open_subkey("SOFTWARE\\Microsoft\\Cryptography")
            .ok()?;
        let guid: String = key.get_value("MachineGuid").ok()?;
        let trimmed = guid.trim().to_string();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    }

    pub fn volume_serial() -> Option<String> {
        let root: Vec<u16> = OsString::from("C:\\")
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        let mut serial: u32 = 0;
        let ok = unsafe {
            GetVolumeInformationW(
                root.as_ptr(),
                std::ptr::null_mut(),
                0,
                &mut serial,
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                0,
            )
        };

        if ok == 0 {
            None
        } else {
            Some((serial as i64).to_string())
        }
    }

    pub fn computer_name() -> Option<String> {
        std::env::var("COMPUTERNAME")
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
    }

    /// Mirrors JUCE's `SystemStats::getUniqueDeviceID()` on Windows: builds a
    /// string from SMBIOS type 1/2/4 tables, then `String(hashCode64())`.
    pub fn unique_device_id() -> Option<String> {
        let buffer = read_smbios()?;
        let hash = smbios_hash(&buffer);
        Some(hash.to_string())
    }

    fn read_smbios() -> Option<Vec<u8>> {
        const RSMB: u32 = 0x5253_4D42;

        let size = unsafe { GetSystemFirmwareTable(RSMB, 0, std::ptr::null_mut(), 0) };
        if size == 0 {
            return None;
        }

        let mut buffer = vec![0u8; size as usize];
        let written =
            unsafe { GetSystemFirmwareTable(RSMB, 0, buffer.as_mut_ptr(), size) };

        if written == 0 || written > size {
            return None;
        }

        buffer.truncate(written as usize);
        Some(buffer)
    }

    fn smbios_hash(buffer: &[u8]) -> i64 {
        if buffer.len() < 8 {
            return 0;
        }

        let length = u32::from_le_bytes([buffer[4], buffer[5], buffer[6], buffer[7]]) as usize;
        if buffer.len() < 8 + length {
            return 0;
        }

        let mut content = &buffer[8..8 + length];
        let mut uuid = String::new();

        while !content.is_empty() {
            if content.len() < 4 {
                break;
            }

            let table_type = content[0];
            let header_length = content[1] as usize;
            if content.len() < header_length {
                break;
            }

            let tail = &content[header_length..];
            let mut strings: Vec<String> = Vec::new();
            let mut string_offset = header_length;

            while string_offset < content.len() {
                let remaining = &content[string_offset..];
                let n = remaining.iter().position(|b| *b == 0).unwrap_or(remaining.len());
                if n == 0 {
                    break;
                }
                strings.push(String::from_utf8_lossy(&remaining[..n]).into_owned());
                string_offset += n + 1;
            }

            let string_from_offset = |offset: usize| -> String {
                if offset >= content.len() {
                    return String::new();
                }
                let index = content[offset] as usize;
                if index == 0 || index > strings.len() {
                    return String::new();
                }
                strings[index - 1].clone()
            };

            match table_type {
                1 => {
                    uuid.push_str(&string_from_offset(0x04));
                    uuid.push('\n');
                    uuid.push_str(&string_from_offset(0x05));
                    uuid.push('\n');

                    const SYSTEM_UUID: usize = 0x08;
                    if SYSTEM_UUID + 16 < content.len() {
                        for b in &content[SYSTEM_UUID..SYSTEM_UUID + 16] {
                            uuid.push_str(&format!("{b:02X}"));
                        }
                    }
                    uuid.push('\n');
                }
                2 => {
                    for offset in [0x04usize, 0x05, 0x06, 0x07, 0x08] {
                        uuid.push_str(&string_from_offset(offset));
                        uuid.push('\n');
                    }
                }
                4 => {
                    for offset in [0x07usize, 0x10, 0x21, 0x22] {
                        uuid.push_str(&string_from_offset(offset));
                        uuid.push('\n');
                    }
                }
                _ => {}
            }

            let end_of_string_table = (header_length + 2).max(string_offset + 1).min(content.len());
            let _ = tail;
            content = &content[end_of_string_table..];
        }

        // JUCE HashGenerator<uint64>: result = 101 * result + codepoint.
        let mut hash: u64 = 0;
        for ch in uuid.chars() {
            hash = hash.wrapping_mul(101).wrapping_add(ch as u64);
        }

        hash as i64
    }
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
mod linux {
    pub fn machine_id() -> Option<String> {
        std::fs::read_to_string("/etc/machine-id")
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn formats_machine_id() {
        assert_eq!(
            format_machine_id("4F2A91BC77D03E158AC60B4419EE5D73"),
            "4F2A-91BC-77D0-3E15-8AC6-0B44-19EE-5D73"
        );
    }

    #[test]
    fn normalises_pasted_ids() {
        assert_eq!(
            normalise_machine_id(" 4f2a-91bc 77d0-3e15 "),
            "4F2A91BC77D03E15"
        );
    }

    #[test]
    fn canonical_is_stable() {
        let first = machine_info().canonical;
        let second = machine_info().canonical;
        assert_eq!(first.len(), 32);
        assert_eq!(first, second);
    }
}

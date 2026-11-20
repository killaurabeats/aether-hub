mod admin;
mod hwid;
mod install;
mod keygen;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudConfig {
    pub url: String,
    pub anon_key: String,
    pub admin_token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct IssueLogEntry {
    issued_at: String,
    machine_id: String,
    product_tag: String,
    key: String,
    nickname: String,
    plugin_title: String,
}

#[tauri::command]
fn machine_id() -> hwid::MachineInfo {
    hwid::machine_info()
}

#[tauri::command]
fn admin_status(app: AppHandle) -> admin::AdminStatus {
    let app_data = app.path().app_data_dir().ok();
    admin::status(app_data)
}

#[tauri::command]
fn generate_license(
    app: AppHandle,
    machine_id: String,
    product_tag: Option<String>,
    nickname: Option<String>,
    plugin_title: Option<String>,
) -> Result<keygen::IssuedLicense, String> {
    let app_data = app.path().app_data_dir().ok();
    let signing_key = admin::load_signing_key(app_data)?;
    let tag = product_tag.as_deref().unwrap_or(keygen::DEFAULT_PRODUCT_TAG);
    let issued = keygen::issue(&signing_key, &machine_id, tag)?;

    let _ = append_issue_log(
        &app,
        &issued,
        nickname.unwrap_or_default(),
        plugin_title.unwrap_or_default(),
    );

    Ok(issued)
}

#[tauri::command]
fn write_license_file(key: String, product_tag: String) -> Result<(), String> {
    let tag = product_tag.to_uppercase();
    let folder = if tag == "AETHER-VOCAL-STRIP" {
        "AetherVocalStrip".to_string()
    } else {
        tag.chars()
            .filter(|c| c.is_ascii_alphanumeric())
            .collect::<String>()
    };
    if folder.is_empty() {
        return Err("Invalid product tag".into());
    }

    let base = dirs::data_dir().ok_or_else(|| "Cannot locate Application Support".to_string())?;
    let dir = base.join(folder);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join("license.aether");
    fs::write(&path, key.trim()).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn verify_license(
    key: String,
    machine_id: String,
    product_tag: Option<String>,
    public_key: String,
) -> bool {
    keygen::verify(
        &key,
        &machine_id,
        product_tag.as_deref().unwrap_or(keygen::DEFAULT_PRODUCT_TAG),
        &public_key,
    )
}

fn issue_log_path(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .app_data_dir()
        .ok()
        .map(|dir| dir.join("issued_licenses.jsonl"))
}

fn append_issue_log(
    app: &AppHandle,
    issued: &keygen::IssuedLicense,
    nickname: String,
    plugin_title: String,
) -> Result<(), String> {
    let Some(path) = issue_log_path(app) else {
        return Ok(());
    };

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let entry = IssueLogEntry {
        issued_at: issued.issued_at.clone(),
        machine_id: issued.machine_id.clone(),
        product_tag: issued.product_tag.clone(),
        key: issued.key.clone(),
        nickname,
        plugin_title,
    };

    let line = serde_json::to_string(&entry).map_err(|e| e.to_string())?;
    let mut text = fs::read_to_string(&path).unwrap_or_default();
    text.push_str(&line);
    text.push('\n');
    fs::write(path, text).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn list_issued_licenses(app: AppHandle) -> Vec<IssueLogEntry> {
    let Some(path) = issue_log_path(&app) else {
        return Vec::new();
    };

    let Ok(text) = fs::read_to_string(path) else {
        return Vec::new();
    };

    text.lines()
        .rev()
        .filter_map(|line| serde_json::from_str::<IssueLogEntry>(line).ok())
        .take(200)
        .collect()
}


#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct FileStat {
    size: u64,
    name: String,
}

#[tauri::command]
fn file_stat(path: String) -> Result<FileStat, String> {
    let metadata = std::fs::metadata(&path).map_err(|e| format!("Cannot read {path}: {e}"))?;
    let name = PathBuf::from(&path)
        .file_name()
        .map(|value| value.to_string_lossy().into_owned())
        .unwrap_or_else(|| "file".to_string());

    Ok(FileStat {
        size: metadata.len(),
        name,
    })
}

#[tauri::command]
fn read_image_data_url(path: String) -> Result<String, String> {
    use base64::{engine::general_purpose::STANDARD, Engine as _};

    let metadata = std::fs::metadata(&path).map_err(|e| format!("Cannot read {path}: {e}"))?;
    if metadata.len() > 8 * 1024 * 1024 {
        return Err("Image is larger than 8 MB.".into());
    }

    let bytes = std::fs::read(&path).map_err(|e| format!("Cannot read {path}: {e}"))?;
    let mime = match PathBuf::from(&path)
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default()
        .as_str()
    {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "gif" => "image/gif",
        _ => "application/octet-stream",
    };

    Ok(format!("data:{};base64,{}", mime, STANDARD.encode(bytes)))
}

#[tauri::command]
fn open_folder(path: String) -> Result<(), String> {
    install::open_folder(&path)
}

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    if !(url.starts_with("https://")
        || url.starts_with("http://")
        || url.starts_with("mailto:"))
    {
        return Err("Only http(s) and mailto links can be opened.".into());
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &url])
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        std::process::Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

fn is_publishable_key(key: &str) -> bool {
    key.starts_with("sb_publishable_")
}

#[tauri::command]
async fn cloud_admin_api(
    config: CloudConfig,
    action: String,
    payload: Value,
) -> Result<Value, String> {
    let url = config.url.trim_end_matches('/');

    if url.is_empty() || config.anon_key.is_empty() {
        return Err("Cloud is not configured.".into());
    }

    if config.admin_token.is_empty() {
        return Err("Admin token is missing from this build.".into());
    }

    let client = reqwest::Client::new();
    let mut request = client
        .post(format!("{url}/functions/v1/aether-admin"))
        .header("apikey", &config.anon_key);

    if !is_publishable_key(&config.anon_key) {
        request = request.bearer_auth(&config.anon_key);
    }

    let response = request
        .json(&serde_json::json!({
            "token": config.admin_token,
            "action": action,
            "payload": payload,
        }))
        .send()
        .await
        .map_err(|e| format!("Admin request failed: {e}"))?;

    let status = response.status();
    let text = response.text().await.unwrap_or_default();

    if !status.is_success() {
        return Err(format!("Admin request failed ({status}): {text}"));
    }

    serde_json::from_str(&text).map_err(|e| format!("Unexpected admin response: {e}"))
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UploadRequest {
    pub local_path: String,
    pub bucket: String,
    pub storage_path: String,
    pub content_type: Option<String>,
}

#[tauri::command]
async fn cloud_upload(
    config: CloudConfig,
    request: UploadRequest,
) -> Result<Value, String> {
    let url = config.url.trim_end_matches('/');
    if url.is_empty() || config.anon_key.is_empty() || config.admin_token.is_empty() {
        return Err("Cloud admin credentials are not configured.".into());
    }

    let file = tokio::fs::File::open(&request.local_path)
        .await
        .map_err(|e| format!("Cannot read {}: {e}", request.local_path))?;
    let total = file
        .metadata()
        .await
        .map(|m| m.len())
        .unwrap_or(0);
    let body = reqwest::Body::wrap_stream(tokio_util::io::ReaderStream::new(file));

    let client = reqwest::Client::new();

    let mut sign_request = client
        .post(format!("{url}/functions/v1/aether-admin"))
        .header("apikey", &config.anon_key);

    if !is_publishable_key(&config.anon_key) {
        sign_request = sign_request.bearer_auth(&config.anon_key);
    }

    let sign_response = sign_request
        .json(&serde_json::json!({
            "token": config.admin_token,
            "action": "sign_upload",
            "payload": { "bucket": request.bucket, "path": request.storage_path }
        }))
        .send()
        .await
        .map_err(|e| format!("Could not sign upload: {e}"))?;

    let status = sign_response.status();
    let sign_body: Value = sign_response
        .json()
        .await
        .map_err(|e| format!("Invalid sign response: {e}"))?;

    if !status.is_success() {
        return Err(format!("Could not sign upload ({status}): {sign_body}"));
    }

    let signed_url = sign_body
        .get("signedUrl")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Cloud did not return a signed upload URL.".to_string())?;

    let content_type = request
        .content_type
        .unwrap_or_else(|| "application/octet-stream".to_string());

    let upload = client
        .put(signed_url)
        .header("Content-Type", &content_type)
        .header("x-upsert", "true")
        .header("Content-Length", total.to_string())
        .body(body)
        .send()
        .await
        .map_err(|e| format!("Upload failed: {e}"))?;

    if !upload.status().is_success() {
        let status = upload.status();
        let text = upload.text().await.unwrap_or_default();
        return Err(format!("Upload failed ({status}): {text}"));
    }

    Ok(serde_json::json!({
        "publicUrl": format!("{url}/storage/v1/object/public/{}/{}", request.bucket, request.storage_path),
        "storagePath": request.storage_path,
        "bucket": request.bucket,
    }))
}

#[tauri::command]
fn frontend_log(app: AppHandle, level: String, message: String) -> Result<(), String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("logs");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    let stamp = chrono::Local::now().format("%Y-%m-%d %H:%M:%S");
    let line = format!(
        "[{stamp}] {:<5} {}\n",
        level.to_uppercase(),
        message.chars().take(4000).collect::<String>()
    );

    use std::io::Write;
    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(dir.join("frontend.log"))
        .map_err(|e| e.to_string())?;
    file.write_all(line.as_bytes()).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

pub fn machine_id_string() -> String {
    hwid::machine_info().formatted
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            machine_id,
            admin_status,
            generate_license,
            write_license_file,
            verify_license,
            list_issued_licenses,
            app_version,
            frontend_log,
            install::check_installs,
            install::uninstall_release,
            install::install_release,
            install::download_release,
            install::app_paths,
            file_stat,
            read_image_data_url,
            open_folder,
            open_url,
            cloud_admin_api,
            cloud_upload,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Aether Hub");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prints_machine_id_for_cross_check() {
        let info = hwid::machine_info();
        println!("MACHINE ID: {}", info.formatted);
        assert_eq!(info.canonical.len(), 32);
    }

    #[test]
    fn keygen_roundtrip_uses_monocypher_signatures() {
        let secret = keygen::SecretKey::from_bytes(&[0x42u8; 32]).unwrap();
        let issued = keygen::issue(
            &secret,
            "4F2A-91BC-77D0-3E15-8AC6-0B44-19EE-5D73",
            keygen::DEFAULT_PRODUCT_TAG,
        )
        .unwrap();

        assert!(keygen::verify(
            &issued.key,
            "4F2A91BC77D03E158AC60B4419EE5D73",
            keygen::DEFAULT_PRODUCT_TAG,
            &issued.public_key,
        ));
        assert!(!keygen::verify(
            &issued.key,
            "4F2A91BC77D03E158AC60B4419EE5D73",
            "AETHER-OTHER-PLUGIN",
            &issued.public_key,
        ));
    }
}



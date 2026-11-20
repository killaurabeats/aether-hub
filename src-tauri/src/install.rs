//! One-click installation for plugins, drumkits and preset packs.

use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::AsyncWriteExt;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct InstalledRecord {
    pub version: String,
    pub installed_at: String,
    pub category: String,
    pub title: String,
    pub paths: Vec<String>,
    pub size_bytes: u64,
}

pub type Installs = BTreeMap<String, InstalledRecord>;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppPaths {
    pub os: String,
    pub arch: String,
    pub home: String,
    pub documents: String,
    pub presets_dir: String,
    pub drumkits_dir: String,
    pub vst3_dir: String,
    pub components_dir: String,
    pub resource_dir: String,
    pub app_data_dir: String,
    pub installs_file: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallRequest {
    pub slug: String,
    pub title: String,
    pub category: String,
    pub version: String,
    pub url: String,
    #[serde(default)]
    pub preset_dir: Option<String>,
    #[serde(default)]
    pub drumkit_dir: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct InstallProgress {
    slug: String,
    phase: String,
    received: u64,
    total: u64,
    percent: f64,
    message: Option<String>,
}


#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadRequest {
    pub url: String,
    pub filename: String,
    pub title: String,
}

fn safe_file_name(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .map(|c| {
            if matches!(c, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|') {
                '-'
            } else {
                c
            }
        })
        .collect();

    let trimmed = cleaned.trim().trim_matches('.').trim();
    if trimmed.is_empty() {
        return "Aether Release.zip".to_string();
    }

    if trimmed.to_lowercase().ends_with(".zip") {
        trimmed.to_string()
    } else {
        format!("{trimmed}.zip")
    }
}

fn unique_destination(dir: &Path, filename: &str) -> PathBuf {
    let candidate = dir.join(filename);
    if !candidate.exists() {
        return candidate;
    }

    let stem = Path::new(filename)
        .file_stem()
        .map(|value| value.to_string_lossy().into_owned())
        .unwrap_or_else(|| "release".to_string());
    let extension = Path::new(filename)
        .extension()
        .map(|value| value.to_string_lossy().into_owned())
        .unwrap_or_default();

    for index in 1..1000 {
        let name = if extension.is_empty() {
            format!("{stem} ({index})")
        } else {
            format!("{stem} ({index}).{extension}")
        };
        let candidate = dir.join(name);
        if !candidate.exists() {
            return candidate;
        }
    }

    dir.join(format!("{stem}-{}.{}", uuid::Uuid::new_v4(), extension))
}

async fn download_plain(source: &Source, target: &Path) -> Result<(), String> {
    match source {
        Source::Local(path) => {
            tokio::fs::copy(path, target)
                .await
                .map(|_| ())
                .map_err(|e| format!("Could not copy release: {e}"))
        }
        Source::Remote(url) => {
            let client = reqwest::Client::builder()
                .user_agent("AetherHub/1.1")
                .build()
                .map_err(|e| e.to_string())?;
            let response = client
                .get(url)
                .send()
                .await
                .map_err(|e| format!("Download failed: {e}"))?;

            if !response.status().is_success() {
                return Err(format!("Download failed with HTTP {}", response.status()));
            }

            let mut file = tokio::fs::File::create(target)
                .await
                .map_err(|e| e.to_string())?;
            let mut stream = response.bytes_stream();

            while let Some(chunk) = stream.next().await {
                let chunk = chunk.map_err(|e| format!("Download interrupted: {e}"))?;
                file.write_all(&chunk).await.map_err(|e| e.to_string())?;
            }
            file.flush().await.map_err(|e| e.to_string())?;
            Ok(())
        }
    }
}

#[tauri::command]
pub async fn download_release(app: AppHandle, request: DownloadRequest) -> Result<String, String> {
    let source = resolve_source(&app, &request.url)?;
    let downloads = dirs::download_dir()
        .or_else(|| dirs::home_dir().map(|home| home.join("Downloads")))
        .ok_or_else(|| "Could not locate the Downloads folder.".to_string())?;
    let target_dir = downloads.join("Aether Hub");
    fs::create_dir_all(&target_dir).map_err(|e| e.to_string())?;

    let base_name = if request.filename.trim().is_empty() {
        safe_file_name(&request.title)
    } else {
        safe_file_name(&request.filename)
    };
    let destination = unique_destination(&target_dir, &base_name);
    let temp = std::env::temp_dir().join(format!("aether-download-{}.zip", uuid::Uuid::new_v4()));

    let result = download_plain(&source, &temp).await;
    if let Err(error) = result {
        let _ = fs::remove_file(&temp);
        return Err(error);
    }

    if let Err(error) = fs::copy(&temp, &destination) {
        let _ = fs::remove_file(&temp);
        return Err(format!("Could not save the download: {error}"));
    }

    let _ = fs::remove_file(&temp);
    Ok(destination.display().to_string())
}

#[tauri::command]
pub fn app_paths(app: AppHandle) -> AppPaths {
    let home = dirs::home_dir().unwrap_or_default();
    let documents = dirs::document_dir().unwrap_or_else(|| home.join("Documents"));

    let presets_dir = if cfg!(target_os = "windows") {
        documents.join("Image-Line").join("FL Studio").join("Presets").join("Aether Plugins")
    } else {
        documents
            .join("Image-Line")
            .join("FL Studio")
            .join("Presets")
            .join("Aether Plugins")
    };

    let drumkits_dir = documents.join("Aether Hub").join("Drumkits");

    let (vst3_dir, components_dir) = plugin_dirs();

    let resource_dir = app
        .path()
        .resource_dir()
        .unwrap_or_else(|_| PathBuf::from("."));
    let app_data_dir = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| home.join("Library/Application Support/com.aetherhub.launcher"));
    let installs_file = app_data_dir.join("installs.json");

    AppPaths {
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        home: home.display().to_string(),
        documents: documents.display().to_string(),
        presets_dir: presets_dir.display().to_string(),
        drumkits_dir: drumkits_dir.display().to_string(),
        vst3_dir: vst3_dir.display().to_string(),
        components_dir: components_dir.display().to_string(),
        resource_dir: resource_dir.display().to_string(),
        app_data_dir: app_data_dir.display().to_string(),
        installs_file: installs_file.display().to_string(),
    }
}

fn test_root() -> Option<PathBuf> {
    std::env::var_os("AETHER_TEST_ROOT").map(PathBuf::from)
}

pub fn plugin_dirs() -> (PathBuf, PathBuf) {
    if let Some(root) = test_root() {
        return (root.join("VST3"), root.join("Components"));
    }

    #[cfg(target_os = "macos")]
    {
        let audio = dirs::home_dir()
            .unwrap_or_default()
            .join("Library")
            .join("Audio")
            .join("Plug-Ins");
        (audio.join("VST3"), audio.join("Components"))
    }

    #[cfg(target_os = "windows")]
    {
        let common = std::env::var("COMMONPROGRAMFILES")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from(r"C:\Program Files\Common Files"));
        let vst3 = common.join("VST3");

        let fallback = std::env::var("LOCALAPPDATA")
            .map(PathBuf::from)
            .unwrap_or_default()
            .join("Programs")
            .join("Common")
            .join("VST3");

        (vst3, fallback)
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let home = dirs::home_dir().unwrap_or_default();
        (home.join(".vst3"), home.join(".vst3"))
    }
}

fn installs_path(app: &AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("installs.json")
}

pub fn read_installs(app: &AppHandle) -> Installs {
    fs::read_to_string(installs_path(app))
        .ok()
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_default()
}

fn write_installs(app: &AppHandle, installs: &Installs) -> Result<(), String> {
    let path = installs_path(app);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let text = serde_json::to_string_pretty(installs).map_err(|e| e.to_string())?;
    fs::write(path, text).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn check_installs(app: AppHandle) -> Installs {
    read_installs(&app)
}

#[tauri::command]
pub fn uninstall_release(app: AppHandle, slug: String) -> Result<Installs, String> {
    let mut installs = read_installs(&app);
    if let Some(record) = installs.remove(&slug) {
        for item in record.paths {
            let path = PathBuf::from(item);
            if path.is_dir() {
                let _ = fs::remove_dir_all(path);
            } else if path.is_file() {
                let _ = fs::remove_file(path);
            }
        }
    }
    write_installs(&app, &installs)?;
    Ok(installs)
}

#[tauri::command]
pub async fn install_release(
    app: AppHandle,
    request: InstallRequest,
) -> Result<InstalledRecord, String> {
    let temp_root = std::env::temp_dir().join(format!("aether-install-{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&temp_root).map_err(|e| e.to_string())?;

    let archive_path = temp_root.join("payload.zip");
    let extracted = temp_root.join("extracted");

    let result = install_inner(&app, &request, &archive_path, &extracted).await;

    let _ = fs::remove_dir_all(&temp_root);
    result
}

async fn install_inner(
    app: &AppHandle,
    request: &InstallRequest,
    archive_path: &Path,
    extracted: &Path,
) -> Result<InstalledRecord, String> {
    emit(app, request, "preparing", 0, 0, 0.0, Some("Resolving download…"));

    let source = resolve_source(app, &request.url)?;

    let total = match &source {
        Source::Local(path) => fs::metadata(path).map(|m| m.len()).unwrap_or(0),
        Source::Remote(_) => 0,
    };

    download(app, request, &source, archive_path, total).await?;

    let archive_size = fs::metadata(archive_path).map(|m| m.len()).unwrap_or(0);

    emit(app, request, "extracting", archive_size, archive_size, 82.0, Some("Unpacking archive…"));

    let extract_to = extracted.to_path_buf();
    let archive = archive_path.to_path_buf();
    tauri::async_runtime::spawn_blocking(move || extract_zip(&archive, &extract_to))
        .await
        .map_err(|e| e.to_string())??;

    emit(app, request, "installing", archive_size, archive_size, 90.0, Some("Installing files…"));

    let category = request.category.to_lowercase();
    let (paths, size_bytes) = match category.as_str() {
        "plugins" => install_plugins(extracted)?,
        "presets" => install_presets(request, extracted)?,
        "drumkits" => install_drumkits(request, extracted)?,
        other => return Err(format!("Unknown category: {other}")),
    };

    let record = InstalledRecord {
        version: request.version.clone(),
        installed_at: chrono::Utc::now().to_rfc3339(),
        category: request.category.clone(),
        title: request.title.clone(),
        paths: paths.iter().map(|p| p.display().to_string()).collect(),
        size_bytes,
    };

    let mut installs = read_installs(app);
    installs.insert(request.slug.clone(), record.clone());
    write_installs(app, &installs)?;

    emit(app, request, "done", archive_size, archive_size, 100.0, Some("Installed"));

    Ok(record)
}

enum Source {
    Local(PathBuf),
    Remote(String),
}

fn resolve_source(app: &AppHandle, url: &str) -> Result<Source, String> {
    if let Some(rest) = url.strip_prefix("local:") {
        return Ok(Source::Local(PathBuf::from(rest)));
    }

    if let Some(rest) = url.strip_prefix("file://") {
        return Ok(Source::Local(PathBuf::from(rest)));
    }

    if url.starts_with("http://") || url.starts_with("https://") {
        return Ok(Source::Remote(url.to_string()));
    }

    let file_name = url
        .trim_start_matches('/')
        .strip_prefix("releases/")
        .unwrap_or_else(|| url.trim_start_matches('/'));

    let mut candidates: Vec<PathBuf> = Vec::new();

    if let Ok(resource_dir) = app.path().resource_dir() {
        candidates.push(resource_dir.join("resources").join("releases").join(file_name));
        candidates.push(resource_dir.join("releases").join(file_name));
        candidates.push(resource_dir.join(file_name));
    }

    candidates.push(
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("resources")
            .join("releases")
            .join(file_name),
    );

    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            candidates.push(dir.join("resources").join("releases").join(file_name));
            candidates.push(dir.join("releases").join(file_name));
        }
    }

    for candidate in candidates {
        if candidate.is_file() {
            return Ok(Source::Local(candidate));
        }
    }

    Err(format!(
        "Release file '{file_name}' is not bundled and no download URL is configured."
    ))
}

async fn download(
    app: &AppHandle,
    request: &InstallRequest,
    source: &Source,
    target: &Path,
    known_total: u64,
) -> Result<(), String> {
    match source {
        Source::Local(path) => {
            let total = fs::metadata(path).map(|m| m.len()).unwrap_or(known_total);
            emit(app, request, "downloading", 0, total, 5.0, Some("Copying bundled release…"));
            tokio::fs::copy(path, target)
                .await
                .map_err(|e| format!("Could not copy release file: {e}"))?;
            emit(app, request, "downloading", total, total, 80.0, Some("Downloaded"));
            Ok(())
        }
        Source::Remote(url) => {
            let client = reqwest::Client::builder()
                .user_agent("AetherHub/1.1")
                .build()
                .map_err(|e| e.to_string())?;

            let response = client
                .get(url)
                .send()
                .await
                .map_err(|e| format!("Download failed: {e}"))?;

            if !response.status().is_success() {
                return Err(format!("Download failed with HTTP {}", response.status()));
            }

            let total = response.content_length().unwrap_or(known_total);
            let mut file = tokio::fs::File::create(target)
                .await
                .map_err(|e| e.to_string())?;

            let mut received: u64 = 0;
            let mut last_emit = std::time::Instant::now();
            let mut stream = response.bytes_stream();

            while let Some(chunk) = stream.next().await {
                let chunk = chunk.map_err(|e| format!("Download interrupted: {e}"))?;
                file.write_all(&chunk).await.map_err(|e| e.to_string())?;
                received += chunk.len() as u64;

                if last_emit.elapsed().as_millis() > 90 || received == total {
                    let percent = if total > 0 {
                        5.0 + (received as f64 / total as f64) * 75.0
                    } else {
                        40.0
                    };
                    emit(app, request, "downloading", received, total, percent, None);
                    last_emit = std::time::Instant::now();
                }
            }

            file.flush().await.map_err(|e| e.to_string())?;
            emit(app, request, "downloading", received, total, 80.0, Some("Downloaded"));
            Ok(())
        }
    }
}

fn emit(
    app: &AppHandle,
    request: &InstallRequest,
    phase: &str,
    received: u64,
    total: u64,
    percent: f64,
    message: Option<&str>,
) {
    let _ = app.emit(
        "install-progress",
        InstallProgress {
            slug: request.slug.clone(),
            phase: phase.to_string(),
            received,
            total,
            percent,
            message: message.map(str::to_string),
        },
    );
}

fn extract_zip(archive: &Path, destination: &Path) -> Result<(), String> {
    let file = fs::File::open(archive).map_err(|e| format!("Cannot open archive: {e}"))?;
    let mut zip = zip::ZipArchive::new(file).map_err(|e| format!("Invalid ZIP archive: {e}"))?;

    fs::create_dir_all(destination).map_err(|e| e.to_string())?;

    for index in 0..zip.len() {
        let mut entry = zip.by_index(index).map_err(|e| e.to_string())?;
        let Some(relative) = entry.enclosed_name() else {
            continue;
        };
        let out_path = destination.join(relative);

        if entry.is_dir() {
            fs::create_dir_all(&out_path).map_err(|e| e.to_string())?;
            continue;
        }

        if let Some(parent) = out_path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }

        let mut out_file = fs::File::create(&out_path).map_err(|e| e.to_string())?;
        std::io::copy(&mut entry, &mut out_file).map_err(|e| e.to_string())?;
    }

    Ok(())
}

fn install_plugins(extracted: &Path) -> Result<(Vec<PathBuf>, u64), String> {
    let mut bundles: Vec<PathBuf> = Vec::new();
    collect_bundles(extracted, &mut bundles, 0);

    if bundles.is_empty() {
        return Err("The archive does not contain a .vst3 or .component bundle.".into());
    }

    let (vst3_dir, components_dir) = plugin_dirs();
    fs::create_dir_all(&vst3_dir).map_err(|e| e.to_string())?;

    let mut installed: Vec<PathBuf> = Vec::new();
    let mut total_size: u64 = 0;

    for bundle in bundles {
        let file_name = bundle
            .file_name()
            .ok_or_else(|| "Invalid bundle name".to_string())?
            .to_os_string();

        let is_component = bundle
            .extension()
            .map(|e| e.eq_ignore_ascii_case("component"))
            .unwrap_or(false);

        let mut target_root = if is_component {
            components_dir.clone()
        } else {
            vst3_dir.clone()
        };

        if is_component {
            fs::create_dir_all(&components_dir).map_err(|e| e.to_string())?;
        }

        let mut destination = target_root.join(&file_name);

        match atomic_replace_dir(&bundle, &destination) {
            Ok(()) => {}
            Err(err) if cfg!(target_os = "windows") && !is_component => {
                // Program Files may require elevation; fall back to the user
                // VST3 folder, which every modern host scans.
                let (_, fallback) = plugin_dirs();
                fs::create_dir_all(&fallback).map_err(|e| e.to_string())?;
                target_root = fallback;
                destination = target_root.join(&file_name);
                atomic_replace_dir(&bundle, &destination).map_err(|second| {
                    format!("Could not install to {} ({err}); fallback also failed ({second})", target_root.display())
                })?;
            }
            Err(err) => return Err(format!("Could not install {}: {err}", bundle.display())),
        }

        total_size += dir_size(&destination);
        installed.push(destination);
    }

    Ok((installed, total_size))
}

fn install_presets(
    request: &InstallRequest,
    extracted: &Path,
) -> Result<(Vec<PathBuf>, u64), String> {
    let base = request
        .preset_dir
        .as_ref()
        .filter(|s| !s.trim().is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| match test_root() {
            Some(root) => root.join("Presets").join("Aether Plugins"),
            None => dirs::document_dir()
                .unwrap_or_default()
                .join("Image-Line")
                .join("FL Studio")
                .join("Presets")
                .join("Aether Plugins"),
        });

    let final_dir = base.join(safe_folder_name(&request.title));
    fs::create_dir_all(&final_dir).map_err(|e| e.to_string())?;

    copy_payload(extracted, &final_dir)?;

    // A small marker helps the user (and FL Studio's browser) find the pack.
    let marker = final_dir.join("aether-pack.json");
    if !marker.exists() {
        let meta = serde_json::json!({
            "name": request.title,
            "version": request.version,
            "installedBy": "Aether Hub",
            "installedAt": chrono::Utc::now().to_rfc3339(),
            "os": std::env::consts::OS
        });
        let _ = fs::write(&marker, serde_json::to_string_pretty(&meta).unwrap_or_default());
    }

    let size = dir_size(&final_dir);
    Ok((vec![final_dir], size))
}

fn install_drumkits(
    request: &InstallRequest,
    extracted: &Path,
) -> Result<(Vec<PathBuf>, u64), String> {
    let base = request
        .drumkit_dir
        .as_ref()
        .filter(|s| !s.trim().is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| match test_root() {
            Some(root) => root.join("Drumkits"),
            None => dirs::document_dir()
                .unwrap_or_default()
                .join("Aether Hub")
                .join("Drumkits"),
        });

    let final_dir = base.join(safe_folder_name(&request.title));
    fs::create_dir_all(&final_dir).map_err(|e| e.to_string())?;

    copy_payload(extracted, &final_dir)?;

    let size = dir_size(&final_dir);
    Ok((vec![final_dir], size))
}

fn collect_bundles(dir: &Path, out: &mut Vec<PathBuf>, depth: usize) {
    if depth > 4 {
        return;
    }

    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };

    for entry in entries.flatten() {
        let path = entry.path();
        let Ok(file_type) = entry.file_type() else {
            continue;
        };

        if !file_type.is_dir() {
            continue;
        }

        let is_bundle = path
            .extension()
            .map(|e| e.eq_ignore_ascii_case("vst3") || e.eq_ignore_ascii_case("component"))
            .unwrap_or(false);

        if is_bundle {
            out.push(path);
        } else {
            collect_bundles(&path, out, depth + 1);
        }
    }
}

/// If the archive has a single top-level folder, install its contents instead
/// of nesting the same folder name twice.
fn copy_payload(extracted: &Path, destination: &Path) -> Result<(), String> {
    let entries: Vec<_> = fs::read_dir(extracted)
        .map_err(|e| e.to_string())?
        .flatten()
        .collect();

    let source = if entries.len() == 1 && entries[0].path().is_dir() {
        entries[0].path()
    } else {
        extracted.to_path_buf()
    };

    copy_dir_contents(&source, destination)
}

fn copy_dir_contents(source: &Path, destination: &Path) -> Result<(), String> {
    fs::create_dir_all(destination).map_err(|e| e.to_string())?;

    for entry in fs::read_dir(source).map_err(|e| e.to_string())?.flatten() {
        let src = entry.path();
        let dst = destination.join(entry.file_name());

        if src.is_dir() {
            copy_dir_contents(&src, &dst)?;
        } else if src.is_file() {
            if let Some(parent) = dst.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            fs::copy(&src, &dst).map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

/// Copies a bundle next to its destination first, then swaps it in. A failed
/// copy never destroys a working plugin installation.
fn atomic_replace_dir(source: &Path, destination: &Path) -> Result<(), String> {
    let parent = destination
        .parent()
        .ok_or_else(|| "Invalid install destination".to_string())?;
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;

    let tag = uuid::Uuid::new_v4();
    let temp = parent.join(format!(".aether-tmp-{tag}"));
    let backup = parent.join(format!(".aether-backup-{tag}"));

    if let Err(error) = copy_dir_contents(source, &temp) {
        let _ = fs::remove_dir_all(&temp);
        return Err(error);
    }

    if destination.exists() {
        if let Err(error) = fs::rename(destination, &backup) {
            let _ = fs::remove_dir_all(&temp);
            return Err(format!("Cannot replace existing plugin: {error}"));
        }
    }

    match fs::rename(&temp, destination) {
        Ok(()) => {
            let _ = fs::remove_dir_all(&backup);
            Ok(())
        }
        Err(error) => {
            if backup.exists() {
                let _ = fs::rename(&backup, destination);
            }
            let _ = fs::remove_dir_all(&temp);
            Err(format!("Cannot finalise plugin install: {error}"))
        }
    }
}

fn dir_size(dir: &Path) -> u64 {
    let Ok(entries) = fs::read_dir(dir) else {
        return 0;
    };

    let mut total = 0;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            total += dir_size(&path);
        } else if let Ok(meta) = entry.metadata() {
            total += meta.len();
        }
    }
    total
}

fn safe_folder_name(title: &str) -> String {
    let cleaned: String = title
        .chars()
        .map(|c| if matches!(c, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|') { '-' } else { c })
        .collect();
    let trimmed = cleaned.trim().trim_matches('.').trim();
    if trimmed.is_empty() {
        "Aether Release".to_string()
    } else {
        trimmed.to_string()
    }
}

pub fn open_folder(path: &str) -> Result<(), String> {
    let path = PathBuf::from(path);
    if !path.exists() {
        fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[cfg(target_os = "macos")]
    fn installs_all_three_categories_from_bundled_zips() {
        let root = std::env::temp_dir().join(format!("aether-install-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&root).unwrap();
        std::env::set_var("AETHER_TEST_ROOT", &root);

        let releases = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources/releases");

        // --- plugin archive (VST3 + AU) -------------------------------------
        let plugin_zip = releases.join("aether-vocal-strip-macos.zip");
        if plugin_zip.is_file() {
            let extracted = root.join("plugin-extract");
            extract_zip(&plugin_zip, &extracted).unwrap();
            let (paths, size) = install_plugins(&extracted).unwrap();

            assert!(size > 1_000_000, "plugin copy should have real size, got {size}");
            assert_eq!(paths.len(), 2, "expected VST3 + AU, got {paths:?}");
            for path in &paths {
                assert!(path.exists(), "{} missing", path.display());
                let binary = path.join("Contents/MacOS/AetherVocal Strip");
                assert!(binary.is_file(), "binary missing in {}", path.display());
            }
        }

        // --- drumkit ---------------------------------------------------------
        let kit_zip = releases.join("aether-808-essentials.zip");
        if kit_zip.is_file() {
            let extracted = root.join("kit-extract");
            extract_zip(&kit_zip, &extracted).unwrap();
            let request = InstallRequest {
                slug: "test-kit".into(),
                title: "Aether 808 Essentials".into(),
                category: "drumkits".into(),
                version: "1.1".into(),
                url: String::new(),
                preset_dir: None,
                drumkit_dir: None,
            };
            let (paths, size) = install_drumkits(&request, &extracted).unwrap();
            assert!(size > 0);
            assert!(paths[0].join("Drums/Kick - Aether Punch.wav").is_file());
            assert!(paths[0].join("Previews/Aether 808 Demo.wav").is_file());
        }

        // --- presets ---------------------------------------------------------
        let preset_zip = releases.join("aether-vocal-chain-presets.zip");
        if preset_zip.is_file() {
            let extracted = root.join("preset-extract");
            extract_zip(&preset_zip, &extracted).unwrap();
            let request = InstallRequest {
                slug: "test-preset".into(),
                title: "Aether Vocal Chain".into(),
                category: "presets".into(),
                version: "1.1".into(),
                url: String::new(),
                preset_dir: Some(root.join("FL Presets").display().to_string()),
                drumkit_dir: None,
            };
            let (paths, _) = install_presets(&request, &extracted).unwrap();
            assert!(paths[0].join("aether-pack.json").is_file());
            assert!(paths[0].join("01 - Clean Vocal.aetherpreset").is_file());
        }

        std::env::remove_var("AETHER_TEST_ROOT");
        let _ = std::fs::remove_dir_all(&root);
    }
}

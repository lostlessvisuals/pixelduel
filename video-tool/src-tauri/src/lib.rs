use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::thread;

use serde::Serialize;
use tauri::{AppHandle, Manager};

#[derive(Serialize)]
struct ProbeResult {
  raw_json: String,
}

fn guess_mime(path: &Path) -> &'static str {
  match path.extension().and_then(|s| s.to_str()).unwrap_or("").to_lowercase().as_str() {
    "html" => "text/html; charset=utf-8",
    "js" => "text/javascript; charset=utf-8",
    "css" => "text/css; charset=utf-8",
    "svg" => "image/svg+xml",
    "png" => "image/png",
    "jpg" | "jpeg" => "image/jpeg",
    "ico" => "image/x-icon",
    "json" => "application/json; charset=utf-8",
    _ => "application/octet-stream",
  }
}

// Serves ../src at http://127.0.0.1:1420 in dev.
// This avoids WebView local-file loading weirdness.
fn start_dev_server_once() {
  static ONCE: std::sync::Once = std::sync::Once::new();
  ONCE.call_once(|| {
    thread::spawn(|| {
      let root = PathBuf::from("..").join("src"); // running from src-tauri
      let server = tiny_http::Server::http("127.0.0.1:1420").expect("dev server bind failed");

      println!("Dev server serving {:?} at http://127.0.0.1:1420", root);

      for req in server.incoming_requests() {
        let url = req.url().split('?').next().unwrap_or("/");
        let rel = if url == "/" { "index.html" } else { &url[1..] };
        let path = root.join(rel);

        let (status, body) = match fs::read(&path) {
          Ok(bytes) => (200, bytes),
          Err(_) => (404, b"Not found".to_vec()),
        };

        let mime = guess_mime(&path);
        let response = tiny_http::Response::from_data(body)
          .with_status_code(status)
          .with_header(tiny_http::Header::from_bytes(&b"Content-Type"[..], mime.as_bytes()).unwrap())
          .with_header(tiny_http::Header::from_bytes(&b"Cache-Control"[..], b"no-cache").unwrap());

        let _ = req.respond(response);
      }
    });
  });
}

fn resolve_bundled_binary(app: &AppHandle, name: &str) -> Result<PathBuf, String> {
  let dev_path = PathBuf::from("binaries").join(name); // current_dir is src-tauri
  if dev_path.exists() {
    return Ok(dev_path);
  }

  let resource_dir = app
    .path()
    .resource_dir()
    .map_err(|e| format!("Failed to resolve resource_dir: {}", e))?;
  let prod_path = resource_dir.join("binaries").join(name);

  if prod_path.exists() {
    return Ok(prod_path);
  }

  Err(format!(
    "Bundled binary not found: {} (looked in {:?} and {:?})",
    name, dev_path, prod_path
  ))
}

#[tauri::command]
fn probe_video(app: AppHandle, path: String) -> Result<ProbeResult, String> {
  let ffprobe = resolve_bundled_binary(&app, "ffprobe.exe")?;

  let output = Command::new(ffprobe)
    .args([
      "-hide_banner",
      "-print_format",
      "json",
      "-show_format",
      "-show_streams",
      &path,
    ])
    .output()
    .map_err(|e| format!("Failed to run ffprobe: {}", e))?;

  if !output.status.success() {
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    return Err(format!("ffprobe error:\n{}", stderr));
  }

  let raw_json = String::from_utf8_lossy(&output.stdout).to_string();
  Ok(ProbeResult { raw_json })
}

pub fn run() {
  tauri::Builder::default()
    .setup(|_app| {
      println!("=== TAURI STARTUP DEBUG ===");
      println!("current_dir: {:?}", std::env::current_dir());
      println!("==========================");

      // Start server only in dev/debug
      #[cfg(debug_assertions)]
      start_dev_server_once();

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![probe_video])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

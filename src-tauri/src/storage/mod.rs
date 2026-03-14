pub mod connections;
pub mod queries;

use keyring::Entry;
use serde::de::DeserializeOwned;
use std::fs;
use tauri::{AppHandle, Manager, Runtime};
use crate::error::AppError;

pub(crate) const KEYCHAIN_SERVICE: &str = "quarry";
pub(crate) const CONNECTIONS_FILE: &str = "connections.json";
pub(crate) const QUERIES_FILE: &str = "saved_queries.json";

// ── Keychain helpers ─────────────────────────────────────────────────────

pub(crate) fn store_password(name: &str, password: &str) -> Result<(), AppError> {
    Entry::new(KEYCHAIN_SERVICE, name)
        .map_err(|e| AppError::Keychain(e.to_string()))?
        .set_password(password)
        .map_err(|e| AppError::Keychain(e.to_string()))
}

pub fn fetch_password(name: &str) -> Result<String, AppError> {
    Entry::new(KEYCHAIN_SERVICE, name)
        .map_err(|e| AppError::Keychain(e.to_string()))?
        .get_password()
        .map_err(|e| AppError::Keychain(e.to_string()))
}

pub(crate) fn remove_password(name: &str) -> Result<(), AppError> {
    Entry::new(KEYCHAIN_SERVICE, name)
        .map_err(|e| AppError::Keychain(e.to_string()))?
        .delete_password()
        .map_err(|e| AppError::Keychain(e.to_string()))
}

// ── Generic JSON store helpers ───────────────────────────────────────────

pub(crate) fn read_json_store<R: Runtime, T: DeserializeOwned>(app: &AppHandle<R>, filename: &str) -> Result<Vec<T>, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(filename);
    if !path.exists() {
        return Ok(vec![]);
    }
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

pub(crate) fn write_json_store<R: Runtime, T: serde::Serialize>(app: &AppHandle<R>, filename: &str, data: &[T]) -> Result<(), String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(filename);
    let content = serde_json::to_string_pretty(data).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())
}

pub(crate) fn upsert<T, F>(items: &mut Vec<T>, item: T, matches: F)
where
    F: Fn(&T) -> bool,
{
    if let Some(existing) = items.iter_mut().find(|i| matches(i)) {
        *existing = item;
    } else {
        items.push(item);
    }
}

// ── Helper used by commands ────────────────────────────────────────────────

pub fn get_connection_with_password<R: Runtime>(
    app: &AppHandle<R>,
    name: &str,
) -> Result<(crate::models::SavedConnection, String), AppError> {
    let conns: Vec<crate::models::SavedConnection> = read_json_store(app, CONNECTIONS_FILE)?;
    let conn = conns
        .into_iter()
        .find(|c| c.name == name)
        .ok_or_else(|| AppError::ConnectionNotFound(name.to_string()))?;
    let password = fetch_password(name)?;
    Ok((conn, password))
}

use tauri::{AppHandle, Runtime, State};
use crate::AppState;
use crate::error::AppError;
use crate::models::SavedConnection;
use super::{
    CONNECTIONS_FILE, read_json_store, write_json_store,
    store_password, remove_password, fetch_password, upsert,
};

#[tauri::command]
pub fn load_connections<R: Runtime>(app: AppHandle<R>) -> Result<Vec<SavedConnection>, AppError> {
    Ok(read_json_store(&app, CONNECTIONS_FILE)?)
}

/// Create a new connection. The password is stored in the OS keychain only,
/// never written to connections.json.
#[tauri::command]
pub fn save_connection<R: Runtime>(
    app: AppHandle<R>,
    connection: SavedConnection,
    password: String,
) -> Result<(), AppError> {
    store_password(&connection.name, &password)?;
    let mut conns: Vec<SavedConnection> = read_json_store(&app, CONNECTIONS_FILE)?;
    let name = connection.name.clone();
    upsert(&mut conns, connection, |c| c.name == name);
    Ok(write_json_store(&app, CONNECTIONS_FILE, &conns)?)
}

/// Edit an existing connection. If `new_password` is provided it replaces the
/// keychain entry. If absent and the name changed, the entry is moved to the
/// new name. If absent and the name is unchanged, the keychain is untouched.
#[tauri::command]
pub fn update_connection<R: Runtime>(
    app: AppHandle<R>,
    old_name: String,
    connection: SavedConnection,
    new_password: Option<String>,
) -> Result<(), AppError> {
    if let Some(pw) = new_password {
        let _ = remove_password(&old_name); // ignore — old entry may not exist
        store_password(&connection.name, &pw)?;
    } else if old_name != connection.name {
        let pw = fetch_password(&old_name)?;
        store_password(&connection.name, &pw)?;
        remove_password(&old_name)?; // propagate — we just fetched from it, it should exist
    }
    let mut conns: Vec<SavedConnection> = read_json_store(&app, CONNECTIONS_FILE)?;
    if let Some(existing) = conns.iter_mut().find(|c| c.name == old_name) {
        *existing = connection;
    }
    Ok(write_json_store(&app, CONNECTIONS_FILE, &conns)?)
}

#[tauri::command]
pub async fn delete_connection<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, AppState>,
    name: String,
) -> Result<(), AppError> {
    let mut conns: Vec<SavedConnection> = read_json_store(&app, CONNECTIONS_FILE)?;
    conns.retain(|c| c.name != name);
    let _ = remove_password(&name); // best-effort — don't fail the delete
    write_json_store(&app, CONNECTIONS_FILE, &conns)?;
    let mut db = state.db.lock().await;
    db.remove(&name);
    let prefix = format!("{name}::");
    db.retain(|k, _| !k.starts_with(&prefix));
    Ok(())
}

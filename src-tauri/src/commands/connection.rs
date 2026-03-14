use std::time::Duration;
use tauri::State;
use tokio::time::timeout;
use crate::db::DbConnection;
use crate::error::AppError;
use crate::AppState;
use crate::storage::get_connection_with_password;

#[tauri::command]
pub async fn disconnect(state: State<'_, AppState>, name: String) -> Result<(), AppError> {
    let mut db = state.db.lock().await;
    db.remove(&name);
    let prefix = format!("{name}::");
    db.retain(|k, _| !k.starts_with(&prefix));
    Ok(())
}

#[tauri::command]
pub async fn disconnect_database(
    state: State<'_, AppState>,
    connection: String,
    database: String,
) -> Result<(), AppError> {
    let mut db = state.db.lock().await;
    db.remove(&format!("{connection}::{database}"));
    Ok(())
}

#[tauri::command]
pub async fn connect_database<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    state: State<'_, AppState>,
    connection: String,
    database: String,
) -> Result<(), AppError> {
    let (conn, password) = get_connection_with_password(&app, &connection)?;
    let db_conn =
        DbConnection::connect(&conn.db_type, &conn.host, conn.port, &database, &conn.username, &password).await?;
    let mut db = state.db.lock().await;
    db.insert(format!("{connection}::{database}"), db_conn);
    Ok(())
}

#[tauri::command]
pub async fn connect_saved<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    state: State<'_, AppState>,
    name: String,
) -> Result<(), AppError> {
    let (conn, password) = get_connection_with_password(&app, &name)?;
    let db_conn =
        DbConnection::connect(&conn.db_type, &conn.host, conn.port, &conn.database, &conn.username, &password).await?;
    let mut db = state.db.lock().await;
    db.insert(name, db_conn);
    Ok(())
}

#[tauri::command]
pub async fn test_connection(
    db_type: String,
    host: String,
    port: u16,
    database: String,
    username: String,
    password: Option<String>,
    saved_name: Option<String>,
) -> Result<(), AppError> {
    const CONNECT_TIMEOUT: Duration = Duration::from_secs(5);

    let pw = match (password, saved_name) {
        (Some(p), _) => p,
        (None, Some(name)) => crate::storage::fetch_password(&name)?,
        (None, None) => return Err(AppError::Io("No password provided".to_string())),
    };

    let result = timeout(
        CONNECT_TIMEOUT,
        DbConnection::connect(&db_type, &host, port, &database, &username, &pw),
    )
    .await;

    match result {
        Ok(Ok(_)) => Ok(()),
        Ok(Err(e)) => Err(AppError::Database(e)),
        Err(_) => Err(AppError::Io("Connection timed out. Check the host and port.".to_string())),
    }
}

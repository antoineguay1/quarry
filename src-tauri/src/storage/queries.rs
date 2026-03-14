use keyring::Entry;
use tauri::{AppHandle, Runtime};
use crate::error::AppError;
use crate::models::SavedQuery;
use super::{QUERIES_FILE, KEYCHAIN_SERVICE, read_json_store, write_json_store, upsert, store_password, remove_password};

const AI_KEY_USER: &str = "__ai_key__";

#[tauri::command]
pub fn load_saved_queries<R: Runtime>(app: AppHandle<R>) -> Result<Vec<SavedQuery>, AppError> {
    Ok(read_json_store(&app, QUERIES_FILE)?)
}

#[tauri::command]
pub fn save_query<R: Runtime>(app: AppHandle<R>, query: SavedQuery) -> Result<(), AppError> {
    let mut queries: Vec<SavedQuery> = read_json_store(&app, QUERIES_FILE)?;
    let id = query.id.clone();
    upsert(&mut queries, query, |q| q.id == id);
    Ok(write_json_store(&app, QUERIES_FILE, &queries)?)
}

#[tauri::command]
pub fn delete_saved_query<R: Runtime>(app: AppHandle<R>, id: String) -> Result<(), AppError> {
    let mut queries: Vec<SavedQuery> = read_json_store(&app, QUERIES_FILE)?;
    queries.retain(|q| q.id != id);
    Ok(write_json_store(&app, QUERIES_FILE, &queries)?)
}

#[tauri::command]
pub fn save_ai_key(key: String) -> Result<(), AppError> {
    store_password(AI_KEY_USER, &key)
}

#[tauri::command]
pub fn get_ai_key() -> Result<Option<String>, AppError> {
    match Entry::new(KEYCHAIN_SERVICE, AI_KEY_USER)
        .map_err(|e| AppError::Keychain(e.to_string()))?
        .get_password()
    {
        Ok(k) => Ok(Some(k)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(AppError::Keychain(e.to_string())),
    }
}

#[tauri::command]
pub fn delete_ai_key() -> Result<(), AppError> {
    remove_password(AI_KEY_USER)
}

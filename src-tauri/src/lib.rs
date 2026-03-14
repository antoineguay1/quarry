mod ai;
mod commands;
mod db;
mod error;
mod models;
mod storage;
#[cfg(test)]
mod tests;

use std::collections::HashMap;
use tokio::sync::Mutex;
use crate::db::DbConnection;

pub struct AppState {
    pub db: Mutex<HashMap<String, DbConnection>>,
}

impl AppState {
    pub async fn get_conn(
        &self,
        connection: &str,
        database: Option<&str>,
    ) -> Result<(tokio::sync::MutexGuard<'_, HashMap<String, DbConnection>>, String), String> {
        let key = match database {
            Some(db) => format!("{connection}::{db}"),
            None => connection.to_string(),
        };
        let guard = self.db.lock().await;
        if !guard.contains_key(&key) {
            return Err(format!("Not connected to '{key}'"));
        }
        Ok((guard, key))
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(AppState { db: Mutex::new(HashMap::new()) })
        .invoke_handler(tauri::generate_handler![
            commands::connection::connect_saved,
            commands::connection::connect_database,
            commands::connection::disconnect,
            commands::connection::disconnect_database,
            commands::connection::test_connection,
            commands::query::list_databases,
            commands::query::list_tables,
            commands::query::get_table_data,
            commands::query::count_rows,
            commands::query::get_table_columns,
            commands::query::get_column_keys,
            commands::query::get_schema,
            commands::query::execute_query,
            commands::query::execute_ddl,
            commands::query::delete_rows,
            commands::query::insert_row,
            commands::query::submit_table_changes,
            storage::connections::load_connections,
            storage::connections::save_connection,
            storage::connections::update_connection,
            storage::connections::delete_connection,
            storage::queries::load_saved_queries,
            storage::queries::save_query,
            storage::queries::delete_saved_query,
            storage::queries::save_ai_key,
            storage::queries::get_ai_key,
            storage::queries::delete_ai_key,
            ai::list_ai_models,
            ai::call_ai,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

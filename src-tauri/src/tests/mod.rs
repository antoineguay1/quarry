mod ai;
mod connection;
mod connections;
mod db_mod;
mod error;
mod filter;
mod models;
mod mysql;
mod mysql_integration;
mod postgres;
mod postgres_integration;
mod push_conditions;
mod queries_storage;
mod query;
mod query_commands;
mod storage;

/// Shared file-system lock for all tests that read/write `connections.json`.
/// Each test module that accesses that file should grab this lock, preventing
/// concurrent tests from racing on the same on-disk file.
pub(super) static CONNECTIONS_FILE_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

pub(super) fn lock_connections_file() -> std::sync::MutexGuard<'static, ()> {
    CONNECTIONS_FILE_LOCK.lock().unwrap_or_else(|e| e.into_inner())
}

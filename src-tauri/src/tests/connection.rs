use std::collections::HashMap;
use tokio::sync::Mutex;

use tauri::Manager;

use crate::commands::connection::{connect_database, connect_saved, disconnect, disconnect_database, test_connection};
use crate::db::DbConnection;
use crate::error::AppError;
use crate::AppState;

// ── helpers ───────────────────────────────────────────────────────────────────

/// Create a lazy PgPool-backed DbConnection that never actually dials the server.
/// sqlx defers all network activity until the first query, so this is safe to
/// use as a stand-in value in AppState tests.
fn lazy_pg() -> DbConnection {
    use sqlx::postgres::PgPool;
    DbConnection::Postgres(PgPool::connect_lazy("postgres://user:pass@localhost/db").unwrap())
}

fn build_app(state: AppState) -> tauri::App<tauri::test::MockRuntime> {
    tauri::test::mock_builder()
        .manage(state)
        .build(tauri::test::mock_context(tauri::test::noop_assets()))
        .expect("failed to build test app")
}

// ── test_connection ───────────────────────────────────────────────────────────

/// (None, None) → early return with Io error; no DB contact needed.
#[tokio::test]
async fn test_connection_no_password_and_no_saved_name_returns_io_error() {
    let result = test_connection(
        "postgres".to_string(),
        "localhost".to_string(),
        5432,
        "testdb".to_string(),
        "user".to_string(),
        None, // password
        None, // saved_name
    )
    .await;

    match result {
        Err(AppError::Io(msg)) => assert!(msg.contains("No password")),
        other => panic!("expected Err(AppError::Io), got {other:?}"),
    }
}

/// (Some(pw), _) with an unsupported db_type → DbConnection::connect returns
/// Err immediately → mapped to AppError::Database. No real server needed.
#[tokio::test]
async fn test_connection_unsupported_db_type_returns_database_error() {
    let result = test_connection(
        "unsupported".to_string(),
        "localhost".to_string(),
        5432,
        "testdb".to_string(),
        "user".to_string(),
        Some("secret".to_string()), // password takes the Some(p) branch
        None,
    )
    .await;

    match result {
        Err(AppError::Database(msg)) => assert!(msg.to_lowercase().contains("unsupported")),
        other => panic!("expected Err(AppError::Database), got {other:?}"),
    }
}

/// (None, Some(name)) → fetch_password is called; the keychain entry does not
/// exist in the test environment so it returns a Keychain error.
#[tokio::test]
async fn test_connection_missing_keychain_entry_returns_keychain_error() {
    let result = test_connection(
        "postgres".to_string(),
        "localhost".to_string(),
        5432,
        "testdb".to_string(),
        "user".to_string(),
        None,                                                               // password
        Some("__nonexistent_quarry_test_connection_xyz__".to_string()),    // saved_name
    )
    .await;

    match result {
        Err(AppError::Keychain(_)) => {}
        other => panic!("expected Err(AppError::Keychain), got {other:?}"),
    }
}

// ── disconnect ────────────────────────────────────────────────────────────────

/// Disconnecting a name removes the top-level entry AND every `name::*` entry,
/// while entries for other connections are left untouched.
#[tokio::test]
async fn disconnect_removes_connection_and_all_sub_connections() {
    let mut map: HashMap<String, DbConnection> = HashMap::new();
    map.insert("myconn".to_string(), lazy_pg());
    map.insert("myconn::alpha".to_string(), lazy_pg());
    map.insert("myconn::beta".to_string(), lazy_pg());
    map.insert("other".to_string(), lazy_pg());

    let app = build_app(AppState { db: Mutex::new(map) });

    disconnect(app.state::<AppState>(), "myconn".to_string())
        .await
        .unwrap();

    let state = app.state::<AppState>();
    let db = state.db.lock().await;
    assert!(!db.contains_key("myconn"), "top-level entry should be gone");
    assert!(!db.contains_key("myconn::alpha"), "sub-connection alpha should be gone");
    assert!(!db.contains_key("myconn::beta"), "sub-connection beta should be gone");
    assert!(db.contains_key("other"), "unrelated connection must survive");
}

/// Disconnecting a name that was never registered is a no-op — no panic.
#[tokio::test]
async fn disconnect_nonexistent_connection_is_a_noop() {
    let app = build_app(AppState { db: Mutex::new(HashMap::new()) });

    let result = disconnect(app.state::<AppState>(), "ghost".to_string()).await;
    assert!(result.is_ok());
}

// ── disconnect_database ───────────────────────────────────────────────────────

/// Only the `connection::database` composite key is removed; sibling databases
/// belonging to the same connection remain in the map.
#[tokio::test]
async fn disconnect_database_removes_only_the_requested_db() {
    let mut map: HashMap<String, DbConnection> = HashMap::new();
    map.insert("conn::db1".to_string(), lazy_pg());
    map.insert("conn::db2".to_string(), lazy_pg());

    let app = build_app(AppState { db: Mutex::new(map) });

    disconnect_database(
        app.state::<AppState>(),
        "conn".to_string(),
        "db1".to_string(),
    )
    .await
    .unwrap();

    let state = app.state::<AppState>();
    let db = state.db.lock().await;
    assert!(!db.contains_key("conn::db1"), "db1 should be disconnected");
    assert!(db.contains_key("conn::db2"), "db2 must not be affected");
}

/// Disconnecting a database that is not in the map is a no-op — no panic.
#[tokio::test]
async fn disconnect_database_nonexistent_entry_is_a_noop() {
    let app = build_app(AppState { db: Mutex::new(HashMap::new()) });

    let result = disconnect_database(
        app.state::<AppState>(),
        "conn".to_string(),
        "missing".to_string(),
    )
    .await;
    assert!(result.is_ok());
}

// ── connect_saved ─────────────────────────────────────────────────────────────

/// When the name is not in connections.json, connect_saved fails with ConnectionNotFound.
#[tokio::test]
async fn connect_saved_unknown_name_returns_connection_not_found() {
    let _guard = super::lock_connections_file();
    let app = build_app(AppState { db: Mutex::new(HashMap::new()) });

    let result = connect_saved(
        app.handle().clone(),
        app.state::<AppState>(),
        "__ghost_connect_saved_xyz__".to_string(),
    )
    .await;

    assert!(
        matches!(result, Err(AppError::ConnectionNotFound(_))),
        "expected ConnectionNotFound"
    );
}

// ── connect_database ──────────────────────────────────────────────────────────

/// When the connection name is not in connections.json, connect_database fails with ConnectionNotFound.
#[tokio::test]
async fn connect_database_unknown_name_returns_connection_not_found() {
    let _guard = super::lock_connections_file();
    let app = build_app(AppState { db: Mutex::new(HashMap::new()) });

    let result = connect_database(
        app.handle().clone(),
        app.state::<AppState>(),
        "__ghost_connect_database_xyz__".to_string(),
        "mydb".to_string(),
    )
    .await;

    assert!(
        matches!(result, Err(AppError::ConnectionNotFound(_))),
        "expected ConnectionNotFound"
    );
}

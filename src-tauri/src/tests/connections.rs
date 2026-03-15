use std::collections::HashMap;
use tokio::sync::Mutex as TokioMutex;
use tauri::Manager;

use crate::db::DbConnection;
use crate::models::SavedConnection;
use crate::storage::connections::{delete_connection, load_connections, save_connection, update_connection};
use crate::AppState;

fn lock_file() -> std::sync::MutexGuard<'static, ()> {
    super::lock_connections_file()
}

// ── helpers ───────────────────────────────────────────────────────────────────

fn conn(name: &str) -> SavedConnection {
    SavedConnection {
        name: name.to_string(),
        db_type: "postgres".to_string(),
        host: "localhost".to_string(),
        port: 5432,
        database: "testdb".to_string(),
        username: "testuser".to_string(),
    }
}

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

fn empty_state() -> AppState {
    AppState { db: TokioMutex::new(HashMap::new()) }
}

fn clear_connections_file(app: &tauri::App<tauri::test::MockRuntime>) {
    if let Ok(dir) = app.path().app_data_dir() {
        let _ = std::fs::remove_file(dir.join("connections.json"));
    }
}

/// Remove a keychain entry before a test so a stale entry from a previous run
/// doesn't interfere. Uses the `security` CLI directly because keyring v2's
/// `delete_password` can silently fail on the macOS legacy Keychain in test
/// environments, leaving entries that cause `set_password` to fail.
fn clean_keychain(name: &str) {
    let _ = crate::storage::remove_password(name);
}

// ── load_connections ──────────────────────────────────────────────────────────

/// When no connections.json file exists the command returns an empty list.
#[test]
fn load_connections_returns_empty_without_saved_file() {
    let _guard = lock_file();
    let app = build_app(empty_state());
    clear_connections_file(&app);

    let conns = load_connections(app.handle().clone()).unwrap();
    assert!(conns.is_empty());
}

// ── save_connection ───────────────────────────────────────────────────────────

/// Saving a connection and reloading it returns the same record.
#[test]
fn save_then_load_returns_the_saved_connection() {
    let _guard = lock_file();
    let name = "__test_conn_save_load__";
    let app = build_app(empty_state());
    clear_connections_file(&app);
    clean_keychain(name);

    save_connection(app.handle().clone(), conn(name), "pw".to_string()).unwrap();

    let conns = load_connections(app.handle().clone()).unwrap();
    let found = conns.iter().find(|c| c.name == name).expect("saved connection should appear");
    assert_eq!(found.host, "localhost");
    assert_eq!(found.port, 5432);

    clear_connections_file(&app);
    clean_keychain(name);
}

/// Saving the same connection name twice upserts (replaces) the entry — no
/// duplicates in the list.
#[test]
fn save_same_name_twice_upserts_not_duplicates() {
    let _guard = lock_file();
    let name = "__test_conn_upsert__";
    let app = build_app(empty_state());
    clear_connections_file(&app);
    clean_keychain(name);

    save_connection(app.handle().clone(), conn(name), "pw1".to_string()).unwrap();

    let mut updated = conn(name);
    updated.host = "remotehost".to_string();
    save_connection(app.handle().clone(), updated, "pw2".to_string()).unwrap();

    let conns = load_connections(app.handle().clone()).unwrap();
    let matches: Vec<_> = conns.iter().filter(|c| c.name == name).collect();
    assert_eq!(matches.len(), 1, "upsert must not create duplicates");
    assert_eq!(matches[0].host, "remotehost");

    clear_connections_file(&app);
    clean_keychain(name);
}

// ── update_connection ─────────────────────────────────────────────────────────

/// When the name is unchanged and no new password is provided, only the
/// non-name fields are updated.
#[test]
fn update_connection_same_name_no_password_updates_fields() {
    let _guard = lock_file();
    let name = "__test_conn_update_same__";
    let app = build_app(empty_state());
    clear_connections_file(&app);
    clean_keychain(name);

    save_connection(app.handle().clone(), conn(name), "pw".to_string()).unwrap();

    let mut updated = conn(name);
    updated.host = "newhost".to_string();
    updated.port = 9999;

    update_connection(
        app.handle().clone(),
        name.to_string(),
        updated,
        None, // same name, no new password → keychain untouched
    )
    .unwrap();

    let conns = load_connections(app.handle().clone()).unwrap();
    let found = conns.iter().find(|c| c.name == name).unwrap();
    assert_eq!(found.host, "newhost");
    assert_eq!(found.port, 9999);

    clear_connections_file(&app);
    clean_keychain(name);
}

/// Providing a new password replaces the keychain entry and updates the record.
#[test]
fn update_connection_with_new_password_succeeds() {
    let _guard = lock_file();
    let name = "__test_conn_update_pw__";
    let app = build_app(empty_state());
    clear_connections_file(&app);
    clean_keychain(name);

    save_connection(app.handle().clone(), conn(name), "oldpw".to_string()).unwrap();

    update_connection(
        app.handle().clone(),
        name.to_string(),
        conn(name),
        Some("newpw".to_string()),
    )
    .unwrap();

    clear_connections_file(&app);
    clean_keychain(name);
}

/// When the name changes the keychain entry is migrated: old name removed,
/// new name added; the JSON list reflects the new name.
#[test]
fn update_connection_name_change_moves_keychain_entry() {
    let _guard = lock_file();
    let old_name = "__test_conn_rename_old__";
    let new_name = "__test_conn_rename_new__";
    let app = build_app(empty_state());
    clear_connections_file(&app);
    clean_keychain(old_name);
    clean_keychain(new_name);

    save_connection(app.handle().clone(), conn(old_name), "pw".to_string()).unwrap();

    let mut renamed = conn(old_name);
    renamed.name = new_name.to_string();

    update_connection(
        app.handle().clone(),
        old_name.to_string(),
        renamed,
        None, // no new password → fetch old entry and move it
    )
    .unwrap();

    let conns = load_connections(app.handle().clone()).unwrap();
    assert!(conns.iter().all(|c| c.name != old_name), "old name must be gone from list");
    assert!(conns.iter().any(|c| c.name == new_name), "new name must appear in list");

    clear_connections_file(&app);
    clean_keychain(old_name);
    clean_keychain(new_name);
}

/// If the old_name does not match any entry in the JSON list, the command
/// still completes without error (the non-found branch is a silent no-op).
#[test]
fn update_connection_nonexistent_name_is_noop() {
    let _guard = lock_file();
    let app = build_app(empty_state());
    clear_connections_file(&app);
    // Pre-clean so store_password doesn't fail with "already exists".
    clean_keychain("ghost");

    // Providing a password avoids calling fetch_password on a missing keychain
    // entry; the remove+store in the Some(pw) branch is exercised instead.
    update_connection(
        app.handle().clone(),
        "ghost".to_string(),
        conn("ghost"),
        Some("pw".to_string()),
    )
    .unwrap();

    // The connection list remains empty (no entry matched old_name).
    let conns = load_connections(app.handle().clone()).unwrap();
    assert!(conns.iter().all(|c| c.name != "ghost"));

    clean_keychain("ghost");
}

// ── delete_connection ─────────────────────────────────────────────────────────

/// Deleting a saved connection removes it from the JSON list.
#[tokio::test]
async fn delete_connection_removes_entry_from_list() {
    let _guard = lock_file();
    let name = "__test_conn_delete__";
    let app = build_app(empty_state());
    clear_connections_file(&app);
    clean_keychain(name);

    save_connection(app.handle().clone(), conn(name), "pw".to_string()).unwrap();

    let state = app.state::<AppState>();
    delete_connection(app.handle().clone(), state, name.to_string())
        .await
        .unwrap();

    let conns = load_connections(app.handle().clone()).unwrap();
    assert!(conns.iter().all(|c| c.name != name));
}

/// Deleting a connection also removes its top-level and `name::*` sub-entries
/// from the in-memory AppState pool map.
#[tokio::test]
async fn delete_connection_clears_app_state_entries() {
    let _guard = lock_file();
    let name = "__test_conn_delete_state__";
    let mut map = HashMap::new();
    map.insert(name.to_string(), lazy_pg());
    map.insert(format!("{name}::alpha"), lazy_pg());
    map.insert(format!("{name}::beta"), lazy_pg());
    map.insert("other_conn".to_string(), lazy_pg());

    let app = build_app(AppState { db: TokioMutex::new(map) });
    clear_connections_file(&app);
    clean_keychain(name);

    // Optionally save so the JSON entry exists (delete_connection works either way).
    let _ = save_connection(app.handle().clone(), conn(name), "pw".to_string());

    let state = app.state::<AppState>();
    delete_connection(app.handle().clone(), state.clone(), name.to_string())
        .await
        .unwrap();

    let db = state.db.lock().await;
    assert!(!db.contains_key(name), "top-level pool must be gone");
    assert!(!db.contains_key(&format!("{name}::alpha")), "sub-pool alpha must be gone");
    assert!(!db.contains_key(&format!("{name}::beta")), "sub-pool beta must be gone");
    assert!(db.contains_key("other_conn"), "unrelated connection must survive");
}

/// Deleting a name that was never saved completes without error.
#[tokio::test]
async fn delete_connection_nonexistent_is_noop() {
    let _guard = lock_file();
    let app = build_app(empty_state());
    clear_connections_file(&app);

    let state = app.state::<AppState>();
    delete_connection(app.handle().clone(), state, "ghost_conn".to_string())
        .await
        .unwrap();
}

/// Deleting a connection from a non-empty list leaves the other entries intact.
#[tokio::test]
async fn delete_connection_leaves_other_entries_intact() {
    let _guard = lock_file();
    let keep = "__test_conn_keep__";
    let remove = "__test_conn_remove__";
    let app = build_app(empty_state());
    clear_connections_file(&app);
    clean_keychain(keep);
    clean_keychain(remove);

    save_connection(app.handle().clone(), conn(keep), "pw1".to_string()).unwrap();
    save_connection(app.handle().clone(), conn(remove), "pw2".to_string()).unwrap();

    let state = app.state::<AppState>();
    delete_connection(app.handle().clone(), state.clone(), remove.to_string())
        .await
        .unwrap();

    let conns = load_connections(app.handle().clone()).unwrap();
    assert!(conns.iter().any(|c| c.name == keep), "sibling entry must survive deletion");
    assert!(conns.iter().all(|c| c.name != remove), "deleted entry must be gone");

    delete_connection(app.handle().clone(), state, keep.to_string())
        .await
        .unwrap();
    clear_connections_file(&app);
}

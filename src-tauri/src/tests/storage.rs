use crate::error::AppError;
use crate::models::SavedConnection;
use crate::storage::connections::save_connection;
use crate::storage::{get_connection_with_password, upsert};

fn build_app() -> tauri::App<tauri::test::MockRuntime> {
    tauri::test::mock_builder()
        .build(tauri::test::mock_context(tauri::test::noop_assets()))
        .expect("failed to build test app")
}

fn saved_conn(name: &str) -> SavedConnection {
    SavedConnection {
        name: name.to_string(),
        db_type: "postgres".to_string(),
        host: "localhost".to_string(),
        port: 5432,
        database: "testdb".to_string(),
        username: "testuser".to_string(),
    }
}

fn clean_keychain(name: &str) {
    let _ = std::process::Command::new("security")
        .args(["delete-generic-password", "-s", "quarry", "-a", name])
        .output();
}

#[test]
fn upsert_appends_when_not_found() {
    let mut items: Vec<(String, i32)> = vec![("a".to_string(), 1)];
    upsert(&mut items, ("b".to_string(), 2), |i| i.0 == "b");
    assert_eq!(items.len(), 2);
    assert_eq!(items[1], ("b".to_string(), 2));
}

#[test]
fn upsert_updates_in_place() {
    let mut items: Vec<(String, i32)> = vec![("a".to_string(), 1), ("b".to_string(), 2)];
    upsert(&mut items, ("a".to_string(), 99), |i| i.0 == "a");
    assert_eq!(items.len(), 2);
    assert_eq!(items[0], ("a".to_string(), 99));
    assert_eq!(items[1], ("b".to_string(), 2));
}

#[test]
fn upsert_empty_list() {
    let mut items: Vec<i32> = vec![];
    upsert(&mut items, 42, |i| *i == 42);
    assert_eq!(items, vec![42]);
}

#[test]
fn upsert_only_matching_item_updated() {
    let mut items = vec![
        ("x".to_string(), 1),
        ("y".to_string(), 2),
        ("z".to_string(), 3),
    ];
    upsert(&mut items, ("y".to_string(), 20), |i| i.0 == "y");
    assert_eq!(items[0], ("x".to_string(), 1));
    assert_eq!(items[1], ("y".to_string(), 20));
    assert_eq!(items[2], ("z".to_string(), 3));
}

// ── get_connection_with_password ─────────────────────────────────────────────

/// Looking up a unique name that will never be in the shared connections.json
/// returns ConnectionNotFound without needing to clear the file.
#[test]
fn get_connection_with_password_not_found() {
    let app = build_app();
    let result = get_connection_with_password(app.handle(), "__ghost_gcwp_xyz__");
    assert!(
        matches!(result, Err(AppError::ConnectionNotFound(_))),
        "expected ConnectionNotFound"
    );
}

/// When the connection exists in JSON but the keychain entry is absent,
/// the function returns a Keychain error.
#[test]
fn get_connection_with_password_missing_keychain_entry_returns_keychain_error() {
    // Use the shared connections-file lock so this test runs serially with
    // connections.rs tests that call clear_connections_file.
    let _guard = super::lock_connections_file();
    let name = "__test_storage_gcwp__";
    let app = build_app();
    clean_keychain(name);

    // Upserts into the shared file — safe even if other entries exist.
    save_connection(app.handle().clone(), saved_conn(name), "pw".to_string()).unwrap();
    // Delete the keychain entry so fetch_password fails.
    clean_keychain(name);

    let result = get_connection_with_password(app.handle(), name);
    assert!(
        matches!(result, Err(AppError::Keychain(_))),
        "expected Keychain error"
    );
}

use std::sync::Mutex;
use tauri::Manager;

use crate::models::SavedQuery;
use crate::storage::queries::{delete_ai_key, delete_saved_query, get_ai_key, load_saved_queries, save_ai_key, save_query};

// Serialize all file-based tests so they don't race on the shared app_data_dir.
static FILE_LOCK: Mutex<()> = Mutex::new(());
// Serialize keychain tests to avoid races on the AI key entry.
static KEYCHAIN_LOCK: Mutex<()> = Mutex::new(());

fn clean_ai_keychain() {
    let _ = std::process::Command::new("security")
        .args(["delete-generic-password", "-s", "quarry", "-a", "__ai_key__"])
        .output();
}

fn build_app() -> tauri::App<tauri::test::MockRuntime> {
    tauri::test::mock_builder()
        .build(tauri::test::mock_context(tauri::test::noop_assets()))
        .expect("failed to build test app")
}

fn make_query(id: &str, name: &str, sql: &str) -> SavedQuery {
    SavedQuery {
        id: id.to_string(),
        name: name.to_string(),
        sql: sql.to_string(),
        connection_name: "conn".to_string(),
        database: None,
    }
}

fn clear_queries_file(app: &tauri::App<tauri::test::MockRuntime>) {
    if let Ok(dir) = app.path().app_data_dir() {
        let _ = std::fs::remove_file(dir.join("saved_queries.json"));
    }
}

// ── load_saved_queries ────────────────────────────────────────────────────────

#[test]
fn load_returns_empty_when_file_absent() {
    let _guard = FILE_LOCK.lock().unwrap();
    let app = build_app();
    clear_queries_file(&app);

    let queries = load_saved_queries(app.handle().clone()).unwrap();
    assert!(queries.is_empty());
}

// ── save_query ────────────────────────────────────────────────────────────────

#[test]
fn save_new_query_appends_it() {
    let _guard = FILE_LOCK.lock().unwrap();
    let app = build_app();
    clear_queries_file(&app);

    save_query(app.handle().clone(), make_query("q1", "My Query", "SELECT 1")).unwrap();

    let queries = load_saved_queries(app.handle().clone()).unwrap();
    assert_eq!(queries.len(), 1);
    assert_eq!(queries[0].id, "q1");
    assert_eq!(queries[0].sql, "SELECT 1");

    clear_queries_file(&app);
}

#[test]
fn save_existing_id_updates_in_place() {
    let _guard = FILE_LOCK.lock().unwrap();
    let app = build_app();
    clear_queries_file(&app);

    save_query(app.handle().clone(), make_query("q1", "My Query", "SELECT 1")).unwrap();
    save_query(app.handle().clone(), make_query("q1", "My Query", "SELECT 999")).unwrap();

    let queries = load_saved_queries(app.handle().clone()).unwrap();
    assert_eq!(queries.len(), 1);
    assert_eq!(queries[0].sql, "SELECT 999");

    clear_queries_file(&app);
}

#[test]
fn save_multiple_queries_preserves_order_and_count() {
    let _guard = FILE_LOCK.lock().unwrap();
    let app = build_app();
    clear_queries_file(&app);

    save_query(app.handle().clone(), make_query("q1", "Q1", "SELECT 1")).unwrap();
    save_query(app.handle().clone(), make_query("q2", "Q2", "SELECT 2")).unwrap();
    save_query(app.handle().clone(), make_query("q3", "Q3", "SELECT 3")).unwrap();

    let queries = load_saved_queries(app.handle().clone()).unwrap();
    assert_eq!(queries.len(), 3);
    assert_eq!(queries[0].id, "q1");
    assert_eq!(queries[1].id, "q2");
    assert_eq!(queries[2].id, "q3");

    clear_queries_file(&app);
}

// ── delete_saved_query ────────────────────────────────────────────────────────

#[test]
fn delete_removes_the_matching_query() {
    let _guard = FILE_LOCK.lock().unwrap();
    let app = build_app();
    clear_queries_file(&app);

    save_query(app.handle().clone(), make_query("q1", "Q1", "SELECT 1")).unwrap();
    save_query(app.handle().clone(), make_query("q2", "Q2", "SELECT 2")).unwrap();

    delete_saved_query(app.handle().clone(), "q1".to_string()).unwrap();

    let queries = load_saved_queries(app.handle().clone()).unwrap();
    assert_eq!(queries.len(), 1);
    assert_eq!(queries[0].id, "q2");

    clear_queries_file(&app);
}

#[test]
fn delete_nonexistent_id_is_a_noop() {
    let _guard = FILE_LOCK.lock().unwrap();
    let app = build_app();
    clear_queries_file(&app);

    save_query(app.handle().clone(), make_query("q1", "Q1", "SELECT 1")).unwrap();
    delete_saved_query(app.handle().clone(), "nonexistent".to_string()).unwrap();

    let queries = load_saved_queries(app.handle().clone()).unwrap();
    assert_eq!(queries.len(), 1);
    assert_eq!(queries[0].id, "q1");

    clear_queries_file(&app);
}

// ── AI key (keychain) ────────────────────────────────────────────────────────

#[test]
fn get_ai_key_returns_none_when_not_set() {
    let _guard = KEYCHAIN_LOCK.lock().unwrap_or_else(|e| e.into_inner());
    clean_ai_keychain();

    let result = get_ai_key();
    assert!(matches!(result, Ok(None)), "expected Ok(None), got {result:?}");
}

#[test]
fn save_ai_key_stores_in_keychain_and_get_returns_it() {
    let _guard = KEYCHAIN_LOCK.lock().unwrap_or_else(|e| e.into_inner());
    clean_ai_keychain();

    save_ai_key("test_api_key_xyz".to_string()).unwrap();
    let result = get_ai_key();
    assert!(
        matches!(&result, Ok(Some(s)) if s == "test_api_key_xyz"),
        "expected Ok(Some(\"test_api_key_xyz\")), got {result:?}"
    );

    clean_ai_keychain();
}

#[test]
fn delete_ai_key_removes_entry_from_keychain() {
    let _guard = KEYCHAIN_LOCK.lock().unwrap_or_else(|e| e.into_inner());
    clean_ai_keychain();

    save_ai_key("key_to_delete".to_string()).unwrap();
    delete_ai_key().unwrap();

    let result = get_ai_key();
    assert!(matches!(result, Ok(None)), "expected Ok(None) after delete, got {result:?}");
}

use std::collections::HashMap;
use tokio::sync::Mutex;
use tauri::Manager;

use crate::commands::query::{
    count_rows, delete_rows, execute_ddl, execute_query, get_column_keys, get_schema,
    get_table_columns, get_table_data, insert_row, list_databases, list_tables,
    submit_table_changes,
};
use crate::db::DbConnection;
use crate::error::AppError;
use crate::models::{FilterEntry, SortEntry};
use crate::AppState;

// ── helpers ───────────────────────────────────────────────────────────────────

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

fn state_with(map: HashMap<String, DbConnection>) -> AppState {
    AppState { db: Mutex::new(map) }
}

fn empty_state() -> AppState {
    state_with(HashMap::new())
}

fn state_with_pg(key: &str) -> AppState {
    let mut map = HashMap::new();
    map.insert(key.to_string(), lazy_pg());
    state_with(map)
}

fn make_filter(col: &str, value: &str, col_type: &str) -> FilterEntry {
    FilterEntry {
        col: col.to_string(),
        value: value.to_string(),
        value2: None,
        operator: "eq".to_string(),
        case_sensitive: false,
        col_type: col_type.to_string(),
        exact: false,
        null_filter: None,
    }
}

// Returns true if the error is a real DB error (not ConnectionNotFound).
// With lazy pools, all DB calls fail but the dispatch lines are covered.
fn is_db_error<T>(result: &Result<T, AppError>) -> bool {
    matches!(result, Err(e) if !matches!(e, AppError::ConnectionNotFound(_)))
}

// ── list_databases ────────────────────────────────────────────────────────────

#[tokio::test]
async fn list_databases_conn_not_found() {
    let app = build_app(empty_state());
    let result = list_databases(app.state::<AppState>(), "missing".to_string()).await;
    assert!(result.is_err(), "expected an error for missing connection");
}

#[tokio::test]
async fn list_databases_dispatches_to_db() {
    let app = build_app(state_with_pg("myconn"));
    let result = list_databases(app.state::<AppState>(), "myconn".to_string()).await;
    assert!(is_db_error(&result));
}

// ── list_tables ───────────────────────────────────────────────────────────────

#[tokio::test]
async fn list_tables_conn_not_found() {
    let app = build_app(empty_state());
    let result = list_tables(
        app.state::<AppState>(),
        "missing".to_string(),
        "db".to_string(),
    )
    .await;
    assert!(result.is_err(), "expected an error for missing connection");
}

#[tokio::test]
async fn list_tables_dispatches_to_db() {
    let app = build_app(state_with_pg("myconn::mydb"));
    let result = list_tables(
        app.state::<AppState>(),
        "myconn".to_string(),
        "mydb".to_string(),
    )
    .await;
    assert!(is_db_error(&result));
}

// ── get_table_data ────────────────────────────────────────────────────────────

#[tokio::test]
async fn get_table_data_conn_not_found() {
    let app = build_app(empty_state());
    let result = get_table_data(
        app.state::<AppState>(),
        "missing".to_string(),
        "db".to_string(),
        "table".to_string(),
        vec![],
        vec![],
        10,
        0,
    )
    .await;
    assert!(result.is_err(), "expected an error for missing connection");
}

#[tokio::test]
async fn get_table_data_converts_sort_entries_and_dispatches() {
    let app = build_app(state_with_pg("myconn::mydb"));
    // Both asc and desc branches of `e.dir.eq_ignore_ascii_case("desc")` are exercised.
    let sort = vec![
        SortEntry { col: "id".to_string(), dir: "asc".to_string() },
        SortEntry { col: "name".to_string(), dir: "DESC".to_string() },
    ];
    let result = get_table_data(
        app.state::<AppState>(),
        "myconn".to_string(),
        "mydb".to_string(),
        "mytable".to_string(),
        sort,
        vec![],
        10,
        0,
    )
    .await;
    assert!(is_db_error(&result));
}

// ── count_rows ────────────────────────────────────────────────────────────────

#[tokio::test]
async fn count_rows_conn_not_found() {
    let app = build_app(empty_state());
    let result = count_rows(
        app.state::<AppState>(),
        "missing".to_string(),
        "db".to_string(),
        "table".to_string(),
        vec![],
    )
    .await;
    assert!(result.is_err(), "expected an error for missing connection");
}

#[tokio::test]
async fn count_rows_empty_filters_takes_count_table_rows_branch() {
    let app = build_app(state_with_pg("myconn::mydb"));
    let result = count_rows(
        app.state::<AppState>(),
        "myconn".to_string(),
        "mydb".to_string(),
        "mytable".to_string(),
        vec![], // empty → count_table_rows branch
    )
    .await;
    assert!(is_db_error(&result));
}

#[tokio::test]
async fn count_rows_non_empty_filters_takes_count_filtered_rows_branch() {
    let app = build_app(state_with_pg("myconn::mydb"));
    let result = count_rows(
        app.state::<AppState>(),
        "myconn".to_string(),
        "mydb".to_string(),
        "mytable".to_string(),
        vec![make_filter("id", "1", "number")], // non-empty → count_filtered_rows branch
    )
    .await;
    assert!(is_db_error(&result));
}

// ── get_table_columns ─────────────────────────────────────────────────────────

#[tokio::test]
async fn get_table_columns_conn_not_found() {
    let app = build_app(empty_state());
    let result = get_table_columns(
        app.state::<AppState>(),
        "missing".to_string(),
        "db".to_string(),
        "table".to_string(),
    )
    .await;
    assert!(result.is_err(), "expected an error for missing connection");
}

#[tokio::test]
async fn get_table_columns_dispatches_to_db() {
    let app = build_app(state_with_pg("myconn::mydb"));
    let result = get_table_columns(
        app.state::<AppState>(),
        "myconn".to_string(),
        "mydb".to_string(),
        "mytable".to_string(),
    )
    .await;
    assert!(is_db_error(&result));
}

// ── get_column_keys ───────────────────────────────────────────────────────────

#[tokio::test]
async fn get_column_keys_conn_not_found() {
    let app = build_app(empty_state());
    let result = get_column_keys(
        app.state::<AppState>(),
        "missing".to_string(),
        "db".to_string(),
        "table".to_string(),
    )
    .await;
    assert!(result.is_err(), "expected an error for missing connection");
}

#[tokio::test]
async fn get_column_keys_dispatches_to_db() {
    let app = build_app(state_with_pg("myconn::mydb"));
    let result = get_column_keys(
        app.state::<AppState>(),
        "myconn".to_string(),
        "mydb".to_string(),
        "mytable".to_string(),
    )
    .await;
    assert!(is_db_error(&result));
}

// ── get_schema ────────────────────────────────────────────────────────────────

#[tokio::test]
async fn get_schema_conn_not_found() {
    let app = build_app(empty_state());
    let result = get_schema(
        app.state::<AppState>(),
        "missing".to_string(),
        "db".to_string(),
    )
    .await;
    assert!(result.is_err(), "expected an error for missing connection");
}

#[tokio::test]
async fn get_schema_dispatches_to_db() {
    let app = build_app(state_with_pg("myconn::mydb"));
    let result = get_schema(
        app.state::<AppState>(),
        "myconn".to_string(),
        "mydb".to_string(),
    )
    .await;
    assert!(is_db_error(&result));
}

// ── execute_query ─────────────────────────────────────────────────────────────

#[tokio::test]
async fn execute_query_conn_not_found() {
    let app = build_app(empty_state());
    let result = execute_query(
        app.state::<AppState>(),
        "missing".to_string(),
        None,
        "SELECT 1".to_string(),
    )
    .await;
    assert!(result.is_err(), "expected an error for missing connection");
}

#[tokio::test]
async fn execute_query_none_database_dispatches_to_db() {
    let app = build_app(state_with_pg("myconn"));
    let result = execute_query(
        app.state::<AppState>(),
        "myconn".to_string(),
        None, // None → uses connection name as key
        "SELECT 1".to_string(),
    )
    .await;
    assert!(is_db_error(&result));
}

#[tokio::test]
async fn execute_query_some_database_dispatches_to_db() {
    let app = build_app(state_with_pg("myconn::mydb"));
    let result = execute_query(
        app.state::<AppState>(),
        "myconn".to_string(),
        Some("mydb".to_string()), // Some(db) → composite key
        "SELECT 1".to_string(),
    )
    .await;
    assert!(is_db_error(&result));
}

// ── delete_rows ───────────────────────────────────────────────────────────────

#[tokio::test]
async fn delete_rows_conn_not_found() {
    let app = build_app(empty_state());
    let result = delete_rows(
        app.state::<AppState>(),
        "missing".to_string(),
        "db".to_string(),
        "table".to_string(),
        "id".to_string(),
        vec!["1".to_string()],
    )
    .await;
    assert!(result.is_err(), "expected an error for missing connection");
}

#[tokio::test]
async fn delete_rows_dispatches_to_db() {
    let app = build_app(state_with_pg("myconn::mydb"));
    let result = delete_rows(
        app.state::<AppState>(),
        "myconn".to_string(),
        "mydb".to_string(),
        "mytable".to_string(),
        "id".to_string(),
        vec!["1".to_string()],
    )
    .await;
    assert!(is_db_error(&result));
}

// ── insert_row ────────────────────────────────────────────────────────────────

#[tokio::test]
async fn insert_row_conn_not_found() {
    let app = build_app(empty_state());
    let result = insert_row(
        app.state::<AppState>(),
        "missing".to_string(),
        "db".to_string(),
        "table".to_string(),
        vec![],
    )
    .await;
    assert!(result.is_err(), "expected an error for missing connection");
}

#[tokio::test]
async fn insert_row_dispatches_to_db() {
    let app = build_app(state_with_pg("myconn::mydb"));
    let result = insert_row(
        app.state::<AppState>(),
        "myconn".to_string(),
        "mydb".to_string(),
        "mytable".to_string(),
        vec![],
    )
    .await;
    assert!(is_db_error(&result));
}

// ── submit_table_changes ──────────────────────────────────────────────────────

#[tokio::test]
async fn submit_table_changes_conn_not_found() {
    let app = build_app(empty_state());
    let result = submit_table_changes(
        app.state::<AppState>(),
        "missing".to_string(),
        "db".to_string(),
        "table".to_string(),
        None,
        vec![],
        vec![],
        vec![],
    )
    .await;
    assert!(result.is_err(), "expected an error for missing connection");
}

#[tokio::test]
async fn submit_table_changes_dispatches_to_db() {
    let app = build_app(state_with_pg("myconn::mydb"));
    let result = submit_table_changes(
        app.state::<AppState>(),
        "myconn".to_string(),
        "mydb".to_string(),
        "mytable".to_string(),
        None,
        vec![],
        vec![],
        vec![],
    )
    .await;
    assert!(is_db_error(&result));
}

// ── execute_ddl ───────────────────────────────────────────────────────────────

/// None database → key = "{connection}", not in empty state → ConnectionNotFound.
/// Covers the `None => connection.clone()` branch in key formation.
#[tokio::test]
async fn execute_ddl_none_database_key_format_and_not_found() {
    let app = build_app(empty_state());
    let result = execute_ddl(
        app.handle().clone(),
        app.state::<AppState>(),
        "missing".to_string(),
        None,
        "ALTER TABLE t ADD COLUMN x INT".to_string(),
    )
    .await;
    assert!(result.is_err(), "expected an error for missing connection");
}

/// Some(database) → key = "{connection}::{database}", not in empty state → ConnectionNotFound.
/// Covers the `Some(db) => format!(...)` branch in key formation.
#[tokio::test]
async fn execute_ddl_some_database_key_format_and_not_found() {
    let app = build_app(empty_state());
    let result = execute_ddl(
        app.handle().clone(),
        app.state::<AppState>(),
        "myconn".to_string(),
        Some("mydb".to_string()),
        "ALTER TABLE t ADD COLUMN x INT".to_string(),
    )
    .await;
    assert!(result.is_err(), "expected an error for missing connection");
}

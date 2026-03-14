use tauri::State;
use crate::models::{ColumnInfo, ColumnKeyInfo, ColumnValue, FilterEntry, QueryResult, RowUpdate, SortEntry, SubmitResult, TableSchema};
use crate::error::AppError;
use crate::AppState;

#[tauri::command]
pub async fn list_databases(
    state: State<'_, AppState>,
    connection: String,
) -> Result<Vec<String>, AppError> {
    let (db, key) = state.get_conn(&connection, None).await?;
    db[&key].list_databases().await.map_err(AppError::from)
}

#[tauri::command]
pub async fn list_tables(
    state: State<'_, AppState>,
    connection: String,
    database: String,
) -> Result<Vec<String>, AppError> {
    let (db, key) = state.get_conn(&connection, Some(&database)).await?;
    db[&key].list_tables_for_db(&database).await.map_err(AppError::from)
}

#[tauri::command]
pub async fn get_table_data(
    state: State<'_, AppState>,
    connection: String,
    database: String,
    table: String,
    sort_entries: Vec<SortEntry>,
    filter_entries: Vec<FilterEntry>,
    limit: i64,
    offset: i64,
) -> Result<QueryResult, AppError> {
    let (db, key) = state.get_conn(&connection, Some(&database)).await?;
    let entries: Vec<(String, bool)> = sort_entries
        .into_iter()
        .map(|e| (e.col, e.dir.eq_ignore_ascii_case("desc")))
        .collect();
    db[&key].get_table_data(&table, &entries, &filter_entries, limit, offset).await.map_err(AppError::from)
}

#[tauri::command]
pub async fn count_rows(
    state: State<'_, AppState>,
    connection: String,
    database: String,
    table: String,
    filter_entries: Vec<FilterEntry>,
) -> Result<i64, AppError> {
    let (db, key) = state.get_conn(&connection, Some(&database)).await?;
    if filter_entries.is_empty() {
        db[&key].count_table_rows(&table).await.map_err(AppError::from)
    } else {
        db[&key].count_filtered_rows(&table, &filter_entries).await.map_err(AppError::from)
    }
}

#[tauri::command]
pub async fn get_table_columns(
    state: State<'_, AppState>,
    connection: String,
    database: String,
    table: String,
) -> Result<Vec<ColumnInfo>, AppError> {
    let (db, key) = state.get_conn(&connection, Some(&database)).await?;
    db[&key].get_table_columns(&table).await.map_err(AppError::from)
}

#[tauri::command]
pub async fn get_column_keys(
    state: State<'_, AppState>,
    connection: String,
    database: String,
    table: String,
) -> Result<Vec<ColumnKeyInfo>, AppError> {
    let (db, key) = state.get_conn(&connection, Some(&database)).await?;
    db[&key].get_column_keys(&table).await.map_err(AppError::from)
}

#[tauri::command]
pub async fn get_schema(
    state: State<'_, AppState>,
    connection: String,
    database: String,
) -> Result<Vec<TableSchema>, AppError> {
    let (db, key) = state.get_conn(&connection, Some(&database)).await?;
    db[&key].get_schema(&database).await.map_err(AppError::from)
}

#[tauri::command]
pub async fn execute_query(
    state: State<'_, AppState>,
    connection: String,
    database: Option<String>,
    sql: String,
) -> Result<QueryResult, AppError> {
    let (db, key) = state.get_conn(&connection, database.as_deref()).await?;
    let start = std::time::Instant::now();
    let mut result = db[&key].execute_query(&sql).await.map_err(AppError::from)?;
    result.execution_time_ms = start.elapsed().as_millis() as u64;
    Ok(result)
}

#[tauri::command]
pub async fn delete_rows(
    state: State<'_, AppState>,
    connection: String,
    database: String,
    table: String,
    pk_column: String,
    pk_values: Vec<String>,
) -> Result<u64, AppError> {
    let (db, key) = state.get_conn(&connection, Some(&database)).await?;
    db[&key].delete_rows(&table, &pk_column, &pk_values).await.map_err(AppError::from)
}

#[tauri::command]
pub async fn insert_row(
    state: State<'_, AppState>,
    connection: String,
    database: String,
    table: String,
    values: Vec<ColumnValue>,
) -> Result<(), AppError> {
    let (db, key) = state.get_conn(&connection, Some(&database)).await?;
    db[&key].insert_row(&table, &values).await.map_err(AppError::from)
}

#[tauri::command]
pub async fn submit_table_changes(
    state: State<'_, AppState>,
    connection: String,
    database: String,
    table: String,
    pk_column: Option<String>,
    deletes: Vec<String>,
    updates: Vec<RowUpdate>,
    inserts: Vec<Vec<ColumnValue>>,
) -> Result<SubmitResult, AppError> {
    let (db, key) = state.get_conn(&connection, Some(&database)).await?;
    db[&key].submit_changes(&table, pk_column.as_deref(), &deletes, &updates, &inserts).await.map_err(AppError::from)
}

#[tauri::command]
pub async fn execute_ddl<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    state: State<'_, AppState>,
    connection: String,
    database: Option<String>,
    sql: String,
) -> Result<(), AppError> {
    let key = match &database {
        Some(db) => format!("{connection}::{db}"),
        None => connection.clone(),
    };

    // Execute DDL, then drop the guard so we can reconnect below.
    {
        let guard = state.db.lock().await;
        let conn = guard.get(&key).ok_or_else(|| AppError::ConnectionNotFound(key.clone()))?;
        conn.execute_query(&sql).await.map_err(AppError::from)?;
    }

    // After any DDL that targets a specific database, replace the pool with a fresh one.
    // This clears PostgreSQL's prepared-statement cache, which would otherwise return
    // "cached plan must not change result type" after ALTER TABLE ADD/DROP COLUMN.
    if let Some(db_name) = &database {
        let (saved_conn, password) = crate::storage::get_connection_with_password(&app, &connection)?;
        let new_conn = crate::db::DbConnection::connect(
            &saved_conn.db_type, &saved_conn.host, saved_conn.port,
            db_name, &saved_conn.username, &password,
        ).await.map_err(AppError::from)?;
        state.db.lock().await.insert(key, new_conn);
    }

    Ok(())
}

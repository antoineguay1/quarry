use testcontainers::runners::AsyncRunner;
use testcontainers_modules::mysql::Mysql;

use crate::db::DbConnection;
use crate::models::{ColumnValue, FilterEntry};

// ── helpers ───────────────────────────────────────────────────────────────────

async fn start_mysql() -> (DbConnection, testcontainers::ContainerAsync<Mysql>) {
    let container = Mysql::default()
        .start()
        .await
        .expect("failed to start mysql container");

    let port = container.get_host_port_ipv4(3306).await.unwrap();
    // testcontainers-modules Mysql uses MYSQL_ALLOW_EMPTY_PASSWORD=yes with no
    // extra user, so connect as root with empty password to the "test" database.
    let url = format!("mysql://root@127.0.0.1:{port}/test");

    let opts: sqlx::mysql::MySqlConnectOptions = url.parse().unwrap();
    let pool = sqlx::mysql::MySqlPool::connect_with(opts)
        .await
        .expect("failed to connect to mysql");

    (DbConnection::Mysql(pool), container)
}

fn eq_filter(col: &str, value: &str, col_type: &str) -> FilterEntry {
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

// ── list_databases ────────────────────────────────────────────────────────────

#[tokio::test]
async fn mysql_list_databases() {
    let (conn, _c) = start_mysql().await;
    let dbs = conn.list_databases().await.unwrap();
    assert!(!dbs.is_empty());
}

// ── list_tables_for_db ────────────────────────────────────────────────────────

#[tokio::test]
async fn mysql_list_tables_for_db() {
    let (conn, _c) = start_mysql().await;
    conn.execute_query(
        "CREATE TABLE _list_tables_test (id INT AUTO_INCREMENT PRIMARY KEY)",
    )
    .await
    .unwrap();

    let tables = conn.list_tables_for_db("test").await.unwrap();
    assert!(tables.iter().any(|t| t == "_list_tables_test"));
}

// ── get_table_columns ─────────────────────────────────────────────────────────

#[tokio::test]
async fn mysql_get_table_columns() {
    let (conn, _c) = start_mysql().await;
    conn.execute_query(
        "CREATE TABLE _col_test (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255) NOT NULL, score FLOAT)",
    )
    .await
    .unwrap();

    let cols = conn.get_table_columns("_col_test").await.unwrap();
    assert!(cols.iter().any(|c| c.name == "id"));
    assert!(cols.iter().any(|c| c.name == "name"));
    assert!(cols.iter().any(|c| c.name == "score"));
}

// ── get_column_keys ───────────────────────────────────────────────────────────

#[tokio::test]
async fn mysql_get_column_keys() {
    let (conn, _c) = start_mysql().await;
    conn.execute_query(
        "CREATE TABLE _keys_parent (id INT AUTO_INCREMENT PRIMARY KEY)",
    )
    .await
    .unwrap();
    conn.execute_query(
        "CREATE TABLE _keys_child (
            id INT AUTO_INCREMENT PRIMARY KEY,
            parent_id INT,
            FOREIGN KEY (parent_id) REFERENCES _keys_parent(id)
        )",
    )
    .await
    .unwrap();

    let keys = conn.get_column_keys("_keys_child").await.unwrap();
    let pk = keys.iter().find(|k| k.column_name == "id").unwrap();
    assert!(pk.is_primary);
    let fk = keys.iter().find(|k| k.column_name == "parent_id").unwrap();
    assert_eq!(fk.fk_ref_table.as_deref(), Some("_keys_parent"));
}

// ── get_schema ────────────────────────────────────────────────────────────────

#[tokio::test]
async fn mysql_get_schema() {
    let (conn, _c) = start_mysql().await;
    conn.execute_query("CREATE TABLE _schema_test (id INT, name VARCHAR(255))")
        .await
        .unwrap();

    let schema = conn.get_schema("test").await.unwrap();
    assert!(schema.iter().any(|t| t.table_name == "_schema_test"));
}

// ── execute_query (SELECT + DML) ──────────────────────────────────────────────

#[tokio::test]
async fn mysql_run_select_query() {
    let (conn, _c) = start_mysql().await;
    let result = conn
        .execute_query("SELECT 1 AS num, 'hello' AS greeting, TRUE AS flag")
        .await
        .unwrap();

    assert_eq!(result.row_count, 1);
    assert!(result.columns.contains(&"num".to_string()));
}

#[tokio::test]
async fn mysql_run_dml_query() {
    let (conn, _c) = start_mysql().await;
    conn.execute_query(
        "CREATE TABLE _dml_test (id INT AUTO_INCREMENT PRIMARY KEY, val VARCHAR(255))",
    )
    .await
    .unwrap();

    // DML executes without error; row_count reflects affected rows
    conn.execute_query("INSERT INTO _dml_test (val) VALUES ('x')")
        .await
        .unwrap();
}

// ── get_table_data with filter ────────────────────────────────────────────────

#[tokio::test]
async fn mysql_get_table_data_with_filter() {
    let (conn, _c) = start_mysql().await;
    conn.execute_query(
        "CREATE TABLE _data_test (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255))",
    )
    .await
    .unwrap();
    conn.execute_query(
        "INSERT INTO _data_test (name) VALUES ('alice'), ('bob'), ('alice')",
    )
    .await
    .unwrap();

    let filter = eq_filter("name", "alice", "text");
    let result = conn
        .get_table_data("_data_test", &[], &[filter], 10, 0)
        .await
        .unwrap();
    assert_eq!(result.row_count, 2);
}

// ── count_table_rows / count_filtered_rows ────────────────────────────────────

#[tokio::test]
async fn mysql_count_rows() {
    let (conn, _c) = start_mysql().await;
    conn.execute_query(
        "CREATE TABLE _count_test (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255))",
    )
    .await
    .unwrap();
    conn.execute_query(
        "INSERT INTO _count_test (name) VALUES ('a'), ('b'), ('a')",
    )
    .await
    .unwrap();

    let total = conn.count_table_rows("_count_test").await.unwrap();
    assert_eq!(total, 3);

    let filter = eq_filter("name", "a", "text");
    let filtered = conn
        .count_filtered_rows("_count_test", &[filter])
        .await
        .unwrap();
    assert_eq!(filtered, 2);
}

// ── delete_rows / insert_row ──────────────────────────────────────────────────

#[tokio::test]
async fn mysql_insert_and_delete_rows() {
    let (conn, _c) = start_mysql().await;
    conn.execute_query(
        "CREATE TABLE _mut_test (id INT AUTO_INCREMENT PRIMARY KEY, val VARCHAR(255))",
    )
    .await
    .unwrap();

    let values = vec![ColumnValue { column: "val".to_string(), value: Some("hello".to_string()) }];
    conn.insert_row("_mut_test", &values).await.unwrap();

    let data = conn.get_table_data("_mut_test", &[], &[], 10, 0).await.unwrap();
    assert_eq!(data.row_count, 1);

    let id_idx = data.columns.iter().position(|c| c == "id").unwrap();
    let id_val = data.rows[0][id_idx].to_string();

    conn.delete_rows("_mut_test", "id", &[id_val]).await.unwrap();
    assert_eq!(conn.count_table_rows("_mut_test").await.unwrap(), 0);
}

// ── submit_changes ────────────────────────────────────────────────────────────

#[tokio::test]
async fn mysql_submit_changes() {
    use crate::models::RowUpdate;

    let (conn, _c) = start_mysql().await;
    conn.execute_query(
        "CREATE TABLE _submit_test (id INT AUTO_INCREMENT PRIMARY KEY, val VARCHAR(255))",
    )
    .await
    .unwrap();
    conn.execute_query("INSERT INTO _submit_test (val) VALUES ('initial')")
        .await
        .unwrap();

    let data = conn.get_table_data("_submit_test", &[], &[], 10, 0).await.unwrap();
    let id_idx = data.columns.iter().position(|c| c == "id").unwrap();
    let id_val = data.rows[0][id_idx].to_string();

    let update = RowUpdate {
        pk_value: id_val,
        values: vec![ColumnValue { column: "val".to_string(), value: Some("updated".to_string()) }],
    };
    let insert = vec![ColumnValue { column: "val".to_string(), value: Some("new_row".to_string()) }];

    let result = conn
        .submit_changes("_submit_test", Some("id"), &[], &[update], &[insert])
        .await
        .unwrap();

    assert_eq!(result.updated_count, 1);
    assert_eq!(result.inserted_count, 1);
    assert_eq!(conn.count_table_rows("_submit_test").await.unwrap(), 2);
}

use crate::db::{is_select_query, DbConnection};
use crate::models::FilterEntry;

#[test]
fn select_statements() {
    assert!(is_select_query("SELECT * FROM users"));
    assert!(is_select_query("select * from t"));
    assert!(is_select_query("  SELECT id FROM t"));
    assert!(is_select_query("Select * from t"));
}

#[test]
fn with_statement() {
    assert!(is_select_query("WITH cte AS (SELECT 1) SELECT * FROM cte"));
}

#[test]
fn table_values_show_describe_explain() {
    assert!(is_select_query("TABLE users"));
    assert!(is_select_query("VALUES (1, 2)"));
    assert!(is_select_query("SHOW TABLES"));
    assert!(is_select_query("DESCRIBE users"));
    assert!(is_select_query("EXPLAIN SELECT * FROM users"));
}

#[test]
fn mutating_statements_are_false() {
    assert!(!is_select_query("INSERT INTO t VALUES (1)"));
    assert!(!is_select_query("UPDATE t SET x = 1"));
    assert!(!is_select_query("DELETE FROM t"));
    assert!(!is_select_query("CREATE TABLE t (id INT)"));
}

#[test]
fn empty_string_is_false() {
    assert!(!is_select_query(""));
}

// ── DbConnection lazy-pool dispatch ───────────────────────────────────────────

fn lazy_pg() -> DbConnection {
    use sqlx::postgres::PgPool;
    DbConnection::Postgres(PgPool::connect_lazy("postgres://user:pass@localhost/db").unwrap())
}

fn lazy_mysql() -> DbConnection {
    use sqlx::mysql::MySqlPool;
    DbConnection::Mysql(MySqlPool::connect_lazy("mysql://user:pass@localhost/db").unwrap())
}

fn make_filter(col: &str, value: &str) -> FilterEntry {
    FilterEntry {
        col: col.to_string(),
        value: value.to_string(),
        value2: None,
        operator: "eq".to_string(),
        case_sensitive: false,
        col_type: "text".to_string(),
        exact: false,
        null_filter: None,
    }
}

/// connect() with an unsupported db_type returns an Err immediately.
#[tokio::test]
async fn connect_unsupported_type_returns_error() {
    let result = DbConnection::connect("oracle", "localhost", 1521, "db", "user", "pass").await;
    assert!(result.is_err());
    assert!(result.unwrap_err().to_lowercase().contains("unsupported"));
}

/// Call every Postgres dispatch arm with a lazy pool — the pool is never dialled
/// so each call returns a DB error, but all dispatch branches in db/mod.rs are
/// reached and the lines are instrumented.
#[tokio::test]
async fn pg_dispatch_covers_all_postgres_arms() {
    let pg = lazy_pg();
    let filters = vec![make_filter("id", "1")];

    // list_databases
    assert!(pg.list_databases().await.is_err());
    // list_tables_for_db
    assert!(pg.list_tables_for_db("mydb").await.is_err());
    // execute_query
    assert!(pg.execute_query("SELECT 1").await.is_err());
    // get_table_columns
    assert!(pg.get_table_columns("t").await.is_err());
    // get_column_keys
    assert!(pg.get_column_keys("t").await.is_err());
    // count_table_rows
    assert!(pg.count_table_rows("t").await.is_err());
    // count_filtered_rows
    assert!(pg.count_filtered_rows("t", &filters).await.is_err());
    // get_schema
    assert!(pg.get_schema("mydb").await.is_err());
    // delete_rows
    assert!(pg.delete_rows("t", "id", &["1".to_string()]).await.is_err());
    // insert_row
    assert!(pg.insert_row("t", &[]).await.is_err());
    // submit_changes
    assert!(pg.submit_changes("t", Some("id"), &[], &[], &[]).await.is_err());
    // get_table_data
    assert!(pg.get_table_data("t", &[], &[], 10, 0).await.is_err());
}

/// Same for the MySQL dispatch arms.
#[tokio::test]
async fn mysql_dispatch_covers_all_mysql_arms() {
    let mysql = lazy_mysql();
    let filters = vec![make_filter("id", "1")];

    assert!(mysql.list_databases().await.is_err());
    assert!(mysql.list_tables_for_db("mydb").await.is_err());
    assert!(mysql.execute_query("SELECT 1").await.is_err());
    assert!(mysql.get_table_columns("t").await.is_err());
    assert!(mysql.get_column_keys("t").await.is_err());
    assert!(mysql.count_table_rows("t").await.is_err());
    assert!(mysql.count_filtered_rows("t", &filters).await.is_err());
    assert!(mysql.get_schema("mydb").await.is_err());
    assert!(mysql.delete_rows("t", "id", &["1".to_string()]).await.is_err());
    assert!(mysql.insert_row("t", &[]).await.is_err());
    assert!(mysql.submit_changes("t", Some("id"), &[], &[], &[]).await.is_err());
    assert!(mysql.get_table_data("t", &[], &[], 10, 0).await.is_err());
}

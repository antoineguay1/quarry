use std::collections::HashMap;
use sqlx::postgres::PgConnectOptions;
use sqlx::PgPool;
use tokio::sync::Mutex;

use crate::db::DbConnection;
use crate::AppState;

// ── AppState::get_conn ─────────────────────────────────────────────────────────

fn lazy_pg_conn() -> DbConnection {
    let opts = PgConnectOptions::new()
        .host("127.0.0.1")
        .port(5432)
        .database("test")
        .username("user");
    DbConnection::Postgres(PgPool::connect_lazy_with(opts))
}

fn state_with(keys: &[&str]) -> AppState {
    let mut map = HashMap::new();
    for &k in keys {
        map.insert(k.to_string(), lazy_pg_conn());
    }
    AppState { db: Mutex::new(map) }
}

#[tokio::test]
async fn get_conn_no_database_key_is_connection_name() {
    let state = state_with(&["myconn"]);
    let (guard, key) = state.get_conn("myconn", None).await.unwrap();
    assert_eq!(key, "myconn");
    assert!(guard.contains_key(&key));
}

#[tokio::test]
async fn get_conn_with_database_key_uses_double_colon() {
    let state = state_with(&["myconn::mydb"]);
    let (guard, key) = state.get_conn("myconn", Some("mydb")).await.unwrap();
    assert_eq!(key, "myconn::mydb");
    assert!(guard.contains_key(&key));
}

#[tokio::test]
async fn get_conn_not_found_no_database_returns_err() {
    let state = state_with(&[]);
    let result = state.get_conn("ghost", None).await;
    assert!(result.is_err());
    let err = result.err().unwrap();
    assert!(err.contains("ghost"), "error should mention the missing key: {err}");
}

#[tokio::test]
async fn get_conn_not_found_with_database_returns_err() {
    let state = state_with(&[]);
    let result = state.get_conn("myconn", Some("mydb")).await;
    assert!(result.is_err());
    let err = result.err().unwrap();
    assert!(err.contains("myconn::mydb"), "error should mention the compound key: {err}");
}

#[tokio::test]
async fn get_conn_partial_key_not_matched() {
    // "myconn" is registered but "myconn::other" is not
    let state = state_with(&["myconn"]);
    let result = state.get_conn("myconn", Some("other")).await;
    assert!(result.is_err());
    let err = result.err().unwrap();
    assert!(err.contains("myconn::other"));
}

#[tokio::test]
async fn get_conn_multiple_connections_selects_correct_one() {
    let state = state_with(&["conn_a", "conn_b", "conn_a::db1"]);

    let (_, key_a) = state.get_conn("conn_a", None).await.unwrap();
    assert_eq!(key_a, "conn_a");

    let (_, key_b) = state.get_conn("conn_b", None).await.unwrap();
    assert_eq!(key_b, "conn_b");

    let (_, key_db) = state.get_conn("conn_a", Some("db1")).await.unwrap();
    assert_eq!(key_db, "conn_a::db1");
}

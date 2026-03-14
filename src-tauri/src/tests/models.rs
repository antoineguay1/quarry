use serde_json::Value;
use crate::models::{ColumnKeyInfo, FilterEntry, QueryResult, SavedConnection, SavedQuery, SubmitResult};

// ── FilterEntry deserialization ───────────────────────────────────────────────

#[test]
fn filter_entry_minimal_uses_defaults() {
    // operator, exact, null_filter are all optional with defaults
    let json_str = r#"{"col":"age","value":"42","caseSensitive":false,"colType":"number"}"#;
    let f: FilterEntry = serde_json::from_str(json_str).unwrap();
    assert_eq!(f.col, "age");
    assert_eq!(f.value, "42");
    assert_eq!(f.operator, "eq");
    assert!(!f.exact);
    assert!(f.null_filter.is_none());
    assert!(f.value2.is_none());
}

#[test]
fn filter_entry_full_between() {
    let json_str = r#"{
        "col": "score",
        "value": "10",
        "value2": "20",
        "operator": "between",
        "caseSensitive": false,
        "colType": "number",
        "exact": false
    }"#;
    let f: FilterEntry = serde_json::from_str(json_str).unwrap();
    assert_eq!(f.operator, "between");
    assert_eq!(f.value2.as_deref(), Some("20"));
    assert!(!f.exact);
}

#[test]
fn filter_entry_null_filter_is_null() {
    let json_str = r#"{"col":"name","value":"","caseSensitive":false,"colType":"text","nullFilter":"is_null"}"#;
    let f: FilterEntry = serde_json::from_str(json_str).unwrap();
    assert_eq!(f.null_filter.as_deref(), Some("is_null"));
}

#[test]
fn filter_entry_null_filter_is_not_null() {
    let json_str = r#"{"col":"name","value":"","caseSensitive":false,"colType":"text","nullFilter":"is_not_null"}"#;
    let f: FilterEntry = serde_json::from_str(json_str).unwrap();
    assert_eq!(f.null_filter.as_deref(), Some("is_not_null"));
}

// ── SavedQuery round-trip ─────────────────────────────────────────────────────

#[test]
fn saved_query_round_trip_with_database() {
    let q = SavedQuery {
        id: "abc123".to_string(),
        name: "My Query".to_string(),
        sql: "SELECT 1".to_string(),
        connection_name: "local".to_string(),
        database: Some("mydb".to_string()),
    };
    let v = serde_json::to_value(&q).unwrap();
    // camelCase keys
    assert_eq!(v["id"], "abc123");
    assert_eq!(v["name"], "My Query");
    assert_eq!(v["connectionName"], "local");
    assert_eq!(v["database"], "mydb");

    let q2: SavedQuery = serde_json::from_value(v).unwrap();
    assert_eq!(q2.database.as_deref(), Some("mydb"));
    assert_eq!(q2.connection_name, "local");
}

#[test]
fn saved_query_round_trip_no_database() {
    let q = SavedQuery {
        id: "abc123".to_string(),
        name: "My Query".to_string(),
        sql: "SELECT 1".to_string(),
        connection_name: "local".to_string(),
        database: None,
    };
    let v = serde_json::to_value(&q).unwrap();
    assert!(v["database"].is_null());

    let q2: SavedQuery = serde_json::from_value(v).unwrap();
    assert!(q2.database.is_none());
}

// ── SavedConnection round-trip ────────────────────────────────────────────────

#[test]
fn saved_connection_round_trip_camel_case() {
    let c = SavedConnection {
        name: "local".to_string(),
        db_type: "postgres".to_string(),
        host: "localhost".to_string(),
        port: 5432,
        database: "mydb".to_string(),
        username: "admin".to_string(),
    };
    let v = serde_json::to_value(&c).unwrap();
    assert_eq!(v["name"], "local");
    assert_eq!(v["dbType"], "postgres");
    assert_eq!(v["host"], "localhost");
    assert_eq!(v["port"], 5432);
    assert_eq!(v["database"], "mydb");
    assert_eq!(v["username"], "admin");

    let c2: SavedConnection = serde_json::from_value(v).unwrap();
    assert_eq!(c2.db_type, "postgres");
    assert_eq!(c2.port, 5432);
}

#[test]
fn saved_connection_ignores_unknown_password_field() {
    // Frontend may send a "password" field; it should be silently ignored
    let json_str = r#"{
        "name": "local",
        "dbType": "postgres",
        "host": "localhost",
        "port": 5432,
        "database": "mydb",
        "username": "admin",
        "password": "secret"
    }"#;
    let c: SavedConnection = serde_json::from_str(json_str).unwrap();
    assert_eq!(c.name, "local");
    assert_eq!(c.username, "admin");
    // no panic — unknown "password" key is ignored
}

// ── QueryResult ───────────────────────────────────────────────────────────────

#[test]
fn query_result_empty_constructor() {
    let r = QueryResult::empty();
    assert_eq!(r.row_count, 0);
    assert!(r.columns.is_empty());
    assert!(r.column_types.is_empty());
    assert!(r.column_raw_types.is_empty());
    assert!(r.rows.is_empty());
    assert_eq!(r.sql, "");
    assert_eq!(r.execution_time_ms, 0);
}

#[test]
fn query_result_serializes_snake_case() {
    // QueryResult has no rename_all, so field names are unchanged (snake_case)
    let r = QueryResult {
        columns: vec!["id".to_string()],
        column_types: vec!["number".to_string()],
        column_raw_types: vec!["int4".to_string()],
        rows: vec![vec![Value::from(1)]],
        row_count: 1,
        sql: "SELECT id FROM users".to_string(),
        execution_time_ms: 5,
    };
    let v = serde_json::to_value(&r).unwrap();
    assert_eq!(v["row_count"], 1);
    assert_eq!(v["column_types"][0], "number");
    assert_eq!(v["column_raw_types"][0], "int4");
    assert_eq!(v["execution_time_ms"], 5);
    assert_eq!(v["sql"], "SELECT id FROM users");
}

// ── ColumnKeyInfo serialization ───────────────────────────────────────────────

#[test]
fn column_key_info_with_fk_camel_case() {
    let c = ColumnKeyInfo {
        column_name: "user_id".to_string(),
        is_primary: false,
        fk_ref_table: Some("users".to_string()),
        fk_ref_column: Some("id".to_string()),
        is_nullable: true,
        is_auto_generated: false,
    };
    let v = serde_json::to_value(&c).unwrap();
    assert_eq!(v["columnName"], "user_id");
    assert_eq!(v["isPrimary"], false);
    assert_eq!(v["fkRefTable"], "users");
    assert_eq!(v["fkRefColumn"], "id");
    assert_eq!(v["isNullable"], true);
    assert_eq!(v["isAutoGenerated"], false);
}

#[test]
fn column_key_info_no_fk_nulls() {
    let c = ColumnKeyInfo {
        column_name: "id".to_string(),
        is_primary: true,
        fk_ref_table: None,
        fk_ref_column: None,
        is_nullable: false,
        is_auto_generated: true,
    };
    let v = serde_json::to_value(&c).unwrap();
    assert_eq!(v["isPrimary"], true);
    assert!(v["fkRefTable"].is_null());
    assert!(v["fkRefColumn"].is_null());
    assert_eq!(v["isAutoGenerated"], true);
}

// ── SubmitResult serialization ────────────────────────────────────────────────

#[test]
fn submit_result_camel_case() {
    let r = SubmitResult {
        deleted_count: 2,
        updated_count: 1,
        inserted_count: 0,
    };
    let v = serde_json::to_value(&r).unwrap();
    assert_eq!(v["deletedCount"], 2);
    assert_eq!(v["updatedCount"], 1);
    assert_eq!(v["insertedCount"], 0);
}

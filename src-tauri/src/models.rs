use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SortEntry {
    pub col: String,
    pub dir: String, // "asc" or "desc"
}

fn default_operator() -> String { "eq".to_string() }

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FilterEntry {
    pub col: String,
    pub value: String,
    pub value2: Option<String>, // upper bound for "between" operator
    #[serde(default = "default_operator")]
    pub operator: String, // "eq" | "gt" | "gte" | "lt" | "lte" | "between"
    pub case_sensitive: bool,
    pub col_type: String, // "text" | "number" | "boolean" | "date" | "time" | "datetime" | "json" | "other"
    #[serde(default)]
    pub exact: bool, // true = exact equality match (used for FK navigation)
    #[serde(default)]
    pub null_filter: Option<String>, // "is_null" | "is_not_null"
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SavedQuery {
    pub id: String,
    pub name: String,
    pub sql: String,
    pub connection_name: String,
    #[serde(default)]
    pub database: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SavedConnection {
    pub name: String,
    pub db_type: String,
    pub host: String,
    pub port: u16,
    pub database: String,
    pub username: String,
    // password is stored in the OS keychain, never in this struct
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ColumnKeyInfo {
    pub column_name: String,
    pub is_primary: bool,
    pub fk_ref_table: Option<String>,
    pub fk_ref_column: Option<String>,
    pub is_nullable: bool,
    pub is_auto_generated: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ColumnInfo {
    pub name: String,
    pub data_type: String,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColumnValue {
    pub column: String,
    pub value: Option<String>, // None = SQL NULL
}

#[derive(Serialize)]
pub struct QueryResult {
    pub columns: Vec<String>,
    pub column_types: Vec<String>,
    pub column_raw_types: Vec<String>,
    pub rows: Vec<Vec<Value>>,
    pub row_count: usize,
    pub sql: String,
    pub execution_time_ms: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TableSchema {
    pub table_name: String,
    pub columns: Vec<ColumnInfo>,
    pub keys: Vec<ColumnKeyInfo>,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RowUpdate {
    pub pk_value: String,
    pub values: Vec<ColumnValue>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SubmitResult {
    pub deleted_count: u64,
    pub updated_count: u64,
    pub inserted_count: u64,
}

impl QueryResult {
    pub fn empty() -> Self {
        QueryResult {
            columns: vec![],
            column_types: vec![],
            column_raw_types: vec![],
            rows: vec![],
            row_count: 0,
            sql: String::new(),
            execution_time_ms: 0,
        }
    }
}

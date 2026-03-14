pub mod filter;
pub mod mysql;
pub mod postgres;

use sqlx::mysql::{MySqlConnectOptions, MySqlPool};
use sqlx::postgres::{PgConnectOptions, PgPool};
use crate::models::{ColumnInfo, ColumnKeyInfo, ColumnValue, FilterEntry, QueryResult, RowUpdate, SubmitResult, TableSchema};

pub fn is_select_query(sql: &str) -> bool {
    let s = sql.trim_start().to_uppercase();
    s.starts_with("SELECT")
        || s.starts_with("WITH")
        || s.starts_with("TABLE")
        || s.starts_with("VALUES")
        || s.starts_with("SHOW")
        || s.starts_with("DESCRIBE")
        || s.starts_with("EXPLAIN")
}

#[derive(Debug)]
pub enum DbConnection {
    Postgres(PgPool),
    Mysql(MySqlPool),
}

impl DbConnection {
    pub async fn connect(
        db_type: &str,
        host: &str,
        port: u16,
        database: &str,
        username: &str,
        password: &str,
    ) -> Result<Self, String> {
        match db_type {
            "postgres" => {
                let options = PgConnectOptions::new()
                    .host(host)
                    .port(port)
                    .database(database)
                    .username(username)
                    .password(password);
                let pool = PgPool::connect_with(options)
                    .await
                    .map_err(|e| e.to_string())?;
                Ok(DbConnection::Postgres(pool))
            }
            "mysql" => {
                let options = MySqlConnectOptions::new()
                    .host(host)
                    .port(port)
                    .database(database)
                    .username(username)
                    .password(password);
                let pool = MySqlPool::connect_with(options)
                    .await
                    .map_err(|e| e.to_string())?;
                Ok(DbConnection::Mysql(pool))
            }
            _ => Err("Unsupported database type".to_string()),
        }
    }

    pub async fn list_databases(&self) -> Result<Vec<String>, String> {
        match self {
            DbConnection::Postgres(pool) => postgres::list_databases(pool).await,
            DbConnection::Mysql(pool) => mysql::list_databases(pool).await,
        }
    }

    pub async fn list_tables_for_db(&self, database: &str) -> Result<Vec<String>, String> {
        match self {
            DbConnection::Postgres(pool) => postgres::list_tables_for_db(pool, database).await,
            DbConnection::Mysql(pool) => mysql::list_tables_for_db(pool, database).await,
        }
    }

    pub async fn execute_query(&self, sql: &str) -> Result<QueryResult, String> {
        let mut result = match self {
            DbConnection::Postgres(pool) => postgres::run_query(pool, sql).await,
            DbConnection::Mysql(pool) => mysql::run_query(pool, sql).await,
        }?;
        result.sql = sql.to_string();
        Ok(result)
    }

    pub async fn get_table_columns(&self, table: &str) -> Result<Vec<ColumnInfo>, String> {
        match self {
            DbConnection::Postgres(pool) => postgres::get_table_columns(pool, table).await,
            DbConnection::Mysql(pool) => mysql::get_table_columns(pool, table).await,
        }
    }

    pub async fn get_column_keys(&self, table: &str) -> Result<Vec<ColumnKeyInfo>, String> {
        match self {
            DbConnection::Postgres(pool) => postgres::get_column_keys(pool, table).await,
            DbConnection::Mysql(pool) => mysql::get_column_keys(pool, table).await,
        }
    }

    pub async fn count_table_rows(&self, table: &str) -> Result<i64, String> {
        match self {
            DbConnection::Postgres(pool) => postgres::count_table_rows(pool, table).await,
            DbConnection::Mysql(pool) => mysql::count_table_rows(pool, table).await,
        }
    }

    pub async fn count_filtered_rows(&self, table: &str, filter_entries: &[FilterEntry]) -> Result<i64, String> {
        match self {
            DbConnection::Postgres(pool) => postgres::count_filtered_rows(pool, table, filter_entries).await,
            DbConnection::Mysql(pool) => mysql::count_filtered_rows(pool, table, filter_entries).await,
        }
    }

    pub async fn get_schema(&self, database: &str) -> Result<Vec<TableSchema>, String> {
        match self {
            DbConnection::Postgres(pool) => postgres::get_schema(pool, database).await,
            DbConnection::Mysql(pool) => mysql::get_schema(pool, database).await,
        }
    }

    pub async fn delete_rows(&self, table: &str, pk_column: &str, pk_values: &[String]) -> Result<u64, String> {
        match self {
            DbConnection::Postgres(pool) => postgres::delete_rows(pool, table, pk_column, pk_values).await,
            DbConnection::Mysql(pool) => mysql::delete_rows(pool, table, pk_column, pk_values).await,
        }
    }

    pub async fn insert_row(&self, table: &str, values: &[ColumnValue]) -> Result<(), String> {
        match self {
            DbConnection::Postgres(pool) => postgres::insert_row(pool, table, values).await,
            DbConnection::Mysql(pool) => mysql::insert_row(pool, table, values).await,
        }
    }

    pub async fn submit_changes(
        &self,
        table: &str,
        pk_column: Option<&str>,
        deletes: &[String],
        updates: &[RowUpdate],
        inserts: &[Vec<ColumnValue>],
    ) -> Result<SubmitResult, String> {
        match self {
            DbConnection::Postgres(pool) => postgres::submit_changes(pool, table, pk_column, deletes, updates, inserts).await,
            DbConnection::Mysql(pool) => mysql::submit_changes(pool, table, pk_column, deletes, updates, inserts).await,
        }
    }

    pub async fn get_table_data(
        &self,
        table: &str,
        sort_entries: &[(String, bool)],
        filter_entries: &[FilterEntry],
        limit: i64,
        offset: i64,
    ) -> Result<QueryResult, String> {
        match self {
            DbConnection::Postgres(pool) =>
                postgres::get_table_data(pool, table, sort_entries, filter_entries, limit, offset).await,
            DbConnection::Mysql(pool) =>
                mysql::get_table_data(pool, table, sort_entries, filter_entries, limit, offset).await,
        }
    }
}

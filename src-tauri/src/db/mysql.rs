use serde_json::{json, Value};
use sqlx::mysql::{MySqlPool, MySqlRow};
use sqlx::types::chrono;
use sqlx::{Column, Row, TypeInfo};
use crate::models::{ColumnInfo, ColumnKeyInfo, ColumnValue, FilterEntry, QueryResult, RowUpdate, SubmitResult, TableSchema};
use super::filter::{self, DbDialect, active_filters, build_query_result};

const DIALECT: DbDialect = DbDialect::Mysql;

fn mysql_type_category(name: &str) -> &'static str {
    if name == "BOOLEAN" || name == "TINYINT(1)" {
        return "boolean";
    }
    if matches!(
        name,
        "TINYINT" | "SMALLINT" | "MEDIUMINT" | "INT" | "BIGINT"
        | "TINYINT UNSIGNED" | "SMALLINT UNSIGNED" | "MEDIUMINT UNSIGNED"
        | "INT UNSIGNED" | "BIGINT UNSIGNED" | "FLOAT" | "DOUBLE"
    ) {
        return "number";
    }
    if name.starts_with("DECIMAL") || name.starts_with("NUMERIC") {
        return "number";
    }
    if name == "DATE" {
        return "date";
    }
    if name == "TIME" || name.starts_with("TIME(") {
        return "time";
    }
    if name.starts_with("DATETIME") || name.starts_with("TIMESTAMP") {
        return "datetime";
    }
    if name == "JSON" {
        return "json";
    }
    "text"
}

pub fn value_to_json(row: &MySqlRow, i: usize) -> Value {
    let type_name = row.column(i).type_info().name();

    // Boolean
    if type_name == "BOOLEAN" || type_name == "TINYINT(1)" {
        return row
            .try_get::<Option<bool>, _>(i)
            .ok()
            .flatten()
            .map(Value::Bool)
            .unwrap_or(Value::Null);
    }

    // Integers
    if matches!(
        type_name,
        "TINYINT" | "SMALLINT" | "MEDIUMINT" | "INT" | "BIGINT"
        | "TINYINT UNSIGNED" | "SMALLINT UNSIGNED" | "MEDIUMINT UNSIGNED" | "INT UNSIGNED"
    ) {
        return row
            .try_get::<Option<i64>, _>(i)
            .ok()
            .flatten()
            .map(|n| json!(n))
            .unwrap_or(Value::Null);
    }
    if type_name == "BIGINT UNSIGNED" {
        return row
            .try_get::<Option<u64>, _>(i)
            .ok()
            .flatten()
            .map(|n| json!(n))
            .unwrap_or(Value::Null);
    }

    // Floats
    if type_name == "FLOAT" {
        return row
            .try_get::<Option<f32>, _>(i)
            .ok()
            .flatten()
            .map(|f| json!(f))
            .unwrap_or(Value::Null);
    }
    if type_name == "DOUBLE" {
        return row
            .try_get::<Option<f64>, _>(i)
            .ok()
            .flatten()
            .map(|f| json!(f))
            .unwrap_or(Value::Null);
    }

    // Decimal
    if type_name.starts_with("DECIMAL") || type_name.starts_with("NUMERIC") {
        return row
            .try_get::<Option<bigdecimal::BigDecimal>, _>(i)
            .ok()
            .flatten()
            .map(|d| json!(d.to_string()))
            .unwrap_or(Value::Null);
    }

    // JSON
    if type_name == "JSON" {
        return row
            .try_get::<Option<Value>, _>(i)
            .ok()
            .flatten()
            .unwrap_or(Value::Null);
    }

    // Date/time
    if type_name == "DATE" {
        return row
            .try_get::<Option<chrono::NaiveDate>, _>(i)
            .ok()
            .flatten()
            .map(|d| Value::String(d.to_string()))
            .unwrap_or(Value::Null);
    }
    if type_name == "TIME" || type_name.starts_with("TIME(") {
        return row
            .try_get::<Option<chrono::NaiveTime>, _>(i)
            .ok()
            .flatten()
            .map(|t| Value::String(t.to_string()))
            .unwrap_or(Value::Null);
    }
    if type_name.starts_with("DATETIME") {
        return row
            .try_get::<Option<chrono::NaiveDateTime>, _>(i)
            .ok()
            .flatten()
            .map(|dt| Value::String(dt.to_string()))
            .unwrap_or(Value::Null);
    }
    if type_name.starts_with("TIMESTAMP") {
        return row
            .try_get::<Option<chrono::DateTime<chrono::Utc>>, _>(i)
            .ok()
            .flatten()
            .map(|dt| Value::String(dt.format("%Y-%m-%d %H:%M:%S").to_string()))
            .unwrap_or(Value::Null);
    }

    // Default: try String, then fall back to raw bytes for binary types
    row.try_get::<Option<String>, _>(i)
        .ok()
        .flatten()
        .map(Value::String)
        .unwrap_or_else(|| {
            row.try_get::<Option<Vec<u8>>, _>(i)
                .ok()
                .flatten()
                .map(|b| Value::String(String::from_utf8_lossy(&b).into_owned()))
                .unwrap_or(Value::Null)
        })
}

pub async fn run_query(pool: &MySqlPool, sql: &str) -> Result<QueryResult, String> {
    if super::is_select_query(sql) {
        let rows = sqlx::query(sql)
            .fetch_all(pool)
            .await
            .map_err(|e| e.to_string())?;
        if rows.is_empty() {
            return Ok(QueryResult::empty());
        }
        let (columns, column_types, column_raw_types, result_rows) =
            filter::extract_rows(&rows, mysql_type_category, value_to_json);
        Ok(build_query_result(columns, column_types, column_raw_types, result_rows, String::new()))
    } else {
        let result = sqlx::query(sql)
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
        Ok(build_query_result(
            vec!["rows_affected".to_string()],
            vec![],
            vec![],
            vec![vec![json!(result.rows_affected())]],
            String::new(),
        ))
    }
}

pub async fn list_databases(pool: &MySqlPool) -> Result<Vec<String>, String> {
    let rows = sqlx::query(
        "SELECT CONVERT(SCHEMA_NAME USING utf8mb4) FROM information_schema.SCHEMATA \
         WHERE SCHEMA_NAME NOT IN ('mysql','information_schema','performance_schema','sys') \
         ORDER BY SCHEMA_NAME",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(rows.iter().map(|r| r.get::<String, _>(0)).collect())
}

pub async fn list_tables_for_db(pool: &MySqlPool, database: &str) -> Result<Vec<String>, String> {
    let rows = sqlx::query(
        "SELECT CONVERT(table_name USING utf8mb4) FROM information_schema.tables \
         WHERE table_schema = ? \
         AND table_type = 'BASE TABLE' ORDER BY table_name",
    )
    .bind(database)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(rows.iter().map(|r| r.get::<String, _>(0)).collect())
}

pub fn table_data_sql(table: &str, sort_entries: &[(String, bool)], limit: i64, offset: i64) -> String {
    let order = DIALECT.build_order_clause(sort_entries);
    format!("SELECT * FROM {}{} LIMIT {} OFFSET {}", DIALECT.quote_ident(table), order, limit, offset)
}

pub async fn get_column_keys(pool: &MySqlPool, table: &str) -> Result<Vec<ColumnKeyInfo>, String> {
    let t = table.replace('`', "");

    let pk_rows = sqlx::query(
        "SELECT CONVERT(COLUMN_NAME USING utf8mb4) FROM information_schema.KEY_COLUMN_USAGE \
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = 'PRIMARY'",
    )
    .bind(&t)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let fk_rows = sqlx::query(
        "SELECT CONVERT(COLUMN_NAME USING utf8mb4), \
                CONVERT(REFERENCED_TABLE_NAME USING utf8mb4), \
                CONVERT(REFERENCED_COLUMN_NAME USING utf8mb4) \
         FROM information_schema.KEY_COLUMN_USAGE \
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? \
         AND REFERENCED_TABLE_NAME IS NOT NULL",
    )
    .bind(&t)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let col_rows = sqlx::query(
        "SELECT CONVERT(COLUMN_NAME USING utf8mb4), \
                CONVERT(IS_NULLABLE USING utf8mb4), \
                CONVERT(EXTRA USING utf8mb4) \
         FROM information_schema.COLUMNS \
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? \
         ORDER BY ORDINAL_POSITION",
    )
    .bind(&t)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(filter::assemble_key_info(
        col_rows.iter().map(|r| {
            let name: String = r.get(0);
            let nullable: String = r.get(1);
            let extra: String = r.get(2);
            let extra_lc = extra.to_lowercase();
            let is_auto = extra_lc.contains("auto_increment")
                || extra_lc.contains("virtual generated")
                || extra_lc.contains("stored generated");
            (name, nullable == "YES", is_auto)
        }),
        pk_rows.iter().map(|r| r.get::<String, _>(0)),
        fk_rows.iter().map(|r| {
            (
                r.get::<String, _>(0),
                r.get::<String, _>(1),
                r.get::<String, _>(2),
            )
        }),
    ))
}

pub async fn get_table_columns(pool: &MySqlPool, table: &str) -> Result<Vec<ColumnInfo>, String> {
    let t = table.replace('`', "");
    let rows = sqlx::query(
        "SELECT CONVERT(column_name USING utf8mb4), CONVERT(column_type USING utf8mb4) \
         FROM information_schema.columns \
         WHERE table_schema = DATABASE() AND table_name = ? \
         ORDER BY ordinal_position",
    )
    .bind(&t)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows
        .iter()
        .map(|r| ColumnInfo {
            name: r.get::<String, _>(0),
            data_type: r.get::<String, _>(1),
        })
        .collect())
}

pub async fn get_schema(pool: &MySqlPool, database: &str) -> Result<Vec<TableSchema>, String> {
    let tables = list_tables_for_db(pool, database).await?;
    let mut schema = Vec::new();
    for table in &tables {
        let columns = get_table_columns(pool, table).await?;
        let keys = get_column_keys(pool, table).await?;
        schema.push(TableSchema { table_name: table.clone(), columns, keys });
    }
    Ok(schema)
}

pub async fn get_table_data(
    pool: &MySqlPool,
    table: &str,
    sort_entries: &[(String, bool)],
    filter_entries: &[FilterEntry],
    limit: i64,
    offset: i64,
) -> Result<QueryResult, String> {
    let active = active_filters(filter_entries);

    if active.is_empty() {
        let sql = table_data_sql(table, sort_entries, limit, offset);
        let mut result = run_query(pool, &sql).await?;
        result.sql = sql;
        return Ok(result);
    }

    let display_parts: Vec<String> = active.iter().map(|f| DIALECT.display_filter_part(f)).collect();
    let order_sql = DIALECT.build_order_clause(sort_entries);
    let display_sql = DIALECT.build_display_sql(table, &display_parts, &order_sql, limit, offset);

    // Build parameterized query
    let mut qb = sqlx::QueryBuilder::<sqlx::MySql>::new(
        format!("SELECT * FROM {} WHERE ", DIALECT.quote_ident(table))
    );
    filter::push_conditions(&mut qb, &active, &DIALECT);
    qb.push(&order_sql);
    qb.push(format!(" LIMIT {} OFFSET {}", limit, offset));

    let rows = qb.build().fetch_all(pool).await.map_err(|e| e.to_string())?;

    if rows.is_empty() {
        let mut r = QueryResult::empty();
        r.sql = display_sql;
        return Ok(r);
    }

    let (columns, column_types, column_raw_types, result_rows) =
        filter::extract_rows(&rows, mysql_type_category, value_to_json);
    Ok(build_query_result(columns, column_types, column_raw_types, result_rows, display_sql))
}

pub async fn count_table_rows(pool: &MySqlPool, table: &str) -> Result<i64, String> {
    let sql = format!("SELECT COUNT(*) FROM {}", DIALECT.quote_ident(table));
    let (count,): (i64,) = sqlx::query_as(&sql)
        .fetch_one(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(count)
}

pub async fn delete_rows(pool: &MySqlPool, table: &str, pk_column: &str, pk_values: &[String]) -> Result<u64, String> {
    let mut qb = sqlx::QueryBuilder::<sqlx::MySql>::new(
        format!("DELETE FROM {} WHERE CAST({} AS CHAR) IN (", DIALECT.quote_ident(table), DIALECT.quote_ident(pk_column))
    );
    let mut sep = qb.separated(", ");
    for v in pk_values { sep.push_bind(v.clone()); }
    qb.push(")");
    Ok(qb.build().execute(pool).await.map_err(|e| e.to_string())?.rows_affected())
}

pub async fn insert_row(pool: &MySqlPool, table: &str, values: &[ColumnValue]) -> Result<(), String> {
    let cols: Vec<String> = values.iter().map(|cv| DIALECT.quote_ident(&cv.column)).collect();
    let mut qb = sqlx::QueryBuilder::<sqlx::MySql>::new(format!(
        "INSERT INTO {} ({}) VALUES (",
        DIALECT.quote_ident(table),
        cols.join(", ")
    ));
    let mut sep = qb.separated(", ");
    for cv in values {
        match &cv.value {
            Some(v) => { sep.push_bind(v.clone()); }
            None => { sep.push("NULL"); }
        }
    }
    qb.push(")");
    qb.build().execute(pool).await.map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn submit_changes(
    pool: &MySqlPool,
    table: &str,
    pk_column: Option<&str>,
    deletes: &[String],
    updates: &[RowUpdate],
    inserts: &[Vec<ColumnValue>],
) -> Result<SubmitResult, String> {
    use sqlx::Acquire;
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;
    let conn = tx.acquire().await.map_err(|e| e.to_string())?;

    let mut deleted_count: u64 = 0;
    let mut updated_count: u64 = 0;
    let mut inserted_count: u64 = 0;

    // Deletes
    if !deletes.is_empty() {
        let pk = pk_column.ok_or("No primary key column for deletes")?;
        let mut qb = sqlx::QueryBuilder::<sqlx::MySql>::new(
            format!("DELETE FROM {} WHERE CAST({} AS CHAR) IN (", DIALECT.quote_ident(table), DIALECT.quote_ident(pk))
        );
        let mut sep = qb.separated(", ");
        for v in deletes { sep.push_bind(v.clone()); }
        qb.push(")");
        deleted_count = qb.build().execute(&mut *conn).await.map_err(|e| e.to_string())?.rows_affected();
    }

    // Updates
    for upd in updates {
        let pk = pk_column.ok_or("No primary key column for updates")?;
        if upd.values.is_empty() { continue; }
        let mut qb = sqlx::QueryBuilder::<sqlx::MySql>::new(
            format!("UPDATE {} SET ", DIALECT.quote_ident(table))
        );
        for (i, cv) in upd.values.iter().enumerate() {
            if i > 0 { qb.push(", "); }
            match &cv.value {
                Some(v) => { qb.push(format!("{} = ", DIALECT.quote_ident(&cv.column))); qb.push_bind(v.clone()); }
                None => { qb.push(format!("{} = NULL", DIALECT.quote_ident(&cv.column))); }
            }
        }
        qb.push(format!(" WHERE CAST({} AS CHAR) = ", DIALECT.quote_ident(pk)));
        qb.push_bind(upd.pk_value.clone());
        updated_count += qb.build().execute(&mut *conn).await.map_err(|e| e.to_string())?.rows_affected();
    }

    // Inserts
    for row_values in inserts {
        if row_values.is_empty() { continue; }
        let cols: Vec<String> = row_values.iter().map(|cv| DIALECT.quote_ident(&cv.column)).collect();
        let mut qb = sqlx::QueryBuilder::<sqlx::MySql>::new(format!(
            "INSERT INTO {} ({}) VALUES (",
            DIALECT.quote_ident(table),
            cols.join(", ")
        ));
        let mut sep = qb.separated(", ");
        for cv in row_values {
            match &cv.value {
                Some(v) => { sep.push_bind(v.clone()); }
                None => { sep.push("NULL"); }
            }
        }
        qb.push(")");
        qb.build().execute(&mut *conn).await.map_err(|e| e.to_string())?;
        inserted_count += 1;
    }

    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(SubmitResult { deleted_count, updated_count, inserted_count })
}

#[cfg(test)]
mod tests {
    use super::mysql_type_category;

    #[test]
    fn boolean() {
        assert_eq!(mysql_type_category("BOOLEAN"), "boolean");
        assert_eq!(mysql_type_category("TINYINT(1)"), "boolean");
    }

    #[test]
    fn integer_types() {
        for t in &[
            "TINYINT", "SMALLINT", "MEDIUMINT", "INT", "BIGINT",
            "TINYINT UNSIGNED", "SMALLINT UNSIGNED", "MEDIUMINT UNSIGNED",
            "INT UNSIGNED", "BIGINT UNSIGNED",
        ] {
            assert_eq!(mysql_type_category(t), "number", "{t} should be number");
        }
    }

    #[test]
    fn float_types() {
        assert_eq!(mysql_type_category("FLOAT"), "number");
        assert_eq!(mysql_type_category("DOUBLE"), "number");
    }

    #[test]
    fn decimal_numeric() {
        assert_eq!(mysql_type_category("DECIMAL(10,2)"), "number");
        assert_eq!(mysql_type_category("NUMERIC(8,4)"), "number");
    }

    #[test]
    fn date_time_datetime() {
        assert_eq!(mysql_type_category("DATE"), "date");
        assert_eq!(mysql_type_category("TIME"), "time");
        assert_eq!(mysql_type_category("TIME(6)"), "time");
        assert_eq!(mysql_type_category("DATETIME"), "datetime");
        assert_eq!(mysql_type_category("DATETIME(3)"), "datetime");
        assert_eq!(mysql_type_category("TIMESTAMP"), "datetime");
        assert_eq!(mysql_type_category("TIMESTAMP(6)"), "datetime");
    }

    #[test]
    fn json() {
        assert_eq!(mysql_type_category("JSON"), "json");
    }

    #[test]
    fn text_fallback() {
        assert_eq!(mysql_type_category("TEXT"), "text");
        assert_eq!(mysql_type_category("VARCHAR"), "text");
        assert_eq!(mysql_type_category("CHAR"), "text");
    }
}

pub async fn count_filtered_rows(pool: &MySqlPool, table: &str, filter_entries: &[FilterEntry]) -> Result<i64, String> {
    let active = active_filters(filter_entries);
    if active.is_empty() {
        return count_table_rows(pool, table).await;
    }
    let mut qb = sqlx::QueryBuilder::<sqlx::MySql>::new(
        format!("SELECT COUNT(*) FROM {} WHERE ", DIALECT.quote_ident(table))
    );
    filter::push_conditions(&mut qb, &active, &DIALECT);
    let row = qb.build().fetch_one(pool).await.map_err(|e| e.to_string())?;
    Ok(row.get::<i64, _>(0))
}

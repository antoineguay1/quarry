use serde_json::{json, Value};
use sqlx::postgres::{PgPool, PgRow};
use sqlx::types::chrono;
use sqlx::{Column, Row, TypeInfo};
use crate::models::{ColumnInfo, ColumnKeyInfo, ColumnValue, FilterEntry, QueryResult, RowUpdate, SubmitResult, TableSchema};
use super::filter::{self, DbDialect, active_filters, build_query_result};

const DIALECT: DbDialect = DbDialect::Postgres;

fn pg_type_category(name: &str) -> &'static str {
    match name {
        "BOOL" => "boolean",
        "INT2" | "INT4" | "INT8" | "OID" | "FLOAT4" | "FLOAT8" | "NUMERIC" => "number",
        "DATE" => "date",
        "TIME" | "TIMETZ" => "time",
        "TIMESTAMP" | "TIMESTAMPTZ" => "datetime",
        "JSON" | "JSONB" => "json",
        t if t.ends_with("[]") => "other",
        _ => "text",
    }
}

pub fn value_to_json(row: &PgRow, i: usize) -> Value {
    let type_name = row.column(i).type_info().name();
    match type_name {
        "BOOL" => row
            .try_get::<Option<bool>, _>(i)
            .ok()
            .flatten()
            .map(Value::Bool)
            .unwrap_or(Value::Null),
        "INT2" => row
            .try_get::<Option<i16>, _>(i)
            .ok()
            .flatten()
            .map(|n| json!(n))
            .unwrap_or(Value::Null),
        "INT4" => row
            .try_get::<Option<i32>, _>(i)
            .ok()
            .flatten()
            .map(|n| json!(n))
            .unwrap_or(Value::Null),
        "INT8" => row
            .try_get::<Option<i64>, _>(i)
            .ok()
            .flatten()
            .map(|n| json!(n))
            .unwrap_or(Value::Null),
        "OID" => row
            .try_get::<Option<i32>, _>(i)
            .ok()
            .flatten()
            .map(|n| json!(n))
            .unwrap_or(Value::Null),
        "FLOAT4" => row
            .try_get::<Option<f32>, _>(i)
            .ok()
            .flatten()
            .map(|f| json!(f))
            .unwrap_or(Value::Null),
        "FLOAT8" => row
            .try_get::<Option<f64>, _>(i)
            .ok()
            .flatten()
            .map(|f| json!(f))
            .unwrap_or(Value::Null),
        "NUMERIC" => row
            .try_get::<Option<sqlx::types::BigDecimal>, _>(i)
            .ok()
            .flatten()
            .map(|d| Value::String(d.to_string()))
            .unwrap_or(Value::Null),
        "JSON" | "JSONB" => row
            .try_get::<Option<Value>, _>(i)
            .ok()
            .flatten()
            .unwrap_or(Value::Null),
        "TEXT[]" | "VARCHAR[]" | "BPCHAR[]" | "NAME[]" => row
            .try_get::<Option<Vec<Option<String>>>, _>(i)
            .ok()
            .flatten()
            .map(|arr| {
                Value::Array(
                    arr.into_iter()
                        .map(|s| s.map(Value::String).unwrap_or(Value::Null))
                        .collect(),
                )
            })
            .unwrap_or(Value::Null),
        "DATE" => row
            .try_get::<Option<chrono::NaiveDate>, _>(i)
            .ok()
            .flatten()
            .map(|d: chrono::NaiveDate| Value::String(d.to_string()))
            .unwrap_or(Value::Null),
        "TIME" | "TIMETZ" => row
            .try_get::<Option<chrono::NaiveTime>, _>(i)
            .ok()
            .flatten()
            .map(|t: chrono::NaiveTime| Value::String(t.to_string()))
            .unwrap_or(Value::Null),
        "TIMESTAMP" => row
            .try_get::<Option<chrono::NaiveDateTime>, _>(i)
            .ok()
            .flatten()
            .map(|dt: chrono::NaiveDateTime| Value::String(dt.to_string()))
            .unwrap_or(Value::Null),
        "TIMESTAMPTZ" => row
            .try_get::<Option<chrono::DateTime<chrono::Utc>>, _>(i)
            .ok()
            .flatten()
            .map(|dt: chrono::DateTime<chrono::Utc>| Value::String(dt.to_rfc3339()))
            .unwrap_or(Value::Null),
        _ => row
            .try_get::<Option<String>, _>(i)
            .ok()
            .flatten()
            .map(Value::String)
            .unwrap_or(Value::Null),
    }
}

pub async fn run_query(pool: &PgPool, sql: &str) -> Result<QueryResult, String> {
    if super::is_select_query(sql) {
        let rows = sqlx::query(sql)
            .fetch_all(pool)
            .await
            .map_err(|e| e.to_string())?;
        if rows.is_empty() {
            return Ok(QueryResult::empty());
        }
        let (columns, column_types, column_raw_types, result_rows) =
            filter::extract_rows(&rows, pg_type_category, value_to_json);
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

pub async fn list_databases(pool: &PgPool) -> Result<Vec<String>, String> {
    let rows = sqlx::query(
        "SELECT datname FROM pg_database \
         WHERE datistemplate = false AND datallowconn = true \
         ORDER BY datname",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(rows.iter().map(|r| r.get::<String, _>(0)).collect())
}

pub async fn list_tables_for_db(pool: &PgPool, database: &str) -> Result<Vec<String>, String> {
    let rows = sqlx::query(
        "SELECT table_name::text FROM information_schema.tables \
         WHERE table_catalog = $1 \
         AND table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast') \
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

pub async fn get_column_keys(pool: &PgPool, table: &str) -> Result<Vec<ColumnKeyInfo>, String> {
    let t = table.replace('"', "");

    let pk_rows = sqlx::query(
        "SELECT kcu.column_name \
         FROM information_schema.table_constraints tc \
         JOIN information_schema.key_column_usage kcu \
             ON tc.constraint_name = kcu.constraint_name \
             AND tc.table_schema = kcu.table_schema \
         WHERE tc.constraint_type = 'PRIMARY KEY' \
         AND tc.table_name = $1 \
         AND tc.table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')",
    )
    .bind(&t)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let fk_rows = sqlx::query(
        "SELECT kcu.column_name, ccu.table_name AS ref_table, ccu.column_name AS ref_column \
         FROM information_schema.table_constraints tc \
         JOIN information_schema.key_column_usage kcu \
             ON tc.constraint_name = kcu.constraint_name \
             AND tc.table_schema = kcu.table_schema \
         JOIN information_schema.constraint_column_usage ccu \
             ON ccu.constraint_name = tc.constraint_name \
             AND ccu.table_schema = tc.table_schema \
         WHERE tc.constraint_type = 'FOREIGN KEY' \
         AND tc.table_name = $1 \
         AND tc.table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')",
    )
    .bind(&t)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let col_rows = sqlx::query(
        "SELECT column_name, is_nullable, \
         COALESCE(column_default LIKE 'nextval(%', false) OR is_identity = 'YES' OR is_generated = 'ALWAYS' \
         FROM information_schema.columns \
         WHERE table_name = $1 \
         AND table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast') \
         ORDER BY ordinal_position",
    )
    .bind(&t)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(filter::assemble_key_info(
        col_rows.iter().map(|r| {
            let name: String = r.get(0);
            let nullable: &str = r.get(1);
            let is_auto: bool = r.get::<Option<bool>, _>(2).unwrap_or(false);
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

pub async fn get_table_columns(pool: &PgPool, table: &str) -> Result<Vec<ColumnInfo>, String> {
    let t = table.replace('"', "");
    let rows = sqlx::query(
        "SELECT column_name, data_type \
         FROM information_schema.columns \
         WHERE table_name = $1 \
         AND table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast') \
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

pub async fn get_schema(pool: &PgPool, database: &str) -> Result<Vec<TableSchema>, String> {
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
    pool: &PgPool,
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
    let mut qb = sqlx::QueryBuilder::<sqlx::Postgres>::new(
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
        filter::extract_rows(&rows, pg_type_category, value_to_json);
    Ok(build_query_result(columns, column_types, column_raw_types, result_rows, display_sql))
}

pub async fn count_table_rows(pool: &PgPool, table: &str) -> Result<i64, String> {
    let sql = format!("SELECT COUNT(*) FROM {}", DIALECT.quote_ident(table));
    let (count,): (i64,) = sqlx::query_as(&sql)
        .fetch_one(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(count)
}

pub async fn delete_rows(pool: &PgPool, table: &str, pk_column: &str, pk_values: &[String]) -> Result<u64, String> {
    let mut qb = sqlx::QueryBuilder::<sqlx::Postgres>::new(
        format!("DELETE FROM {} WHERE CAST({} AS TEXT) IN (", DIALECT.quote_ident(table), DIALECT.quote_ident(pk_column))
    );
    let mut sep = qb.separated(", ");
    for v in pk_values { sep.push_bind(v.clone()); }
    qb.push(")");
    Ok(qb.build().execute(pool).await.map_err(|e| e.to_string())?.rows_affected())
}

pub async fn insert_row(pool: &PgPool, table: &str, values: &[ColumnValue]) -> Result<(), String> {
    // Look up column types for casting
    let col_types = {
        let mut conn = pool.acquire().await.map_err(|e| e.to_string())?;
        get_column_type_map(&mut *conn, table).await?
    };
    let cols: Vec<String> = values.iter().map(|cv| DIALECT.quote_ident(&cv.column)).collect();
    let mut qb = sqlx::QueryBuilder::<sqlx::Postgres>::new(format!(
        "INSERT INTO {} ({}) VALUES (",
        DIALECT.quote_ident(table),
        cols.join(", ")
    ));
    for (i, cv) in values.iter().enumerate() {
        if i > 0 { qb.push(", "); }
        let cast = col_types.get(&cv.column).map(|t| pg_cast_suffix(t)).unwrap_or("");
        match &cv.value {
            Some(v) => { qb.push_bind(v.clone()); qb.push(cast); }
            None => { qb.push("NULL"); }
        }
    }
    qb.push(")");
    qb.build().execute(pool).await.map_err(|e| e.to_string())?;
    Ok(())
}

/// Look up column data types for a table so we can cast text params to the right PG type.
async fn get_column_type_map(conn: &mut sqlx::PgConnection, table: &str) -> Result<std::collections::HashMap<String, String>, String> {
    let t = table.replace('"', "");
    let rows = sqlx::query(
        "SELECT column_name, data_type FROM information_schema.columns \
         WHERE table_name = $1 \
         AND table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')"
    )
    .bind(&t)
    .fetch_all(&mut *conn)
    .await
    .map_err(|e| e.to_string())?;

    let mut map = std::collections::HashMap::new();
    for row in &rows {
        let name: String = row.get(0);
        let dtype: String = row.get(1);
        map.insert(name, dtype);
    }
    Ok(map)
}

/// Map information_schema data_type to a PostgreSQL cast expression.
fn pg_cast_suffix(data_type: &str) -> &'static str {
    match data_type {
        "smallint" | "integer" | "bigint" => "::bigint",
        "real" | "double precision" => "::double precision",
        "numeric" => "::numeric",
        "boolean" => "::boolean",
        "date" => "::date",
        "time without time zone" | "time with time zone" => "::time",
        "timestamp without time zone" => "::timestamp",
        "timestamp with time zone" => "::timestamptz",
        "json" => "::json",
        "jsonb" => "::jsonb",
        "uuid" => "::uuid",
        "inet" => "::inet",
        "ARRAY" => "::text[]",
        _ => "",  // text, varchar, char — no cast needed
    }
}

pub async fn submit_changes(
    pool: &PgPool,
    table: &str,
    pk_column: Option<&str>,
    deletes: &[String],
    updates: &[RowUpdate],
    inserts: &[Vec<ColumnValue>],
) -> Result<SubmitResult, String> {
    use sqlx::Acquire;
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;
    let conn = tx.acquire().await.map_err(|e| e.to_string())?;

    // Look up column types for casting
    let col_types = if !updates.is_empty() || !inserts.is_empty() {
        get_column_type_map(&mut *conn, table).await?
    } else {
        std::collections::HashMap::new()
    };

    let mut deleted_count: u64 = 0;
    let mut updated_count: u64 = 0;
    let mut inserted_count: u64 = 0;

    // Deletes
    if !deletes.is_empty() {
        let pk = pk_column.ok_or("No primary key column for deletes")?;
        let mut qb = sqlx::QueryBuilder::<sqlx::Postgres>::new(
            format!("DELETE FROM {} WHERE CAST({} AS TEXT) IN (", DIALECT.quote_ident(table), DIALECT.quote_ident(pk))
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
        let mut qb = sqlx::QueryBuilder::<sqlx::Postgres>::new(
            format!("UPDATE {} SET ", DIALECT.quote_ident(table))
        );
        for (i, cv) in upd.values.iter().enumerate() {
            if i > 0 { qb.push(", "); }
            let cast = col_types.get(&cv.column).map(|t| pg_cast_suffix(t)).unwrap_or("");
            match &cv.value {
                Some(v) => { qb.push(format!("{} = ", DIALECT.quote_ident(&cv.column))); qb.push_bind(v.clone()); qb.push(cast); }
                None => { qb.push(format!("{} = NULL", DIALECT.quote_ident(&cv.column))); }
            }
        }
        qb.push(format!(" WHERE CAST({} AS TEXT) = ", DIALECT.quote_ident(pk)));
        qb.push_bind(upd.pk_value.clone());
        updated_count += qb.build().execute(&mut *conn).await.map_err(|e| e.to_string())?.rows_affected();
    }

    // Inserts
    for row_values in inserts {
        if row_values.is_empty() { continue; }
        let cols: Vec<String> = row_values.iter().map(|cv| DIALECT.quote_ident(&cv.column)).collect();
        let mut qb = sqlx::QueryBuilder::<sqlx::Postgres>::new(format!(
            "INSERT INTO {} ({}) VALUES (",
            DIALECT.quote_ident(table),
            cols.join(", ")
        ));
        for (i, cv) in row_values.iter().enumerate() {
            if i > 0 { qb.push(", "); }
            let cast = col_types.get(&cv.column).map(|t| pg_cast_suffix(t)).unwrap_or("");
            match &cv.value {
                Some(v) => { qb.push_bind(v.clone()); qb.push(cast); }
                None => { qb.push("NULL"); }
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
    use super::{pg_cast_suffix, pg_type_category};

    #[test]
    fn boolean() {
        assert_eq!(pg_type_category("BOOL"), "boolean");
    }

    #[test]
    fn number_types() {
        for t in &["INT2", "INT4", "INT8", "OID", "FLOAT4", "FLOAT8", "NUMERIC"] {
            assert_eq!(pg_type_category(t), "number", "{t} should be number");
        }
    }

    #[test]
    fn date_time_datetime() {
        assert_eq!(pg_type_category("DATE"), "date");
        assert_eq!(pg_type_category("TIME"), "time");
        assert_eq!(pg_type_category("TIMETZ"), "time");
        assert_eq!(pg_type_category("TIMESTAMP"), "datetime");
        assert_eq!(pg_type_category("TIMESTAMPTZ"), "datetime");
    }

    #[test]
    fn json() {
        assert_eq!(pg_type_category("JSON"), "json");
        assert_eq!(pg_type_category("JSONB"), "json");
    }

    #[test]
    fn array_type_is_other() {
        assert_eq!(pg_type_category("INT4[]"), "other");
        assert_eq!(pg_type_category("TEXT[]"), "other");
    }

    #[test]
    fn text_fallback() {
        assert_eq!(pg_type_category("TEXT"), "text");
        assert_eq!(pg_type_category("VARCHAR"), "text");
        assert_eq!(pg_type_category("UUID"), "text");
    }

    // ── pg_cast_suffix ────────────────────────────────────────────────────────

    #[test]
    fn cast_suffix_integer_types() {
        assert_eq!(pg_cast_suffix("smallint"), "::bigint");
        assert_eq!(pg_cast_suffix("integer"), "::bigint");
        assert_eq!(pg_cast_suffix("bigint"), "::bigint");
    }

    #[test]
    fn cast_suffix_float_types() {
        assert_eq!(pg_cast_suffix("real"), "::double precision");
        assert_eq!(pg_cast_suffix("double precision"), "::double precision");
    }

    #[test]
    fn cast_suffix_numeric() {
        assert_eq!(pg_cast_suffix("numeric"), "::numeric");
    }

    #[test]
    fn cast_suffix_boolean() {
        assert_eq!(pg_cast_suffix("boolean"), "::boolean");
    }

    #[test]
    fn cast_suffix_date() {
        assert_eq!(pg_cast_suffix("date"), "::date");
    }

    #[test]
    fn cast_suffix_time_types() {
        assert_eq!(pg_cast_suffix("time without time zone"), "::time");
        assert_eq!(pg_cast_suffix("time with time zone"), "::time");
    }

    #[test]
    fn cast_suffix_timestamp_types() {
        assert_eq!(pg_cast_suffix("timestamp without time zone"), "::timestamp");
        assert_eq!(pg_cast_suffix("timestamp with time zone"), "::timestamptz");
    }

    #[test]
    fn cast_suffix_json_jsonb() {
        assert_eq!(pg_cast_suffix("json"), "::json");
        assert_eq!(pg_cast_suffix("jsonb"), "::jsonb");
    }

    #[test]
    fn cast_suffix_uuid() {
        assert_eq!(pg_cast_suffix("uuid"), "::uuid");
    }

    #[test]
    fn cast_suffix_inet() {
        assert_eq!(pg_cast_suffix("inet"), "::inet");
    }

    #[test]
    fn cast_suffix_array() {
        assert_eq!(pg_cast_suffix("ARRAY"), "::text[]");
    }

    #[test]
    fn cast_suffix_text_varchar_no_cast() {
        assert_eq!(pg_cast_suffix("text"), "");
        assert_eq!(pg_cast_suffix("character varying"), "");
        assert_eq!(pg_cast_suffix("varchar"), "");
        assert_eq!(pg_cast_suffix("char"), "");
    }
}

pub async fn count_filtered_rows(pool: &PgPool, table: &str, filter_entries: &[FilterEntry]) -> Result<i64, String> {
    let active = active_filters(filter_entries);
    if active.is_empty() {
        return count_table_rows(pool, table).await;
    }
    let mut qb = sqlx::QueryBuilder::<sqlx::Postgres>::new(
        format!("SELECT COUNT(*) FROM {} WHERE ", DIALECT.quote_ident(table))
    );
    filter::push_conditions(&mut qb, &active, &DIALECT);
    let row = qb.build().fetch_one(pool).await.map_err(|e| e.to_string())?;
    Ok(row.get::<i64, _>(0))
}

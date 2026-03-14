use serde_json::Value;
use sqlx::{Column, Row, TypeInfo};
use crate::models::{ColumnKeyInfo, FilterEntry, QueryResult};

pub enum DbDialect {
    Postgres,
    Mysql,
}

impl DbDialect {
    pub fn quote_ident(&self, name: &str) -> String {
        match self {
            DbDialect::Postgres => format!("\"{}\"", name.replace('"', "\"\"")),
            DbDialect::Mysql => format!("`{}`", name.replace('`', "``")),
        }
    }

    pub fn cast_text(&self) -> &'static str {
        match self {
            DbDialect::Postgres => "TEXT",
            DbDialect::Mysql => "CHAR",
        }
    }

    pub fn numeric_cast(&self) -> &'static str {
        match self {
            DbDialect::Postgres => "::numeric",
            DbDialect::Mysql => "",
        }
    }

    pub fn datetime_cast(&self, col_type: &str) -> &'static str {
        match self {
            DbDialect::Postgres => match col_type {
                "date" => "::date",
                "time" => "::time",
                _ => "::timestamp",
            },
            DbDialect::Mysql => "",
        }
    }

    pub fn like_prefix(&self, case_sensitive: bool) -> &'static str {
        if case_sensitive {
            match self {
                DbDialect::Mysql => "BINARY ",
                DbDialect::Postgres => "",
            }
        } else {
            ""
        }
    }

    pub fn like_op(&self, case_sensitive: bool) -> &'static str {
        match (self, case_sensitive) {
            (DbDialect::Postgres, false) => "ILIKE",
            _ => "LIKE",
        }
    }

    pub fn text_filter_col(&self, quoted_col: &str, col_type: &str) -> String {
        match self {
            DbDialect::Postgres if matches!(col_type, "json" | "other") => {
                format!("CAST({} AS TEXT)", quoted_col)
            }
            _ => quoted_col.to_string(),
        }
    }

    pub fn build_order_clause(&self, sort_entries: &[(String, bool)]) -> String {
        if sort_entries.is_empty() {
            return String::new();
        }
        let parts: Vec<String> = sort_entries
            .iter()
            .map(|(col, desc)| {
                let dir = if *desc { "DESC" } else { "ASC" };
                format!("{} {}", self.quote_ident(col), dir)
            })
            .collect();
        format!(" ORDER BY {}", parts.join(", "))
    }

    /// Build one WHERE predicate string for display SQL (values inlined, not parameterized).
    pub fn display_filter_part(&self, f: &FilterEntry) -> String {
        let quoted_col = self.quote_ident(&f.col);
        if let Some(nf) = &f.null_filter {
            return if nf == "is_null" {
                format!("{} IS NULL", quoted_col)
            } else {
                format!("{} IS NOT NULL", quoted_col)
            };
        }
        let escaped_val = f.value.replace('\'', "''");
        match f.col_type.as_str() {
            "number" => {
                if f.exact {
                    let cast_text = self.cast_text();
                    format!("CAST({} AS {}) = '{}'", quoted_col, cast_text, escaped_val)
                } else {
                    let val2 = f.value2.as_deref().unwrap_or("").replace('\'', "''");
                    match f.operator.as_str() {
                        "gt"      => format!("{} > {}",  quoted_col, escaped_val),
                        "gte"     => format!("{} >= {}", quoted_col, escaped_val),
                        "lt"      => format!("{} < {}",  quoted_col, escaped_val),
                        "lte"     => format!("{} <= {}", quoted_col, escaped_val),
                        "between" => format!("{} BETWEEN {} AND {}", quoted_col, escaped_val, val2),
                        _         => format!("{} = {}",  quoted_col, escaped_val),
                    }
                }
            }
            "boolean" => match self {
                DbDialect::Postgres => {
                    let b = f.value.to_lowercase() == "true";
                    format!("{} = {}", quoted_col, b)
                }
                DbDialect::Mysql => {
                    let b = if f.value.to_lowercase() == "true" { "1" } else { "0" };
                    format!("{} = {}", quoted_col, b)
                }
            },
            "date" | "time" | "datetime" => {
                let val = f.value.replace('T', " ").replace('\'', "''");
                let val2 = f.value2.as_deref().unwrap_or("").replace('T', " ").replace('\'', "''");
                let cast = match self {
                    DbDialect::Postgres => match f.col_type.as_str() {
                        "date" => "::date",
                        "time" => "::time",
                        _ => "::timestamp",
                    },
                    DbDialect::Mysql => "",
                };
                match f.operator.as_str() {
                    "gt"  => format!("{} > '{}'{}",  quoted_col, val, cast),
                    "gte" => format!("{} >= '{}'{}",  quoted_col, val, cast),
                    "lt"  => format!("{} < '{}'{}",  quoted_col, val, cast),
                    "lte" => format!("{} <= '{}'{}",  quoted_col, val, cast),
                    "between" => format!(
                        "{} BETWEEN '{}'{} AND '{}'{}", quoted_col, val, cast, val2, cast
                    ),
                    _ => format!("{} = '{}'{}",  quoted_col, val, cast),
                }
            }
            "json" | "other" => {
                // jsonb and array types (text[], etc.) don't support LIKE/ILIKE directly in Postgres
                let filter_col = match self {
                    DbDialect::Postgres => format!("CAST({} AS TEXT)", quoted_col),
                    DbDialect::Mysql => quoted_col.clone(),
                };
                if f.exact {
                    format!("{} = '{}'", filter_col, escaped_val)
                } else if f.case_sensitive {
                    match self {
                        DbDialect::Postgres => format!("{} LIKE '%{}%'", filter_col, escaped_val),
                        DbDialect::Mysql => format!("BINARY {} LIKE '%{}%'", filter_col, escaped_val),
                    }
                } else {
                    match self {
                        DbDialect::Postgres => format!("{} ILIKE '%{}%'", filter_col, escaped_val),
                        DbDialect::Mysql => format!("{} LIKE '%{}%'", filter_col, escaped_val),
                    }
                }
            }
            _ => {
                if f.exact {
                    format!("{} = '{}'", quoted_col, escaped_val)
                } else if f.case_sensitive {
                    match self {
                        DbDialect::Postgres => format!("{} LIKE '%{}%'", quoted_col, escaped_val),
                        DbDialect::Mysql => {
                            format!("BINARY {} LIKE '%{}%'", quoted_col, escaped_val)
                        }
                    }
                } else {
                    match self {
                        DbDialect::Postgres => {
                            format!("{} ILIKE '%{}%'", quoted_col, escaped_val)
                        }
                        DbDialect::Mysql => format!("{} LIKE '%{}%'", quoted_col, escaped_val),
                    }
                }
            }
        }
    }

    pub fn build_display_sql(
        &self,
        table: &str,
        parts: &[String],
        order: &str,
        limit: i64,
        offset: i64,
    ) -> String {
        format!(
            "SELECT * FROM {} WHERE {}{}  LIMIT {} OFFSET {}",
            self.quote_ident(table),
            parts.join(" AND "),
            order,
            limit,
            offset
        )
    }
}

/// Assemble ColumnKeyInfo for all columns, augmented with PK and FK metadata.
/// `col_info` provides (name, is_nullable, is_auto_generated) for every column in order.
/// Identical logic shared by both postgres and mysql drivers.
pub fn assemble_key_info(
    col_info: impl Iterator<Item = (String, bool, bool)>,
    pk_names: impl Iterator<Item = String>,
    fk_triples: impl Iterator<Item = (String, String, String)>,
) -> Vec<ColumnKeyInfo> {
    use std::collections::HashMap;

    let pk_cols: std::collections::HashSet<String> = pk_names.collect();

    let mut fk_map: HashMap<String, (String, String)> = HashMap::new();
    for (col, ref_table, ref_col) in fk_triples {
        fk_map.entry(col).or_insert((ref_table, ref_col));
    }

    col_info
        .map(|(col, is_nullable, is_auto_generated)| {
            let is_primary = pk_cols.contains(&col);
            let (fk_ref_table, fk_ref_column) = if let Some((t, c)) = fk_map.get(&col) {
                (Some(t.clone()), Some(c.clone()))
            } else {
                (None, None)
            };
            ColumnKeyInfo {
                column_name: col,
                is_primary,
                fk_ref_table,
                fk_ref_column,
                is_nullable,
                is_auto_generated,
            }
        })
        .collect()
}

/// Filter active entries from a filter list (non-empty value, valid between range, or null filter).
pub fn active_filters(entries: &[FilterEntry]) -> Vec<&FilterEntry> {
    entries
        .iter()
        .filter(|f| {
            if f.null_filter.is_some() { return true; }
            if f.value.is_empty() { return false; }
            if f.operator.as_str() == "between" {
                return f.value2.as_deref().map_or(false, |v| !v.is_empty());
            }
            true
        })
        .collect()
}

/// Build a QueryResult from extracted row data plus a display SQL string.
pub fn build_query_result(
    columns: Vec<String>,
    column_types: Vec<String>,
    column_raw_types: Vec<String>,
    rows: Vec<Vec<Value>>,
    sql: String,
) -> QueryResult {
    let row_count = rows.len();
    QueryResult {
        columns,
        column_types,
        column_raw_types,
        rows,
        row_count,
        sql,
        execution_time_ms: 0,
    }
}

/// Extract column names, category types, raw types, and row values from a non-empty row slice.
/// `type_category` maps a DB type name to a display category string.
/// `value_fn` converts a row cell at index i to a JSON Value.
pub fn extract_rows<R>(
    rows: &[R],
    type_category: fn(&str) -> &'static str,
    value_fn: fn(&R, usize) -> Value,
) -> (Vec<String>, Vec<String>, Vec<String>, Vec<Vec<Value>>)
where
    R: Row,
{
    let columns: Vec<String> = rows[0]
        .columns()
        .iter()
        .map(|c| Column::name(c).to_string())
        .collect();
    let column_types: Vec<String> = rows[0]
        .columns()
        .iter()
        .map(|c| type_category(c.type_info().name()).to_string())
        .collect();
    let column_raw_types: Vec<String> = rows[0]
        .columns()
        .iter()
        .map(|c| c.type_info().name().to_lowercase())
        .collect();
    let result_rows: Vec<Vec<Value>> = rows
        .iter()
        .map(|row| (0..row.columns().len()).map(|i| value_fn(row, i)).collect())
        .collect();
    (columns, column_types, column_raw_types, result_rows)
}

/// Push parameterized WHERE conditions onto a query builder.
/// Works for both Postgres and MySql via trait bounds.
pub fn push_conditions<DB>(
    qb: &mut sqlx::QueryBuilder<'_, DB>,
    active: &[&FilterEntry],
    dialect: &DbDialect,
)
where
    DB: sqlx::Database,
    for<'q> String: sqlx::Encode<'q, DB> + sqlx::Type<DB>,
    for<'q> bool: sqlx::Encode<'q, DB> + sqlx::Type<DB>,
{
    for (i, f) in active.iter().enumerate() {
        if i > 0 { qb.push(" AND "); }
        let quoted_col = dialect.quote_ident(&f.col);
        if let Some(nf) = &f.null_filter {
            if nf == "is_null" {
                qb.push(format!("{} IS NULL", quoted_col));
            } else {
                qb.push(format!("{} IS NOT NULL", quoted_col));
            }
            continue;
        }
        match f.col_type.as_str() {
            "number" => {
                let cast_text = dialect.cast_text();
                let num_cast = dialect.numeric_cast();
                if f.exact {
                    qb.push(format!("CAST({} AS {}) = ", quoted_col, cast_text));
                    qb.push_bind(f.value.clone());
                } else {
                    match f.operator.as_str() {
                        "gt" | "gte" | "lt" | "lte" => {
                            let sql_op = match f.operator.as_str() {
                                "gt" => ">", "gte" => ">=", "lt" => "<", _ => "<=",
                            };
                            qb.push(format!("{} {} ", quoted_col, sql_op));
                            qb.push_bind(f.value.clone());
                            qb.push(num_cast);
                        }
                        "between" => {
                            let val2 = f.value2.as_deref().unwrap_or("").to_string();
                            qb.push(format!("{} BETWEEN ", quoted_col));
                            qb.push_bind(f.value.clone());
                            qb.push(format!("{} AND ", num_cast));
                            qb.push_bind(val2);
                            qb.push(num_cast);
                        }
                        _ => {
                            qb.push(format!("{} = ", quoted_col));
                            qb.push_bind(f.value.clone());
                            qb.push(num_cast);
                        }
                    }
                }
            }
            "boolean" => {
                let b = f.value.to_lowercase() == "true";
                qb.push(format!("{} = ", quoted_col));
                qb.push_bind(b);
            }
            "date" | "time" | "datetime" => {
                let val = f.value.replace('T', " ");
                let cast = dialect.datetime_cast(f.col_type.as_str());
                match f.operator.as_str() {
                    "gt" | "gte" | "lt" | "lte" => {
                        let sql_op = match f.operator.as_str() {
                            "gt" => ">", "gte" => ">=", "lt" => "<", _ => "<=",
                        };
                        qb.push(format!("{} {} ", quoted_col, sql_op));
                        qb.push_bind(val);
                        qb.push(cast);
                    }
                    "between" => {
                        let val2 = f.value2.as_deref().unwrap_or("").replace('T', " ");
                        qb.push(format!("{} BETWEEN ", quoted_col));
                        qb.push_bind(val);
                        qb.push(format!("{} AND ", cast));
                        qb.push_bind(val2);
                        qb.push(cast);
                    }
                    _ => {
                        qb.push(format!("{} = ", quoted_col));
                        qb.push_bind(val);
                        qb.push(cast);
                    }
                }
            }
            col_type => {
                let filter_col = dialect.text_filter_col(&quoted_col, col_type);
                if f.exact {
                    qb.push(format!("{} = ", filter_col));
                    qb.push_bind(f.value.clone());
                } else {
                    let prefix = dialect.like_prefix(f.case_sensitive);
                    let op = dialect.like_op(f.case_sensitive);
                    qb.push(format!("{}{} {} ", prefix, filter_col, op));
                    qb.push_bind(format!("%{}%", f.value));
                }
            }
        }
    }
}

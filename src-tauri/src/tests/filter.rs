use serde_json::Value;
use crate::db::filter::{active_filters, assemble_key_info, build_query_result, DbDialect};
use crate::models::FilterEntry;

fn make_filter(col: &str, value: &str, col_type: &str) -> FilterEntry {
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

// ── quote_ident ──────────────────────────────────────────────────────────────

#[test]
fn quote_ident_postgres() {
    assert_eq!(DbDialect::Postgres.quote_ident("name"), "\"name\"");
    assert_eq!(DbDialect::Postgres.quote_ident(r#"na"me"#), r#""na""me""#);
}

#[test]
fn quote_ident_mysql() {
    assert_eq!(DbDialect::Mysql.quote_ident("name"), "`name`");
    assert_eq!(DbDialect::Mysql.quote_ident("na`me"), "`na``me`");
}

// ── cast_text / numeric_cast ─────────────────────────────────────────────────

#[test]
fn cast_text() {
    assert_eq!(DbDialect::Postgres.cast_text(), "TEXT");
    assert_eq!(DbDialect::Mysql.cast_text(), "CHAR");
}

#[test]
fn numeric_cast() {
    assert_eq!(DbDialect::Postgres.numeric_cast(), "::numeric");
    assert_eq!(DbDialect::Mysql.numeric_cast(), "");
}

// ── datetime_cast ────────────────────────────────────────────────────────────

#[test]
fn datetime_cast_postgres() {
    assert_eq!(DbDialect::Postgres.datetime_cast("date"), "::date");
    assert_eq!(DbDialect::Postgres.datetime_cast("time"), "::time");
    assert_eq!(DbDialect::Postgres.datetime_cast("datetime"), "::timestamp");
    assert_eq!(DbDialect::Postgres.datetime_cast("other"), "::timestamp");
}

#[test]
fn datetime_cast_mysql() {
    assert_eq!(DbDialect::Mysql.datetime_cast("date"), "");
    assert_eq!(DbDialect::Mysql.datetime_cast("time"), "");
    assert_eq!(DbDialect::Mysql.datetime_cast("datetime"), "");
}

// ── like_prefix ──────────────────────────────────────────────────────────────

#[test]
fn like_prefix() {
    assert_eq!(DbDialect::Mysql.like_prefix(true), "BINARY ");
    assert_eq!(DbDialect::Mysql.like_prefix(false), "");
    assert_eq!(DbDialect::Postgres.like_prefix(true), "");
    assert_eq!(DbDialect::Postgres.like_prefix(false), "");
}

// ── like_op ──────────────────────────────────────────────────────────────────

#[test]
fn like_op() {
    assert_eq!(DbDialect::Postgres.like_op(false), "ILIKE");
    assert_eq!(DbDialect::Postgres.like_op(true), "LIKE");
    assert_eq!(DbDialect::Mysql.like_op(false), "LIKE");
    assert_eq!(DbDialect::Mysql.like_op(true), "LIKE");
}

// ── text_filter_col ──────────────────────────────────────────────────────────

#[test]
fn text_filter_col_postgres_json_other() {
    assert_eq!(
        DbDialect::Postgres.text_filter_col("\"data\"", "json"),
        "CAST(\"data\" AS TEXT)"
    );
    assert_eq!(
        DbDialect::Postgres.text_filter_col("\"data\"", "other"),
        "CAST(\"data\" AS TEXT)"
    );
}

#[test]
fn text_filter_col_passes_through() {
    assert_eq!(
        DbDialect::Postgres.text_filter_col("\"name\"", "text"),
        "\"name\""
    );
    assert_eq!(
        DbDialect::Mysql.text_filter_col("`data`", "json"),
        "`data`"
    );
    assert_eq!(
        DbDialect::Mysql.text_filter_col("`name`", "text"),
        "`name`"
    );
}

// ── build_order_clause ───────────────────────────────────────────────────────

#[test]
fn build_order_clause_empty() {
    assert_eq!(DbDialect::Postgres.build_order_clause(&[]), "");
}

#[test]
fn build_order_clause_single_asc() {
    assert_eq!(
        DbDialect::Postgres.build_order_clause(&[("id".to_string(), false)]),
        " ORDER BY \"id\" ASC"
    );
}

#[test]
fn build_order_clause_single_desc() {
    assert_eq!(
        DbDialect::Postgres.build_order_clause(&[("name".to_string(), true)]),
        " ORDER BY \"name\" DESC"
    );
}

#[test]
fn build_order_clause_multi() {
    assert_eq!(
        DbDialect::Postgres.build_order_clause(&[
            ("a".to_string(), false),
            ("b".to_string(), true),
        ]),
        " ORDER BY \"a\" ASC, \"b\" DESC"
    );
}

// ── display_filter_part ──────────────────────────────────────────────────────

#[test]
fn display_filter_null_filter() {
    let mut f = make_filter("col", "", "text");
    f.null_filter = Some("is_null".to_string());
    assert_eq!(
        DbDialect::Postgres.display_filter_part(&f),
        "\"col\" IS NULL"
    );

    f.null_filter = Some("is_not_null".to_string());
    assert_eq!(
        DbDialect::Postgres.display_filter_part(&f),
        "\"col\" IS NOT NULL"
    );
}

#[test]
fn display_filter_number_exact() {
    let mut f = make_filter("price", "42", "number");
    f.exact = true;
    assert_eq!(
        DbDialect::Postgres.display_filter_part(&f),
        "CAST(\"price\" AS TEXT) = '42'"
    );
    assert_eq!(
        DbDialect::Mysql.display_filter_part(&f),
        "CAST(`price` AS CHAR) = '42'"
    );
}

#[test]
fn display_filter_number_operators() {
    let mut f = make_filter("age", "18", "number");
    f.operator = "gt".to_string();
    assert_eq!(DbDialect::Postgres.display_filter_part(&f), "\"age\" > 18");

    f.operator = "gte".to_string();
    assert_eq!(DbDialect::Postgres.display_filter_part(&f), "\"age\" >= 18");

    f.operator = "lt".to_string();
    assert_eq!(DbDialect::Postgres.display_filter_part(&f), "\"age\" < 18");

    f.operator = "lte".to_string();
    assert_eq!(DbDialect::Postgres.display_filter_part(&f), "\"age\" <= 18");
}

#[test]
fn display_filter_number_between() {
    let mut f = make_filter("score", "10", "number");
    f.operator = "between".to_string();
    f.value2 = Some("20".to_string());
    assert_eq!(
        DbDialect::Postgres.display_filter_part(&f),
        "\"score\" BETWEEN 10 AND 20"
    );
}

#[test]
fn display_filter_boolean_postgres() {
    let mut f = make_filter("active", "true", "boolean");
    assert_eq!(DbDialect::Postgres.display_filter_part(&f), "\"active\" = true");

    f.value = "false".to_string();
    assert_eq!(DbDialect::Postgres.display_filter_part(&f), "\"active\" = false");
}

#[test]
fn display_filter_boolean_mysql() {
    let mut f = make_filter("active", "true", "boolean");
    assert_eq!(DbDialect::Mysql.display_filter_part(&f), "`active` = 1");

    f.value = "false".to_string();
    assert_eq!(DbDialect::Mysql.display_filter_part(&f), "`active` = 0");
}

#[test]
fn display_filter_datetime_postgres() {
    let mut f = make_filter("created_at", "2024-01-15T10:30:00", "datetime");
    assert_eq!(
        DbDialect::Postgres.display_filter_part(&f),
        "\"created_at\" = '2024-01-15 10:30:00'::timestamp"
    );

    f.operator = "gt".to_string();
    assert_eq!(
        DbDialect::Postgres.display_filter_part(&f),
        "\"created_at\" > '2024-01-15 10:30:00'::timestamp"
    );

    f.operator = "between".to_string();
    f.value2 = Some("2024-12-31T23:59:59".to_string());
    assert_eq!(
        DbDialect::Postgres.display_filter_part(&f),
        "\"created_at\" BETWEEN '2024-01-15 10:30:00'::timestamp AND '2024-12-31 23:59:59'::timestamp"
    );
}

#[test]
fn display_filter_date_postgres() {
    let f = make_filter("dob", "2000-06-01", "date");
    assert_eq!(
        DbDialect::Postgres.display_filter_part(&f),
        "\"dob\" = '2000-06-01'::date"
    );
}

#[test]
fn display_filter_datetime_mysql() {
    let f = make_filter("ts", "2024-01-15T10:30:00", "datetime");
    assert_eq!(
        DbDialect::Mysql.display_filter_part(&f),
        "`ts` = '2024-01-15 10:30:00'"
    );
}

#[test]
fn display_filter_json_postgres() {
    let mut f = make_filter("data", "foo", "json");
    // exact
    f.exact = true;
    assert_eq!(
        DbDialect::Postgres.display_filter_part(&f),
        "CAST(\"data\" AS TEXT) = 'foo'"
    );
    // ilike
    f.exact = false;
    f.case_sensitive = false;
    assert_eq!(
        DbDialect::Postgres.display_filter_part(&f),
        "CAST(\"data\" AS TEXT) ILIKE '%foo%'"
    );
    // case-sensitive like
    f.case_sensitive = true;
    assert_eq!(
        DbDialect::Postgres.display_filter_part(&f),
        "CAST(\"data\" AS TEXT) LIKE '%foo%'"
    );
}

#[test]
fn display_filter_json_mysql() {
    let mut f = make_filter("data", "foo", "json");
    f.case_sensitive = true;
    assert_eq!(
        DbDialect::Mysql.display_filter_part(&f),
        "BINARY `data` LIKE '%foo%'"
    );

    f.case_sensitive = false;
    assert_eq!(
        DbDialect::Mysql.display_filter_part(&f),
        "`data` LIKE '%foo%'"
    );
}

#[test]
fn display_filter_text_postgres() {
    let mut f = make_filter("name", "alice", "text");
    // case-insensitive (default) → ILIKE
    assert_eq!(
        DbDialect::Postgres.display_filter_part(&f),
        "\"name\" ILIKE '%alice%'"
    );
    // exact
    f.exact = true;
    assert_eq!(
        DbDialect::Postgres.display_filter_part(&f),
        "\"name\" = 'alice'"
    );
    // case-sensitive
    f.exact = false;
    f.case_sensitive = true;
    assert_eq!(
        DbDialect::Postgres.display_filter_part(&f),
        "\"name\" LIKE '%alice%'"
    );
}

#[test]
fn display_filter_text_mysql() {
    let mut f = make_filter("name", "alice", "text");
    assert_eq!(
        DbDialect::Mysql.display_filter_part(&f),
        "`name` LIKE '%alice%'"
    );
    f.case_sensitive = true;
    assert_eq!(
        DbDialect::Mysql.display_filter_part(&f),
        "BINARY `name` LIKE '%alice%'"
    );
}

// ── build_display_sql ────────────────────────────────────────────────────────

#[test]
fn build_display_sql_format() {
    let sql = DbDialect::Postgres.build_display_sql(
        "users",
        &["\"age\" > 18".to_string()],
        "",
        10,
        20,
    );
    assert_eq!(
        sql,
        "SELECT * FROM \"users\" WHERE \"age\" > 18  LIMIT 10 OFFSET 20"
    );
}

#[test]
fn build_display_sql_with_order() {
    let sql = DbDialect::Postgres.build_display_sql(
        "users",
        &["\"age\" > 18".to_string()],
        " ORDER BY \"id\" ASC",
        5,
        0,
    );
    assert_eq!(
        sql,
        "SELECT * FROM \"users\" WHERE \"age\" > 18 ORDER BY \"id\" ASC  LIMIT 5 OFFSET 0"
    );
}

// ── active_filters ───────────────────────────────────────────────────────────

#[test]
fn active_filters_empty_value_excluded() {
    let f = make_filter("col", "", "text");
    assert_eq!(active_filters(&[f]).len(), 0);
}

#[test]
fn active_filters_null_filter_always_included() {
    let mut f = make_filter("col", "", "text");
    f.null_filter = Some("is_null".to_string());
    assert_eq!(active_filters(&[f]).len(), 1);
}

#[test]
fn active_filters_between_needs_value2() {
    let mut f = make_filter("score", "10", "number");
    f.operator = "between".to_string();
    // no value2 → excluded
    assert_eq!(active_filters(&[f]).len(), 0);

    let mut f2 = make_filter("score", "10", "number");
    f2.operator = "between".to_string();
    f2.value2 = Some("20".to_string());
    assert_eq!(active_filters(&[f2]).len(), 1);

    // empty value2 → excluded
    let mut f3 = make_filter("score", "10", "number");
    f3.operator = "between".to_string();
    f3.value2 = Some(String::new());
    assert_eq!(active_filters(&[f3]).len(), 0);
}

#[test]
fn active_filters_non_empty_value_included() {
    let f = make_filter("name", "alice", "text");
    assert_eq!(active_filters(&[f]).len(), 1);
}

// ── build_query_result ───────────────────────────────────────────────────────

#[test]
fn build_query_result_fields() {
    let cols = vec!["id".to_string(), "name".to_string()];
    let types = vec!["number".to_string(), "text".to_string()];
    let raw = vec!["int4".to_string(), "varchar".to_string()];
    let rows: Vec<Vec<Value>> = vec![
        vec![Value::from(1), Value::from("a")],
        vec![Value::from(2), Value::from("b")],
        vec![Value::from(3), Value::from("c")],
    ];
    let result = build_query_result(cols.clone(), types.clone(), raw.clone(), rows, "SELECT 1".to_string());

    assert_eq!(result.row_count, 3);
    assert_eq!(result.columns, cols);
    assert_eq!(result.column_types, types);
    assert_eq!(result.column_raw_types, raw);
    assert_eq!(result.sql, "SELECT 1");
}

// ── assemble_key_info ────────────────────────────────────────────────────────

#[test]
fn assemble_key_info_primary_key() {
    let col_info = vec![("id".to_string(), false, true)].into_iter();
    let pk_names = vec!["id".to_string()].into_iter();
    let fk_triples = std::iter::empty();

    let result = assemble_key_info(col_info, pk_names, fk_triples);
    assert_eq!(result.len(), 1);
    assert_eq!(result[0].column_name, "id");
    assert!(result[0].is_primary);
    assert!(!result[0].is_nullable);
    assert!(result[0].is_auto_generated);
    assert!(result[0].fk_ref_table.is_none());
    assert!(result[0].fk_ref_column.is_none());
}

#[test]
fn assemble_key_info_foreign_key() {
    let col_info = vec![
        ("id".to_string(), false, true),
        ("user_id".to_string(), true, false),
    ]
    .into_iter();
    let pk_names = vec!["id".to_string()].into_iter();
    let fk_triples = vec![("user_id".to_string(), "users".to_string(), "id".to_string())].into_iter();

    let result = assemble_key_info(col_info, pk_names, fk_triples);
    assert_eq!(result.len(), 2);

    let fk = &result[1];
    assert_eq!(fk.column_name, "user_id");
    assert!(!fk.is_primary);
    assert!(fk.is_nullable);
    assert!(!fk.is_auto_generated);
    assert_eq!(fk.fk_ref_table.as_deref(), Some("users"));
    assert_eq!(fk.fk_ref_column.as_deref(), Some("id"));
}

#[test]
fn assemble_key_info_no_pk_or_fk() {
    let col_info = vec![("name".to_string(), true, false)].into_iter();
    let result = assemble_key_info(col_info, std::iter::empty(), std::iter::empty());
    assert!(!result[0].is_primary);
    assert!(result[0].is_nullable);
    assert!(result[0].fk_ref_table.is_none());
}

// ── build_order_clause (MySQL) ────────────────────────────────────────────────

#[test]
fn build_order_clause_mysql_empty() {
    assert_eq!(DbDialect::Mysql.build_order_clause(&[]), "");
}

#[test]
fn build_order_clause_mysql_asc_and_desc() {
    assert_eq!(
        DbDialect::Mysql.build_order_clause(&[("id".to_string(), false)]),
        " ORDER BY `id` ASC"
    );
    assert_eq!(
        DbDialect::Mysql.build_order_clause(&[("name".to_string(), true)]),
        " ORDER BY `name` DESC"
    );
}

#[test]
fn build_order_clause_mysql_multi() {
    assert_eq!(
        DbDialect::Mysql.build_order_clause(&[
            ("a".to_string(), false),
            ("b".to_string(), true),
        ]),
        " ORDER BY `a` ASC, `b` DESC"
    );
}

// ── build_display_sql (MySQL) ─────────────────────────────────────────────────

#[test]
fn build_display_sql_mysql_format() {
    let sql = DbDialect::Mysql.build_display_sql(
        "users",
        &["`age` > 18".to_string()],
        "",
        10,
        20,
    );
    assert_eq!(
        sql,
        "SELECT * FROM `users` WHERE `age` > 18  LIMIT 10 OFFSET 20"
    );
}

#[test]
fn build_display_sql_mysql_with_order() {
    let sql = DbDialect::Mysql.build_display_sql(
        "users",
        &["`age` > 18".to_string()],
        " ORDER BY `id` ASC",
        5,
        0,
    );
    assert_eq!(
        sql,
        "SELECT * FROM `users` WHERE `age` > 18 ORDER BY `id` ASC  LIMIT 5 OFFSET 0"
    );
}

// ── display_filter_part: null_filter (MySQL) ──────────────────────────────────

#[test]
fn display_filter_null_filter_mysql() {
    let mut f = make_filter("col", "", "text");
    f.null_filter = Some("is_null".to_string());
    assert_eq!(DbDialect::Mysql.display_filter_part(&f), "`col` IS NULL");

    f.null_filter = Some("is_not_null".to_string());
    assert_eq!(
        DbDialect::Mysql.display_filter_part(&f),
        "`col` IS NOT NULL"
    );
}

// ── display_filter_part: number operators (MySQL) ─────────────────────────────

#[test]
fn display_filter_number_operators_mysql() {
    let mut f = make_filter("age", "18", "number");

    f.operator = "gt".to_string();
    assert_eq!(DbDialect::Mysql.display_filter_part(&f), "`age` > 18");

    f.operator = "gte".to_string();
    assert_eq!(DbDialect::Mysql.display_filter_part(&f), "`age` >= 18");

    f.operator = "lt".to_string();
    assert_eq!(DbDialect::Mysql.display_filter_part(&f), "`age` < 18");

    f.operator = "lte".to_string();
    assert_eq!(DbDialect::Mysql.display_filter_part(&f), "`age` <= 18");
}

#[test]
fn display_filter_number_between_mysql() {
    let mut f = make_filter("score", "10", "number");
    f.operator = "between".to_string();
    f.value2 = Some("20".to_string());
    assert_eq!(
        DbDialect::Mysql.display_filter_part(&f),
        "`score` BETWEEN 10 AND 20"
    );
}

// ── display_filter_part: datetime operators (MySQL) ───────────────────────────

#[test]
fn display_filter_datetime_mysql_operators() {
    let mut f = make_filter("ts", "2024-01-15T10:30:00", "datetime");

    f.operator = "gt".to_string();
    assert_eq!(
        DbDialect::Mysql.display_filter_part(&f),
        "`ts` > '2024-01-15 10:30:00'"
    );

    f.operator = "gte".to_string();
    assert_eq!(
        DbDialect::Mysql.display_filter_part(&f),
        "`ts` >= '2024-01-15 10:30:00'"
    );

    f.operator = "lt".to_string();
    assert_eq!(
        DbDialect::Mysql.display_filter_part(&f),
        "`ts` < '2024-01-15 10:30:00'"
    );

    f.operator = "lte".to_string();
    assert_eq!(
        DbDialect::Mysql.display_filter_part(&f),
        "`ts` <= '2024-01-15 10:30:00'"
    );
}

#[test]
fn display_filter_datetime_mysql_between() {
    let mut f = make_filter("ts", "2024-01-01T00:00:00", "datetime");
    f.operator = "between".to_string();
    f.value2 = Some("2024-12-31T23:59:59".to_string());
    assert_eq!(
        DbDialect::Mysql.display_filter_part(&f),
        "`ts` BETWEEN '2024-01-01 00:00:00' AND '2024-12-31 23:59:59'"
    );
}

// ── display_filter_part: date and time types (MySQL) ──────────────────────────

#[test]
fn display_filter_date_mysql() {
    let f = make_filter("dob", "2000-06-01", "date");
    assert_eq!(
        DbDialect::Mysql.display_filter_part(&f),
        "`dob` = '2000-06-01'"
    );
}

#[test]
fn display_filter_time_postgres() {
    let f = make_filter("start_time", "08:00:00", "time");
    assert_eq!(
        DbDialect::Postgres.display_filter_part(&f),
        "\"start_time\" = '08:00:00'::time"
    );
}

#[test]
fn display_filter_time_mysql() {
    let f = make_filter("start_time", "08:00:00", "time");
    assert_eq!(
        DbDialect::Mysql.display_filter_part(&f),
        "`start_time` = '08:00:00'"
    );
}

// ── display_filter_part: text exact (MySQL) ───────────────────────────────────

#[test]
fn display_filter_text_exact_mysql() {
    let mut f = make_filter("name", "alice", "text");
    f.exact = true;
    assert_eq!(
        DbDialect::Mysql.display_filter_part(&f),
        "`name` = 'alice'"
    );
}

// ── display_filter_part: other col_type (catch-all) ───────────────────────────

#[test]
fn display_filter_other_type_postgres() {
    let mut f = make_filter("data", "foo", "other");
    // Postgres: "other" → wrapped in CAST, treated like json
    f.exact = true;
    assert_eq!(
        DbDialect::Postgres.display_filter_part(&f),
        "CAST(\"data\" AS TEXT) = 'foo'"
    );
    f.exact = false;
    f.case_sensitive = false;
    assert_eq!(
        DbDialect::Postgres.display_filter_part(&f),
        "CAST(\"data\" AS TEXT) ILIKE '%foo%'"
    );
}

#[test]
fn display_filter_other_type_mysql() {
    let mut f = make_filter("data", "foo", "other");
    f.case_sensitive = false;
    assert_eq!(
        DbDialect::Mysql.display_filter_part(&f),
        "`data` LIKE '%foo%'"
    );
    f.exact = true;
    assert_eq!(
        DbDialect::Mysql.display_filter_part(&f),
        "`data` = 'foo'"
    );
}

// ── display_filter_part: datetime operators (Postgres) ───────────────────────

#[test]
fn display_filter_datetime_postgres_gte_lt_lte() {
    let mut f = make_filter("created_at", "2024-06-01T12:00:00", "datetime");

    f.operator = "gte".to_string();
    assert_eq!(
        DbDialect::Postgres.display_filter_part(&f),
        "\"created_at\" >= '2024-06-01 12:00:00'::timestamp"
    );

    f.operator = "lt".to_string();
    assert_eq!(
        DbDialect::Postgres.display_filter_part(&f),
        "\"created_at\" < '2024-06-01 12:00:00'::timestamp"
    );

    f.operator = "lte".to_string();
    assert_eq!(
        DbDialect::Postgres.display_filter_part(&f),
        "\"created_at\" <= '2024-06-01 12:00:00'::timestamp"
    );
}

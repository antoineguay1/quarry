use crate::db::postgres::table_data_sql;

// ── table_data_sql ────────────────────────────────────────────────────────────

#[test]
fn table_data_sql_no_sort() {
    let sql = table_data_sql("users", &[], 10, 0);
    assert_eq!(sql, r#"SELECT * FROM "users" LIMIT 10 OFFSET 0"#);
}

#[test]
fn table_data_sql_with_offset() {
    let sql = table_data_sql("orders", &[], 25, 50);
    assert_eq!(sql, r#"SELECT * FROM "orders" LIMIT 25 OFFSET 50"#);
}

#[test]
fn table_data_sql_sort_asc() {
    let sql = table_data_sql("orders", &[("id".to_string(), false)], 25, 0);
    assert_eq!(sql, r#"SELECT * FROM "orders" ORDER BY "id" ASC LIMIT 25 OFFSET 0"#);
}

#[test]
fn table_data_sql_sort_desc() {
    let sql = table_data_sql("products", &[("created_at".to_string(), true)], 100, 0);
    assert_eq!(
        sql,
        r#"SELECT * FROM "products" ORDER BY "created_at" DESC LIMIT 100 OFFSET 0"#
    );
}

#[test]
fn table_data_sql_multi_sort() {
    let sql = table_data_sql(
        "events",
        &[("date".to_string(), false), ("id".to_string(), true)],
        50,
        0,
    );
    assert_eq!(
        sql,
        r#"SELECT * FROM "events" ORDER BY "date" ASC, "id" DESC LIMIT 50 OFFSET 0"#
    );
}

#[test]
fn table_data_sql_quotes_double_quote_in_table_name() {
    // table names containing double-quotes are escaped by doubling them
    let sql = table_data_sql(r#"my"table"#, &[], 10, 0);
    assert_eq!(sql, r#"SELECT * FROM "my""table" LIMIT 10 OFFSET 0"#);
}

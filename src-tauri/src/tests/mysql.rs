use crate::db::mysql::table_data_sql;

// ── table_data_sql ────────────────────────────────────────────────────────────

#[test]
fn no_sort_no_offset() {
    let sql = table_data_sql("users", &[], 50, 0);
    assert_eq!(sql, "SELECT * FROM `users` LIMIT 50 OFFSET 0");
}

#[test]
fn single_sort_asc() {
    let sql = table_data_sql("orders", &[("id".to_string(), false)], 10, 0);
    assert_eq!(sql, "SELECT * FROM `orders` ORDER BY `id` ASC LIMIT 10 OFFSET 0");
}

#[test]
fn single_sort_desc() {
    let sql = table_data_sql("events", &[("created_at".to_string(), true)], 25, 0);
    assert_eq!(sql, "SELECT * FROM `events` ORDER BY `created_at` DESC LIMIT 25 OFFSET 0");
}

#[test]
fn multi_sort() {
    let sort = vec![("last_name".to_string(), false), ("first_name".to_string(), false)];
    let sql = table_data_sql("contacts", &sort, 100, 0);
    assert_eq!(
        sql,
        "SELECT * FROM `contacts` ORDER BY `last_name` ASC, `first_name` ASC LIMIT 100 OFFSET 0"
    );
}

#[test]
fn mixed_sort_asc_desc() {
    let sort = vec![("score".to_string(), true), ("name".to_string(), false)];
    let sql = table_data_sql("players", &sort, 20, 40);
    assert_eq!(
        sql,
        "SELECT * FROM `players` ORDER BY `score` DESC, `name` ASC LIMIT 20 OFFSET 40"
    );
}

#[test]
fn limit_and_offset() {
    let sql = table_data_sql("logs", &[], 50, 150);
    assert_eq!(sql, "SELECT * FROM `logs` LIMIT 50 OFFSET 150");
}

#[test]
fn table_name_with_backtick_is_escaped() {
    // A table name containing a backtick must be double-backtick-escaped.
    let sql = table_data_sql("my`table", &[], 10, 0);
    assert_eq!(sql, "SELECT * FROM `my``table` LIMIT 10 OFFSET 0");
}

#[test]
fn table_name_with_spaces() {
    let sql = table_data_sql("my table", &[], 5, 0);
    assert_eq!(sql, "SELECT * FROM `my table` LIMIT 5 OFFSET 0");
}

#[test]
fn column_with_special_chars_is_escaped() {
    let sort = vec![("some`col".to_string(), false)];
    let sql = table_data_sql("t", &sort, 1, 0);
    assert_eq!(sql, "SELECT * FROM `t` ORDER BY `some``col` ASC LIMIT 1 OFFSET 0");
}

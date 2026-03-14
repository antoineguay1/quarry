use crate::db::filter::{push_conditions, DbDialect};
use crate::models::FilterEntry;
use sqlx::QueryBuilder;

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

// ── NULL filters ─────────────────────────────────────────────────────────────

#[test]
fn null_is_null() {
    let mut f = make_filter("age", "", "number");
    f.null_filter = Some("is_null".to_string());
    let refs: Vec<&FilterEntry> = vec![&f];

    let mut qb = QueryBuilder::<sqlx::Postgres>::new("");
    push_conditions(&mut qb, &refs, &DbDialect::Postgres);
    assert_eq!(qb.sql(), "\"age\" IS NULL");
}

#[test]
fn null_is_not_null() {
    let mut f = make_filter("age", "", "number");
    f.null_filter = Some("is_not_null".to_string());
    let refs: Vec<&FilterEntry> = vec![&f];

    let mut qb = QueryBuilder::<sqlx::Postgres>::new("");
    push_conditions(&mut qb, &refs, &DbDialect::Postgres);
    assert_eq!(qb.sql(), "\"age\" IS NOT NULL");
}

// ── number type ───────────────────────────────────────────────────────────────

#[test]
fn number_eq() {
    let f = make_filter("age", "25", "number");
    let refs: Vec<&FilterEntry> = vec![&f];

    let mut qb = QueryBuilder::<sqlx::Postgres>::new("");
    push_conditions(&mut qb, &refs, &DbDialect::Postgres);
    assert_eq!(qb.sql(), "\"age\" = $1::numeric");
}

#[test]
fn number_exact() {
    let mut f = make_filter("age", "25", "number");
    f.exact = true;
    let refs: Vec<&FilterEntry> = vec![&f];

    let mut qb = QueryBuilder::<sqlx::Postgres>::new("");
    push_conditions(&mut qb, &refs, &DbDialect::Postgres);
    assert_eq!(qb.sql(), "CAST(\"age\" AS TEXT) = $1");
}

#[test]
fn number_gt() {
    let mut f = make_filter("age", "18", "number");
    f.operator = "gt".to_string();
    let refs: Vec<&FilterEntry> = vec![&f];

    let mut qb = QueryBuilder::<sqlx::Postgres>::new("");
    push_conditions(&mut qb, &refs, &DbDialect::Postgres);
    assert_eq!(qb.sql(), "\"age\" > $1::numeric");
}

#[test]
fn number_gte() {
    let mut f = make_filter("age", "18", "number");
    f.operator = "gte".to_string();
    let refs: Vec<&FilterEntry> = vec![&f];

    let mut qb = QueryBuilder::<sqlx::Postgres>::new("");
    push_conditions(&mut qb, &refs, &DbDialect::Postgres);
    assert_eq!(qb.sql(), "\"age\" >= $1::numeric");
}

#[test]
fn number_lt() {
    let mut f = make_filter("age", "65", "number");
    f.operator = "lt".to_string();
    let refs: Vec<&FilterEntry> = vec![&f];

    let mut qb = QueryBuilder::<sqlx::Postgres>::new("");
    push_conditions(&mut qb, &refs, &DbDialect::Postgres);
    assert_eq!(qb.sql(), "\"age\" < $1::numeric");
}

#[test]
fn number_lte() {
    let mut f = make_filter("age", "65", "number");
    f.operator = "lte".to_string();
    let refs: Vec<&FilterEntry> = vec![&f];

    let mut qb = QueryBuilder::<sqlx::Postgres>::new("");
    push_conditions(&mut qb, &refs, &DbDialect::Postgres);
    assert_eq!(qb.sql(), "\"age\" <= $1::numeric");
}

#[test]
fn number_between() {
    let mut f = make_filter("score", "10", "number");
    f.operator = "between".to_string();
    f.value2 = Some("20".to_string());
    let refs: Vec<&FilterEntry> = vec![&f];

    let mut qb = QueryBuilder::<sqlx::Postgres>::new("");
    push_conditions(&mut qb, &refs, &DbDialect::Postgres);
    assert_eq!(qb.sql(), "\"score\" BETWEEN $1::numeric AND $2::numeric");
}

// ── boolean type ──────────────────────────────────────────────────────────────

#[test]
fn boolean_eq() {
    let f = make_filter("active", "true", "boolean");
    let refs: Vec<&FilterEntry> = vec![&f];

    let mut qb = QueryBuilder::<sqlx::Postgres>::new("");
    push_conditions(&mut qb, &refs, &DbDialect::Postgres);
    assert_eq!(qb.sql(), "\"active\" = $1");
}

// ── datetime / date types ─────────────────────────────────────────────────────

#[test]
fn datetime_eq() {
    let f = make_filter("ts", "2024-01-15T10:30:00", "datetime");
    let refs: Vec<&FilterEntry> = vec![&f];

    let mut qb = QueryBuilder::<sqlx::Postgres>::new("");
    push_conditions(&mut qb, &refs, &DbDialect::Postgres);
    assert_eq!(qb.sql(), "\"ts\" = $1::timestamp");
}

#[test]
fn date_eq() {
    let f = make_filter("dob", "2000-06-01", "date");
    let refs: Vec<&FilterEntry> = vec![&f];

    let mut qb = QueryBuilder::<sqlx::Postgres>::new("");
    push_conditions(&mut qb, &refs, &DbDialect::Postgres);
    assert_eq!(qb.sql(), "\"dob\" = $1::date");
}

#[test]
fn datetime_between() {
    let mut f = make_filter("ts", "2024-01-01T00:00:00", "datetime");
    f.operator = "between".to_string();
    f.value2 = Some("2024-12-31T23:59:59".to_string());
    let refs: Vec<&FilterEntry> = vec![&f];

    let mut qb = QueryBuilder::<sqlx::Postgres>::new("");
    push_conditions(&mut qb, &refs, &DbDialect::Postgres);
    assert_eq!(qb.sql(), "\"ts\" BETWEEN $1::timestamp AND $2::timestamp");
}

// ── text type ─────────────────────────────────────────────────────────────────

#[test]
fn text_ilike_case_insensitive() {
    let f = make_filter("name", "alice", "text");
    let refs: Vec<&FilterEntry> = vec![&f];

    let mut qb = QueryBuilder::<sqlx::Postgres>::new("");
    push_conditions(&mut qb, &refs, &DbDialect::Postgres);
    assert_eq!(qb.sql(), "\"name\" ILIKE $1");
}

#[test]
fn text_like_case_sensitive() {
    let mut f = make_filter("name", "alice", "text");
    f.case_sensitive = true;
    let refs: Vec<&FilterEntry> = vec![&f];

    let mut qb = QueryBuilder::<sqlx::Postgres>::new("");
    push_conditions(&mut qb, &refs, &DbDialect::Postgres);
    assert_eq!(qb.sql(), "\"name\" LIKE $1");
}

#[test]
fn text_exact() {
    let mut f = make_filter("name", "alice", "text");
    f.exact = true;
    let refs: Vec<&FilterEntry> = vec![&f];

    let mut qb = QueryBuilder::<sqlx::Postgres>::new("");
    push_conditions(&mut qb, &refs, &DbDialect::Postgres);
    assert_eq!(qb.sql(), "\"name\" = $1");
}

// ── multiple conditions ───────────────────────────────────────────────────────

#[test]
fn multiple_conditions_joined_by_and() {
    let f1 = make_filter("age", "25", "number");
    let f2 = make_filter("name", "alice", "text");
    let refs: Vec<&FilterEntry> = vec![&f1, &f2];

    let mut qb = QueryBuilder::<sqlx::Postgres>::new("");
    push_conditions(&mut qb, &refs, &DbDialect::Postgres);
    assert_eq!(qb.sql(), "\"age\" = $1::numeric AND \"name\" ILIKE $2");
}

// ── MySQL dialect ─────────────────────────────────────────────────────────────

#[test]
fn mysql_number_eq_no_cast() {
    let f = make_filter("age", "25", "number");
    let refs: Vec<&FilterEntry> = vec![&f];

    let mut qb = QueryBuilder::<sqlx::MySql>::new("");
    push_conditions(&mut qb, &refs, &DbDialect::Mysql);
    // MySQL uses ? placeholders and no ::numeric cast
    assert_eq!(qb.sql(), "`age` = ?");
}

#[test]
fn mysql_text_ilike_uses_like() {
    let f = make_filter("name", "alice", "text");
    let refs: Vec<&FilterEntry> = vec![&f];

    let mut qb = QueryBuilder::<sqlx::MySql>::new("");
    push_conditions(&mut qb, &refs, &DbDialect::Mysql);
    // MySQL has no ILIKE — falls back to LIKE
    assert_eq!(qb.sql(), "`name` LIKE ?");
}

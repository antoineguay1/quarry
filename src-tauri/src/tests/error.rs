use crate::error::{friendly_error, AppError};

#[test]
fn eof_variants() {
    assert_eq!(
        friendly_error("Connection EOF"),
        "Could not reach the server. Check the host and port."
    );
    assert_eq!(
        friendly_error("connection reset by peer"),
        "Could not reach the server. Check the host and port."
    );
    assert_eq!(
        friendly_error("connection refused"),
        "Could not reach the server. Check the host and port."
    );
    assert_eq!(
        friendly_error("broken pipe"),
        "Could not reach the server. Check the host and port."
    );
}

#[test]
fn auth_variants() {
    assert_eq!(
        friendly_error("password authentication failed"),
        "Authentication failed. Check your username and password."
    );
    assert_eq!(
        friendly_error("authentication failed for user"),
        "Authentication failed. Check your username and password."
    );
}

#[test]
fn database_not_found_variants() {
    assert_eq!(
        friendly_error(r#"database "mydb" does not exist"#),
        "Database not found."
    );
    assert_eq!(
        friendly_error("Unknown database 'mydb'"),
        "Database not found."
    );
}

#[test]
fn timeout_variants() {
    assert_eq!(
        friendly_error("connection timed out"),
        "Connection timed out. Check the host and port."
    );
    assert_eq!(
        friendly_error("timeout waiting for connection"),
        "Connection timed out. Check the host and port."
    );
}

#[test]
fn host_not_found_variants() {
    assert_eq!(
        friendly_error("name or service not known"),
        "Host not found."
    );
    assert_eq!(
        friendly_error("No such host"),
        "Host not found."
    );
    assert_eq!(
        friendly_error("nodename nor servname provided"),
        "Host not found."
    );
}

#[test]
fn prefix_stripped() {
    assert_eq!(
        friendly_error("error communicating with database: some raw error"),
        "some raw error"
    );
}

#[test]
fn unknown_passthrough() {
    assert_eq!(
        friendly_error("some totally unknown error"),
        "some totally unknown error"
    );
}

#[test]
fn app_error_connection_not_found() {
    let e = AppError::ConnectionNotFound("myconn".to_string());
    assert_eq!(e.to_string(), "Connection 'myconn' not found");
}

#[test]
fn app_error_database() {
    let e = AppError::Database("some totally unknown error".to_string());
    assert_eq!(e.to_string(), "some totally unknown error");
}

#[test]
fn app_error_keychain() {
    let e = AppError::Keychain("access denied".to_string());
    assert_eq!(e.to_string(), "Keychain error: access denied");
}

#[test]
fn app_error_io() {
    let e = AppError::Io("file not found".to_string());
    assert_eq!(e.to_string(), "file not found");
}

#[test]
fn app_error_from_string_applies_friendly_error() {
    // From<String> wraps into AppError::Database, which passes through friendly_error
    let e = AppError::from("connection refused".to_string());
    assert_eq!(
        e.to_string(),
        "Could not reach the server. Check the host and port."
    );
}

#[test]
fn app_error_serializes_as_string_via_serde() {
    // The serde::Serialize impl delegates to Display (friendly_error output)
    let e = AppError::Database("some totally unknown error".to_string());
    let v = serde_json::to_value(&e).unwrap();
    assert_eq!(v, serde_json::json!("some totally unknown error"));
}

pub fn friendly_error(err: &str) -> String {
    let e = err.to_lowercase();
    if e.contains("eof")
        || e.contains("connection reset")
        || e.contains("connection refused")
        || e.contains("broken pipe")
    {
        "Could not reach the server. Check the host and port.".to_string()
    } else if e.contains("password") || e.contains("authentication") {
        "Authentication failed. Check your username and password.".to_string()
    } else if e.contains("database") && (e.contains("does not exist") || e.contains("unknown database")) {
        "Database not found.".to_string()
    } else if e.contains("timed out") || e.contains("timeout") {
        "Connection timed out. Check the host and port.".to_string()
    } else if e.contains("name or service not known")
        || e.contains("no such host")
        || e.contains("nodename nor servname")
    {
        "Host not found.".to_string()
    } else {
        err.trim_start_matches("error communicating with database: ")
            .to_string()
    }
}

#[derive(Debug)]
pub enum AppError {
    ConnectionNotFound(String),
    Database(String),
    Keychain(String),
    Io(String),
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AppError::ConnectionNotFound(name) => write!(f, "Connection '{}' not found", name),
            AppError::Database(msg) => write!(f, "{}", friendly_error(msg)),
            AppError::Keychain(msg) => write!(f, "Keychain error: {}", msg),
            AppError::Io(msg) => write!(f, "{}", msg),
        }
    }
}

impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

impl From<String> for AppError {
    fn from(s: String) -> Self {
        AppError::Database(s)
    }
}

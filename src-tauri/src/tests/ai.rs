use serde_json::json;
use wiremock::matchers::{method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};

use crate::ai::{
    call_ai, call_ai_impl, list_ai_models, list_ai_models_impl, AiModel, BASE_OVERRIDE,
    KEY_OVERRIDE,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

fn set_key(key: Option<&str>) {
    KEY_OVERRIDE.with(|k| *k.borrow_mut() = Some(key.map(|s| s.to_string())));
}

fn clear_overrides() {
    KEY_OVERRIDE.with(|k| *k.borrow_mut() = None);
    BASE_OVERRIDE.with(|b| *b.borrow_mut() = None);
}

fn set_base(base: &str) {
    BASE_OVERRIDE.with(|b| *b.borrow_mut() = Some(base.to_string()));
}

// ── AiModel ───────────────────────────────────────────────────────────────────

#[test]
fn ai_model_serializes() {
    let model = AiModel {
        id: "claude-3-5-sonnet-20241022".to_string(),
        display_name: "Claude 3.5 Sonnet".to_string(),
    };
    let v = serde_json::to_value(&model).unwrap();
    assert_eq!(v["id"], "claude-3-5-sonnet-20241022");
    assert_eq!(v["display_name"], "Claude 3.5 Sonnet");
}

// ── list_ai_models_impl ───────────────────────────────────────────────────────

#[tokio::test]
async fn list_models_success() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/models"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "data": [
                {"id": "claude-sonnet", "display_name": "Claude Sonnet"},
                {"id": "claude-haiku", "display_name": "Claude Haiku"}
            ]
        })))
        .mount(&server)
        .await;

    let result = list_ai_models_impl(&server.uri(), "key").await.unwrap();
    assert_eq!(result.len(), 2);
    assert_eq!(result[0].id, "claude-sonnet");
    assert_eq!(result[0].display_name, "Claude Sonnet");
    assert_eq!(result[1].id, "claude-haiku");
}

#[tokio::test]
async fn list_models_display_name_falls_back_to_id() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/models"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "data": [{"id": "claude-model-x"}]
        })))
        .mount(&server)
        .await;

    let result = list_ai_models_impl(&server.uri(), "key").await.unwrap();
    assert_eq!(result.len(), 1);
    assert_eq!(result[0].display_name, "claude-model-x");
}

#[tokio::test]
async fn list_models_filters_entries_without_id() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/models"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "data": [
                {"display_name": "No ID Model"},
                {"id": "valid-model"}
            ]
        })))
        .mount(&server)
        .await;

    let result = list_ai_models_impl(&server.uri(), "key").await.unwrap();
    assert_eq!(result.len(), 1);
    assert_eq!(result[0].id, "valid-model");
}

#[tokio::test]
async fn list_models_missing_data_array() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/models"))
        .respond_with(
            ResponseTemplate::new(200).set_body_json(json!({"models": []})),
        )
        .mount(&server)
        .await;

    let result = list_ai_models_impl(&server.uri(), "key").await;
    assert_eq!(result, Err("Unexpected response format".to_string()));
}

#[tokio::test]
async fn list_models_api_error_with_json_message() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/models"))
        .respond_with(
            ResponseTemplate::new(401)
                .set_body_json(json!({"error": {"message": "Invalid API key"}})),
        )
        .mount(&server)
        .await;

    let result = list_ai_models_impl(&server.uri(), "key").await;
    assert_eq!(result, Err("Invalid API key".to_string()));
}

#[tokio::test]
async fn list_models_api_error_without_json_message() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/models"))
        .respond_with(ResponseTemplate::new(500).set_body_string("Internal Server Error"))
        .mount(&server)
        .await;

    let result = list_ai_models_impl(&server.uri(), "key").await;
    assert_eq!(result, Err("API error".to_string()));
}

// ── call_ai_impl ──────────────────────────────────────────────────────────────

#[tokio::test]
async fn call_ai_success() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/messages"))
        .respond_with(
            ResponseTemplate::new(200)
                .set_body_json(json!({"content": [{"type": "text", "text": "Hello!"}]})),
        )
        .mount(&server)
        .await;

    let result =
        call_ai_impl(&server.uri(), "key", "system prompt", "user message", "claude-haiku-4-5").await;
    assert_eq!(result, Ok("Hello!".to_string()));
}

#[tokio::test]
async fn call_ai_unexpected_format_empty_content() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/messages"))
        .respond_with(
            ResponseTemplate::new(200).set_body_json(json!({"content": []})),
        )
        .mount(&server)
        .await;

    let result = call_ai_impl(&server.uri(), "key", "s", "u", "m").await;
    assert_eq!(
        result,
        Err("Unexpected response format from API".to_string())
    );
}

#[tokio::test]
async fn call_ai_unexpected_format_no_text_field() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/messages"))
        .respond_with(
            ResponseTemplate::new(200).set_body_json(json!({"content": [{"type": "tool_use"}]})),
        )
        .mount(&server)
        .await;

    let result = call_ai_impl(&server.uri(), "key", "s", "u", "m").await;
    assert_eq!(
        result,
        Err("Unexpected response format from API".to_string())
    );
}

#[tokio::test]
async fn call_ai_api_error_with_message() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/messages"))
        .respond_with(
            ResponseTemplate::new(429)
                .set_body_json(json!({"error": {"message": "Rate limit exceeded"}})),
        )
        .mount(&server)
        .await;

    let result = call_ai_impl(&server.uri(), "key", "s", "u", "m").await;
    assert_eq!(result, Err("Rate limit exceeded".to_string()));
}

#[tokio::test]
async fn call_ai_api_error_without_json_message() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/messages"))
        .respond_with(ResponseTemplate::new(503).set_body_string("service unavailable"))
        .mount(&server)
        .await;

    let result = call_ai_impl(&server.uri(), "key", "s", "u", "m").await;
    assert_eq!(result, Err("API error".to_string()));
}

// ── Tauri command wrappers ────────────────────────────────────────────────────

#[tokio::test]
async fn list_ai_models_command_no_key() {
    set_key(None);
    let result = list_ai_models().await;
    clear_overrides();
    assert_eq!(result, Err("No Claude API key configured.".to_string()));
}

#[tokio::test]
async fn list_ai_models_command_with_key() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/models"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "data": [{"id": "claude-3", "display_name": "Claude 3"}]
        })))
        .mount(&server)
        .await;

    set_key(Some("test_key"));
    set_base(&server.uri());
    let result = list_ai_models().await;
    clear_overrides();

    let models = result.unwrap();
    assert_eq!(models.len(), 1);
    assert_eq!(models[0].id, "claude-3");
}

#[tokio::test]
async fn call_ai_command_no_key() {
    set_key(None);
    let result = call_ai("sys".to_string(), "usr".to_string(), "model".to_string()).await;
    clear_overrides();
    assert_eq!(
        result,
        Err("No Claude API key configured. Add one in Settings.".to_string())
    );
}

#[tokio::test]
async fn call_ai_command_with_key() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/messages"))
        .respond_with(
            ResponseTemplate::new(200)
                .set_body_json(json!({"content": [{"type": "text", "text": "done"}]})),
        )
        .mount(&server)
        .await;

    set_key(Some("test_key"));
    set_base(&server.uri());
    let result = call_ai("sys".to_string(), "usr".to_string(), "model".to_string()).await;
    clear_overrides();

    assert_eq!(result, Ok("done".to_string()));
}

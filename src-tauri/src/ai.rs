use std::sync::LazyLock;
use crate::storage::queries::get_ai_key;

static HTTP: LazyLock<reqwest::Client> = LazyLock::new(reqwest::Client::new);

const API_BASE: &str = "https://api.anthropic.com/v1";
const API_VERSION: &str = "2023-06-01";

// ── Test hooks ────────────────────────────────────────────────────────────────

#[cfg(test)]
thread_local! {
    /// Override the API base URL (e.g. point to a wiremock server).
    pub(crate) static BASE_OVERRIDE: std::cell::RefCell<Option<String>> =
        std::cell::RefCell::new(None);
    /// Override the resolved key: `Some(None)` → no key, `Some(Some(k))` → use k.
    pub(crate) static KEY_OVERRIDE: std::cell::RefCell<Option<Option<String>>> =
        std::cell::RefCell::new(None);
}

fn effective_base() -> String {
    #[cfg(test)]
    {
        let v = BASE_OVERRIDE.with(|b| b.borrow().clone());
        if let Some(base) = v {
            return base;
        }
    }
    API_BASE.to_string()
}

fn fetch_key() -> Result<Option<String>, String> {
    #[cfg(test)]
    {
        let v = KEY_OVERRIDE.with(|k| k.borrow().clone());
        if v.is_some() {
            return Ok(v.unwrap());
        }
    }
    get_ai_key().map_err(|e| e.to_string())
}

// ── Internal helpers (pub(crate) for testing) ─────────────────────────────────

pub(crate) async fn check_response(res: reqwest::Response) -> Result<serde_json::Value, String> {
    if !res.status().is_success() {
        let err: serde_json::Value = res.json().await.unwrap_or_default();
        return Err(err["error"]["message"]
            .as_str()
            .unwrap_or("API error")
            .to_string());
    }
    res.json().await.map_err(|e| e.to_string())
}

pub(crate) async fn list_ai_models_impl(base: &str, key: &str) -> Result<Vec<AiModel>, String> {
    let res = HTTP
        .get(format!("{base}/models"))
        .header("x-api-key", key)
        .header("anthropic-version", API_VERSION)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let data = check_response(res).await?;
    let models = data["data"]
        .as_array()
        .ok_or("Unexpected response format")?
        .iter()
        .filter_map(|m| {
            let id = m["id"].as_str()?;
            let display_name = m["display_name"].as_str().unwrap_or(id);
            Some(AiModel {
                id: id.to_string(),
                display_name: display_name.to_string(),
            })
        })
        .collect();

    Ok(models)
}

pub(crate) async fn call_ai_impl(
    base: &str,
    key: &str,
    system: &str,
    user: &str,
    model: &str,
) -> Result<String, String> {
    let body = serde_json::json!({
        "model": model,
        "max_tokens": 1024,
        "system": system,
        "messages": [{ "role": "user", "content": user }]
    });

    let res = HTTP
        .post(format!("{base}/messages"))
        .header("x-api-key", key)
        .header("anthropic-version", API_VERSION)
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let data = check_response(res).await?;
    data["content"][0]["text"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Unexpected response format from API".to_string())
}

// ── Tauri commands ────────────────────────────────────────────────────────────

#[derive(serde::Serialize, Debug, PartialEq)]
pub struct AiModel {
    pub id: String,
    pub display_name: String,
}

#[tauri::command]
pub async fn list_ai_models() -> Result<Vec<AiModel>, String> {
    let key = fetch_key()?.ok_or("No Claude API key configured.")?;
    list_ai_models_impl(&effective_base(), &key).await
}

#[tauri::command]
pub async fn call_ai(system: String, user: String, model: String) -> Result<String, String> {
    let key = fetch_key()?.ok_or("No Claude API key configured. Add one in Settings.")?;
    call_ai_impl(&effective_base(), &key, &system, &user, &model).await
}

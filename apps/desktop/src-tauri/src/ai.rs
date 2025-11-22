// AI runtime integration with Ollama
// Handles embeddings and LLM inference

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct EmbeddingRequest {
    pub model: String,
    pub prompt: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EmbeddingResponse {
    pub embedding: Vec<f32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct InferenceRequest {
    pub model: String,
    pub prompt: String,
    pub stream: bool,
}

pub struct OllamaClient {
    base_url: String,
    client: reqwest::Client,
}

impl OllamaClient {
    pub fn new() -> Self {
        OllamaClient {
            base_url: "http://localhost:11434".to_string(),
            client: reqwest::Client::new(),
        }
    }

    pub async fn generate_embedding(&self, text: &str) -> Result<Vec<f32>, String> {
        // TODO: Call Ollama API for embeddings
        // Default model: all-MiniLM-L6-v2
        Ok(vec![])
    }

    pub async fn generate(&self, prompt: &str, model: &str) -> Result<String, String> {
        // TODO: Call Ollama API for text generation
        // Default model: llama3.2:3b
        Ok(String::new())
    }

    pub async fn is_running(&self) -> bool {
        // Check if Ollama is running
        self.client
            .get(&format!("{}/api/tags", self.base_url))
            .send()
            .await
            .is_ok()
    }
}

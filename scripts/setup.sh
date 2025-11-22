#!/bin/bash

echo "🌍 EarthServers Local - Setup Script"
echo "====================================="
echo ""

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js >= 18"
    exit 1
fi
echo "✅ Node.js $(node --version)"

# Check for pnpm
if ! command -v pnpm &> /dev/null; then
    echo "⚠️  pnpm not found. Installing..."
    npm install -g pnpm
fi
echo "✅ pnpm $(pnpm --version)"

# Check for Rust
if ! command -v cargo &> /dev/null; then
    echo "❌ Rust not found. Please install from https://rustup.rs/"
    exit 1
fi
echo "✅ Rust $(rustc --version)"

# Check for Ollama
if ! command -v ollama &> /dev/null; then
    echo "⚠️  Ollama not found. Please install from https://ollama.ai/"
    echo "    After installation, run: ollama pull all-minilm && ollama pull llama3.2:3b"
fi

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
pnpm install

# Create models directory
echo ""
echo "📁 Creating models directory..."
mkdir -p models
echo "*.gguf" > models/.gitignore
echo "*.bin" >> models/.gitignore

# Setup complete
echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Start Ollama: ollama serve"
echo "  2. Download models: ollama pull all-minilm && ollama pull llama3.2:3b"
echo "  3. Run development server: pnpm desktop"
echo ""
echo "🌍 Happy coding!"

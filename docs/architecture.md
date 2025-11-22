# Architecture Overview

## Philosophy

**"We don't desire to rule the Earth. Only to serve it."**

EarthServers Local is built on three core principles:

1. **Privacy First**: Your data never leaves your device by default
2. **Intelligent Distribution**: Run compute where it makes most sense
3. **User Control**: You own your data and choose what to share

## Three-Tier Architecture

### Tier 1: Local AI (Your Device)
- **Power**: ~0W marginal (device already running)
- **Latency**: 0ms (no network)
- **Privacy**: 100% (data never leaves)

**Services:**
- EarthSearch, EarthMemory, EarthWrite, EarthVoice, EarthFilter, EarthMusic, EarthAssist

### Tier 2: Edge Servers (Regional)
- **Power**: ~100W per user (amortized)
- **Latency**: 5-20ms
- **Privacy**: High (regional, not mega-datacenter)

**Services:**
- Image generation, complex code analysis, collaborative features

### Tier 3: Central Datacenter
- **Power**: ~500-1000W per concurrent user
- **Latency**: 50-100ms
- **Privacy**: Lower (but necessary for certain tasks)

**Services:**
- Frontier models (GPT-4 class), 3D modeling, massive simulations

## Technology Stack

### Desktop Application

```
┌─────────────────────────────────────┐
│        Tauri Desktop App            │
│  ┌───────────────────────────────┐  │
│  │      React Frontend           │  │
│  │  - TypeScript                 │  │
│  │  - Tailwind CSS               │  │
│  │  - React Router               │  │
│  └───────────────────────────────┘  │
│              ↕ IPC                  │
│  ┌───────────────────────────────┐  │
│  │      Rust Backend             │  │
│  │  - Tauri Commands             │  │
│  │  - SQLite Database            │  │
│  │  - Meilisearch Integration    │  │
│  │  - Ollama Client              │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
         ↓              ↓
    [Database]    [Ollama Server]
```

### Data Flow

```
User Input
    ↓
React UI
    ↓
Tauri IPC
    ↓
Rust Command Handler
    ↓
┌────────────┬──────────────┬──────────────┐
│  Database  │ Meilisearch  │   Ollama     │
│  (SQLite)  │  (Search)    │   (AI)       │
└────────────┴──────────────┴──────────────┘
    ↓              ↓              ↓
Results merged and returned to UI
```

## Core Components

### 1. Search Engine (EarthSearch)

**Purpose**: Privacy-first search with domain curation

**Components:**
- **Domain Manager**: Add/remove/organize domains
- **Search Indexer**: Meilisearch integration
- **Query Parser**: AI-powered query understanding
- **Results Ranker**: Trust-score based ranking

**Data Storage:**
```sql
domains (url, category, trust_score, added_date)
domain_lists (name, description, author)
list_domains (list_id, domain_id)
```

**Flow:**
```
User Query
    ↓
Query Parser (Ollama) → Understand intent
    ↓
Search Index (Meilisearch) → Find matches
    ↓
Filter by domain whitelist
    ↓
Rank by trust score + relevance
    ↓
Return results
```

### 2. Knowledge Graph (EarthMemory)

**Purpose**: Personal knowledge graph and semantic search

**Components:**
- **Page Indexer**: Auto-index visited pages
- **Embedding Generator**: Convert text to vectors
- **Similarity Search**: Find related content
- **Note Manager**: Add annotations

**Data Storage:**
```sql
pages (url, title, content, visited_at, embedding)
notes (page_id, content, created_at)
```

**Flow:**
```
Visit Page
    ↓
Extract content
    ↓
Generate embedding (Ollama)
    ↓
Store in database
    ↓
Calculate similarity with existing pages
    ↓
Update knowledge graph connections
```

### 3. AI Runtime

**Purpose**: Unified interface to Ollama

**Models:**
- **all-MiniLM-L6-v2** (~25MB): Fast embeddings
- **Llama 3.2 3B** (~2GB): Text generation, query understanding

**API:**
```typescript
interface AIRuntime {
  generateEmbedding(text: string): Promise<number[]>
  generate(prompt: string, model?: string): Promise<string>
  isRunning(): Promise<boolean>
  listModels(): Promise<string[]>
}
```

### 4. Database Layer

**SQLite Schema:**
```sql
-- Search
domains, domain_lists, list_domains

-- Memory
pages, notes

-- Settings
settings (key, value, updated_at)
```

**Migrations**: Version-based schema updates

## Communication Patterns

### Frontend ↔ Backend (Tauri IPC)

```typescript
// Frontend
import { invoke } from '@tauri-apps/api/tauri';

const result = await invoke('search_domains', { 
  query: 'climate change' 
});
```

```rust
// Backend
#[tauri::command]
async fn search_domains(query: String) -> Result<Vec<SearchResult>, String> {
    // Implementation
}
```

### Backend ↔ Ollama (HTTP)

```rust
// Rust
let response = reqwest::get("http://localhost:11434/api/tags")
    .await?
    .json::<OllamaResponse>()
    .await?;
```

### Backend ↔ Database (Direct)

```rust
// Rust + rusqlite
let conn = Connection::open(&db_path)?;
conn.execute(
    "INSERT INTO pages (url, title, content) VALUES (?1, ?2, ?3)",
    params![url, title, content],
)?;
```

## Security Model

### Tauri Allowlist

Only explicitly allowed APIs are accessible:

```json
{
  "allowlist": {
    "shell": { "open": true },
    "dialog": { "all": true },
    "fs": { "scope": ["$APPDATA/*"] },
    "http": { "scope": ["http://localhost:11434/*"] }
  }
}
```

### Data Isolation

- **App data**: `~/.earthservers/` (platform-specific)
- **Models**: `~/.earthservers/models/`
- **Database**: `~/.earthservers/earthservers.db`

### No Telemetry

Zero telemetry by default. User opts-in for crash reports.

## Performance Optimizations

### 1. Lazy Loading
- Models loaded on first use
- Database connections pooled
- Components code-split

### 2. Caching
- Embeddings cached (don't regenerate)
- Search results cached (5-minute TTL)
- AI responses cached for identical queries

### 3. Background Processing
- Indexing runs in background
- Embedding generation queued
- Database writes batched

### 4. Efficient Queries
- Indexed columns for fast lookups
- LIMIT clauses for pagination
- Prepared statements for repeated queries

## Scalability

### Local-First Design

Each user's data is independent:
- No shared state
- No synchronization needed
- Scales to billions of users naturally

### Optional Cloud Sync (Future)

```
Local Device
    ↓ (encrypted)
IPFS Storage
    ↓ (pull from any node)
Other Devices
```

## Future Architecture

### RISC-V Migration (2027+)

```
Current: x86/ARM + NVIDIA GPU
    ↓
Target: RISC-V CPU + Custom AI Accelerator
    ↓
Benefits:
  - Open ISA (no licensing)
  - Custom ESCCML integration
  - Lower power consumption
  - Full stack control
```

### Federated Edge Network

```
User's Local AI
    ↓
Community Edge Server (Iceland - geothermal)
    ↓
Regional Hub (renewable powered)
    ↓
Central Intelligence (only when necessary)
```

## Design Decisions

### Why Rust?
- Memory safety
- Performance
- Excellent async support
- Fits RISC-V roadmap

### Why React?
- Component reusability
- Strong ecosystem
- TypeScript support
- You already know it

### Why Meilisearch?
- Fast, typo-tolerant search
- Rust-based (embeddable)
- Simple API
- Good documentation

### Why Ollama?
- Dead simple model management
- OpenAI-compatible API
- Automatic GPU acceleration
- Works offline

### Why SQLite?
- Zero-configuration
- Reliable
- Fast for single-user
- Perfect for local-first

## Monitoring & Debugging

### Logs
- Frontend: Browser DevTools
- Backend: Stdout/stderr
- Database: SQLite error codes
- AI: Ollama server logs

### Metrics (Future)
- Query latency
- Embedding generation time
- Database query performance
- Memory usage

## Testing Strategy

### Unit Tests
- Rust: `cargo test`
- TypeScript: `vitest`

### Integration Tests
- Tauri commands
- Database operations
- API integrations

### E2E Tests
- Playwright for user flows
- Critical paths only

## Deployment

### Desktop App
- Tauri builds for Windows, macOS, Linux
- Code signing (macOS required)
- Auto-updates via Tauri updater

### Distribution
- GitHub Releases
- Future: Homebrew, apt/yum, Chocolatey

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md)

## License

MIT - See [LICENSE](../LICENSE)

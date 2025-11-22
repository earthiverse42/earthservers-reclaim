<div align="center">
  <h1>EarthServers Reclaim</h1>
  <p><strong>Reclaim Your Digital Sovereignty</strong></p>
  <p>Privacy-first browser with local AI, curated search, and community trust ratings</p>

  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![Rust](https://img.shields.io/badge/rust-%23000000.svg?style=flat&logo=rust&logoColor=white)](https://www.rust-lang.org/)
  [![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![Tauri](https://img.shields.io/badge/tauri-%2324C8DB.svg?style=flat&logo=tauri&logoColor=%23FFFFFF)](https://tauri.app/)
</div>

---

## Mission

**"We don't desire to rule the Earth. Only to serve it."**

EarthServers Reclaim is a privacy-first desktop application that puts you back in control of your digital life. Your data never leaves your device. Your AI serves you, not shareholders.

## Features

### EarthSearch
- Privacy-first curated search with trusted domain management
- Community trust & bias ratings
- Domain whitelisting with categories
- Split-view browsing (single, dual, vertical, quad)
- Integrated WebView browser with tab management
- Bookmark bar with folders and private bookmarks

### EarthMemory
- Personal knowledge graph for indexed pages
- Full-text search across saved content
- Tagging, favorites, and notes system
- Export/import functionality

### EarthMultiMedia
- Multi-pane media player (single, dual, triple, quad layouts)
- Video, audio, and image support with slideshow mode
- Queue management with drag-and-drop reordering
- Privacy-first design (history disabled by default)
- Password-protected access option
- Playlist creation and management

### WebScraper
- Content scraping with configurable CSS selectors
- Depth and page limits
- Scheduled scraping jobs
- Add to personal search index

### Privacy & Security
- **Incognito Mode** - Browsing activity not saved
- **Profile System** - Multiple isolated profiles
- **Password Manager** - Encrypted credential storage
- **OTP Authenticator** - Built-in 2FA code generator
- **Private Bookmarks** - Password-protected bookmark section

### Customization
- 6+ theme presets (Ocean Turtle, Mountain Eagle, Sun Fire, Lightning Bolt, Air Clouds, EarthServers Default)
- Custom theme editor with full color customization
- Animated backgrounds with theme-specific particles
- Collapsible navbar for more screen space
- Draggable windows (theme customizer, notes)

### Coming Soon
- EarthWrite - Writing assistant
- EarthVoice - Voice interface

## Getting Started

### Prerequisites

- **Node.js** v20+
- **Rust** 1.75+
- **pnpm** (package manager)
- **Ollama** (optional, for AI features)

### Installation

```bash
# Clone the repository
git clone https://github.com/earthservers/earthservers-reclaim.git
cd earthservers-reclaim

# Install dependencies
pnpm install

# Run in development mode (browser)
pnpm dev

# Run desktop app
pnpm desktop
```

### Building

```bash
# Build for your platform
pnpm build:desktop

# Installers will be in:
# apps/desktop/src-tauri/target/release/bundle/
```

## Architecture

```
earthservers-reclaim/
├── apps/
│   ├── desktop/           # Tauri desktop app
│   │   ├── src/          # React frontend
│   │   └── src-tauri/    # Rust backend
│   └── ratings-server/    # Community ratings API (optional)
├── packages/
│   ├── ui/               # Shared React components
│   ├── database/         # SQLite schemas
│   ├── ai-runtime/       # Local AI integration
│   ├── knowledge-graph/  # Knowledge graph utilities
│   └── search-engine/    # Search engine components
└── models/               # AI models (gitignored)
```

### Tech Stack

- **Frontend:** React, TypeScript, Tailwind CSS
- **Backend:** Rust, Tauri
- **Database:** SQLite (local-first)
- **AI:** Ollama (local models)

## Development

### Scripts

```bash
# Frontend development (browser with mocks)
pnpm dev

# Desktop development
pnpm desktop

# Desktop without mocks (production mode)
pnpm desktop:prod

# Build desktop app
pnpm build:desktop

# Lint
pnpm lint
```

### Environment Variables

Development mode uses mock data by default. See `.env.development` and `.env.production` in `apps/desktop/`.

```env
# .env.development
VITE_USE_MOCK_DATA=true

# .env.production
VITE_USE_MOCK_DATA=false
```

## Philosophy

- **Privacy First**: Your data never leaves your device by default
- **User Control**: You own your data and choose what to share
- **Efficiency**: Run compute where it makes most sense
- **Openness**: Open source, open standards, open data

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License - See [LICENSE](LICENSE) for details.

## Community

- **Website:** [earthservers.net](https://earthservers.net)
- **Social:** [social.earthservers.net](https://social.earthservers.net)

## Acknowledgments

Built with open-source technologies:
- [Tauri](https://tauri.app/) - Desktop framework
- [Ollama](https://ollama.ai/) - Local AI runtime
- [React](https://react.dev/) - UI framework
- [Tailwind CSS](https://tailwindcss.com/) - Styling

---

<div align="center">
  <p><strong>Serve the Earth. Reclaim Your Mind.</strong></p>
  <p>Made with care by the EarthServers community</p>
</div>

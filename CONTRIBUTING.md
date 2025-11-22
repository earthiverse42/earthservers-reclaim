# Contributing to EarthServers Reclaim

Thank you for your interest in contributing!

## Philosophy

"We don't desire to rule the Earth. Only to serve it."

All contributions should align with these values:
- **Privacy First**: Respect user data and privacy
- **Efficiency**: Minimize resource consumption
- **Openness**: Open source, open standards
- **Accessibility**: Make AI accessible to everyone

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/earthservers-reclaim.git`
3. Install dependencies: `pnpm install`
4. Create a branch: `git checkout -b feature/your-feature-name`

## Development Workflow

### Running with Mock Data

```bash
# Development mode (browser with mocks)
pnpm dev

# Desktop development
pnpm desktop

# Desktop without mocks (production mode)
pnpm desktop:prod
```

### Standard Workflow

1. Make your changes
2. Test thoroughly: `pnpm test`
3. Lint your code: `pnpm lint`
4. Commit with clear messages
5. Push to your fork
6. Open a Pull Request

## Code Style

- **TypeScript**: Use strict mode, avoid `any`
- **React**: Functional components with hooks
- **Rust**: Follow Clippy recommendations
- **Comments**: Explain *why*, not *what*

## Commit Messages

Follow conventional commits:
```
feat: add domain import feature
fix: resolve search indexing bug
docs: update architecture documentation
test: add tests for knowledge graph
refactor: simplify AI runtime interface
```

## Testing

- Write tests for new features
- Maintain >80% coverage where possible
- Test on multiple platforms if changing Tauri code

## Pull Requests

**Good PR:**
- Focused on one feature/fix
- Includes tests
- Updates documentation
- Clear description of changes

**PR Template:**
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
How you tested your changes

## Screenshots (if UI change)
Before/after screenshots
```

## Areas for Contribution

### High Priority
- [ ] Meilisearch integration for EarthSearch
- [ ] Embedding generation for EarthMemory
- [ ] Domain list import/export UI
- [ ] Settings panel
- [ ] Error handling improvements

### Medium Priority
- [ ] Additional UI components
- [ ] Search result ranking algorithm
- [ ] Browser history integration
- [ ] Keyboard shortcuts
- [ ] Dark/light theme toggle

### Low Priority
- [ ] Additional AI models support
- [ ] Custom themes
- [ ] Plugins system
- [ ] Browser extensions

## Questions?

- Open an issue for bugs
- Start a discussion for features
- Join our Discord [Coming Soon]

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Code of Conduct

Be respectful, inclusive, and constructive. We're all here to serve the Earth together. 🌍

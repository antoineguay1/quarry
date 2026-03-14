# Quarry

A lightweight desktop database explorer for PostgreSQL and MySQL.

## Download

**[→ Latest release](https://github.com/antoineguay1/quarry/releases)**

macOS (Apple Silicon · Intel) · Linux · Windows

---

## Features

### Connections
- PostgreSQL and MySQL support
- Save multiple named connections; passwords stored in the OS keychain (macOS Keychain, Linux Secret Service, Windows Credential Manager)
- Test connection before saving
- Auto-reconnect to previously open databases on launch

### Browsing
- 3-level sidebar tree: connection → database → table
- Filter which databases are visible per connection (persisted)
- Column visibility toggle and column resizing
- Configurable row density (compact / comfortable) and page size (50–500)
- Date format setting (ISO / US / EU)

### Table data
- Pagination with configurable page size
- Multi-column sorting with priority indicators
- Per-column filters with type-aware operators (equals, greater/less than, between, NULL / NOT NULL, case-sensitive text)
- Search bar with per-table history and case-sensitivity toggle
- Inline cell editing — keyboard navigation (arrows, Tab, Enter, F2), right-click context menu (edit, copy, set NULL)
- Pending changes: staged edits highlighted in blue; submit or discard as a batch
- Insert and delete rows
- Foreign key navigation — click an FK cell to jump to the referenced row

### Schema diagram
- Interactive ER diagram (ReactFlow) per database
- Tables shown with columns, primary key (key icon) and foreign key (link icon) indicators
- Drag tables to arrange; layout saved per database

### Table management
- Create tables with a visual column builder: drag-and-drop column ordering, type selection, constraints (nullable, primary key, auto-increment), default values, SQL preview before creation
- Rename and drop tables and databases
- Add and drop individual columns

### SQL editor
- Syntax highlighting (CodeMirror 6, VS Code theme)
- All query tabs backed by saved queries — auto-saved with 600 ms debounce
- Per-query connection + database selector; inline rename; resizable editor/results pane

### AI assistant (Claude)
- Generate SQL from plain English, explain queries, fix errors, refine results
- Model selection (Haiku / Sonnet / Opus); API key stored in OS keychain, never on disk
- Toggled via the `[✨ AI]` button in the editor toolbar

### Customization
- Dark / light theme (system-aware, toggleable)
- Configurable font size, date format, table density, and default page size

---

## Building from source

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Rust](https://rustup.rs/) (stable toolchain)
- Tauri CLI prerequisites for your platform — see the [Tauri docs](https://tauri.app/start/prerequisites/)

### Commands

```bash
# Install JS dependencies
npm install

# Run in development mode (hot-reload)
npm run tauri dev

# Build a production bundle
npm run tauri build
```

---

## Project structure

```
src/                      # React frontend
  components/             # UI components (Sidebar, QueryEditor, DataTable, ...)
  hooks/                  # Custom React hooks
  types.ts                # Shared TypeScript types
src-tauri/
  src/
    commands/             # Tauri IPC command handlers
    db/                   # Database connection pool logic
    storage.rs            # JSON persistence (connections, saved queries)
    models.rs             # Shared Rust structs
  tauri.conf.json         # App config (name, window size, bundle targets)
```

---

## Data storage

| Data | Location |
|---|---|
| Saved connections | `<app data dir>/connections.json` |
| Saved queries | `<app data dir>/saved_queries.json` |
| Passwords | OS keychain (never written to disk) |
| AI API key | OS keychain (never written to disk) |

The app data directory is platform-specific:
- **macOS**: `~/Library/Application Support/app.quarry`
- **Linux**: `~/.local/share/app.quarry`
- **Windows**: `%APPDATA%\app.quarry`

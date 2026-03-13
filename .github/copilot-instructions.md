# Copilot Instructions — copilot-chat-history

## Project Overview

This is a VS Code extension that lets you browse and search GitHub Copilot chat history organized by workspace. It targets **VS Code Insiders** and reads chat session data from:

```
%APPDATA%\Code - Insiders\User\workspaceStorage\<workspace-id>\chatSessions\
```

## Tech Stack

- **Language**: TypeScript
- **Bundler**: esbuild (via `esbuild.js`)
- **Type checking**: `tsc --noEmit` (TypeScript compiler, no emit)
- **Linter**: ESLint (`eslint src`)
- **Packaging**: `@vscode/vsce`

## Key Files

- `src/extension.ts` — Main extension entry point; tree view provider, session scanning, workspace resolution
- `src/types.ts` — Shared TypeScript types
- `src/renderers/` — HTML rendering of chat sessions
- `src/markdown/` — Markdown processing for chat content
- `src/utils/` — Notification helpers, session file utilities
- `resources/chatStyles.css` — Styles for the rendered chat webview
- `esbuild.js` — Custom build script for development and production bundling

## npm Scripts

| Script | Description |
|---|---|
| `npm run compile` | Type-check, lint, and bundle (development) |
| `npm run watch` | Watch mode — runs `watch:esbuild` and `watch:tsc` in parallel |
| `npm run package` | Type-check, lint, and bundle for **production** |
| `npm run package:vsix` | Build production bundle and export a `.vsix` file |
| `npm run check-types` | Run `tsc --noEmit` only |
| `npm run lint` | Run ESLint on `src/` |
| `npm run test` | Compile tests and run with `vscode-test` |

## Build Steps

### Development build

```bash
npm install          # Install dependencies (required on first clone)
npm run compile      # One-time build
```

### Watch mode (recommended during development)

```bash
npm run watch        # Starts esbuild watch + tsc watch in parallel
```

### Production build

```bash
npm run package      # Type-check + lint + production bundle → dist/extension.js
```

## Exporting a VSIX

To package the extension as an installable `.vsix` file:

```bash
npm run package:vsix
```

This runs the production build then invokes `@vscode/vsce package`, producing:

```
copilot-chat-history-<version>.vsix
```

### Install the VSIX into VS Code Insiders

```bash
code-insiders --install-extension copilot-chat-history-<version>.vsix
```

Or from within VS Code Insiders: Extensions view → `...` menu → **Install from VSIX...** → select the file.

## Post-Change Deployment (Agentic)

After completing any code changes, always perform these steps automatically without waiting to be asked:

1. Bump the patch version in `package.json` (e.g. `1.2.4` → `1.2.5`)
2. Run `npm run package:vsix` to type-check, lint, bundle, and produce the `.vsix`
3. Run `code-insiders --install-extension copilot-chat-history-<version>.vsix` to install it

The user can then reload the extension host (**Developer: Restart Extension Host**) to activate the new version.

## Platform Notes

- The extension hard-codes the Windows path `Code - Insiders\User\workspaceStorage` (changed from the upstream `Code\User\workspaceStorage`).
- There is no cross-platform path detection yet; macOS/Linux paths are not supported.

## Coding Conventions

- Use `async/await`; avoid raw Promise chains.
- Prefer `fs.existsSync` + `fs.readdirSync` for synchronous directory scans; async I/O is used where performance matters.
- Keep VS Code API usage in `extension.ts`; pure logic belongs in `utils/` or `renderers/`.
- Do not add unnecessary comments — let code be self-documenting.

# Excalidraw MCP — Setup Guide

This skill requires the **Excalidraw MCP server** to be connected. Without it, the `mcp__excalidraw__*` tools will not be available and the `/excalidraw` skill will not work.

**Source**: https://github.com/excalidraw/excalidraw-mcp

---

## Option 1: VS Code (Claude Code Extension) — Recommended

Add the Excalidraw MCP server to your VS Code settings:

1. Open VS Code Settings (`Cmd+,` on Mac, `Ctrl+,` on Windows/Linux)
2. Search for `claude.mcpServers`
3. Click "Edit in settings.json"
4. Add the Excalidraw server:

```jsonc
// .vscode/settings.json (workspace-level, shared with team)
// or User Settings (personal, applies to all projects)
{
  "claude.mcpServers": {
    "excalidraw": {
      "type": "http",
      "url": "https://mcp.excalidraw.com/sse"
    }
  }
}
```

5. Restart the Claude Code extension (reload VS Code window: `Cmd+Shift+P` → "Reload Window")

---

## Option 2: Claude Desktop App

Add to your Claude Desktop config file:

- **Mac**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "excalidraw": {
      "type": "http",
      "url": "https://mcp.excalidraw.com/sse"
    }
  }
}
```

Then restart Claude Desktop.

---

## Option 3: Local Server (Self-Hosted)

If you prefer to run the MCP server locally instead of using the hosted version:

```bash
git clone https://github.com/excalidraw/excalidraw-mcp.git
cd excalidraw-mcp/excalidraw-mcp-app
pnpm install && pnpm run build
```

Then point your config to the local server:

```json
{
  "mcpServers": {
    "excalidraw": {
      "command": "node",
      "args": ["/absolute/path/to/excalidraw-mcp-app/dist/index.js", "--stdio"]
    }
  }
}
```

Replace `/absolute/path/to/` with the actual path where you cloned the repo.

---

## Verify Setup

After configuring, verify the MCP is connected by checking that these tools are available in Claude Code:

| Tool | Purpose |
|------|---------|
| `mcp__excalidraw__read_me` | Load element format reference |
| `mcp__excalidraw__create_view` | Render diagrams inline |
| `mcp__excalidraw__export_to_excalidraw` | Export to shareable excalidraw.com link |
| `mcp__excalidraw__save_checkpoint` | Save diagram state for iteration |
| `mcp__excalidraw__read_checkpoint` | Restore previous diagram state |

**Quick test**: Ask Claude Code to "draw a simple box" — if it renders an Excalidraw diagram inline, the MCP is working.

If the tools don't appear:
- Restart your editor/app
- Check that the URL `https://mcp.excalidraw.com/sse` is accessible from your network
- For local servers, check the terminal output for connection errors

---

## Recommended Permissions

To avoid being prompted for approval on every diagram, add these to your project's `.claude/settings.local.json`:

```json
{
  "permissions": {
    "allow": [
      "mcp__excalidraw__create_view",
      "mcp__excalidraw__export_to_excalidraw",
      "mcp__excalidraw__save_checkpoint",
      "mcp__excalidraw__read_checkpoint",
      "mcp__excalidraw__read_me"
    ]
  }
}
```

This auto-allows all Excalidraw MCP calls without prompting. These are safe — they only render diagrams and export to excalidraw.com (no file system access, no external writes).

---

## No Environment Variables Required

The Excalidraw MCP server works out of the box with zero configuration. No API keys, tokens, or environment variables needed.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Tools not appearing | Restart VS Code / Claude Desktop after config change |
| "MCP server not found" | Check URL is exactly `https://mcp.excalidraw.com/sse` |
| Diagram renders but no export link | Ensure `mcp__excalidraw__export_to_excalidraw` is in your permissions allow list |
| Local server won't start | Ensure Node.js 18+ and pnpm are installed |
| Permission prompts on every call | Add the permissions block above to `.claude/settings.local.json` |

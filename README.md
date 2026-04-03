# Claude Code Copier Ninja (CCC Ninja)

Parse, format, and copy Claude Code conversation transcripts with one click.

## Features

- **Parse JSONL transcripts** from Claude Code sessions
- **Clean Markdown output** with speaker labels, code blocks, and timestamps
- **One-click copy** to clipboard
- **Export** as `.md` or `.txt`
- **Auto-discover** transcript files in `~/.claude/projects/`
- **Tool call visibility** — optionally include or hide tool calls (Read, Write, Bash, etc.)

## Usage

1. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Run **"CCC Ninja: Copy Transcript"**
3. Select a transcript file (browse, pick from `.claude/` folder, or use the active editor)
4. A formatted Markdown tab opens with the parsed conversation
5. Use toolbar buttons or commands to copy/save:
   - **CCC Ninja: Copy to Clipboard**
   - **CCC Ninja: Save as Markdown**
   - **CCC Ninja: Save as Text**

## Where are transcript files?

Claude Code stores conversation transcripts as `.jsonl` files in:

```
~/.claude/projects/<encoded-path>/<session-id>/subagents/*.jsonl
```

The extension can auto-discover these files for you.

## Requirements

- VS Code 1.85+
- Claude Code transcript files (`.jsonl` format)

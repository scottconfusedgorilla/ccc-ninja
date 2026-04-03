# Claude Code Copier Ninja (CCC Ninja)

Parse, format, and copy Claude Code conversation transcripts with one click.

## Features

- **Parse JSONL transcripts** from Claude Code sessions
- **Clean Markdown output** with speaker labels, code blocks, and timestamps
- **One-click copy** to clipboard
- **Export** as `.md` or `.txt`
- **Auto-discover** transcript files in `~/.claude/projects/`
- **Tool call visibility** — optionally include or hide tool calls (Read, Write, Bash, etc.)

---

## Installation

There are two ways to install CCC Ninja. Pick whichever feels easier.

### Option A: Install from the `.vsix` file (easiest)

A `.vsix` file is just a packaged-up extension — like a `.zip` but for VS Code.

1. **Find the file.** After building (or downloading), you'll have a file called `ccc-ninja-0.1.0.vsix`.

2. **Open VS Code.**

3. **Open the Extensions panel.** Click the square icon on the left sidebar, or press `Ctrl+Shift+X`.

4. **Click the three-dot menu** (`...`) at the top of the Extensions panel.

5. **Click "Install from VSIX..."**

6. **Browse to the `.vsix` file**, select it, and click Install.

7. **Done!** You'll see a notification that says the extension was installed. You may need to reload VS Code — it'll prompt you if so.

### Option B: Install from the terminal

If you prefer the command line, open a terminal and run:

```
code --install-extension path/to/ccc-ninja-0.1.0.vsix
```

Replace `path/to/` with wherever the file actually is. For example:

```
code --install-extension S:\Projects\ccc-ninja\ccc-ninja-0.1.0.vsix
```

That's it. VS Code will install it and you're ready to go.

### Option C: Install from the VS Code Marketplace (coming soon)

Once published, you'll be able to search "Claude Code Copier Ninja" in the Extensions panel and click Install. Not available yet.

---

## How to use it

### Step 1: Open the Command Palette

Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac). This opens a search bar at the top of VS Code where you can type commands.

### Step 2: Type "CCC Ninja"

Start typing `CCC Ninja` and you'll see **"CCC Ninja: Copy Transcript"** appear. Click it (or press Enter).

### Step 3: Pick a transcript file

You'll get a menu with options:

- **"Browse for file..."** — opens a file picker so you can find the `.jsonl` file yourself
- **"Find in .claude/ folder"** — the extension looks in your `~/.claude/projects/` folder and shows you all the transcript files it finds
- **"Use current file"** — if you already have a `.jsonl` file open, this option appears too

Pick one and select the file you want.

### Step 4: Choose whether to include tool calls

You'll get asked: **"Include tool calls?"**

- **Include tool calls** — shows everything: file reads, writes, bash commands, etc.
- **Hide tool calls** — shows only the human/assistant conversation (cleaner, shorter)

### Step 5: Read, copy, or save

A new tab opens with your formatted transcript. From here you can:

| What you want to do | How to do it |
|---|---|
| **Copy everything to clipboard** | Open Command Palette (`Ctrl+Shift+P`) and run **"CCC Ninja: Copy to Clipboard"** — then paste anywhere |
| **Save as a Markdown file** | Command Palette → **"CCC Ninja: Save as Markdown"** — picks a save location |
| **Save as a plain text file** | Command Palette → **"CCC Ninja: Save as Text"** |

---

## Where are my transcript files?

When you use Claude Code, it saves your conversations as `.jsonl` files. They live here:

```
C:\Users\YourName\.claude\projects\<project>\<session-id>\subagents\*.jsonl
```

You don't need to memorize that path — the extension can find them for you (the "Find in .claude/ folder" option).

---

## The status bar

Look at the bottom-right corner of VS Code. You'll see **"CCC Ninja ready"**. You can click it as a shortcut to run the main command.

---

## Uninstalling

1. Open the Extensions panel (`Ctrl+Shift+X`)
2. Find "Claude Code Copier Ninja" in the list
3. Click **Uninstall**

---

## Requirements

- VS Code 1.85 or newer
- Claude Code transcript files (`.jsonl` format)

---

## Building from source

If you cloned this repo and want to build it yourself:

```bash
npm install
npm run compile
npx @vscode/vsce package
```

This creates the `.vsix` file. Then install it using Option A or B above.

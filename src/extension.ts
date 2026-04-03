import * as vscode from "vscode";
import * as path from "path";
import { parseTranscript } from "./parser";
import { formatAsMarkdown, formatAsPlainText } from "./formatter";

let statusBarItem: vscode.StatusBarItem;
let lastFormattedMarkdown: string | undefined;
let lastFormattedText: string | undefined;
let outputTabUri: vscode.Uri | undefined;

export function activate(context: vscode.ExtensionContext) {
  // Status bar
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.text = "$(dash) CCC Ninja ready";
  statusBarItem.command = "cccNinja.copyTranscript";
  statusBarItem.tooltip = "Click to parse a Claude Code transcript";
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "cccNinja.copyTranscript",
      () => copyTranscriptCommand()
    ),
    vscode.commands.registerCommand(
      "cccNinja.copyToClipboard",
      () => copyToClipboardCommand()
    ),
    vscode.commands.registerCommand(
      "cccNinja.saveAsMarkdown",
      () => saveCommand("md")
    ),
    vscode.commands.registerCommand(
      "cccNinja.saveAsText",
      () => saveCommand("txt")
    )
  );
}

async function copyTranscriptCommand() {
  // Find transcript files or let user pick
  const file = await pickTranscriptFile();
  if (!file) return;

  statusBarItem.text = "$(sync~spin) CCC Ninja parsing...";

  try {
    const raw = Buffer.from(
      await vscode.workspace.fs.readFile(file)
    ).toString("utf-8");
    const messages = parseTranscript(raw);

    if (messages.length === 0) {
      vscode.window.showWarningMessage(
        "CCC Ninja: No messages found in the selected file."
      );
      statusBarItem.text = "$(dash) CCC Ninja ready";
      return;
    }

    // Ask user about formatting options
    const includeTools = await vscode.window.showQuickPick(
      [
        { label: "Include tool calls", picked: true, value: true },
        { label: "Hide tool calls", picked: false, value: false },
      ],
      { placeHolder: "Include tool calls (Read, Write, Bash, etc.)?" }
    );

    const opts = {
      includeToolCalls: includeTools?.value ?? true,
      includeToolResults: false,
      includeTimestamps: true,
    };

    lastFormattedMarkdown = formatAsMarkdown(messages, opts);
    lastFormattedText = formatAsPlainText(messages);

    // Open in new tab as markdown
    const doc = await vscode.workspace.openTextDocument({
      content: lastFormattedMarkdown,
      language: "markdown",
    });
    await vscode.window.showTextDocument(doc, { preview: false });

    // Set context for toolbar buttons
    outputTabUri = doc.uri;
    await vscode.commands.executeCommand(
      "setContext",
      "cccNinja.isOutputTab",
      true
    );

    // Track when user navigates away
    const disposable = vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor && editor.document.uri.toString() !== outputTabUri?.toString()) {
        vscode.commands.executeCommand(
          "setContext",
          "cccNinja.isOutputTab",
          false
        );
      } else if (
        editor &&
        editor.document.uri.toString() === outputTabUri?.toString()
      ) {
        vscode.commands.executeCommand(
          "setContext",
          "cccNinja.isOutputTab",
          true
        );
      }
    });

    // Clean up on tab close
    const closeDisposable = vscode.workspace.onDidCloseTextDocument((closed) => {
      if (closed.uri.toString() === outputTabUri?.toString()) {
        vscode.commands.executeCommand(
          "setContext",
          "cccNinja.isOutputTab",
          false
        );
        outputTabUri = undefined;
        lastFormattedMarkdown = undefined;
        lastFormattedText = undefined;
        disposable.dispose();
        closeDisposable.dispose();
      }
    });

    const count = messages.filter(
      (m) => m.role === "user" || m.role === "assistant"
    ).length;
    vscode.window.showInformationMessage(
      `CCC Ninja: Parsed ${count} messages. Use toolbar buttons or command palette to copy/save.`
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`CCC Ninja: Failed to parse — ${msg}`);
  }

  statusBarItem.text = "$(dash) CCC Ninja ready";
}

async function pickTranscriptFile(): Promise<vscode.Uri | undefined> {
  // Check if active editor has a .jsonl file
  const active = vscode.window.activeTextEditor;
  if (active && active.document.fileName.endsWith(".jsonl")) {
    const useActive = await vscode.window.showQuickPick(
      [
        { label: "Use current file", value: "current" },
        { label: "Browse for file...", value: "browse" },
        { label: "Find in .claude/ folder", value: "find" },
      ],
      { placeHolder: "Which transcript to parse?" }
    );

    if (!useActive) return undefined;
    if (useActive.value === "current") return active.document.uri;
    if (useActive.value === "browse") return browseForFile();
    return findClaudeTranscripts();
  }

  // No active JSONL — offer browse or find
  const choice = await vscode.window.showQuickPick(
    [
      { label: "Browse for file...", value: "browse" },
      { label: "Find in .claude/ folder", value: "find" },
    ],
    { placeHolder: "Select a Claude Code transcript file" }
  );

  if (!choice) return undefined;
  if (choice.value === "browse") return browseForFile();
  return findClaudeTranscripts();
}

async function browseForFile(): Promise<vscode.Uri | undefined> {
  const uris = await vscode.window.showOpenDialog({
    canSelectMany: false,
    filters: { "JSONL Transcripts": ["jsonl"], "All Files": ["*"] },
    title: "Select Claude Code Transcript",
  });
  return uris?.[0];
}

async function findClaudeTranscripts(): Promise<vscode.Uri | undefined> {
  // Search common Claude Code transcript locations
  const homeDir =
    process.env.HOME || process.env.USERPROFILE || "";
  const claudeDir = path.join(homeDir, ".claude", "projects");

  try {
    const pattern = new vscode.RelativePattern(claudeDir, "**/*.jsonl");
    const files = await vscode.workspace.findFiles(pattern, null, 50);

    if (files.length === 0) {
      vscode.window.showWarningMessage(
        "CCC Ninja: No .jsonl files found in ~/.claude/projects/"
      );
      return browseForFile();
    }

    // Sort by modification time (newest first) — use file path as proxy
    const items = files.map((f) => ({
      label: path.basename(f.fsPath),
      description: path.dirname(f.fsPath).replace(claudeDir, "~/.claude/projects"),
      uri: f,
    }));

    const pick = await vscode.window.showQuickPick(items, {
      placeHolder: "Select a transcript file",
      matchOnDescription: true,
    });

    return pick?.uri;
  } catch {
    return browseForFile();
  }
}

async function copyToClipboardCommand() {
  if (!lastFormattedMarkdown) {
    vscode.window.showWarningMessage(
      "CCC Ninja: No transcript loaded. Run 'CCC Ninja: Copy Transcript' first."
    );
    return;
  }
  await vscode.env.clipboard.writeText(lastFormattedMarkdown);
  vscode.window.showInformationMessage("CCC Ninja: Copied to clipboard!");
}

async function saveCommand(format: "md" | "txt") {
  const content =
    format === "md" ? lastFormattedMarkdown : lastFormattedText;

  if (!content) {
    vscode.window.showWarningMessage(
      "CCC Ninja: No transcript loaded. Run 'CCC Ninja: Copy Transcript' first."
    );
    return;
  }

  const uri = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file(`transcript.${format}`),
    filters:
      format === "md"
        ? { Markdown: ["md"] }
        : { "Text Files": ["txt"] },
    title: `Save transcript as .${format}`,
  });

  if (uri) {
    await vscode.workspace.fs.writeFile(uri, Buffer.from(content, "utf-8"));
    vscode.window.showInformationMessage(`CCC Ninja: Saved to ${uri.fsPath}`);
  }
}

export function deactivate() {
  statusBarItem?.dispose();
}

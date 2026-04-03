/**
 * Formats parsed messages as styled HTML that mimics the Claude Code terminal UI.
 */

import { ParsedMessage } from "./parser";
import { FormatOptions } from "./formatter";

const defaultOptions: FormatOptions = {
  includeToolCalls: true,
  includeToolResults: false,
  includeTimestamps: true,
};

export function formatAsHtml(
  messages: ParsedMessage[],
  opts: Partial<FormatOptions> = {}
): string {
  const options = { ...defaultOptions, ...opts };
  const bodyHtml = messages
    .map((msg) => renderMessage(msg, options))
    .filter(Boolean)
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Claude Code Transcript</title>
<style>
${CSS}
</style>
</head>
<body>
<div class="transcript">
  <div class="messages">
${bodyHtml}
  </div>
</div>
</body>
</html>`;
}

function renderMessage(msg: ParsedMessage, options: FormatOptions): string {
  if (msg.role === "tool_use" && !options.includeToolCalls) return "";
  if (msg.role === "tool_result" && !options.includeToolResults) return "";

  const ts = options.includeTimestamps && msg.timestamp
    ? `<span class="timestamp">${formatTimestamp(msg.timestamp)}</span>`
    : "";

  switch (msg.role) {
    case "user":
      return `    <div class="message user-message">
      <div class="message-header">
        <span class="dot dot-user"></span>
        <span class="role-label user-label">User</span>${ts}
      </div>
      <div class="message-body">${escapeAndFormat(msg.content)}</div>
    </div>
    <div class="separator"></div>`;

    case "assistant": {
      const modelTag = msg.model
        ? `<span class="model-tag">${escapeHtml(shortModelName(msg.model))}</span>`
        : "";
      return `    <div class="message assistant-message">
      <div class="message-header">
        <span class="dot dot-assistant"></span>
        <span class="role-label assistant-label">Assistant</span>${modelTag}${ts}
      </div>
      <div class="message-body">${escapeAndFormat(msg.content)}</div>
    </div>
    <div class="separator"></div>`;
    }

    case "tool_use": {
      const summary = toolSummary(msg.toolName, msg.toolInput);
      const hasDetail = msg.toolInput && msg.toolInput.includes("\n");
      if (hasDetail) {
        return `    <div class="message tool-message">
      <details class="tool-details">
        <summary class="tool-summary-line">
          <span class="tool-icon">${toolIcon(msg.toolName)}</span>
          <span class="tool-label">${escapeHtml(msg.toolName ?? "Tool")}</span>
          <span class="tool-summary-text">${escapeHtml(summary)}</span>${ts}
        </summary>
        <pre class="tool-input"><code>${escapeHtml(msg.toolInput ?? "")}</code></pre>
      </details>
    </div>`;
      }
      return `    <div class="message tool-message">
      <div class="tool-summary-line">
        <span class="tool-icon">${toolIcon(msg.toolName)}</span>
        <span class="tool-label">${escapeHtml(msg.toolName ?? "Tool")}</span>
        <span class="tool-summary-text">${escapeHtml(summary)}</span>${ts}
      </div>
    </div>`;
    }

    case "tool_result":
      return `    <div class="message tool-result-message">
      <details class="tool-details">
        <summary class="tool-result-summary">
          <span class="tool-result-icon">▸</span> Output
        </summary>
        <pre class="tool-output"><code>${escapeHtml(truncate(msg.content, 3000))}</code></pre>
      </details>
    </div>`;

    default:
      return "";
  }
}

function shortModelName(model: string): string {
  // "claude-opus-4-6" -> "claude-opus-4-6"
  // Keep it short but recognizable
  return model
    .replace("anthropic.", "")
    .replace("openai.", "");
}

function toolIcon(name: string | undefined): string {
  switch (name) {
    case "Read": return "📄";
    case "Write": return "✏️";
    case "Edit": return "✏️";
    case "Bash": return "⚡";
    case "Glob": return "🔍";
    case "Grep": return "🔍";
    case "Agent": return "🤖";
    case "WebSearch": return "🌐";
    case "WebFetch": return "🌐";
    case "TodoWrite": return "📋";
    case "AskUserQuestion": return "❓";
    case "ToolSearch": return "🔧";
    default: return "⚙️";
  }
}

function toolSummary(_name: string | undefined, input: string | undefined): string {
  if (!input) return "";
  // For single-line inputs, show as-is. For multi-line, show first line.
  const firstLine = input.split("\n")[0];
  const maxLen = 100;
  if (firstLine.length > maxLen) {
    return firstLine.slice(0, maxLen) + "...";
  }
  return firstLine;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAndFormat(s: string): string {
  let html = escapeHtml(s);

  // Code blocks: ```lang\n...\n```
  html = html.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    (_m, _lang, code) =>
      `<pre class="code-block"><code>${code}</code></pre>`
  );

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // Italic (but not inside already-processed bold)
  html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");

  // Headings (## and ###)
  html = html.replace(/^### (.+)$/gm, '<div class="heading-3">$1</div>');
  html = html.replace(/^## (.+)$/gm, '<div class="heading-2">$1</div>');

  // Bullet lists
  html = html.replace(/^- (.+)$/gm, '<div class="list-item"><span class="bullet">-</span> $1</div>');

  // Numbered lists
  html = html.replace(/^(\d+)\. (.+)$/gm, '<div class="list-item"><span class="bullet">$1.</span> $2</div>');

  // Tables (basic: | col | col |)
  html = html.replace(/^\|(.+)\|$/gm, (_match, inner) => {
    const cells = inner.split("|").map((c: string) => c.trim());
    // Skip separator rows like |---|---|
    if (cells.every((c: string) => /^-+$/.test(c))) return "";
    const tds = cells.map((c: string) => `<td>${c}</td>`).join("");
    return `<tr>${tds}</tr>`;
  });
  // Wrap consecutive <tr> rows in a table
  html = html.replace(
    /((?:<tr>.*?<\/tr>\s*)+)/g,
    '<table class="md-table">$1</table>'
  );

  // Line breaks (but not inside pre blocks)
  html = html.replace(/\n/g, "<br>");
  // Clean up <br> inside pre
  html = html.replace(/<pre([^>]*)>([\s\S]*?)<\/pre>/g, (_m, attrs, inner) => {
    return `<pre${attrs}>${inner.replace(/<br>/g, "\n")}</pre>`;
  });

  return html;
}

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true })
      .toUpperCase();
  } catch {
    return ts;
  }
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + "\n... (truncated)";
}

const CSS = `
:root {
  --bg: #1e1e1e;
  --bg-hover: #252526;
  --bg-code: #161616;
  --text: #d4d4d4;
  --text-dim: #6a737d;
  --text-code: #d4d4d4;
  --green: #4ec9b0;
  --purple: #c586c0;
  --orange: #ce9178;
  --blue: #569cd6;
  --yellow: #dcdcaa;
  --separator: #333333;
  --font-mono: 'Cascadia Code', 'SF Mono', 'Fira Code', 'JetBrains Mono', Consolas, 'Courier New', monospace;
  --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.6;
}

.transcript {
  max-width: 860px;
  margin: 0 auto;
  padding: 20px 0;
}

.messages {
  padding: 0 24px;
}

/* Separator line between messages */
.separator {
  height: 1px;
  background: var(--separator);
  margin: 4px 0;
}

/* Messages */
.message {
  padding: 12px 0;
}

.message-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.dot-user { background: var(--green); }
.dot-assistant { background: var(--purple); }

.role-label {
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 600;
}
.user-label { color: var(--green); }
.assistant-label { color: var(--purple); }

.model-tag {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-dim);
  background: rgba(255,255,255,0.06);
  padding: 2px 8px;
  border-radius: 10px;
  margin-left: 4px;
}

.timestamp {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-dim);
  margin-left: auto;
}

.message-body {
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.65;
  padding-left: 16px;
}

/* Tool messages */
.tool-message {
  padding: 4px 0;
}

.tool-summary-line {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--text-dim);
  cursor: default;
  list-style: none;
}

.tool-details > .tool-summary-line {
  cursor: pointer;
}

.tool-details > .tool-summary-line::-webkit-details-marker,
.tool-details > .tool-summary-line::marker {
  display: none;
  content: "";
}

.tool-details[open] > .tool-summary-line {
  margin-bottom: 6px;
}

.tool-icon {
  font-size: 13px;
  flex-shrink: 0;
}

.tool-label {
  font-weight: 600;
  color: var(--yellow);
  white-space: nowrap;
}

.tool-summary-text {
  color: var(--text-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.tool-input {
  background: var(--bg-code);
  border: 1px solid var(--separator);
  border-radius: 6px;
  padding: 10px 14px;
  overflow-x: auto;
  margin: 0 0 4px 22px;
}

.tool-input code {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-code);
  white-space: pre-wrap;
  word-break: break-all;
}

/* Tool results */
.tool-result-message {
  padding: 2px 0;
}

.tool-result-summary {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-dim);
  cursor: pointer;
  list-style: none;
  padding: 2px 0;
}

.tool-result-summary::-webkit-details-marker,
.tool-result-summary::marker {
  display: none;
  content: "";
}

.tool-result-icon {
  font-size: 10px;
}

.tool-details[open] .tool-result-icon {
  display: inline-block;
  transform: rotate(90deg);
}

.tool-output {
  background: var(--bg-code);
  border: 1px solid var(--separator);
  border-radius: 6px;
  padding: 10px 14px;
  margin: 6px 0 4px 22px;
  overflow-x: auto;
}

.tool-output code {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-code);
  white-space: pre-wrap;
}

/* Code blocks in message bodies */
.code-block {
  background: var(--bg-code);
  border: 1px solid var(--separator);
  border-radius: 6px;
  margin: 8px 0;
  overflow-x: auto;
}

.code-block code {
  display: block;
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--text-code);
  padding: 12px 14px;
  white-space: pre-wrap;
  word-break: break-all;
}

.inline-code {
  font-family: var(--font-mono);
  font-size: 13px;
  background: rgba(255,255,255,0.08);
  padding: 1px 5px;
  border-radius: 3px;
  color: var(--orange);
}

strong { color: #e0e0e0; }
em { color: var(--text); font-style: italic; }

.list-item {
  padding-left: 4px;
  margin: 2px 0;
}
.list-item .bullet {
  color: var(--text-dim);
  margin-right: 4px;
}

.heading-2 {
  font-size: 16px;
  font-weight: 600;
  color: #e0e0e0;
  margin: 12px 0 6px;
}

.heading-3 {
  font-size: 14px;
  font-weight: 600;
  color: #e0e0e0;
  margin: 10px 0 4px;
}

.md-table {
  border-collapse: collapse;
  margin: 8px 0;
  font-size: 13px;
}

.md-table td {
  border: 1px solid var(--separator);
  padding: 4px 12px;
}

.md-table tr:first-child td {
  font-weight: 600;
  background: rgba(255,255,255,0.04);
}
`;

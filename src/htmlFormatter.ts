/**
 * Formats parsed messages as styled HTML that mimics the Claude Code VS Code panel.
 */

import { ParsedMessage } from "./parser";
import { FormatOptions } from "./formatter";

const defaultOptions: FormatOptions = {
  includeToolCalls: true,
  includeToolResults: true,
  includeTimestamps: true,
};

export function formatAsHtml(
  messages: ParsedMessage[],
  opts: Partial<FormatOptions> = {}
): string {
  const options = { ...defaultOptions, ...opts };

  // Build a map of toolId -> tool_result content
  const resultMap = new Map<string, string>();
  for (const msg of messages) {
    if (msg.role === "tool_result" && msg.toolId) {
      resultMap.set(msg.toolId, msg.content);
    }
  }

  const bodyParts: string[] = [];
  for (const msg of messages) {
    // Skip standalone tool_results — they're inlined into tool_use
    if (msg.role === "tool_result") continue;
    if (msg.role === "tool_use" && !options.includeToolCalls) continue;

    const ts = options.includeTimestamps && msg.timestamp
      ? `<span class="timestamp">${formatTimestamp(msg.timestamp)}</span>`
      : "";

    const html = renderMessage(msg, ts, options, resultMap);
    if (html) bodyParts.push(html);
  }

  const bodyHtml = bodyParts.join("\n");

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

function renderMessage(
  msg: ParsedMessage,
  ts: string,
  options: FormatOptions,
  resultMap: Map<string, string>
): string {
  switch (msg.role) {
    case "user":
      return `    <div class="message user-message">
      <div class="message-header">
        <span class="dot dot-user"></span>
        <span class="role-label">User</span>${ts}
      </div>
      <div class="user-bubble">${escapeAndFormat(msg.content)}</div>
    </div>`;

    case "assistant": {
      const modelTag = msg.model
        ? `<span class="model-tag">${escapeHtml(shortModelName(msg.model))}</span>`
        : "";
      return `    <div class="message assistant-message">
      <div class="message-header">
        <span class="dot dot-assistant"></span>
        <span class="role-label">Assistant</span>${modelTag}${ts}
      </div>
      <div class="message-body">${escapeAndFormat(msg.content)}</div>
    </div>`;
    }

    case "tool_use": {
      const desc = msg.toolDescription || "";
      const input = msg.toolInput || "";
      const result = msg.toolId ? resultMap.get(msg.toolId) : undefined;
      return renderToolCall(msg.toolName ?? "Tool", desc, input, result, ts, options);
    }

    default:
      return "";
  }
}

function renderToolCall(
  name: string,
  description: string,
  input: string,
  result: string | undefined,
  ts: string,
  options: FormatOptions
): string {
  const icon = toolIcon(name);
  const summaryText = description || truncateLine(input, 80);

  // Build the inner content (IN/OUT blocks)
  let innerHtml = "";

  if (input) {
    innerHtml += `\n      <div class="tool-io">
        <span class="tool-io-label">IN</span>
        <pre class="tool-io-content"><code>${escapeHtml(input)}</code></pre>
      </div>`;
  }

  if (result && options.includeToolResults) {
    const trimmed = truncate(result, 3000);
    innerHtml += `\n      <div class="tool-io">
        <span class="tool-io-label">OUT</span>
        <pre class="tool-io-content"><code>${escapeHtml(trimmed)}</code></pre>
      </div>`;
  }

  if (innerHtml) {
    return `    <div class="message tool-message">
      <details class="tool-details">
        <summary class="tool-summary-line">
          <span class="tool-icon">${icon}</span>
          <span class="tool-label">${escapeHtml(name)}</span>
          <span class="tool-summary-text">${escapeHtml(summaryText)}</span>${ts}
        </summary>${innerHtml}
      </details>
    </div>`;
  }

  return `    <div class="message tool-message">
      <div class="tool-summary-line">
        <span class="tool-icon">${icon}</span>
        <span class="tool-label">${escapeHtml(name)}</span>
        <span class="tool-summary-text">${escapeHtml(summaryText)}</span>${ts}
      </div>
    </div>`;
}

function shortModelName(model: string): string {
  return model.replace("anthropic.", "").replace("openai.", "");
}

function toolIcon(name: string | undefined): string {
  switch (name) {
    case "Bash": return "⚡";
    case "Read": return "📄";
    case "Write": return "✏️";
    case "Edit": return "✏️";
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

function truncateLine(s: string, max: number): string {
  const firstLine = s.split("\n")[0];
  if (firstLine.length > max) return firstLine.slice(0, max - 3) + "...";
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

  // Italic
  html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");

  // Headings
  html = html.replace(/^### (.+)$/gm, '<div class="heading-3">$1</div>');
  html = html.replace(/^## (.+)$/gm, '<div class="heading-2">$1</div>');

  // Bullet lists
  html = html.replace(/^- (.+)$/gm, '<div class="list-item">&#8226; $1</div>');

  // Numbered lists
  html = html.replace(/^(\d+)\. (.+)$/gm, '<div class="list-item"><span class="bullet">$1.</span> $2</div>');

  // Tables
  html = html.replace(/^\|(.+)\|$/gm, (_match, inner) => {
    const cells = inner.split("|").map((c: string) => c.trim());
    if (cells.every((c: string) => /^-+$/.test(c))) return "";
    const tds = cells.map((c: string) => `<td>${c}</td>`).join("");
    return `<tr>${tds}</tr>`;
  });
  html = html.replace(
    /((?:<tr>.*?<\/tr>\s*)+)/g,
    '<table class="md-table">$1</table>'
  );

  // Line breaks (but not inside pre blocks)
  html = html.replace(/\n/g, "<br>");
  // Collapse 3+ consecutive <br> to 2
  html = html.replace(/(<br>){3,}/g, "<br><br>");
  // Strip leading/trailing <br>
  html = html.replace(/^(<br>)+/, "").replace(/(<br>)+$/, "");
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
  --bg: #ffffff;
  --bg-code: #f5f5f5;
  --bg-user-bubble: #e8f0fe;
  --bg-tool-io: #1e1e1e;
  --text: #232323;
  --text-dim: #888888;
  --text-light: #d4d4d4;
  --purple: #8b5cf6;
  --bg-assistant: rgba(139, 92, 246, 0.12);
  --blue-dot: #3b82f6;
  --border: #e5e5e5;
  --font-mono: 'Cascadia Code', 'SF Mono', 'Fira Code', 'JetBrains Mono', Consolas, 'Courier New', monospace;
  --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 13px;
  line-height: 1.45;
}

.transcript {
  max-width: 860px;
  margin: 0 auto;
  padding: 8px 0;
}

.messages {
  padding: 0 16px 0 36px;
}

/* User messages — rounded gray bubble */
.user-message {
  padding: 3px 0;
}

.user-bubble {
  background: var(--bg-user-bubble);
  border-radius: 12px;
  padding: 6px 14px;
  font-size: 13px;
  line-height: 1.45;
  color: var(--text);
  display: inline-block;
  max-width: 100%;
}

/* Assistant messages */
.assistant-message {
  padding: 3px 0;
}

.assistant-message .message-body {
  background: var(--bg-assistant);
  border-radius: 12px;
  padding: 4px 12px;
  margin-left: 0;
}

.assistant-message .message-body br + br {
  display: none;
}

.message-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 2px;
  margin-left: -20px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.dot-user { background: var(--blue-dot); }
.dot-assistant { background: var(--purple); }

.role-label {
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.model-tag {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-dim);
  background: var(--bg-code);
  padding: 1px 6px;
  border-radius: 8px;
  margin-left: 2px;
}

.timestamp {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-dim);
  margin-left: auto;
  white-space: nowrap;
}

.message-body {
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 13px;
  line-height: 1.5;
  padding-left: 14px;
}

/* Tool messages */
.tool-message {
  padding: 1px 0;
}

.tool-summary-line {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 1px 0;
  font-family: var(--font-mono);
  font-size: 12px;
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

.tool-icon {
  font-size: 12px;
  flex-shrink: 0;
}

.tool-label {
  font-weight: 700;
  color: var(--text);
  white-space: nowrap;
  font-size: 12px;
}

.tool-summary-text {
  color: var(--text-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  font-size: 12px;
}

/* IN / OUT blocks — dark like VS Code terminal */
.tool-io {
  display: flex;
  gap: 0;
  margin: 2px 0 2px 18px;
  border-radius: 6px;
  overflow: hidden;
  background: var(--bg-tool-io);
}

.tool-io-label {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  color: var(--text-dim);
  padding: 4px 8px;
  background: rgba(255,255,255,0.04);
  display: flex;
  align-items: flex-start;
  white-space: nowrap;
  min-width: 32px;
  user-select: none;
}

.tool-io-content {
  flex: 1;
  margin: 0;
  padding: 4px 8px;
  overflow-x: auto;
  max-height: 120px;
  overflow-y: auto;
}

.tool-io-content code {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-light);
  white-space: pre-wrap;
  word-break: break-all;
}

/* Code blocks in message bodies — dark */
.code-block {
  background: #1e1e1e;
  border-radius: 6px;
  margin: 4px 0;
  overflow-x: auto;
}

.code-block code {
  display: block;
  font-family: var(--font-mono);
  font-size: 12px;
  color: #d4d4d4;
  padding: 6px 10px;
  white-space: pre-wrap;
  word-break: break-all;
}

.inline-code {
  font-family: var(--font-mono);
  font-size: 12px;
  background: var(--bg-code);
  padding: 0 4px;
  border-radius: 3px;
  color: #c7254e;
}

strong { font-weight: 600; }

.list-item {
  padding-left: 12px;
  margin: 0;
  line-height: 1.35;
}

.heading-2 {
  font-size: 15px;
  font-weight: 600;
  margin: 6px 0 3px;
}

.heading-3 {
  font-size: 13px;
  font-weight: 600;
  margin: 4px 0 2px;
}

.md-table {
  border-collapse: collapse;
  margin: 4px 0;
  font-size: 12px;
}

.md-table td {
  border: 1px solid var(--border);
  padding: 2px 8px;
}

.md-table tr:first-child td {
  font-weight: 600;
  background: var(--bg-code);
}
`;

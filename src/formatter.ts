/**
 * Formats parsed messages into clean Markdown output.
 */

import { ParsedMessage } from "./parser";

export interface FormatOptions {
  includeToolCalls: boolean;
  includeToolResults: boolean;
  includeTimestamps: boolean;
}

const defaultOptions: FormatOptions = {
  includeToolCalls: true,
  includeToolResults: false,
  includeTimestamps: true,
};

export function formatAsMarkdown(
  messages: ParsedMessage[],
  opts: Partial<FormatOptions> = {}
): string {
  const options = { ...defaultOptions, ...opts };
  const sections: string[] = [];

  sections.push("# Claude Code Transcript\n");

  for (const msg of messages) {
    if (msg.role === "tool_use" && !options.includeToolCalls) continue;
    if (msg.role === "tool_result" && !options.includeToolResults) continue;

    const timestamp = options.includeTimestamps && msg.timestamp
      ? ` <sub>${formatTimestamp(msg.timestamp)}</sub>`
      : "";

    switch (msg.role) {
      case "user":
        sections.push(`---\n\n## 🧑 User${timestamp}\n\n${msg.content}\n`);
        break;

      case "assistant": {
        const model = msg.model ? ` *(${msg.model})*` : "";
        sections.push(
          `---\n\n## 🤖 Assistant${model}${timestamp}\n\n${msg.content}\n`
        );
        break;
      }

      case "tool_use":
        sections.push(
          `> **🔧 ${msg.toolName}**${timestamp}\n` +
            (msg.toolInput
              ? `> \`\`\`\n> ${msg.toolInput.split("\n").join("\n> ")}\n> \`\`\`\n`
              : "")
        );
        break;

      case "tool_result":
        sections.push(
          `<details><summary>Tool Result${timestamp}</summary>\n\n\`\`\`\n${truncate(msg.content, 2000)}\n\`\`\`\n</details>\n`
        );
        break;
    }
  }

  return sections.join("\n");
}

export function formatAsPlainText(messages: ParsedMessage[]): string {
  const lines: string[] = [];
  lines.push("CLAUDE CODE TRANSCRIPT");
  lines.push("=".repeat(60));

  for (const msg of messages) {
    if (msg.role === "tool_use" || msg.role === "tool_result") continue;

    const ts = msg.timestamp ? ` [${formatTimestamp(msg.timestamp)}]` : "";

    if (msg.role === "user") {
      lines.push("", "-".repeat(60), `USER${ts}`, "-".repeat(60), msg.content);
    } else if (msg.role === "assistant") {
      lines.push(
        "",
        "-".repeat(60),
        `ASSISTANT${ts}`,
        "-".repeat(60),
        msg.content
      );
    }
  }

  return lines.join("\n");
}

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleString();
  } catch {
    return ts;
  }
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + "\n... (truncated)";
}

/**
 * Parses Claude Code JSONL transcript files into structured messages.
 */

export interface ParsedMessage {
  role: "user" | "assistant" | "tool_use" | "tool_result";
  timestamp: string;
  content: string;
  model?: string;
  toolName?: string;
  toolInput?: string;
  toolResult?: string;
}

interface JsonlEntry {
  type?: string;
  timestamp?: string;
  message?: {
    role?: string;
    content?: string | ContentBlock[];
    model?: string;
  };
}

interface ContentBlock {
  type: string;
  text?: string;
  name?: string;
  input?: Record<string, unknown>;
  content?: string | ToolResultContent[];
  tool_use_id?: string;
}

interface ToolResultContent {
  type: string;
  text?: string;
}

export function parseTranscript(raw: string): ParsedMessage[] {
  const lines = raw.split("\n").filter((l) => l.trim());
  const messages: ParsedMessage[] = [];

  for (const line of lines) {
    let entry: JsonlEntry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }

    if (!entry.message?.role) continue;
    if (entry.type === "progress") continue;

    const role = entry.message.role as string;
    const ts = entry.timestamp ?? "";
    const content = entry.message.content;

    if (role === "user") {
      if (typeof content === "string") {
        messages.push({ role: "user", timestamp: ts, content });
      } else if (Array.isArray(content)) {
        // Could be tool_result array or text array
        for (const block of content) {
          if (block.type === "tool_result") {
            const resultText = extractToolResultText(block);
            if (resultText) {
              messages.push({
                role: "tool_result",
                timestamp: ts,
                content: resultText,
                toolName: block.tool_use_id,
              });
            }
          } else if (block.type === "text" && block.text) {
            messages.push({ role: "user", timestamp: ts, content: block.text });
          }
        }
      }
    } else if (role === "assistant") {
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === "text" && block.text) {
            messages.push({
              role: "assistant",
              timestamp: ts,
              content: block.text,
              model: entry.message.model,
            });
          } else if (block.type === "tool_use") {
            messages.push({
              role: "tool_use",
              timestamp: ts,
              content: "",
              toolName: block.name,
              toolInput: formatToolInput(block.name, block.input),
            });
          }
        }
      } else if (typeof content === "string") {
        messages.push({
          role: "assistant",
          timestamp: ts,
          content,
          model: entry.message.model,
        });
      }
    }
  }

  return messages;
}

function extractToolResultText(block: ContentBlock): string {
  if (typeof block.content === "string") return block.content;
  if (Array.isArray(block.content)) {
    return block.content
      .filter((c) => c.type === "text" && c.text)
      .map((c) => c.text!)
      .join("\n");
  }
  return "";
}

function formatToolInput(
  name: string | undefined,
  input: Record<string, unknown> | undefined
): string {
  if (!input) return "";
  // Show concise summaries for common tools
  switch (name) {
    case "Read":
      return String(input.file_path ?? "");
    case "Write":
      return String(input.file_path ?? "");
    case "Edit":
      return String(input.file_path ?? "");
    case "Bash":
      return String(input.command ?? "");
    case "Glob":
      return String(input.pattern ?? "");
    case "Grep":
      return `${input.pattern ?? ""} ${input.path ?? ""}`.trim();
    default:
      return JSON.stringify(input, null, 2);
  }
}

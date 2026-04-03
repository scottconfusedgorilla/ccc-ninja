/**
 * Parses Claude Code JSONL transcript files into structured messages.
 */

export interface ParsedMessage {
  role: "user" | "assistant" | "tool_use" | "tool_result";
  timestamp: string;
  content: string;
  model?: string;
  toolName?: string;
  toolDescription?: string;
  toolInput?: string;
  toolId?: string;
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
  id?: string;
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
        for (const block of content) {
          if (block.type === "tool_result") {
            const resultText = extractToolResultText(block);
            if (resultText) {
              messages.push({
                role: "tool_result",
                timestamp: ts,
                content: resultText,
                toolId: block.tool_use_id,
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
            const { description, input: formattedInput } = formatToolInput(
              block.name,
              block.input
            );
            messages.push({
              role: "tool_use",
              timestamp: ts,
              content: "",
              toolName: block.name,
              toolDescription: description,
              toolInput: formattedInput,
              toolId: block.id,
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
): { description: string; input: string } {
  if (!input) return { description: "", input: "" };

  switch (name) {
    case "Bash":
      return {
        description: String(input.description ?? ""),
        input: String(input.command ?? ""),
      };
    case "Read":
      return { description: String(input.file_path ?? ""), input: "" };
    case "Write":
      return { description: String(input.file_path ?? ""), input: "" };
    case "Edit":
      return {
        description: String(input.file_path ?? ""),
        input: "",
      };
    case "Glob":
      return { description: String(input.pattern ?? ""), input: "" };
    case "Grep":
      return {
        description: `${input.pattern ?? ""} ${input.path ?? ""}`.trim(),
        input: "",
      };
    default:
      return {
        description: String(input.description ?? ""),
        input: JSON.stringify(input, null, 2),
      };
  }
}

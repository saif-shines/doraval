import { brotliDecompressSync, gunzipSync, inflateSync } from "node:zlib";

const REDACT = new Set(["authorization", "x-api-key", "api-key", "cookie"]);

export function decodeWireBody(buf: Buffer, encoding?: string): string {
  const enc = (encoding ?? "").toLowerCase();
  try {
    if (enc === "gzip") return gunzipSync(buf).toString("utf8");
    if (enc === "deflate") return inflateSync(buf).toString("utf8");
    if (enc === "br") return brotliDecompressSync(buf).toString("utf8");
  } catch {
    return buf.toString("utf8");
  }
  return buf.toString("utf8");
}

export function wireStamp(now: Date): string {
  return now.toISOString().replace(/[:.]/g, "-").replace(/Z$/, "");
}

function textOf(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return undefined;
  const parts = value.map((block) => {
    if (typeof block === "string") return block;
    if (block && typeof block === "object" && "text" in block && typeof block.text === "string") return block.text;
    return "";
  }).filter(Boolean);
  return parts.length ? parts.join("\n") : undefined;
}

function toolBlock(value: unknown): string | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  return value.map((tool) => {
    if (!tool || typeof tool !== "object") return "tool";
    const row = tool as Record<string, unknown>;
    const fn = row.function && typeof row.function === "object" ? row.function as Record<string, unknown> : undefined;
    const name = String(row.name ?? fn?.name ?? "tool");
    const description = String(row.description ?? fn?.description ?? "");
    return description ? `${name}\n${description}` : name;
  }).join("\n\n");
}

function messageBlock(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return undefined;
  return value.map((message, index) => {
    if (!message || typeof message !== "object") return `${index}. ${JSON.stringify(message)}`;
    const row = message as Record<string, unknown>;
    const role = String(row.role ?? row.type ?? "message");
    const content = typeof row.content === "string" ? row.content : JSON.stringify(row.content ?? row);
    return `${index}. ${role}\n${content}`;
  }).join("\n\n");
}

function responseText(raw: string): string {
  if (!raw.includes("data:")) return raw;
  const bits: string[] = [];
  for (const line of raw.split("\n")) {
    if (!line.startsWith("data:")) continue;
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      const event = JSON.parse(payload) as Record<string, unknown>;
      const delta = event.delta && typeof event.delta === "object" ? event.delta as Record<string, unknown> : undefined;
      const choice = Array.isArray(event.choices) ? event.choices[0] as Record<string, unknown> | undefined : undefined;
      const choiceDelta = choice?.delta && typeof choice.delta === "object" ? choice.delta as Record<string, unknown> : undefined;
      const text = delta?.text ?? delta?.thinking ?? choiceDelta?.content;
      if (typeof text === "string") bits.push(text);
    } catch {
      // Keep the raw stream when an event is not JSON.
    }
  }
  return bits.length ? bits.join("") : raw;
}

function headerBlock(headers: Record<string, string | string[] | undefined>): string {
  const lines: string[] = [];
  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    const shown = REDACT.has(name.toLowerCase()) ? "[REDACTED]" : Array.isArray(value) ? value.join(", ") : value;
    lines.push(`${name}: ${shown}`);
  }
  return lines.join("\n");
}

export function renderWireMarkdown(input: {
  at: string;
  agent: string;
  method: string;
  path: string;
  status: number;
  headers: Record<string, string | string[] | undefined>;
  requestText: string;
  responseText: string;
}): string {
  let system: string | undefined;
  let tools: string | undefined;
  let messages: string | undefined;
  let raw = input.requestText;
  try {
    const json = JSON.parse(input.requestText) as Record<string, unknown>;
    system = textOf(json.system) ?? (typeof json.instructions === "string" ? json.instructions : undefined);
    tools = toolBlock(json.tools);
    messages = messageBlock(json.messages ?? json.input);
    raw = JSON.stringify(json, null, 2);
  } catch {
    // Not JSON. The request section keeps the bytes as text.
  }
  const parts = [
    "<meta>",
    `at: ${input.at}`,
    `agent: ${input.agent}`,
    `${input.method} ${input.path}`,
    `status: ${input.status}`,
    "</meta>",
    "",
    "<headers>",
    headerBlock(input.headers),
    "</headers>",
    "",
  ];
  if (system) parts.push("<system-prompt>", system, "</system-prompt>", "");
  if (tools) parts.push("<tools>", tools, "</tools>", "");
  if (messages) parts.push("<messages>", messages, "</messages>", "");
  if (!system && !tools && !messages) parts.push("<request>", raw, "</request>", "");
  parts.push("<response>", responseText(input.responseText), "</response>", "");
  return parts.join("\n");
}

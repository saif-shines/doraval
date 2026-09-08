import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { YAML } from "bun";

export function pocketFooter(slug: string): string {
  return `Sent by pocket agent ${slug}`;
}

export function stampText(text: string, slug: string): string {
  const line = pocketFooter(slug);
  const t = text.replace(/\s+$/, "");
  if (t.endsWith(line)) return t + "\n";
  return `${t}\n\n${line}\n`;
}

const POST_NAME =
  /pr.?review|create.?review|pull_request_review|(?:slack|chat).{0,32}(?:post|message)|(?:post|message).{0,32}(?:slack|chat)|chat_post|post_message|conversations_post/i;
const GH_NAME = /pr.?review|create.?review|pull_request_review/i;
const SLACK_NAME = /(?:slack|chat).{0,32}(?:post|message)|(?:post|message).{0,32}(?:slack|chat)|chat_post|post_message|conversations_post/i;
const TEXT_KEYS = ["body", "comment", "text", "message", "content", "review_body", "body_text"] as const;

export function isPostTool(name: string, args: Record<string, unknown>): boolean {
  if (POST_NAME.test(name)) return true;
  const cmd = commandOf(args);
  if (cmd && (/gh\s+pr\s+review/.test(cmd) || /chat\.postMessage/.test(cmd) || /slack\s+chat/.test(cmd))) return true;
  return false;
}

function commandOf(args: Record<string, unknown>): string {
  const c = args.command ?? args.cmd;
  return typeof c === "string" ? c : "";
}

function stampGhReviewCommand(cmd: string, slug: string): string {
  const line = pocketFooter(slug);
  if (cmd.includes(line)) return cmd;
  const m = cmd.match(/(--body|-b)\s+("([^"]*)"|'([^']*)'|(\S+))/);
  if (m) {
    const inner = m[3] ?? m[4] ?? m[5] ?? "";
    const next = stampText(inner, slug).trimEnd();
    return cmd.replace(m[0], `${m[1]} ${JSON.stringify(next)}`);
  }
  return `${cmd.trimEnd()} --body ${JSON.stringify(line)}`;
}

export function stampToolArgs(
  args: Record<string, unknown>,
  slug: string,
  name = "",
): Record<string, unknown> | undefined {
  const next = { ...args };
  let changed = false;
  for (const k of TEXT_KEYS) {
    const v = next[k];
    if (typeof v !== "string") continue;
    const stamped = stampText(v, slug);
    if (stamped !== v) {
      next[k] = stamped;
      changed = true;
    }
  }
  const cmd = commandOf(next);
  if (cmd && /gh\s+pr\s+review/.test(cmd)) {
    const stamped = stampGhReviewCommand(cmd, slug);
    if (stamped !== cmd) {
      if (typeof next.command === "string") next.command = stamped;
      else next.cmd = stamped;
      changed = true;
    }
  }
  if (!changed) {
    if (GH_NAME.test(name) || /gh\s+pr\s+review/.test(cmd)) {
      next.body = stampText(typeof next.body === "string" ? next.body : "", slug);
      changed = true;
    } else if (SLACK_NAME.test(name) || /chat\.postMessage/.test(cmd) || /slack\s+chat/.test(cmd)) {
      next.text = stampText(typeof next.text === "string" ? next.text : "", slug);
      changed = true;
    }
  }
  return changed ? next : undefined;
}

export type HookPayload = {
  tool_name?: string;
  tool_input?: Record<string, unknown> | null;
  args?: Record<string, unknown> | null;
  extra?: Record<string, unknown>;
  cwd?: string;
  task_id?: string;
};

export function resolveHookSlug(
  payload: HookPayload,
  home: string,
  envSlug = process.env.DORA_POCKET_SLUG,
): string | undefined {
  const env = envSlug?.trim();
  if (env) return env;
  const cwd = payload.cwd ?? "";
  const m = cwd.replace(/\\/g, "/").match(/\/\.dora\/harness\/([^/]+)/);
  if (m) return m[1];
  const taskId = String(payload.extra?.task_id ?? payload.task_id ?? "");
  if (!taskId) return undefined;
  const mapPath = jobSlugMapPath(home);
  if (!existsSync(mapPath)) return undefined;
  try {
    const map = JSON.parse(readFileSync(mapPath, "utf8")) as Record<string, string>;
    return map[taskId] || undefined;
  } catch {
    return undefined;
  }
}

export function stampHookPayload(
  payload: HookPayload,
  home: string,
  envSlug?: string,
): { action: "modify"; args: Record<string, unknown> } | undefined {
  const args =
    payload.tool_input && typeof payload.tool_input === "object"
      ? payload.tool_input
      : payload.args && typeof payload.args === "object"
        ? payload.args
        : undefined;
  if (!args) return undefined;
  const name = payload.tool_name ?? "";
  if (!isPostTool(name, args)) return undefined;
  const slug = resolveHookSlug(payload, home, envSlug);
  if (!slug) return undefined;
  const next = stampToolArgs(args, slug, name);
  if (!next) return undefined;
  return { action: "modify", args: next };
}

export function jobSlugMapPath(home: string): string {
  return join(home, ".dora", "hooks", "job-slugs.json");
}

export function hookScriptPath(home: string): string {
  return join(home, ".dora", "hooks", "stamp-pocket-footer.py");
}

export function recordJobSlug(home: string, jobId: string, slug: string): void {
  const p = jobSlugMapPath(home);
  mkdirSync(dirname(p), { recursive: true });
  let map: Record<string, string> = {};
  if (existsSync(p)) {
    try {
      map = JSON.parse(readFileSync(p, "utf8")) as Record<string, string>;
    } catch {
      map = {};
    }
  }
  map[jobId] = slug;
  writeFileSync(p, JSON.stringify(map) + "\n");
}

/** Fail-open Python hook. Hermes shell pre_tool_call. Errors print nothing. */
export const STAMP_HOOK_PY = `#!/usr/bin/env python3
# Dora pocket-footer. Hermes pre_tool_call. Fail open.
import json, os, re, sys
from pathlib import Path

POST = re.compile(r"pr.?review|create.?review|pull_request_review|(?:slack|chat).{0,32}(?:post|message)|(?:post|message).{0,32}(?:slack|chat)|chat_post|post_message|conversations_post", re.I)
GH = re.compile(r"pr.?review|create.?review|pull_request_review", re.I)
SLACK = re.compile(r"(?:slack|chat).{0,32}(?:post|message)|(?:post|message).{0,32}(?:slack|chat)|chat_post|post_message|conversations_post", re.I)
KEYS = ("body", "comment", "text", "message", "content", "review_body", "body_text")

def footer(slug):
    return "Sent by pocket agent " + slug

def stamp_text(text, slug):
    line = footer(slug)
    t = re.sub(r"\\s+$", "", text)
    if t.endswith(line):
        return t + "\\n"
    return t + "\\n\\n" + line + "\\n"

def is_post(name, args):
    if POST.search(name or ""):
        return True
    cmd = args.get("command") or args.get("cmd") or ""
    if not isinstance(cmd, str):
        return False
    return bool(re.search(r"gh\\s+pr\\s+review", cmd) or "chat.postMessage" in cmd or re.search(r"slack\\s+chat", cmd))

def stamp_cmd(cmd, slug):
    line = footer(slug)
    if line in cmd:
        return cmd
    m = re.search(r"(--body|-b)\\s+(\\"([^\\"]*)\\"|'([^']*)'|\\S+)", cmd)
    if m:
        quoted = m.group(2)
        if quoted[:1] in "\\"'":
            inner = quoted[1:-1]
        else:
            inner = quoted
        nxt = stamp_text(inner, slug).rstrip()
        return cmd[: m.start()] + m.group(1) + " " + json.dumps(nxt) + cmd[m.end() :]
    return cmd.rstrip() + " --body " + json.dumps(line)

def stamp_args(args, slug, name=""):
    out = dict(args)
    changed = False
    for k in KEYS:
        v = out.get(k)
        if isinstance(v, str):
            s = stamp_text(v, slug)
            if s != v:
                out[k] = s
                changed = True
    cmd = out.get("command") or out.get("cmd") or ""
    if isinstance(cmd, str) and re.search(r"gh\\s+pr\\s+review", cmd):
        s = stamp_cmd(cmd, slug)
        if s != cmd:
            if "command" in out:
                out["command"] = s
            else:
                out["cmd"] = s
            changed = True
    if not changed:
        if GH.search(name or "") or (isinstance(cmd, str) and re.search(r"gh\\s+pr\\s+review", cmd)):
            out["body"] = stamp_text(out["body"] if isinstance(out.get("body"), str) else "", slug)
            changed = True
        elif SLACK.search(name or "") or "chat.postMessage" in cmd or re.search(r"slack\\s+chat", cmd or ""):
            out["text"] = stamp_text(out["text"] if isinstance(out.get("text"), str) else "", slug)
            changed = True
    return out if changed else None

def resolve_slug(payload, home):
    env = (os.environ.get("DORA_POCKET_SLUG") or "").strip()
    if env:
        return env
    cwd = (payload.get("cwd") or "").replace("\\\\", "/")
    m = re.search(r"/\\.dora/harness/([^/]+)", cwd)
    if m:
        return m.group(1)
    extra = payload.get("extra") or {}
    task = str(extra.get("task_id") or payload.get("task_id") or "")
    if not task:
        return None
    p = Path(home) / ".dora" / "hooks" / "job-slugs.json"
    if not p.is_file():
        return None
    try:
        return json.loads(p.read_text()).get(task)
    except Exception:
        return None

def main():
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
        args = payload.get("tool_input")
        if not isinstance(args, dict):
            args = payload.get("args")
        if not isinstance(args, dict):
            return
        name = payload.get("tool_name") or ""
        if not is_post(name, args):
            return
        home = str(Path.home())
        slug = resolve_slug(payload, home)
        if not slug:
            return
        nxt = stamp_args(args, slug, name)
        if not nxt:
            return
        sys.stdout.write(json.dumps({"action": "modify", "args": nxt}))
    except Exception:
        return

if __name__ == "__main__":
    main()
`;

export function writeHookScript(home: string): string {
  const p = hookScriptPath(home);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, STAMP_HOOK_PY);
  chmodSync(p, 0o755);
  return p;
}

export function ensureHermesFooterHook(home: string, scriptPath: string): boolean {
  const cfgPath = join(home, ".hermes", "config.yaml");
  mkdirSync(dirname(cfgPath), { recursive: true });
  let data: Record<string, unknown> = {};
  if (existsSync(cfgPath)) {
    try {
      const parsed = YAML.parse(readFileSync(cfgPath, "utf8"));
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return false;
      data = parsed as Record<string, unknown>;
    } catch {
      return false;
    }
  }
  const hooks = data.hooks && typeof data.hooks === "object" && !Array.isArray(data.hooks)
    ? { ...(data.hooks as Record<string, unknown>) }
    : {};
  const list = Array.isArray(hooks.pre_tool_call) ? [...hooks.pre_tool_call] : [];
  const already = list.some((e) => typeof e === "object" && e && (e as { command?: string }).command === scriptPath);
  if (!already) list.push({ command: scriptPath, timeout: 5 });
  hooks.pre_tool_call = list;
  data.hooks = hooks;
  if (data.hooks_auto_accept !== true) data.hooks_auto_accept = true;
  writeFileSync(cfgPath, YAML.stringify(data));
  return true;
}

export function installPocketFooterHook(home: string, slug: string, jobId?: string): string {
  const script = writeHookScript(home);
  ensureHermesFooterHook(home, script);
  if (jobId) recordJobSlug(home, jobId, slug);
  return script;
}

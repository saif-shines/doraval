import { spawn } from "node:child_process";

/** One platform split for opening a folder or a URL. */
export function platformOpenCommand(target: string): [string, string[]] {
  if (process.platform === "darwin") return ["open", [target]];
  if (process.platform === "win32") return ["cmd", ["/c", "start", "", target]];
  return ["xdg-open", [target]];
}

export function openDetached(target: string): void {
  const [command, args] = platformOpenCommand(target);
  spawn(command, args, { stdio: "ignore", detached: true }).unref();
}

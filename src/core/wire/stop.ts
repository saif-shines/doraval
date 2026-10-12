import type { ChildProcess } from "node:child_process";

/** Signal the child, wait until it exits, then force it. Resolves only after it is gone. */
export function stopWireChild(child: ChildProcess, graceMs: number): Promise<130> {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve(130);
      return;
    }
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(130);
    };
    child.once("exit", finish);
    const timer = setTimeout(() => {
      if (child.exitCode !== null || child.signalCode !== null) return;
      try {
        child.kill("SIGKILL");
      } catch (error) {
        const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
        // ESRCH means the pid is already gone. Any other failure leaves it alive, so wait for exit.
        if (code === "ESRCH") finish();
      }
    }, graceMs);
    try {
      child.kill("SIGINT");
    } catch {
      finish();
    }
  });
}

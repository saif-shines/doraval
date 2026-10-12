const COUNT_TOKENS = /count[_-]?tokens/i;

/** POST turns only. Token-count calls are forwarded and not saved. */
export function shouldLogWire(method: string, path: string): boolean {
  if (method.toUpperCase() !== "POST") return false;
  const bare = path.split("?")[0] ?? path;
  return !COUNT_TOKENS.test(bare);
}

export interface BurstState {
  hits: { sig: string; at: number }[];
}

/** More than 20 identical method+path+status hits inside 2s are not written. */
export function noteBurst(state: BurstState, sig: string, now: number): "write" | "warn" | "suppress" {
  state.hits = state.hits.filter((hit) => now - hit.at <= 2000);
  const count = state.hits.filter((hit) => hit.sig === sig).length;
  state.hits.push({ sig, at: now });
  if (count > 20) return "suppress";
  if (count === 20) return "warn";
  return "write";
}

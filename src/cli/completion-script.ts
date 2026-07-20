/**
 * Shell completion script generator (install plumbing, not a product command).
 * Invoked via root flag: `dora --completion bash|zsh|fish`
 * Command names come from command-tree so scripts stay in sync with the CLI.
 */
import { topLevelSubCommands, memory } from "./command-tree.js";

const commands = Object.keys(topLevelSubCommands);

async function subCommandNames(name: string): Promise<string[]> {
  if (name === "memory") return Object.keys(memory.subCommands ?? {});
  if (name === "config" || name === "rules") {
    const mod = await topLevelSubCommands[name]();
    return Object.keys((mod as { subCommands?: Record<string, unknown> }).subCommands ?? {});
  }
  if (name === "sessions") {
    const mod = await topLevelSubCommands.sessions();
    return Object.keys((mod as { subCommands?: Record<string, unknown> }).subCommands ?? {});
  }
  return [];
}

/** Returns the completion script, or a human error string if shell is unsupported / missing. */
export async function buildCompletionScript(
  shellRaw: string | undefined,
): Promise<{ ok: true; script: string } | { ok: false; error: string }> {
  const shell = (shellRaw ?? "").toLowerCase().trim();
  if (!shell) {
    return { ok: false, error: "Usage: dora --completion <bash|zsh|fish>" };
  }

  const subCommands: Record<string, string[]> = {};
  for (const name of ["memory", "config", "rules", "sessions"]) {
    subCommands[name] = await subCommandNames(name);
  }

  if (shell === "bash") {
    return {
      ok: true,
      script: `# doraval bash completion
_doraval_completions() {
  local cur prev
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"

  if [ $COMP_CWORD -eq 1 ]; then
    COMPREPLY=( $(compgen -W "${commands.join(" ")}" -- "$cur") )
  elif [ $COMP_CWORD -eq 2 ]; then
    case "$prev" in
      memory) COMPREPLY=( $(compgen -W "${(subCommands.memory ?? []).join(" ")}" -- "$cur") ) ;;
      config) COMPREPLY=( $(compgen -W "${(subCommands.config ?? []).join(" ")}" -- "$cur") ) ;;
      rules) COMPREPLY=( $(compgen -W "${(subCommands.rules ?? []).join(" ")}" -- "$cur") ) ;;
      sessions) COMPREPLY=( $(compgen -W "${(subCommands.sessions ?? []).join(" ")}" -- "$cur") ) ;;
    esac
  fi
}
complete -F _doraval_completions doraval
`,
    };
  }

  if (shell === "zsh") {
    return {
      ok: true,
      script: `# doraval zsh completion
#compdef doraval

_doraval() {
  local -a commands sub
  commands=(${commands.join(" ")})
  _arguments -C \\
    '1: :->cmd' \\
    '*::arg:->args'

  case $state in
    cmd)
      _describe 'command' commands
      ;;
    args)
      case $words[1] in
        memory)
          _describe 'subcommand' (${(subCommands.memory ?? []).join(" ")})
          ;;
        config)
          _describe 'subcommand' (${(subCommands.config ?? []).join(" ")})
          ;;
        rules)
          _describe 'subcommand' (${(subCommands.rules ?? []).join(" ")})
          ;;
        sessions)
          _describe 'subcommand' (${(subCommands.sessions ?? []).join(" ")})
          ;;
      esac
      ;;
  esac
}

_doraval "$@"
`,
    };
  }

  if (shell === "fish") {
    return {
      ok: true,
      script: `# doraval fish completion
complete -c doraval -f
complete -c doraval -n '__fish_use_subcommand' -a '${commands.join(" ")}'

complete -c doraval -n '__fish_seen_subcommand_from memory' -a '${(subCommands.memory ?? []).join(" ")}'
complete -c doraval -n '__fish_seen_subcommand_from config' -a '${(subCommands.config ?? []).join(" ")}'
complete -c doraval -n '__fish_seen_subcommand_from rules' -a '${(subCommands.rules ?? []).join(" ")}'
complete -c doraval -n '__fish_seen_subcommand_from sessions' -a '${(subCommands.sessions ?? []).join(" ")}'
`,
    };
  }

  return { ok: false, error: `Unsupported shell: ${shell}. Supported: bash, zsh, fish` };
}

/** Parse `--completion <shell>` or `--completion=<shell>` from argv. */
export function parseCompletionArg(argv: string[]): string | undefined | null {
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--completion") return argv[i + 1]; // may be undefined → usage error
    if (a.startsWith("--completion=")) return a.slice("--completion=".length);
  }
  return null; // flag not present
}

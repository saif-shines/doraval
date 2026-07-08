import { defineCommand } from "citty";
import { exit } from "../render/exit.js";
import { topLevelSubCommands, journal, memory, claude, codex, cursor, copilot } from "../command-tree.js";

const uiFlags = ["--port", "--open", "--no-open", "--host", "--status", "--force"];

/**
 * Command names, derived from command-tree.ts instead of hand-maintained
 * lists — the actual source of drift that made completions go stale before
 * (missing `drift`, `lint`, offering the dead `eval history`). Groups
 * (skill/journal/claude/...) are already-resolved objects (citty's
 * defineCommand is an identity function), so their subcommand names read
 * off `.subCommands` without invoking any lazy import.
 */
const commands = Object.keys(topLevelSubCommands);
const providerGroups: Record<string, typeof claude> = { claude, codex, cursor, copilot };

async function subCommandNames(name: string): Promise<string[]> {
  if (name === "journal") return Object.keys(journal.subCommands ?? {});
  if (name === "memory") return Object.keys(memory.subCommands ?? {});
  if (name in providerGroups) return Object.keys(providerGroups[name]!.subCommands ?? {});
  // `config` is a real citty subCommand tree — resolve the (already lazy) import once.
  if (name === "config") {
    const mod = await topLevelSubCommands.config();
    return Object.keys((mod as { subCommands?: Record<string, unknown> }).subCommands ?? {});
  }
  return [];
}

async function hookSubCommandNames(): Promise<string[]> {
  const hookLoader = (journal.subCommands as Record<string, () => Promise<unknown>>)?.hook;
  if (!hookLoader) return [];
  const mod = await hookLoader();
  return Object.keys((mod as { subCommands?: Record<string, unknown> }).subCommands ?? {});
}

export default defineCommand({
  meta: {
    name: "completion",
    description: "Generate shell completion scripts (bash, zsh, fish)",
  },
  args: {
    shell: {
      type: "positional",
      description: "Shell to generate completion for (bash | zsh | fish)",
      required: true,
    },
  },
  async run({ args }) {
    const shell = String(args.shell).toLowerCase();

    const subCommands: Record<string, string[]> = {};
    for (const name of ["journal", "memory", "config", "claude", "codex", "cursor", "copilot"]) {
      subCommands[name] = await subCommandNames(name);
    }
    subCommands.hook = await hookSubCommandNames();

    if (shell === "bash") {
      console.log(`# doraval bash completion
_doraval_completions() {
  local cur prev
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"

  if [ $COMP_CWORD -eq 1 ]; then
    COMPREPLY=( $(compgen -W "${commands.join(" ")}" -- "$cur") )
  elif [ $COMP_CWORD -eq 2 ]; then
    case "$prev" in
      journal) COMPREPLY=( $(compgen -W "${(subCommands.journal ?? []).join(" ")}" -- "$cur") ) ;;
      memory) COMPREPLY=( $(compgen -W "${(subCommands.memory ?? []).join(" ")}" -- "$cur") ) ;;
      config) COMPREPLY=( $(compgen -W "${(subCommands.config ?? []).join(" ")}" -- "$cur") ) ;;
      hook) COMPREPLY=( $(compgen -W "${(subCommands.hook ?? []).join(" ")}" -- "$cur") ) ;;
      ui) COMPREPLY=( $(compgen -W "${uiFlags.join(" ")}" -- "$cur") ) ;;
      claude) COMPREPLY=( $(compgen -W "${(subCommands.claude ?? []).join(" ")}" -- "$cur") ) ;;
      codex) COMPREPLY=( $(compgen -W "${(subCommands.codex ?? []).join(" ")}" -- "$cur") ) ;;
      cursor) COMPREPLY=( $(compgen -W "${(subCommands.cursor ?? []).join(" ")}" -- "$cur") ) ;;
      copilot) COMPREPLY=( $(compgen -W "${(subCommands.copilot ?? []).join(" ")}" -- "$cur") ) ;;
    esac
  fi
}
complete -F _doraval_completions doraval
`);
    } else if (shell === "zsh") {
      console.log(`# doraval zsh completion
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
        journal)
          _describe 'subcommand' (${(subCommands.journal ?? []).join(" ")})
          ;;
        memory)
          _describe 'subcommand' (${(subCommands.memory ?? []).join(" ")})
          ;;
        config)
          _describe 'subcommand' (${(subCommands.config ?? []).join(" ")})
          ;;
        hook)
          _describe 'subcommand' (${(subCommands.hook ?? []).join(" ")})
          ;;
        ui)
          _describe 'flag' (${uiFlags.join(" ")})
          ;;
        claude)
          _describe 'subcommand' (${(subCommands.claude ?? []).join(" ")})
          ;;
        codex)
          _describe 'subcommand' (${(subCommands.codex ?? []).join(" ")})
          ;;
        cursor)
          _describe 'subcommand' (${(subCommands.cursor ?? []).join(" ")})
          ;;
        copilot)
          _describe 'subcommand' (${(subCommands.copilot ?? []).join(" ")})
          ;;
      esac
      ;;
  esac
}

_doraval "$@"
`);
    } else if (shell === "fish") {
      console.log(`# doraval fish completion
complete -c doraval -f
complete -c doraval -n '__fish_use_subcommand' -a '${commands.join(" ")}'

complete -c doraval -n '__fish_seen_subcommand_from journal' -a '${(subCommands.journal ?? []).join(" ")}'
complete -c doraval -n '__fish_seen_subcommand_from memory' -a '${(subCommands.memory ?? []).join(" ")}'
complete -c doraval -n '__fish_seen_subcommand_from config' -a '${(subCommands.config ?? []).join(" ")}'
complete -c doraval -n '__fish_seen_subcommand_from hook' -a '${(subCommands.hook ?? []).join(" ")}'
complete -c doraval -n '__fish_seen_subcommand_from ui' -l port -d 'Port'
complete -c doraval -n '__fish_seen_subcommand_from ui' -l open -d 'Open browser'
complete -c doraval -n '__fish_seen_subcommand_from ui' -l no-open -d 'Do not open browser'
complete -c doraval -n '__fish_seen_subcommand_from ui' -l host -d 'Host'
complete -c doraval -n '__fish_seen_subcommand_from ui' -l status -d 'Show status only'
complete -c doraval -n '__fish_seen_subcommand_from ui' -l force -d 'Force restart'
complete -c doraval -n '__fish_seen_subcommand_from claude' -a '${(subCommands.claude ?? []).join(" ")}'
complete -c doraval -n '__fish_seen_subcommand_from codex' -a '${(subCommands.codex ?? []).join(" ")}'
complete -c doraval -n '__fish_seen_subcommand_from cursor' -a '${(subCommands.cursor ?? []).join(" ")}'
complete -c doraval -n '__fish_seen_subcommand_from copilot' -a '${(subCommands.copilot ?? []).join(" ")}'
`);
    } else {
      console.error(`Unsupported shell: ${shell}. Supported: bash, zsh, fish`);
      return await exit(1);
    }
    await exit(0);
  },
});

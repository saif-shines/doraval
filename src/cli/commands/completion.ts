import { defineCommand } from "citty";

const commands = [
  "validate", "init", "bump", "update", "providers",
  "skill", "journal",
  "claude", "codex", "cursor", "copilot"
];

const subCommands: Record<string, string[]> = {
  skill: ["validate", "drift", "judge"],
  journal: ["init", "list", "context", "hook", "update", "add", "sync"],
  hook: ["enable", "disable", "status"],
  claude: ["new", "bump"],
  codex: ["new", "bump"],
  cursor: ["new", "bump"],
  copilot: ["new", "bump"],
};

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
  run({ args }) {
    const shell = String(args.shell).toLowerCase();

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
      skill) COMPREPLY=( $(compgen -W "${subCommands.skill.join(" ")}" -- "$cur") ) ;;
      journal) COMPREPLY=( $(compgen -W "${subCommands.journal.join(" ")}" -- "$cur") ) ;;
      hook) COMPREPLY=( $(compgen -W "${subCommands.hook.join(" ")}" -- "$cur") ) ;;
      claude|codex|cursor|copilot) COMPREPLY=( $(compgen -W "${subCommands.claude.join(" ")}" -- "$cur") ) ;;
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
  commands=(validate init bump update providers skill journal claude codex cursor copilot)
  _arguments -C \\
    '1: :->cmd' \\
    '*::arg:->args'

  case $state in
    cmd)
      _describe 'command' commands
      ;;
    args)
      case $words[1] in
        skill)
          _describe 'subcommand' (validate drift judge)
          ;;
        journal)
          _describe 'subcommand' (init list context hook update add sync)
          ;;
        hook)
          _describe 'subcommand' (enable disable status)
          ;;
        claude|codex|cursor|copilot)
          _describe 'subcommand' (new bump)
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
complete -c doraval -n '__fish_use_subcommand' -a 'validate init bump update providers skill journal claude codex cursor copilot'

complete -c doraval -n '__fish_seen_subcommand_from skill' -a 'validate drift judge'
complete -c doraval -n '__fish_seen_subcommand_from journal' -a 'init list context hook update add sync'
complete -c doraval -n '__fish_seen_subcommand_from hook' -a 'enable disable status'
complete -c doraval -n '__fish_seen_subcommand_from claude codex cursor copilot' -a 'new bump'
`);
    } else {
      console.error(`Unsupported shell: ${shell}. Supported: bash, zsh, fish`);
      process.exit(1);
    }
    process.exit(0);
  },
});

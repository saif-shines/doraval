#!/usr/bin/env node
import { Command } from "commander";
import { validate } from "./commands/validate.js";
import { score } from "./commands/score.js";

const program = new Command();

program
  .name("doraval")
  .description(
    "Validate, score, and test skills and plugins for AI coding agents"
  )
  .version("0.0.1", "-V, --version");

program
  .command("validate")
  .description("Validate structure and schema of a skill or plugin")
  .argument("<path>", "Path to skill directory or plugin root")
  .option("-a, --agent <name>", "Force a specific agent adapter")
  .option("-f, --format <type>", "Output format (json or table)", "table")
  .option("-v, --verbose", "Show detailed diagnostics")
  .option("--ci", "Machine-friendly output, non-zero exit on issues")
  .action(validate);

program
  .command("score")
  .description("Score quality and get actionable suggestions")
  .argument("<path>", "Path to skill directory or plugin root")
  .option("-a, --agent <name>", "Force a specific agent adapter")
  .option("-f, --format <type>", "Output format (json or table)", "table")
  .option("-v, --verbose", "Show detailed diagnostics")
  .option("--ci", "Machine-friendly output, non-zero exit on issues")
  .action(score);

program.parse();

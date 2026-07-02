import { defineCommand } from "citty";
import pc from "picocolors";
import { ui } from "../../out.js";
import { readConfig, writeConfig, type JournalConfig, type EvalConfig } from "../../../core/journal-config.js";
import { PROVIDERS, detectEnvProvider, fetchProviderModels } from "../../../core/providers.js";
import {
  intro,
  outro,
  select,
  isCancel,
  spinner,
  cancel,
  note,
  text,
  password,
} from "@clack/prompts";
import { exit } from "../../render/exit.js";

export default defineCommand({
  meta: {
    name: "setup",
    description: "Configure the LLM vendor and model doraval uses for eval (which model to pick depends on the provider)",
  },
  async run() {
    const isInteractive = process.stdout.isTTY && !process.env.CI;

    if (isInteractive) {
      intro("dora evals setup — choose your eval LLM");
    } else {
      ui.heading("dora evals setup — configure eval LLM");
    }

    const existingCfg = await readConfig();
    if (!existingCfg) {
      ui.warn("No doraval config found. Run dora init first to set up journal + agent.\n");
      return await exit(1);
    }

    if (isInteractive) {
      note("Choose an LLM vendor so doraval can check that agents follow your decisions and principles. Faster and cheaper than spawning your full coding agent.");
    }

    const detectedEnv = detectEnvProvider();
    if (detectedEnv) {
      ui.success(`${detectedEnv.provider.displayName} key detected (${detectedEnv.key}) — prefer env vars over storing keys in config.yml.`);
    }

    const currentEval = existingCfg.eval;
    if (currentEval?.provider || currentEval?.model) {
      ui.dim(`  Current: ${currentEval.provider ?? "—"} / ${currentEval.model ?? "—"}\n`);
    }

    let evalProviderName = "";
    let evalModelAnswer = "";
    let directApiKey = "";
    let directBaseUrl = "";

    if (!isInteractive) {
      ui.info("  Non-interactive — set eval.provider and eval.model via dora config set.\n");
      return await exit(0);
    }

    const providerOptions = [
      ...PROVIDERS.filter((p) => p.name !== "custom").map((p) => ({
        value: p.name,
        label: `${p.displayName}${detectedEnv?.provider.name === p.name ? " (key detected)" : ""}`,
        hint: p.defaultModels.slice(0, 2).join(", "),
      })),
      { value: "custom", label: "Custom (OpenAI-compatible)", hint: "any base URL" },
      { value: "skip", label: "Cancel", hint: "" },
    ];

    const providerChoice = await select({
      message: "Which LLM vendor for eval?",
      options: providerOptions,
      initialValue: detectedEnv?.provider.name ?? currentEval?.provider ?? "skip",
    });
    if (isCancel(providerChoice) || providerChoice === "skip") {
      cancel("Cancelled.");
      return await exit(0);
    }

    evalProviderName = providerChoice as string;
    const chosenProvider = PROVIDERS.find((p) => p.name === evalProviderName)!;
    const isCustom = evalProviderName === "custom";

    if (isCustom) {
      const base = await text({
        message: "Base URL for your OpenAI-compatible API",
        placeholder: "https://your-api.example.com/v1",
        initialValue: currentEval?.base_url ?? "",
        validate: (v) => (!v?.trim() ? "Base URL is required for custom provider" : undefined),
      });
      if (isCancel(base)) { cancel("Cancelled."); return await exit(0); }
      directBaseUrl = (base as string).trim();
    } else {
      directBaseUrl = chosenProvider.baseUrl;
    }

    const alreadyHasKey = [chosenProvider.envKey, ...chosenProvider.altEnvKeys].some(
      (k) => !!process.env[k]
    );

    if (!alreadyHasKey) {
      const envHint = chosenProvider.requiresApiKey
        ? ` Prefer setting ${chosenProvider.envKey} in your environment instead.`
        : "";
      const key = await password({
        message: `${chosenProvider.displayName} API key (stored in ~/.doraval/config.yml).${envHint}`,
      });
      if (isCancel(key)) { cancel("Cancelled."); return await exit(0); }
      directApiKey = typeof key === "string" ? key.trim() : "";
    } else {
      ui.dim(`  Using ${detectedEnv!.key} from environment.\n`);
    }

    // Fetch live models
    const resolvedKey = directApiKey ||
      [chosenProvider.envKey, ...chosenProvider.altEnvKeys].map((k) => process.env[k]).find(Boolean) || "";
    const resolvedBase = directBaseUrl || chosenProvider.baseUrl;

    let liveModels: string[] = [];
    if (resolvedKey && resolvedBase) {
      const ms = spinner();
      ms.start("Fetching available models…");
      liveModels = await fetchProviderModels(resolvedBase, resolvedKey);
      ms.stop(liveModels.length > 0 ? `${liveModels.length} models available` : "Could not fetch model list — showing defaults");
    }

    const defaults = chosenProvider.defaultModels;
    const extra = liveModels.filter((m) => !defaults.includes(m));
    const allModels = [...defaults, ...extra].slice(0, 20);
    const initialModel = currentEval?.model && allModels.includes(currentEval.model)
      ? currentEval.model
      : allModels[0];

    if (allModels.length > 0) {
      const modelChoice = await select({
        message: "Which model?",
        options: [
          ...allModels.map((m, i) => ({ value: m, label: m, hint: i < defaults.length ? "recommended" : "" })),
          { value: "__custom__", label: "Enter a different model ID", hint: "" },
        ],
        initialValue: initialModel,
      });
      if (isCancel(modelChoice)) { cancel("Cancelled."); return await exit(0); }
      if (modelChoice === "__custom__") {
        const custom = await text({ message: "Model ID", placeholder: allModels[0] ?? "gpt-4o-mini" });
        if (isCancel(custom)) { cancel("Cancelled."); return await exit(0); }
        evalModelAnswer = (custom as string).trim() || (allModels[0] ?? "gpt-4o-mini");
      } else {
        evalModelAnswer = modelChoice as string;
      }
    } else {
      const modelResult = await text({ message: "Model ID", placeholder: "gpt-4o-mini" });
      if (isCancel(modelResult)) { cancel("Cancelled."); return await exit(0); }
      evalModelAnswer = (modelResult as string).trim() || "gpt-4o-mini";
    }

    // Write config
    const currentEvalFull: Partial<EvalConfig> = existingCfg.eval ?? {};
    const newEval: Partial<EvalConfig> = {
      ...currentEvalFull,
      max_tool_calls: currentEvalFull.max_tool_calls ?? 200,
      save_history: currentEvalFull.save_history !== false,
      provider: evalProviderName,
      model: evalModelAnswer,
    };
    if (directApiKey) newEval.api_key = directApiKey;
    if (isCustom && directBaseUrl) newEval.base_url = directBaseUrl;

    const cfgToWrite: JournalConfig = { ...existingCfg, eval: newEval };
    await writeConfig(cfgToWrite);

    const displayProvider = chosenProvider?.displayName ?? evalProviderName;
    outro(`Eval configured — ${pc.bold(displayProvider + " / " + evalModelAnswer)}${directApiKey ? " (key saved — prefer env vars long-term)" : ""}`);

    await exit(0);
  },
});

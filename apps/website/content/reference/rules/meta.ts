import { defineMeta } from "blume";
import { RULES } from "../../../../../src/core/rules/registry.js";

export default defineMeta({
  title: "Rules",
  order: 1,
  pages: ["index", ...RULES.map((rule) => rule.code)],
});

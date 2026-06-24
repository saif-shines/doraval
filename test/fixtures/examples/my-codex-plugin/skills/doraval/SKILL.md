---
name: doraval
description: Use doraval to validate, measure drift, and judge skills and plugins. Use when authoring or reviewing context engineering artifacts for AI coding agents (works for Codex too).
---

# Use Doraval (Codex edition)

Make your next context work (skills, plugins & more) for your team, community, or self. Context engineering toolkit for AI coding agents.

When you need to check a skill or Codex plugin:

- Validate the current directory: `doraval validate .`
- Validate one skill: `doraval skill validate ./skills/doraval/`
- Check for rubric drift: `doraval skill drift ./skills/doraval/`
- Get an AI quality judgment: `doraval skill judge ./skills/doraval/`

Always run `doraval validate` before sharing or publishing a plugin.

This skill demonstrates a complete, self-referential example of using doraval inside a generated Codex plugin.

To test in Codex:
1. Make sure this plugin is listed in a marketplace (we created .agents/plugins/marketplace.json for you).
2. Restart Codex.
3. Open the plugin directory, select your local marketplace, and enable the plugin.
4. Invoke the demo with /my-codex-plugin:doraval
**English** | [繁體中文](README.zh-TW.md)

# Grill Mod

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Claude Code mod](https://img.shields.io/badge/Claude%20Code-mod-orange.svg)](https://claude.com/claude-code)

A grill mode for Claude Code. When you have a decision to make, Claude asks you one question at a time until
you have thought it through, then writes the result up as a plan. The interview rules are adapted from the
`grilling` skill in [mattpocock/skills](https://github.com/mattpocock/skills) (MIT). The mod is a TypeScript
hooks module on Claude Code's function-hook API, plus one skill. Its rules, buttons and status text are in
Traditional Chinese.

> [!IMPORTANT]
> - Mods (function hooks) are an early-access Claude Code API. After a Claude Code update, this mod may
>   need an update too.
> - Unofficial. Not made or endorsed by Anthropic.

## What it does

- **One question per card**: Claude asks through Claude Code's built-in question card (`AskUserQuestion`),
  one question at a time, with 2 to 4 options and its pick first, marked 「（建議）」. You press a button
  instead of typing "Q1: A, Q2: as suggested". Text typed under "Other" counts as the answer.
- **Estimated count above the prompt box**: a band there shows `拷問中 [預估問題 2/10]`: 2 questions answered,
  about 10 in all. Claude re-estimates the total with every question, so it grows or shrinks with your answers. It shows `?`
  until the first estimate.
- **Rules in the system prompt**: the grill rules go into the system prompt every turn (with auto-trigger off,
  only during a grill). Grilling does not depend on Claude choosing to load a skill, so it triggers more reliably.
- **Auto-trigger**: when your message contains words like 拷問, grill, 幫我決定, 給我建議, 怎麼選, 要不要, 規劃
  or 企劃, the mod reminds Claude to consider grill mode. A simple question still gets a direct answer.
- **Interrupt**: if Claude drifts, press 中斷拷問 above the prompt box. The running turn stops, and Claude sums
  up what is decided, where it drifted and what is left. Then pick 繼續拷問 (continue) or 不問了 (stop).
- **Plan at the end**: when the questions run out, Claude calls `mcp__grill__finish` and lists the decisions and
  open branches. The band switches to 編寫計畫 with Markdown, HTML, 繼續提問 (ask more) and 關閉 (close the
  band without writing a plan). The plan covers the
  goal, each decision with a one-line reason, what is still open, and next steps. Claude saves it in the
  current working folder, named after the topic, and tells you the path.
- **Decisions survive compaction**: if the conversation is compacted during a grill, the summary copies the
  decision list word for word.

## Requirements

- Claude Code with mod (function hook) support. Nothing else to install: Claude Code loads the TypeScript
  module itself.
- A Claude Code terminal session to install from. A user-scope install also loads in the desktop app.
- The band above the prompt box shows only in the terminal and the desktop app. On mobile and web (Remote
  Control) you won't see it, but grilling works the same.

## Quick start

1. In a Claude Code terminal session, type:

   ```
   /plugin install grill --marketplace Karylcode/claude-grill-mod
   ```

   Answer `y` to add the marketplace, then pick the user scope (all projects). From a shell, the same is
   `claude plugin install grill --marketplace Karylcode/claude-grill-mod`.

2. Start with `/grill:grill <topic>`, or just ask 「幫我決定…」 or 「給我建議…」. With no topic, Claude grills
   what you are already discussing.
3. Answer each card. When the questions run out, pick Markdown, HTML, 繼續提問 or 關閉 above the prompt box.

Auto-trigger is on by default. `/grill-auto off` turns it off, `/grill-auto on` turns it back on, and
`/grill-auto` alone shows the current setting. The setting is kept across sessions.

To update: `claude plugin update grill@karylcode-mods`, then restart Claude Code.

## Troubleshooting

- **No band above the prompt box**: it shows only in the terminal and the desktop app, and it steps aside
  while a Claude Code survey uses that spot. Grilling still works without it.
- **Claude grills you when you wanted a direct answer**: turn auto-trigger off with `/grill-auto off`, and
  start grills yourself with `/grill:grill`.
- **The 編寫計畫 choices disappeared**: typing your own message while they show dismisses them. Say 收尾
  (wrap up) and Claude brings them back.
- **The mod stops working after a Claude Code update**: the mod API is early access. Update the mod and
  restart. To see what broke, run `claude plugin validate .` and `claude plugin test .` in a clone of this repo.

## License

MIT. See [LICENSE](LICENSE).

- The interview rules are adapted from the `grilling` skill in [mattpocock/skills](https://github.com/mattpocock/skills),
  Copyright (c) 2026 Matt Pocock, also under the MIT License.

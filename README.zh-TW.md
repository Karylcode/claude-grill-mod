[English](README.md) | **繁體中文**

# Grill Mod

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Claude Code mod](https://img.shields.io/badge/Claude%20Code-mod-orange.svg)](https://claude.com/claude-code)

Claude Code 的拷問模式 MOD。你要做決定時，Claude 一題一題問到你想清楚為止，問完再幫你寫成計畫。拷問規則改寫自 [mattpocock/skills](https://github.com/mattpocock/skills) 的 `grilling` skill（MIT）。MOD 本身是一個 TypeScript hooks 模組，用 Claude Code 的 function hooks API 寫成，另外附一個 skill。規則、按鈕和狀態文字都是繁體中文。

> [!IMPORTANT]
> - MOD 功能（function hooks）是 Claude Code 的 early access API。Claude Code 更新後，這個 MOD 可能要跟著調整。
> - 非官方專案，不是 Anthropic 做的，也沒有經過 Anthropic 背書。

## 可以做什麼

- **一張卡片一題**：Claude 用 Claude Code 內建的提問卡片（`AskUserQuestion`）一次只問一題，選項 2 到 4 個，建議的選項放第一個，結尾標「（建議）」。按按鈕回答就好，不用打「Q1:A、Q2:照建議」。在「Other」打的字也算答案。
- **輸入框上方顯示預估題數**：`拷問中 [預估問題 2/10]` 代表已經答了 2 題，預估總共 10 題左右。Claude 每次出題都會重新估，所以總題數會隨著答案增減。還沒估之前顯示 `?`。
- **規則放在系統提示詞**：拷問規則每一輪都放在系統提示詞裡（關掉自動觸發時，只在拷問中才放），不靠 Claude 自己決定要不要載入 skill，觸發比較穩。
- **自動觸發**：訊息裡出現「拷問、grill、幫我決定、給我建議、怎麼選、要不要、規劃、企劃」這類字時，MOD 會提醒 Claude 考慮用拷問模式。只是簡單問題的話，Claude 會直接回答。
- **中斷**：Claude 問偏了，就按輸入框上方的「中斷拷問」。正在跑的那一輪會停下來，Claude 整理已經決定的、從哪裡開始偏、還剩什麼。之後再選「繼續拷問」或「不問了」。
- **問完寫計畫**：問題問完時，Claude 呼叫 `mcp__grill__finish`，條列所有決定和還沒處理的分支。上方換成「編寫計畫」，可以選 Markdown、HTML 或「繼續提問」。計畫包含目標、已經做的決定（每項附一句理由）、還沒決定的事、下一步。檔名用主題命名，存在目前的工作資料夾，寫好會告訴你路徑。
- **壓縮時保留決定**：拷問中遇到對話壓縮，摘要會逐條照抄決策清單。

## 需求

- 支援 MOD（function hooks）的 Claude Code。不用另外裝別的，Claude Code 會自己載入 TypeScript 模組。
- 要從 Claude Code 終端機安裝。裝在 user 範圍的話，桌面版也會載入。
- 輸入框上方那條只畫在終端機和桌面版。手機和網頁（Remote Control）看不到，但拷問本身照常運作。

## 快速開始

1. 在 Claude Code 終端機輸入：

   ```
   /plugin install grill --marketplace Karylcode/claude-grill-mod
   ```

   問要不要加入 marketplace 時按 `y`，範圍選 user（所有專案都能用）。在 shell 裡也可以用 `claude plugin install grill --marketplace Karylcode/claude-grill-mod`。

2. 用 `/grill:grill 主題` 開始拷問，或直接說「幫我決定…」「給我建議…」。主題空白時，就拷問目前在討論的事。
3. 一題一題按按鈕回答。問完後，從輸入框上方選 Markdown、HTML 或「繼續提問」。

自動觸發預設是開的。`/grill-auto off` 關閉、`/grill-auto on` 打開，只打 `/grill-auto` 會顯示目前設定。設定會記住，下次開 session 也一樣。

更新：`claude plugin update grill@karylcode-mods`，然後重開 Claude Code。

## 疑難排解

- **輸入框上方沒有那條**：那條只畫在終端機和桌面版，Claude Code 的問卷佔用那個位置時也會先讓開。拷問本身照常運作。
- **只想要直接回答，Claude 卻開始拷問**：用 `/grill-auto off` 關掉自動觸發，要拷問時再打 `/grill:grill`。
- **「編寫計畫」的選項不見了**：選項出現時自己打字，選項就會收起來。說「收尾」，Claude 會再叫出來。
- **Claude Code 更新後 MOD 不能用**：MOD 功能是 early access API。先更新 MOD 再重開。想知道哪裡壞掉，在這個 repo 的 clone 裡執行 `claude plugin validate .` 和 `claude plugin test .`。

## 授權

MIT，詳見 [LICENSE](LICENSE)。

- 拷問規則改寫自 [mattpocock/skills](https://github.com/mattpocock/skills) 的 `grilling` skill，Copyright (c) 2026 Matt Pocock，同樣是 MIT 授權。

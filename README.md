# grill：Claude Code 拷問模式 MOD

讓 Claude 在你要做決定時，一題一題問到你想清楚為止，問完再幫你寫成計畫。

規則改寫自 [mattpocock/skills](https://github.com/mattpocock/skills) 的 `grilling` skill（MIT）。和原版的差別：

- 一次只問一題，用 Claude Code 內建的提問卡片按按鈕回答，不用打「Q1:A、Q2:照建議」。
- 輸入框上方顯示 `拷問中 [預估問題 2/10]`，預估題數會隨著答案調整。
- 拷問規則每一輪都放在系統提示詞裡，不靠 Claude 自己決定要不要載入 skill，觸發比較穩。
- 問完可以選寫成 Markdown 計畫、HTML 頁面，或繼續提問。

## 安裝

在 Claude Code 終端機輸入：

```
/plugin install grill --marketplace Karylcode/claude-grill-mod
```

問要不要加入 marketplace 時按 `y`，範圍選 user（所有專案都能用）。

更新：

```
claude plugin update grill@karylcode-mods
```

## 用法

| 做什麼 | 怎麼做 |
| --- | --- |
| 開始拷問 | `/grill:grill 主題`，或直接說「幫我決定…」「給我建議…」 |
| 中斷（Claude 問偏了） | 按輸入框上方的「中斷拷問」，Claude 會整理目前狀況，再選「繼續拷問」或「不問了」 |
| 問完 | 上方換成「編寫計畫」，選 Markdown、HTML 或繼續提問 |
| 關掉自動觸發 | `/grill-auto off`（`on` 打開） |

自動觸發：訊息裡出現「拷問、grill、幫我決定、給我建議、怎麼選、要不要、規劃、企劃」這類字時，MOD 會提醒 Claude 考慮用拷問模式；只是簡單問題的話，Claude 會直接回答。

## 限制

- 輸入框上方那條只畫在終端機和桌面版，手機和網頁（Remote Control）看不到，但拷問本身照常運作。
- MOD 功能（function hooks）是 Claude Code 的 early access API，Claude Code 更新後可能要跟著調整。

## 開發

```
claude plugin validate .
claude plugin test .
```

## 授權

MIT，見 [LICENSE](LICENSE)。

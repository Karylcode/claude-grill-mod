import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Decision, Phase } from '../types'

// 拷問規則改寫自 mattpocock/skills 的 grilling skill（MIT）。
// 和原版的差別：一次只問一題、用 AskUserQuestion 按鈕作答、回報預估題數、選項和說明寫短。
const RULES = `# 拷問模式（grill mod）

## 什麼時候用
使用者要你給建議、幫忙做決定、規劃或企劃一件還有好幾個未定分支的事，或直接說「拷問」「grill」時，進入拷問模式。只有一個簡單選擇的問題就直接回答，不用拷問。

## 怎麼問
- 在心裡把主題畫成決策樹：每個決定底下掛著依賴它的決定。只問前提都已經確定的題目；一個答案會改變其他題目時，先問那一題。
- 一次只問一題，一律用 AskUserQuestion 工具：questions 只放 1 題，metadata.source 設成 "grill:<預估總題數>"，例如 "grill:10"。不要在一般文字訊息裡列題目或選項。
- 預估總題數 = 已經問過的題數 + 你估計還要問的題數。每次出題都重新估：答案多出新分支就加，排除掉分支就減。只是預估，不用精準。
- 選項 2 到 4 個。你建議的選項放第一個，label 結尾加「（建議）」。label 1 到 5 個詞；description 一句話內，label 已經夠清楚就省略。question 一兩句話講完，需要的背景寫進 question。
- 呼叫工具前不寫長篇說明，也不重述之前的答案，最多一行說明為什麼問這題。
- 查得到的事實（檔案、程式碼、使用者的文件）自己查或派子代理查，不要問使用者。決定交給使用者，不能替使用者回答。
- 使用者在「Other」打的字就是答案。回答「不知道」或跳過時，判斷是不是要先做原型才能回答，或換個角度問，不要重複問同一題。
- grill-me、grilling 這類 skill 也照這裡的格式問，不用「❓ Q1」那種一次列一批的編號清單。

## 中斷與結束
- 使用者說「中斷拷問」：馬上停止出題。整理目前狀況：已經決定了哪些、從哪裡開始偏離主題、還剩哪些沒問。然後等使用者決定要不要繼續，不要自己接著問。
- 使用者說「繼續拷問」：照整理後的方向，繼續一次一題問。
- 決策樹都問完、或使用者說「收尾」時：先呼叫 mcp__grill__finish，再用條列簡短列出所有決定和還沒處理的分支，然後結束這一輪。使用者會從輸入框上方選「Markdown」「HTML」或「繼續提問」；選之前不要寫計畫、不要改檔或開始實作。
- 使用者選「繼續提問」：往下問還沒處理的分支或需要更細的地方，照樣一次一題、回報預估總題數。`

const TOOL_NOTE =
  '拷問模式（grill mod）中：每一題都用這個工具問，questions 只放 1 題，metadata.source 設成 "grill:<預估總題數>"（例如 "grill:10"）；建議的選項放第一個，label 結尾加「（建議）」。'

const FINISH_DESCRIPTION =
  '拷問模式專用：決策樹都問完（或使用者說收尾）時呼叫，把使用者輸入框上方的「拷問中」換成「編寫計畫」，讓使用者選 Markdown、HTML 或繼續提問。'

const FINISHED =
  '已換成「編寫計畫」。現在用條列簡短列出所有決定和還沒處理的分支，然後結束這一輪；使用者會從輸入框上方選 Markdown、HTML 或繼續提問，選之前不要寫計畫。'

const NUDGE =
  '（grill mod）這則訊息可能是要建議或做決定。如果牽涉好幾個還沒定的分支，照系統提示的「拷問模式」做：用 AskUserQuestion 一次問一題。只是單一簡單問題就直接回答。'

const INTERRUPT =
  '中斷拷問：先不要再出題。整理目前狀況：已經決定了哪些、從哪裡開始偏離主題、還剩哪些沒問。整理完等我決定要不要繼續。'

const RESUME = '繼續拷問：照剛才整理的方向，一次一題問下去。'

const ENDED = '（grill mod）使用者結束了這次拷問，不要再接著出題。'

const PLAN_CONTENT =
  '內容包含：目標、已經做的決定（每項附一句理由）、還沒決定的事、下一步。檔名用主題命名，存在目前的工作資料夾，寫好告訴我路徑。'

const WRITE_MARKDOWN = `編寫計畫：把這次拷問的結果整理成一份 Markdown 計畫（.md）。${PLAN_CONTENT}`

const WRITE_HTML = `編寫計畫：把這次拷問的結果整理成一個 HTML 頁面（單一 .html 檔，樣式寫在檔案裡，排版清楚好讀）。${PLAN_CONTENT}`

const MORE = '繼續提問：往下問還沒處理的分支或需要更細的地方，一次一題。'

const TRIGGER =
  /拷問|grill|幫我(決定|選|想想|規劃|企劃)|給(我)?(點|一些)?建議|怎麼(選|決定)|該(選|用)哪|要不要|規劃|企劃/i

// metadata.source 的格式："grill" 或 "grill:10"
const SOURCE = /^grill(?::\s*(\d+))?$/

const decisions = atom({ plugin: 'grill', key: 'decisions' } as const, [])
const estimate = atom({ plugin: 'grill', key: 'estimate' } as const, null)
const isActive = atom({ plugin: 'grill', key: 'isActive' } as const, false)
const phase = atom({ plugin: 'grill', key: 'phase' } as const, 'asking' as Phase)
const isAuto = atom({ plugin: 'grill', key: 'isAuto' } as const, true)

const compactInstructions = (list: readonly Decision[]) =>
  [
    '這段對話有一段拷問（一問一答）。摘要時：',
    '- 逐條照抄下面的決策清單，不要改寫或合併。',
    '- 保留主題、使用者說過的偏好與限制、還沒問到的分支。',
    '- 每一題的選項和說明不用保留。',
    '',
    '決策清單：',
    ...list.map((one, i) => `${i + 1}. 【${one.header}】${one.question} → ${one.answer}`),
  ].join('\n')

const reset = async ($: EngineInterface) => {
  await update($, isActive, () => false)
  await update($, phase, () => 'asking' as Phase)
  await update($, estimate, () => null)
  await update($, decisions, () => [])
}

const startAsking = async ($: EngineInterface) => {
  await update($, isActive, () => true)
  await update($, phase, () => 'asking' as Phase)
}

export const register: Register = on => {
  // 正在跑的那一輪，中斷拷問時要先停掉它
  let runningTurn: string | null = null

  on('session.start', async ($, e, next) => {
    // /grill 本身是 ~/.claude/skills/grill 這個 skill，新 session 的指令清單才找得到
    await $.command.register({
      name: 'grill-auto',
      description: '拷問模式的自動觸發：/grill-auto on 打開、off 關閉',
      argumentHint: '[on | off]',
    })
    await $.tool.register({ name: 'finish', description: FINISH_DESCRIPTION, isDeferred: false })
    const stored = await $.store.get('isAuto')
    if (typeof stored === 'boolean') await update($, isAuto, () => stored)

    return next(e)
  })

  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') await reset($)

    return next(e)
  })

  on('turn.start', ($, e, next) => {
    runningTurn = e.turnId

    return next(e)
  })

  on('turn.complete', ($, e, next) => {
    runningTurn = null

    return next(e)
  })

  // 規則每一輪都在系統提示詞裡，不靠模型自己決定要不要載入 skill
  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    const isOn = (await read($, isAuto)) || (await read($, isActive))
    if (!isOn) return composed

    return {
      sections: [
        ...composed.sections,
        { id: 'grill:rules', text: RULES, scope: 'session' as const },
      ],
    }
  })

  on('tool.describe', { tool: 'AskUserQuestion' }, async ($, e, next) => {
    const described = await next(e)

    return { ...described, description: `${described.description}\n\n${TOOL_NOTE}` }
  })

  on('prompt.submit', async ($, e, next) => {
    if (e.origin.kind === 'plugin') return next(e)

    // 停在「編寫計畫」時自己打字，代表不用那三個選項了，收起來
    if ((await read($, isActive)) && (await read($, phase)) === 'planning') await reset($)

    // 訊息像是在要建議或決定時，旁邊多塞一句提醒
    if (!TRIGGER.test(e.text) || !(await read($, isAuto))) return next(e)

    return next({ ...e, context: [...(e.context ?? []), NUDGE] })
  })

  // 出題時更新預估題數，回答後記下答案
  on('tool.call', { tool: 'AskUserQuestion' }, async ($, e, next) => {
    const matched = SOURCE.exec(e.metadata?.source ?? '')
    const isGrill = matched !== null || (await read($, isActive))
    if (!isGrill) return next(e)

    if (matched?.[1] !== undefined) {
      const total = Number(matched[1])
      await update($, estimate, () => total)
    }
    await startAsking($)

    const ran = await next(e)
    if (ran.deny !== undefined || ran.isError === true) return ran

    const answers = (ran.result.answers ?? {}) as Record<string, string>
    const asked: Decision[] = e.questions.map(q => ({
      header: q.header,
      question: q.question,
      answer: answers[q.question] ?? ran.result.response ?? '（沒回答）',
    }))
    await update($, decisions, list => [...list, ...asked])

    return ran
  })

  on('tool.call', { tool: 'mcp__grill__finish' }, async $ => {
    await update($, isActive, () => true)
    await update($, phase, () => 'planning' as Phase)

    return { result: FINISHED }
  })

  // 自動壓縮時照抄決策清單
  on('session.compact', async ($, e, next) => {
    const list = await read($, decisions)
    const isGrilling = e.agentId === undefined && (await read($, isActive)) && list.length > 0
    if (!isGrilling) return next(e)

    const kept = compactInstructions(list)
    return next({ ...e, instructions: e.instructions ? `${e.instructions}\n\n${kept}` : kept })
  })

  // 打 /grill 時進入拷問中，上方列馬上出現。外掛裡的 skill 會叫 grill:grill
  on('skill.prompt', async ($, e, next) => {
    if (e.skill === 'grill' || e.skill === 'grill:grill') await startAsking($)

    return next(e)
  })

  on('command.run', { command: 'grill-auto' }, async ($, e) => {
    const arg = e.args.trim()
    if (arg !== 'on' && arg !== 'off') {
      const isOn = await read($, isAuto)
      return { text: `自動拷問目前是${isOn ? '開' : '關'}的。用 /grill-auto on 或 off 切換。` }
    }

    const isOn = arg === 'on'
    await update($, isAuto, () => isOn)
    await $.store.set('isAuto', isOn)

    return {
      text: isOn
        ? '已開啟自動拷問：要建議或做決定時會自動用拷問模式。'
        : '已關閉自動拷問。要拷問時打 /grill 主題。',
    }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || !(await read($, isActive))) return next(e)

    const now = await read($, phase)
    const { Box, Button, Text } = $.ui.resolve(e)

    const send = (text: string) => {
      void $.prompt.submit({ text, asUser: true })
    }

    const interrupt = async () => {
      await update($, phase, () => 'paused' as Phase)
      if (runningTurn !== null) {
        try {
          await $.turn.abort({ turnId: runningTurn })
        } catch {
          // 那一輪剛好結束了，直接送出就好
        }
      }
      send(INTERRUPT)
    }

    const resume = async () => {
      await update($, phase, () => 'asking' as Phase)
      send(RESUME)
    }

    const quit = async () => {
      await reset($)
      try {
        await $.session.append({ message: { type: 'user', content: [{ type: 'text', text: ENDED }] } })
      } catch {
        // 留不了提醒也沒關係，規則還在，下一則訊息會說清楚
      }
      $.ui.toast('已結束拷問')
    }

    const writePlan = (text: string) => async () => {
      await reset($)
      send(text)
    }

    const more = async () => {
      await update($, phase, () => 'asking' as Phase)
      send(MORE)
    }

    if (now === 'planning') {
      return (
        <Box key="grill" flexDirection="row" flexWrap="wrap" columnGap={1} alignItems="center">
          <Text bold>編寫計畫</Text>
          <Button key="markdown" hotkey="1" variant="primary" label="Markdown" onPress={writePlan(WRITE_MARKDOWN)} />
          <Button key="html" hotkey="2" label="HTML" onPress={writePlan(WRITE_HTML)} />
          <Button key="more" hotkey="3" label="繼續提問" onPress={more} />
          <Button key="close" hotkey="4" label="關閉" onPress={() => reset($)} />
        </Box>
      )
    }

    const answered = (await read($, decisions)).length
    const total = await read($, estimate)
    const shown = total === null ? '?' : String(Math.max(total, answered))
    const progress = `[預估問題 ${answered}/${shown}]`
    const isPaused = now === 'paused'

    const buttons = isPaused
      ? [
          <Button key="resume" hotkey="1" variant="primary" label="繼續拷問" onPress={resume} />,
          <Button key="quit" hotkey="2" label="不問了" onPress={quit} />,
        ]
      : [<Button key="interrupt" hotkey="1" label="中斷拷問" onPress={interrupt} />]

    return (
      <Box key="grill" flexDirection="row" flexWrap="wrap" columnGap={1} alignItems="center">
        <Text bold>{isPaused ? '已中斷' : '拷問中'}</Text>
        <Text dimColor>{progress}</Text>
        {buttons}
      </Box>
    )
  })
}

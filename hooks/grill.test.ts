import type { On, RenderElement } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

const COMPOSE = {
  model: 'claude-opus-5-5',
  promptModel: 'claude-opus-5-5',
  surfaces: ['desktop'],
  tools: [],
  outputStyle: null,
  traits: [],
} as const

const QUESTION = {
  question: '要用哪個引擎？',
  header: '引擎',
  options: [
    { label: 'Unity（建議）', description: '你最熟' },
    { label: 'UE5', description: '畫面最好' },
  ],
  multiSelect: false,
}

const BAND = {
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
} as const

const PERSON = { kind: 'composer' } as const

// 測試裡沒有真的儲存空間、通知和 Claude Code 自己的上方列，用假的接住
const world = (on: On) => {
  mock.store(on)
  on('ui.toast', () => ({ value: undefined }))
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return h(Text, null, 'engine') as RenderElement
  })
}

const answerWith = (on: On, answer: string) =>
  on('tool.call', { tool: 'AskUserQuestion' }, () => ({
    result: { questions: [QUESTION], answers: { [QUESTION.question]: answer } },
  }))

const ask = (source: string) => ({
  tool: 'AskUserQuestion' as const,
  tool_use_id: `q-${source}`,
  questions: [QUESTION],
  metadata: { source },
})

test('系統提示詞每一輪都帶拷問規則，/grill-auto off 後拿掉', async ($, on) => {
  world(on)
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'x', scope: 'shared' }] }))

  const before = await $.prompt.compose(COMPOSE)
  expect(before.sections.map(s => s.id)).toContain('grill:rules')

  await $.command.run({
    command: 'grill-auto',
    args: 'off',
    origin: PERSON,
    presentation: { isFullscreen: false, columns: 80 },
  })
  const after = await $.prompt.compose(COMPOSE)
  expect(after.sections.map(s => s.id)).not.toContain('grill:rules')
})

test('要建議或決定的訊息會多一句提醒，一般訊息不會', async ($, on) => {
  world(on)
  on('prompt.submit', ($, e) => ({ text: e.text, context: e.context }))

  const asked = await $.prompt.submit({ text: '幫我決定要用哪個引擎', wait: false, origin: PERSON })
  expect(asked.context?.join(' ')).toMatch(/grill mod/)

  const plain = await $.prompt.submit({ text: '把這個 bug 修好', wait: false, origin: PERSON })
  expect(plain.context ?? []).toHaveLength(0)
})

test('上方列顯示預估題數，預估會跟著每次出題調整', async ($, on) => {
  world(on)
  answerWith(on, 'Unity（建議）')

  await $.tool.call(ask('grill:10'))
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'grill', surface, ...BAND })
    expect(await ui.find({ type: 'Text', text: '[預估問題 1/10]' })).toBeDefined()
    expect(await ui.findAll({ type: 'Button' })).toHaveLength(1)
    expect(await ui.find({ key: 'interrupt' })).toBeDefined()
    await ui.unmount()
  }

  await $.tool.call(ask('grill:6'))
  const ui = await $.ui.mount({ plugin: 'grill', surface: 'desktop', ...BAND })
  expect(await ui.find({ type: 'Text', text: '[預估問題 2/6]' })).toBeDefined()
})

test('問完呼叫 finish，換成編寫計畫和三個選項', async ($, on) => {
  world(on)
  answerWith(on, 'UE5')
  await $.tool.call(ask('grill:3'))

  await $.tool.call({ tool: 'mcp__grill__finish', tool_use_id: 'f1' })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'grill', surface, ...BAND })
    expect(await ui.find({ type: 'Text', text: '編寫計畫' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /拷問中/ })).toBeUndefined()
    expect(await ui.find({ key: 'markdown' })).toBeDefined()
    expect(await ui.find({ key: 'html' })).toBeDefined()
    expect(await ui.find({ key: 'more' })).toBeDefined()
    expect(await ui.find({ key: 'close' })).toBeDefined()
    await ui.unmount()
  }
})

test('選 Markdown 或 HTML：送出寫計畫的請求，那條收起來', async ($, on) => {
  world(on)
  answerWith(on, 'UE5')
  const submitted: string[] = []
  on('prompt.submit', ($, e) => {
    submitted.push(e.text)
    return { text: e.text }
  })

  for (const format of ['markdown', 'html'] as const) {
    await $.tool.call(ask('grill:3'))
    await $.tool.call({ tool: 'mcp__grill__finish', tool_use_id: `f-${format}` })

    const ui = await $.ui.mount({ plugin: 'grill', surface: 'desktop', ...BAND })
    await ui.press({ key: format })
    expect(submitted.at(-1)).toMatch(format === 'markdown' ? /Markdown/ : /HTML/)

    const gone = await $.ui.mount({ plugin: 'grill', surface: 'desktop', ...BAND })
    expect(await gone.find({ type: 'Text', text: /編寫計畫|拷問中/ })).toBeUndefined()
  }
})

test('選繼續提問：回到拷問中，題數接著算', async ($, on) => {
  world(on)
  answerWith(on, 'UE5')
  const submitted: string[] = []
  on('prompt.submit', ($, e) => {
    submitted.push(e.text)
    return { text: e.text }
  })
  await $.tool.call(ask('grill:3'))
  await $.tool.call({ tool: 'mcp__grill__finish', tool_use_id: 'f1' })

  const ui = await $.ui.mount({ plugin: 'grill', surface: 'desktop', ...BAND })
  await ui.press({ key: 'more' })
  expect(submitted.at(-1)).toMatch(/^繼續提問/)

  const back = await $.ui.mount({ plugin: 'grill', surface: 'desktop', ...BAND })
  expect(await back.find({ type: 'Text', text: '拷問中' })).toBeDefined()
  expect(await back.find({ type: 'Text', text: '[預估問題 1/3]' })).toBeDefined()
})

test('停在編寫計畫時自己打字，那條收起來', async ($, on) => {
  world(on)
  answerWith(on, 'UE5')
  on('prompt.submit', ($, e) => ({ text: e.text }))
  await $.tool.call(ask('grill:3'))
  await $.tool.call({ tool: 'mcp__grill__finish', tool_use_id: 'f1' })

  await $.prompt.submit({ text: '先不用寫，我想改一下第一題', wait: false, origin: PERSON })

  const ui = await $.ui.mount({ plugin: 'grill', surface: 'desktop', ...BAND })
  expect(await ui.find({ type: 'Text', text: /編寫計畫/ })).toBeUndefined()
})

test('中斷拷問：送出整理請求，之後可以繼續或不問了', async ($, on) => {
  world(on)
  answerWith(on, 'UE5')
  const session = mock.session(on)
  const submitted: string[] = []
  on('prompt.submit', ($, e) => {
    submitted.push(e.text)
    return { text: e.text }
  })
  await $.tool.call(ask('grill:8'))

  const ui = await $.ui.mount({ plugin: 'grill', surface: 'desktop', ...BAND })
  await ui.press({ key: 'interrupt' })
  expect(submitted.at(-1)).toMatch(/^中斷拷問/)

  const paused = await $.ui.mount({ plugin: 'grill', surface: 'desktop', ...BAND })
  expect(await paused.find({ type: 'Text', text: '已中斷' })).toBeDefined()
  expect(await paused.find({ type: 'Text', text: '[預估問題 1/8]' })).toBeDefined()
  await paused.press({ key: 'resume' })
  expect(submitted.at(-1)).toMatch(/^繼續拷問/)

  const resumed = await $.ui.mount({ plugin: 'grill', surface: 'desktop', ...BAND })
  expect(await resumed.find({ type: 'Text', text: '拷問中' })).toBeDefined()
  await resumed.press({ key: 'interrupt' })

  const again = await $.ui.mount({ plugin: 'grill', surface: 'desktop', ...BAND })
  await again.press({ key: 'quit' })
  const notes = session.appended().map(row => JSON.stringify(row.message.content))
  expect(notes.join(' ')).toMatch(/結束了這次拷問/)

  const gone = await $.ui.mount({ plugin: 'grill', surface: 'desktop', ...BAND })
  expect(await gone.find({ type: 'Text', text: /拷問中|已中斷/ })).toBeUndefined()
})

test('自動壓縮時照抄決策清單', async ($, on) => {
  world(on)
  answerWith(on, 'Unity（建議）')
  let instructions = ''
  on('session.compact', ($, e) => {
    instructions = e.instructions ?? ''
    return { messages: [{ role: 'user' as const, text: '摘要', toolUses: [] }] }
  })
  await $.tool.call(ask('grill:5'))

  await $.session.compact({
    trigger: 'auto',
    messages: [{ role: 'user', text: '我想做遊戲', toolUses: [] }],
  })
  expect(instructions).toContain('【引擎】要用哪個引擎？ → Unity（建議）')
})

test('沒標 grill 的一般提問不記進清單', async ($, on) => {
  world(on)
  answerWith(on, 'UE5')
  await $.tool.call(ask(''))

  const ui = await $.ui.mount({ plugin: 'grill', surface: 'desktop', ...BAND })
  expect(await ui.find({ type: 'Text', text: /拷問中/ })).toBeUndefined()
})

test('打 /grill 這個 skill 就進入拷問中，還沒估題數時顯示 ?', async ($, on) => {
  world(on)
  on('skill.prompt', ($, e) => ({ text: e.text }))

  await $.skill.prompt({ skill: 'grill', text: '進入拷問模式，主題：做遊戲' })

  const ui = await $.ui.mount({ plugin: 'grill', surface: 'desktop', ...BAND })
  expect(await ui.find({ type: 'Text', text: '[預估問題 0/?]' })).toBeDefined()
})

test('外掛裡的 /grill:grill 也會進入拷問中，別的 skill 不會', async ($, on) => {
  world(on)
  on('skill.prompt', ($, e) => ({ text: e.text }))

  await $.skill.prompt({ skill: 'tdd', text: 'x' })
  const before = await $.ui.mount({ plugin: 'grill', surface: 'desktop', ...BAND })
  expect(await before.find({ type: 'Text', text: /拷問中/ })).toBeUndefined()
  await before.unmount()

  await $.skill.prompt({ skill: 'grill:grill', text: '進入拷問模式，主題：做遊戲' })
  const after = await $.ui.mount({ plugin: 'grill', surface: 'desktop', ...BAND })
  expect(await after.find({ type: 'Text', text: '拷問中' })).toBeDefined()
})

test('編寫計畫按關閉：那條直接收起來，不送出任何訊息', async ($, on) => {
  world(on)
  answerWith(on, 'UE5')
  const submitted: string[] = []
  on('prompt.submit', ($, e) => {
    submitted.push(e.text)
    return { text: e.text }
  })
  await $.tool.call(ask('grill:3'))
  await $.tool.call({ tool: 'mcp__grill__finish', tool_use_id: 'f1' })

  const ui = await $.ui.mount({ plugin: 'grill', surface: 'desktop', ...BAND })
  await ui.press({ key: 'close' })
  expect(submitted).toHaveLength(0)

  const gone = await $.ui.mount({ plugin: 'grill', surface: 'desktop', ...BAND })
  expect(await gone.find({ type: 'Text', text: /編寫計畫|拷問中/ })).toBeUndefined()
})

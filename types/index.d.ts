export type Decision = { header: string; question: string; answer: string }

// asking：拷問中；paused：已中斷；planning：問完了，等使用者選怎麼寫計畫
export type Phase = 'asking' | 'paused' | 'planning'

declare module 'claude-code' {
  interface PluginState {
    grill: {
      decisions: Decision[]
      estimate: number | null
      isActive: boolean
      phase: Phase
      isAuto: boolean
    }
  }
}

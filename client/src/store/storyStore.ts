import { create } from 'zustand'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StoryFlags {
    visitedMom:    boolean
    metOak:        boolean
    hasStarter:    boolean
    starterChosen: string | null   // 'flameling' | 'aquafin' | 'verdling'
    metGary:       boolean
}

const DEFAULT_FLAGS: StoryFlags = {
    visitedMom:    false,
    metOak:        false,
    hasStarter:    false,
    starterChosen: null,
    metGary:       false,
}

interface StoryState {
    flags:         StoryFlags
    dialogueLocked: boolean
    setFlags:      (f: Partial<StoryFlags>) => void
    setFlag:       (key: keyof StoryFlags, value: boolean | string) => void
    setDialogueLocked: (v: boolean) => void
    reset:         () => void
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useStoryStore = create<StoryState>((set) => ({
    flags:          { ...DEFAULT_FLAGS },
    dialogueLocked: false,

    setFlags: (f) => set((s) => ({ flags: { ...s.flags, ...f } })),
    setFlag:  (key, value) => set((s) => ({ flags: { ...s.flags, [key]: value } })),
    setDialogueLocked: (v) => set({ dialogueLocked: v }),
    reset:    () => set({ flags: { ...DEFAULT_FLAGS }, dialogueLocked: false }),
}))

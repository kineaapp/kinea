import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type UnitSystem = 'metric' | 'imperial'
export type Language = 'pt-BR' | 'en-US'

interface SettingsStore {
  customLogoDataUrl: string | null
  setCustomLogo: (dataUrl: string | null) => void
  unit: UnitSystem
  setUnit: (u: UnitSystem) => void
  language: Language
  setLanguage: (l: Language) => void
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      customLogoDataUrl: null,
      setCustomLogo: (dataUrl) => set({ customLogoDataUrl: dataUrl }),
      unit: 'metric',
      setUnit: (unit) => set({ unit }),
      language: 'pt-BR',
      setLanguage: (language) => set({ language }),
    }),
    { name: 'kinea-settings' }
  )
)

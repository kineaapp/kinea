import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type UnitSystem = 'metric' | 'imperial'

interface SettingsStore {
  customLogoDataUrl: string | null
  setCustomLogo: (dataUrl: string | null) => void
  unit: UnitSystem
  setUnit: (u: UnitSystem) => void
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      customLogoDataUrl: null,
      setCustomLogo: (dataUrl) => set({ customLogoDataUrl: dataUrl }),
      unit: 'metric',
      setUnit: (unit) => set({ unit }),
    }),
    { name: 'kinea-settings' }
  )
)

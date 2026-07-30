import type { UnitSystem } from '../store/settings'

export const toDisplayWeight = (kg: number, unit: UnitSystem) =>
  unit === 'imperial' ? +(kg * 2.20462).toFixed(1) : kg

export const toDisplayLength = (cm: number, unit: UnitSystem) =>
  unit === 'imperial' ? +(cm * 0.393701).toFixed(1) : cm

export const toMetricWeight = (val: number, unit: UnitSystem) =>
  unit === 'imperial' ? val / 2.20462 : val

export const toMetricLength = (val: number, unit: UnitSystem) =>
  unit === 'imperial' ? val / 0.393701 : val

export const weightUnit = (unit: UnitSystem) => unit === 'imperial' ? 'lbs' : 'kg'
export const lengthUnit = (unit: UnitSystem) => unit === 'imperial' ? 'in' : 'cm'

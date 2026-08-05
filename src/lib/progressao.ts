import { supabase } from './supabase'

const SMALL_MUSCLES = ['Bíceps', 'Tríceps', 'Panturrilha', 'Antebraço']

function getIncrement(muscle: string): number {
  if (SMALL_MUSCLES.some(m => muscle.includes(m))) return 0.05
  return 0.10
}

export type SuggestionReason = 'first_time' | 'completed' | 'not_completed'

export interface WeightSuggestion {
  weight: number | null
  reason: SuggestionReason
}

export async function calcSuggestedWeight(
  studentId: number,
  exerciseName: string,
  muscleGroup: string,
  prescribedSets: number,
  prescribedRepsStr: string,
): Promise<WeightSuggestion> {
  const { data: logs } = await supabase
    .from('exercise_logs')
    .select('weight_kg, reps, workout_id, logged_at')
    .eq('student_id', studentId)
    .eq('exercise_name', exerciseName)
    .order('logged_at', { ascending: false })
    .limit(30)

  if (!logs || logs.length === 0) return { weight: null, reason: 'first_time' }

  // Agrupa pelo último workout_id ou pela última data
  const lastWorkoutId = logs[0].workout_id
  const sessionLogs = lastWorkoutId
    ? logs.filter(l => l.workout_id === lastWorkoutId)
    : logs.filter(l => l.logged_at.substring(0, 10) === logs[0].logged_at.substring(0, 10))

  const lastWeight = sessionLogs[0]?.weight_kg ?? 0
  const prescribedReps = parseInt(prescribedRepsStr) || 0

  // Reps baseadas em tempo (ex: "30s") assumem execução completa
  const allRepsOk = prescribedReps > 0
    ? sessionLogs.every(l => (l.reps ?? 0) >= prescribedReps)
    : true

  const completedAll = sessionLogs.length >= prescribedSets && allRepsOk

  if (!completedAll) return { weight: lastWeight, reason: 'not_completed' }

  const increment = getIncrement(muscleGroup)
  const suggested = Math.round(lastWeight * (1 + increment) * 2) / 2  // arredonda para 0,5kg
  return { weight: suggested > 0 ? suggested : null, reason: 'completed' }
}

// Busca sugestões para múltiplos exercícios de um slot de uma vez
export async function calcSuggestionsForSlot(
  studentId: number,
  exercises: Array<{ name: string; muscle: string; sets: number; reps: string }>,
): Promise<WeightSuggestion[]> {
  return Promise.all(
    exercises.map(ex =>
      calcSuggestedWeight(studentId, ex.name, ex.muscle, ex.sets, ex.reps)
    )
  )
}

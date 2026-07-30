import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../store/auth'
import { useSettingsStore } from '../../store/settings'
import { supabase } from '../../lib/supabase'

const FF = '"Libre Franklin",sans-serif'

export function getWeekStart(): string {
  const d = new Date()
  const day = d.getDay()
  const monday = new Date(d)
  monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  monday.setHours(0, 0, 0, 0)
  return monday.toISOString().split('T')[0]
}

export function getWeekRange(weekStart: string, locale: string): string {
  const start = new Date(weekStart + 'T12:00:00')
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' }
  const sep = locale === 'en-US' ? ' to ' : ' a '
  return `${start.toLocaleDateString(locale, opts)}${sep}${end.toLocaleDateString(locale, opts)}`
}

function ScaleCard({ title, hint, value, onChange, opts }: {
  title: string
  hint: string
  value: number | null
  onChange: (v: number) => void
  opts: { v: number; emoji: string; label: string }[]
}) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '18px 20px', boxShadow: '0 2px 8px rgba(27,42,74,.06)' }}>
      <div style={{ font: `700 14px ${FF}`, color: '#1B2A4A', marginBottom: 4 }}>{title}</div>
      <div style={{ font: `400 12px ${FF}`, color: '#7C7869', marginBottom: 16 }}>{hint}</div>
      <div style={{ display: 'flex', gap: 8 }}>
        {opts.map(opt => (
          <button key={opt.v} onClick={() => onChange(opt.v)}
            style={{
              flex: 1, padding: '10px 4px', cursor: 'pointer',
              border: `1.5px solid ${value === opt.v ? '#E8542A' : 'rgba(27,42,74,.1)'}`,
              borderRadius: 12,
              background: value === opt.v ? 'rgba(232,84,42,.1)' : '#fafaf7',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              transition: 'all .15s',
            }}>
            <span style={{ fontSize: 22 }}>{opt.emoji}</span>
            <span style={{ font: `600 9px ${FF}`, color: value === opt.v ? '#E8542A' : '#7C7869', textAlign: 'center', lineHeight: 1.2 }}>
              {opt.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function FeedbackSemanal() {
  const navigate   = useNavigate()
  const { user }   = useAuthStore()
  const { t } = useTranslation()
  const { language } = useSettingsStore()
  const locale = language === 'en-US' ? 'en-US' : 'pt-BR'

  const SLEEP_OPTS = [
    { v: 1, emoji: '😴', label: t('feedback_semanal.opt_very_bad') },
    { v: 2, emoji: '😕', label: t('feedback_semanal.opt_bad')      },
    { v: 3, emoji: '😐', label: t('feedback_semanal.opt_regular')   },
    { v: 4, emoji: '😊', label: t('feedback_semanal.opt_good')      },
    { v: 5, emoji: '🌟', label: t('feedback_semanal.opt_excellent') },
  ]

  const NUTRITION_OPTS = [
    { v: 1, emoji: '🍔', label: t('feedback_semanal.opt_very_bad') },
    { v: 2, emoji: '😕', label: t('feedback_semanal.opt_bad')      },
    { v: 3, emoji: '😐', label: t('feedback_semanal.opt_regular')  },
    { v: 4, emoji: '👍', label: t('feedback_semanal.opt_good_f')   },
    { v: 5, emoji: '🥗', label: t('feedback_semanal.opt_excellent') },
  ]

  const MOOD_OPTS = [
    { v: 1, emoji: '😞', label: t('feedback_semanal.opt_very_low') },
    { v: 2, emoji: '😕', label: t('feedback_semanal.opt_low')      },
    { v: 3, emoji: '😐', label: t('feedback_semanal.opt_moderate') },
    { v: 4, emoji: '😊', label: t('feedback_semanal.opt_good')     },
    { v: 5, emoji: '💪', label: t('feedback_semanal.opt_great')    },
  ]

  const [studentId,   setStudentId]   = useState<number | null>(null)
  const [alreadyDone, setAlreadyDone] = useState(false)
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [done,        setDone]        = useState(false)

  const [workouts,   setWorkouts]   = useState(3)
  const [sleep,      setSleep]      = useState<number | null>(null)
  const [nutrition,  setNutrition]  = useState<number | null>(null)
  const [mood,       setMood]       = useState<number | null>(null)
  const [notes,      setNotes]      = useState('')

  const weekStart = getWeekStart()

  useEffect(() => { if (user?.id) void load() }, [user?.id])

  async function load() {
    const { data: sr } = await supabase
      .from('students').select('id').eq('student_id', user!.id).single()
    if (!sr) { setLoading(false); return }
    const sid = (sr as any).id
    setStudentId(sid)
    const { data: existing } = await supabase
      .from('weekly_feedbacks')
      .select('id')
      .eq('student_id', sid)
      .eq('week_start', weekStart)
      .maybeSingle()
    if (existing) setAlreadyDone(true)
    setLoading(false)
  }

  async function handleSubmit() {
    if (!studentId || sleep === null || nutrition === null || mood === null) return
    setSaving(true)

    await supabase.from('weekly_feedbacks').upsert({
      student_id: studentId,
      week_start: weekStart,
      workouts,
      sleep,
      nutrition,
      mood,
      notes: notes.trim() || null,
    }, { onConflict: 'student_id,week_start' })

    const label = (v: number, opts: { v: number; label: string }[]) =>
      opts.find(o => o.v === v)?.label ?? String(v)
    const chatMsg =
      `📋 Check-in semanal (${getWeekRange(weekStart, locale)})\n\n` +
      `🏋️ Treinos realizados: ${workouts}\n` +
      `😴 Sono: ${label(sleep, SLEEP_OPTS)}\n` +
      `🥗 Alimentação: ${label(nutrition, NUTRITION_OPTS)}\n` +
      `💪 Humor/Disposição: ${label(mood, MOOD_OPTS)}` +
      (notes.trim() ? `\n\n📝 ${notes.trim()}` : '')

    await supabase.from('chat_messages').insert({
      student_id: studentId,
      from_role:  'student',
      text:       chatMsg,
    })

    setSaving(false)
    setDone(true)
  }

  if (loading) return (
    <div style={{ background: '#F4EFE3', minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ font: `500 14px ${FF}`, color: '#7C7869' }}>{t('common.loading')}</div>
    </div>
  )

  if (done || alreadyDone) return (
    <div style={{ background: '#F4EFE3', minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 32 }}>
      <div style={{ width: 72, height: 72, borderRadius: 20, background: 'rgba(76,175,138,.15)', border: '1.5px solid rgba(76,175,138,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Check size={34} color="#4CAF8A" />
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ font: `900 20px ${FF}`, color: '#1B2A4A', marginBottom: 8 }}>
          {alreadyDone && !done ? t('feedback_semanal.done_title_already') : t('feedback_semanal.success')}
        </div>
        <div style={{ font: `400 13.5px ${FF}`, color: '#7C7869', lineHeight: 1.65, maxWidth: 260 }}>
          {alreadyDone && !done
            ? t('feedback_semanal.done_body_already')
            : t('feedback_semanal.done_body_sent')}
        </div>
      </div>
      <button onClick={() => navigate('/aluno/home')}
        style={{ height: 48, padding: '0 28px', background: '#E8542A', border: 'none', borderRadius: 12, font: `700 14px ${FF}`, color: '#fff', cursor: 'pointer', boxShadow: '0 4px 0 #C4421E' }}>
        {t('feedback_semanal.back_home')}
      </button>
    </div>
  )

  const canSubmit = sleep !== null && nutrition !== null && mood !== null

  return (
    <div style={{ background: '#F4EFE3', minHeight: '100%', paddingBottom: 40 }}>

      {/* Header */}
      <div style={{ padding: '18px 20px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate(-1)}
          style={{ width: 36, height: 36, borderRadius: 10, background: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(27,42,74,.1)', flexShrink: 0 }}>
          <ChevronLeft size={20} color="#1B2A4A" strokeWidth={2.5} />
        </button>
        <div>
          <h1 style={{ font: `800 18px ${FF}`, color: '#1B2A4A', margin: 0, letterSpacing: '-.3px' }}>
            {t('feedback_semanal.title')}
          </h1>
          <div style={{ font: `400 11.5px ${FF}`, color: '#7C7869', marginTop: 2 }}>
            {getWeekRange(weekStart, locale)}
          </div>
        </div>
      </div>

      <div style={{ padding: '24px 20px 0', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Workouts count */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '18px 20px', boxShadow: '0 2px 8px rgba(27,42,74,.06)' }}>
          <div style={{ font: `700 14px ${FF}`, color: '#1B2A4A', marginBottom: 4 }}>
            {t('feedback_semanal.workouts_question')}
          </div>
          <div style={{ font: `400 12px ${FF}`, color: '#7C7869', marginBottom: 16 }}>
            {t('feedback_semanal.workouts_hint')}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 5 }}>
            {[0, 1, 2, 3, 4, 5, 6, 7].map(n => (
              <button key={n} onClick={() => setWorkouts(n)}
                style={{
                  flex: 1, height: 48, borderRadius: 10, cursor: 'pointer',
                  border: `1.5px solid ${workouts === n ? '#E8542A' : 'rgba(27,42,74,.1)'}`,
                  background: workouts === n ? 'rgba(232,84,42,.12)' : '#fff',
                  font: `700 16px ${FF}`,
                  color: workouts === n ? '#E8542A' : '#1B2A4A',
                  transition: 'all .15s',
                }}>
                {n}
              </button>
            ))}
          </div>
        </div>

        <ScaleCard
          title={t('feedback_semanal.sleep_title')}
          hint={t('feedback_semanal.sleep_hint')}
          value={sleep}
          onChange={setSleep}
          opts={SLEEP_OPTS}
        />

        <ScaleCard
          title={t('feedback_semanal.nutrition_title')}
          hint={t('feedback_semanal.nutrition_hint')}
          value={nutrition}
          onChange={setNutrition}
          opts={NUTRITION_OPTS}
        />

        <ScaleCard
          title={t('feedback_semanal.mood_title')}
          hint={t('feedback_semanal.mood_hint')}
          value={mood}
          onChange={setMood}
          opts={MOOD_OPTS}
        />

        {/* Notes */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '18px 20px', boxShadow: '0 2px 8px rgba(27,42,74,.06)' }}>
          <div style={{ font: `700 14px ${FF}`, color: '#1B2A4A', marginBottom: 4 }}>
            {t('feedback_semanal.notes_label')}{' '}
            <span style={{ font: `400 12px ${FF}`, color: '#7C7869' }}>{t('feedback_semanal.notes_optional')}</span>
          </div>
          <div style={{ font: `400 12px ${FF}`, color: '#7C7869', marginBottom: 12 }}>
            {t('feedback_semanal.notes_share')}
          </div>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder={t('feedback_semanal.notes_placeholder')}
            rows={4}
            style={{
              width: '100%', background: '#fafaf7',
              border: '1.5px solid #D6CFBE', borderRadius: 10,
              padding: '12px 14px', font: `400 13px ${FF}`,
              color: '#1B2A4A', resize: 'none', outline: 'none', boxSizing: 'border-box',
            } as React.CSSProperties}
          />
        </div>

        {/* Submit */}
        <button
          onClick={() => void handleSubmit()}
          disabled={!canSubmit || saving}
          style={{
            width: '100%', height: 54,
            background: canSubmit ? '#E8542A' : '#D6CFBE',
            border: 'none', borderRadius: 14,
            font: `700 16px ${FF}`,
            color: canSubmit ? '#fff' : '#a39e90',
            cursor: canSubmit && !saving ? 'pointer' : 'default',
            boxShadow: canSubmit ? '0 4px 0 #C4421E' : 'none',
            transition: 'all .2s', opacity: saving ? 0.7 : 1,
          }}>
          {saving ? t('feedback_semanal.submitting') : t('feedback_semanal.submit_btn')}
        </button>

        {!canSubmit && (
          <p style={{ font: `400 12px ${FF}`, color: '#7C7869', textAlign: 'center', margin: '-12px 0 0' }}>
            {t('feedback_semanal.fill_all')}
          </p>
        )}
      </div>
    </div>
  )
}

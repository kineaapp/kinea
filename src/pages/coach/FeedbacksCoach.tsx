import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../store/auth'
import { useStudentsStore } from '../../store/students'
import { useSettingsStore } from '../../store/settings'
import { supabase } from '../../lib/supabase'

const FF = '"Libre Franklin",sans-serif'

interface FeedbackRow {
  id:         number
  student_id: number
  week_start: string
  workouts:   number
  sleep:      number
  nutrition:  number
  mood:       number
  notes:      string | null
  created_at: string
}

function weekLabel(weekStart: string, locale: string) {
  const start = new Date(weekStart + 'T12:00:00')
  const end   = new Date(start)
  end.setDate(start.getDate() + 6)
  return (
    `${start.toLocaleDateString(locale, { day: 'numeric', month: 'short' })} – ` +
    `${end.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}`
  )
}

function getInitials(name: string) {
  const p = name.trim().split(' ')
  return p.length >= 2 ? `${p[0][0]}${p[p.length - 1][0]}`.toUpperCase() : name.slice(0, 2).toUpperCase()
}

const AVATAR_COLORS = ['#E8542A','#1B7a4a','#5a4ea0','#b06a12','#1B2A4A','#2a7ab0','#c4421e']
const scoreColor    = (v: number) => v >= 4 ? '#1B7a4a' : v >= 3 ? '#b06a12' : '#c4421e'
const scoreBg       = (v: number) => v >= 4 ? '#e7f3ea' : v >= 3 ? '#f7ecd9' : '#fbe6e1'
const scoreEmoji    = (v: number, type: 'sleep' | 'nutrition' | 'mood') => {
  const maps = {
    sleep:     ['😴','😕','😐','😊','🌟'],
    nutrition: ['🍔','😕','😐','👍','🥗'],
    mood:      ['😞','😕','😐','😊','💪'],
  }
  return maps[type][v - 1] ?? '—'
}

type Period = 'week' | 'month' | 'all'

export default function FeedbacksCoach() {
  const { t } = useTranslation()
  const { user }                          = useAuthStore()
  const { students, fetchStudents }       = useStudentsStore()
  const navigate                          = useNavigate()
  const locale = useSettingsStore(s => s.language)

  const PERIOD_OPTS: { value: Period; label: string }[] = [
    { value: 'week',  label: t('coach_feedbacks.filter_week')       },
    { value: 'month', label: t('coach_feedbacks.filter_month')      },
    { value: 'all',   label: t('coach_feedbacks.filter_all_period') },
  ]

  const [feedbacks,      setFeedbacks]      = useState<FeedbackRow[]>([])
  const [loading,        setLoading]        = useState(true)
  const [filterStudent,  setFilterStudent]  = useState<number | ''>('')
  const [filterPeriod,   setFilterPeriod]   = useState<Period>('month')

  useEffect(() => {
    if (user?.id && students.length === 0) fetchStudents(user.id)
  }, [user?.id])

  useEffect(() => {
    if (!user?.id || students.length === 0) { setLoading(false); return }

    const ids = students.map(s => s.id)
    if (ids.length === 0) { setFeedbacks([]); setLoading(false); return }

    const cutoff = filterPeriod === 'week'
      ? new Date(Date.now() - 7  * 86_400_000).toISOString().slice(0, 10)
      : filterPeriod === 'month'
      ? new Date(Date.now() - 28 * 86_400_000).toISOString().slice(0, 10)
      : null

    void (async () => {
      setLoading(true)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = supabase
        .from('weekly_feedbacks')
        .select('id,student_id,week_start,workouts,sleep,nutrition,mood,notes,created_at')
        .in('student_id', ids)
        .order('week_start', { ascending: false })
        .limit(200)

      if (cutoff)         q = q.gte('week_start', cutoff)
      if (filterStudent)  q = q.eq('student_id', filterStudent)

      const { data } = await q
      setFeedbacks((data as FeedbackRow[] | null) ?? [])
      setLoading(false)
    })()
  }, [students.length, filterPeriod, filterStudent])

  const studentMap   = new Map(students.map(s => [s.id, s]))
  const uniqueAlunos = new Set(feedbacks.map(f => f.student_id)).size

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', paddingBottom: 40 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <div>
          <h1 style={{ font: `800 28px ${FF}`, color: '#1B2A4A', margin: 0, letterSpacing: '-.6px' }}>
            {t('coach_feedbacks.weekly_title')}
          </h1>
          {!loading && (
            <p style={{ font: `400 13px ${FF}`, color: '#7c7869', margin: '4px 0 0' }}>
              {t('coach_feedbacks.checkin_count', { count: feedbacks.length })}
              {filterStudent === '' && uniqueAlunos > 0 && ` · ${t('coach_feedbacks.student_count', { count: uniqueAlunos })}`}
            </p>
          )}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', background: '#f4efe3', borderRadius: 10, padding: 3, gap: 2 }}>
            {PERIOD_OPTS.map(opt => {
              const active = filterPeriod === opt.value
              return (
                <button key={opt.value} type="button" onClick={() => setFilterPeriod(opt.value)}
                  style={{ height: 34, padding: '0 12px', border: 'none', borderRadius: 8, font: `600 12px ${FF}`, cursor: 'pointer', background: active ? '#1B2A4A' : 'transparent', color: active ? '#fff' : '#7c7869', whiteSpace: 'nowrap' }}>
                  {opt.label}
                </button>
              )
            })}
          </div>

          <select
            value={filterStudent}
            onChange={e => setFilterStudent(e.target.value ? parseInt(e.target.value) : '')}
            style={{ height: 40, border: '1.5px solid #d6cfbe', borderRadius: 10, background: '#fff', padding: '0 12px', font: `500 13px ${FF}`, color: '#1B2A4A', outline: 'none', cursor: 'pointer' }}
          >
            <option value=''>{t('coach_feedbacks.all_students')}</option>
            {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 220 }}>
          <span style={{ width: 28, height: 28, border: '3px solid #EDE8DC', borderTopColor: '#E8542A', borderRadius: '50%', display: 'inline-block', animation: 'kspin .7s linear infinite' }} />
        </div>

      ) : feedbacks.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 16, padding: '60px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
          <div style={{ font: `700 16px ${FF}`, color: '#1B2A4A', marginBottom: 6 }}>{t('coach_feedbacks.none_found_title')}</div>
          <div style={{ font: `400 13px ${FF}`, color: '#9a948a' }}>
            {filterPeriod !== 'all'
              ? t('coach_feedbacks.widen_period')
              : t('coach_feedbacks.no_checkins_desc')}
          </div>
        </div>

      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {feedbacks.map(fb => {
            const student = studentMap.get(fb.student_id)
            if (!student) return null
            const initials    = getInitials(student.name)
            const avatarColor = AVATAR_COLORS[fb.student_id % AVATAR_COLORS.length]

            return (
              <div key={fb.id} style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 14, padding: '16px 18px' }}>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div style={{ width: 38, height: 38, borderRadius: '50%', background: avatarColor, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', font: `700 13px ${FF}`, flexShrink: 0 }}>
                      {initials}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ font: `700 14px ${FF}`, color: '#1B2A4A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {student.name}
                      </div>
                      <div style={{ font: `400 11px ${FF}`, color: '#9a948a', marginTop: 1 }}>
                        {weekLabel(fb.week_start, locale)}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(`/coach/alunos/${fb.student_id}`, { state: { tab: 'feedback' } })}
                    style={{ height: 32, padding: '0 12px', border: '1.5px solid #d6cfbe', background: '#fff', color: '#1B2A4A', borderRadius: 8, font: `600 12px ${FF}`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, whiteSpace: 'nowrap' }}
                  >
                    {t('coach_feedbacks.view_profile')}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 18l6-6-6-6"/>
                    </svg>
                  </button>
                </div>

                {/* Scores */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: fb.notes ? 10 : 0 }}>
                  <div style={{ background: '#f7f4ee', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
                    <div style={{ font: `800 20px ${FF}`, color: '#1B2A4A', lineHeight: 1 }}>{fb.workouts}</div>
                    <div style={{ font: `400 10px ${FF}`, color: '#9a948a', marginTop: 3 }}>{t('coach_feedbacks.workouts_label').toLowerCase()}</div>
                  </div>
                  <div style={{ background: scoreBg(fb.sleep), borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: 20, lineHeight: 1 }}>{scoreEmoji(fb.sleep, 'sleep')}</div>
                    <div style={{ font: `600 9px ${FF}`, color: scoreColor(fb.sleep), marginTop: 3 }}>{t('coach_feedbacks.sleep_label').toLowerCase()}</div>
                  </div>
                  <div style={{ background: scoreBg(fb.nutrition), borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: 20, lineHeight: 1 }}>{scoreEmoji(fb.nutrition, 'nutrition')}</div>
                    <div style={{ font: `600 9px ${FF}`, color: scoreColor(fb.nutrition), marginTop: 3 }}>{t('coach_feedbacks.diet_label')}</div>
                  </div>
                  <div style={{ background: scoreBg(fb.mood), borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: 20, lineHeight: 1 }}>{scoreEmoji(fb.mood, 'mood')}</div>
                    <div style={{ font: `600 9px ${FF}`, color: scoreColor(fb.mood), marginTop: 3 }}>{t('coach_feedbacks.mood_label').toLowerCase()}</div>
                  </div>
                </div>

                {fb.notes && (
                  <div style={{ background: '#faf7ee', borderRadius: 8, padding: '8px 10px', borderLeft: '3px solid #E8542A', font: `400 12px ${FF}`, color: '#1B2A4A', lineHeight: 1.55 }}>
                    {fb.notes}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

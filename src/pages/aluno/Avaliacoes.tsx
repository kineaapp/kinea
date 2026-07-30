import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../store/auth'
import { useSettingsStore } from '../../store/settings'
import { supabase } from '../../lib/supabase'
import { toDisplayWeight, toDisplayLength, weightUnit, lengthUnit } from '../../lib/units'

const FF = '"Libre Franklin",sans-serif'

interface AssessmentRow {
  id: number
  assessed_at: string
  weight_kg: number | null
  body_fat_pct: number | null
  waist_cm: number | null
  hip_cm: number | null
  chest_cm: number | null
  arm_cm: number | null
  height_cm: number | null
}

function delta(curr: number | null, prev: number | null, dec = 1): string | null {
  if (curr == null || prev == null) return null
  const d = curr - prev
  if (d === 0) return null
  return `${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(dec)}`
}

function deltaColor(curr: number | null, prev: number | null, lowerIsBetter: boolean): string {
  if (curr == null || prev == null) return '#A39E90'
  const d = curr - prev
  if (d === 0) return '#A39E90'
  const good = lowerIsBetter ? d < 0 : d > 0
  return good ? '#4CAF8A' : '#D2402A'
}

export default function Avaliacoes() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { language, unit } = useSettingsStore()
  const locale = language === 'en-US' ? 'en-US' : 'pt-BR'
  const wUnit = weightUnit(unit)
  const lUnit = lengthUnit(unit)

  const [assessments,    setAssessments]    = useState<AssessmentRow[]>([])
  const [nextAssessment, setNextAssessment] = useState<string | null>(null)
  const [loading,        setLoading]        = useState(true)

  function fmtDate(iso: string) {
    const [y, m, d] = iso.split('-')
    return new Date(+y, +m - 1, +d).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  useEffect(() => {
    if (!user?.id) return
    ;(async () => {
      const { data: studentRow } = await supabase
        .from('students')
        .select('id, next_assessment')
        .eq('student_id', user.id)
        .maybeSingle()

      if (!studentRow) { setLoading(false); return }

      setNextAssessment(studentRow.next_assessment ?? null)

      const { data } = await supabase
        .from('assessments')
        .select('id,assessed_at,weight_kg,body_fat_pct,waist_cm,hip_cm,chest_cm,arm_cm,height_cm')
        .eq('student_id', studentRow.id)
        .order('assessed_at', { ascending: true })

      setAssessments((data as AssessmentRow[] | null) ?? [])
      setLoading(false)
    })()
  }, [user?.id])

  const daysPastDue = nextAssessment
    ? Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(nextAssessment + 'T00:00:00').getTime()) / 86_400_000)
    : null
  const isAssessmentDue = daysPastDue !== null && daysPastDue >= 0
  const daysUntil = daysPastDue !== null ? -daysPastDue : null

  const latest = assessments.length > 0 ? assessments[assessments.length - 1] : null
  const prev   = assessments.length > 1 ? assessments[assessments.length - 2] : null

  const chartData = assessments.filter(a => a.weight_kg != null).slice(-6)

  function buildChartPath() {
    if (chartData.length < 2) return { line: '', area: '' }
    const weights = chartData.map(a => a.weight_kg as number)
    const minW = Math.min(...weights)
    const maxW = Math.max(...weights)
    const range = maxW - minW || 1
    const W = 300, H = 90, pad = 8

    const pts = chartData.map((a, i) => {
      const x = chartData.length === 1 ? W / 2 : (i / (chartData.length - 1)) * W
      const y = pad + (1 - ((a.weight_kg as number) - minW) / range) * (H - pad * 2)
      return `${x},${y}`
    })

    const line = pts.join(' ')
    const area = `${pts[0].split(',')[0]},${H} ${line} ${pts[pts.length - 1].split(',')[0]},${H}`
    return { line, area }
  }

  const { line: chartLine, area: chartArea } = buildChartPath()
  const chartMonths = chartData.map(a => {
    const [, m] = a.assessed_at.split('-')
    return new Date(2024, parseInt(m) - 1, 1).toLocaleDateString(locale, { month: 'short' })
  })

  const leanMass = (latest?.weight_kg != null && latest?.body_fat_pct != null)
    ? latest.weight_kg * (1 - latest.body_fat_pct / 100)
    : null
  const prevLeanMass = (prev?.weight_kg != null && prev?.body_fat_pct != null)
    ? prev.weight_kg * (1 - prev.body_fat_pct / 100)
    : null

  const circMeasures = [
    { label: t('assessments.label_waist'),     value: latest?.waist_cm ?? null, fill: '#E8542A' },
    { label: t('assessments.label_hip'),       value: latest?.hip_cm   ?? null, fill: '#1B2A4A' },
    { label: t('assessments.label_chest'),     value: latest?.chest_cm ?? null, fill: '#1B2A4A' },
    { label: t('assessments.label_arm_right'), value: latest?.arm_cm   ?? null, fill: '#4CAF8A' },
  ].filter(m => m.value != null) as { label: string; value: number; fill: string }[]
  const maxCirc = circMeasures.length > 0 ? Math.max(...circMeasures.map(m => m.value)) : 1

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <span style={{ width: 24, height: 24, border: '3px solid #EDE8DC', borderTopColor: '#E8542A', borderRadius: '50%', display: 'inline-block', animation: 'kspin .7s linear infinite' }} />
      </div>
    )
  }

  return (
    <div style={{ paddingBottom: 24 }}>

      {/* Header */}
      <div style={{ padding: '18px 20px 16px' }}>
        <h1 style={{ font: `800 24px ${FF}`, color: '#1B2A4A', margin: '0 0 4px', letterSpacing: '-.5px' }}>{t('assessments.title')}</h1>
        <p style={{ font: `400 13px ${FF}`, color: '#7C7869', margin: 0 }}>
          {latest
            ? t('assessments.last_assessment', { date: fmtDate(latest.assessed_at) })
            : t('assessments.no_assessments_registered')}
        </p>
      </div>

      {/* Assessment status card */}
      {!loading && nextAssessment && (
        <div style={{ padding: '0 18px', marginBottom: 16 }}>
          {isAssessmentDue ? (
            <button
              type="button"
              onClick={() => navigate('/aluno/nova-avaliacao')}
              style={{
                width: '100%', padding: '16px 18px',
                background: '#E8542A', border: 'none', borderRadius: 16,
                boxShadow: '0 4px 0 #C4421E',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                cursor: 'pointer',
              }}
            >
              <div style={{ textAlign: 'left' }}>
                <div style={{ font: `700 15px ${FF}`, color: '#fff' }}>
                  {daysPastDue === 0
                    ? t('aluno_layout.assessment_today')
                    : t('aluno_layout.assessment_overdue', { count: daysPastDue })}
                </div>
                <div style={{ font: `400 12px ${FF}`, color: 'rgba(255,255,255,.75)', marginTop: 2 }}>
                  {t('assessments.tap_to_record')}
                </div>
              </div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          ) : (
            <div style={{
              background: '#fff', borderRadius: 16, padding: '14px 16px',
              boxShadow: '0 2px 8px rgba(27,42,74,.07)',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#f0f4ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1B2A4A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
              </div>
              <div>
                <div style={{ font: `600 13px ${FF}`, color: '#1B2A4A' }}>
                  {t('assessments.next_in_days', { count: daysUntil })}
                </div>
                <div style={{ font: `400 11px ${FF}`, color: '#A39E90', marginTop: 2 }}>
                  {new Date(nextAssessment + 'T00:00:00').toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!latest && (
        <div style={{ padding: '0 18px' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '40px 24px', textAlign: 'center', boxShadow: '0 2px 8px rgba(27,42,74,.07)' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
            <div style={{ font: `700 15px ${FF}`, color: '#1B2A4A', marginBottom: 6 }}>{t('assessments.no_data')}</div>
            <div style={{ font: `400 13px ${FF}`, color: '#9a948a' }}>{t('assessments.no_data_desc')}</div>
          </div>
        </div>
      )}

      {/* Metrics */}
      {latest && (
        <>
          <div style={{ padding: '0 18px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>

            {/* Weight */}
            {(() => {
              const wD = latest.weight_kg != null ? toDisplayWeight(latest.weight_kg, unit) : null
              const wPD = prev?.weight_kg != null ? toDisplayWeight(prev.weight_kg, unit) : null
              const d = delta(wD, wPD)
              return (
                <div style={{ background: '#1B2A4A', borderRadius: 16, padding: 16 }}>
                  <div style={{ font: `500 11px ${FF}`, color: '#8B97AD', marginBottom: 8 }}>{t('assessments.weight')}</div>
                  <div style={{ font: `900 26px ${FF}`, color: '#FAEEDA' }}>
                    {wD?.toFixed(1) ?? '—'}
                    <span style={{ font: `500 14px ${FF}`, color: '#8B97AD' }}> {wUnit}</span>
                  </div>
                  {d && (
                    <div style={{ font: `600 11px ${FF}`, color: deltaColor(latest.weight_kg, prev?.weight_kg ?? null, true), marginTop: 4 }}>
                      {d} {wUnit}
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Body fat */}
            <div style={{ background: '#fff', borderRadius: 16, padding: 16, boxShadow: '0 2px 8px rgba(27,42,74,.07)' }}>
              <div style={{ font: `500 11px ${FF}`, color: '#A39E90', marginBottom: 8 }}>{t('assessments.body_fat_pct')}</div>
              <div style={{ font: `900 26px ${FF}`, color: '#1B2A4A' }}>
                {latest.body_fat_pct?.toFixed(1) ?? '—'}
                <span style={{ font: `500 14px ${FF}`, color: '#A39E90' }}>{latest.body_fat_pct != null ? '%' : ''}</span>
              </div>
              {delta(latest.body_fat_pct, prev?.body_fat_pct ?? null) && (
                <div style={{ font: `600 11px ${FF}`, color: deltaColor(latest.body_fat_pct, prev?.body_fat_pct ?? null, true), marginTop: 4 }}>
                  {delta(latest.body_fat_pct, prev?.body_fat_pct ?? null)}%
                </div>
              )}
            </div>

            {/* Lean mass */}
            {(() => {
              const lmD = leanMass != null ? toDisplayWeight(leanMass, unit) : null
              const lmPD = prevLeanMass != null ? toDisplayWeight(prevLeanMass, unit) : null
              const d = delta(lmD, lmPD, 1)
              return (
                <div style={{ background: '#fff', borderRadius: 16, padding: 16, boxShadow: '0 2px 8px rgba(27,42,74,.07)' }}>
                  <div style={{ font: `500 11px ${FF}`, color: '#A39E90', marginBottom: 8 }}>{t('assessments.lean_mass')}</div>
                  <div style={{ font: `900 26px ${FF}`, color: '#1B2A4A' }}>
                    {lmD != null ? lmD.toFixed(1) : '—'}
                    <span style={{ font: `500 14px ${FF}`, color: '#A39E90' }}>{lmD != null ? ` ${wUnit}` : ''}</span>
                  </div>
                  {d && (
                    <div style={{ font: `600 11px ${FF}`, color: deltaColor(leanMass, prevLeanMass, false), marginTop: 4 }}>
                      {d} {wUnit}
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Assessment count */}
            <div style={{ background: '#fff', borderRadius: 16, padding: 16, boxShadow: '0 2px 8px rgba(27,42,74,.07)' }}>
              <div style={{ font: `500 11px ${FF}`, color: '#A39E90', marginBottom: 8 }}>{t('assessments.assessments_label')}</div>
              <div style={{ font: `900 26px ${FF}`, color: '#1B2A4A' }}>
                {assessments.length}
                <span style={{ font: `500 14px ${FF}`, color: '#A39E90' }}> {t('assessments.times_unit', { count: assessments.length })}</span>
              </div>
              {prev && (
                <div style={{ font: `600 11px ${FF}`, color: '#A39E90', marginTop: 4 }}>
                  {t('assessments.prev_label')} {fmtDate(prev.assessed_at)}
                </div>
              )}
            </div>
          </div>

          {/* Weight chart */}
          {chartData.length >= 2 && (
            <div style={{ padding: '0 18px', marginBottom: 10 }}>
              <div style={{ background: '#fff', borderRadius: 16, padding: 18, boxShadow: '0 2px 8px rgba(27,42,74,.07)' }}>
                <div style={{ font: `700 14px ${FF}`, color: '#1B2A4A', marginBottom: 14 }}>{t('assessments.weight_evolution')}</div>
                <svg width="100%" height={100} viewBox="0 0 300 100" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="wgrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#E8542A" stopOpacity="0.18" />
                      <stop offset="100%" stopColor="#E8542A" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <polygon points={chartArea} fill="url(#wgrad)" />
                  <polyline points={chartLine} fill="none" stroke="#E8542A" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                  {chartData.map((a, i) => {
                    const weights = chartData.map(x => x.weight_kg as number)
                    const minW = Math.min(...weights), maxW = Math.max(...weights)
                    const range = maxW - minW || 1
                    const x = (i / (chartData.length - 1)) * 300
                    const y = 8 + (1 - ((a.weight_kg as number) - minW) / range) * 74
                    return i === chartData.length - 1
                      ? <circle key={i} cx={x} cy={y} r={5} fill="#E8542A" />
                      : null
                  })}
                </svg>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                  {chartMonths.map((m, i) => (
                    <span key={i} style={{ font: `400 10px ${FF}`, color: '#C5BFB0' }}>{m}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Circumferences */}
          {circMeasures.length > 0 && (
            <div style={{ padding: '0 18px' }}>
              <div style={{ background: '#fff', borderRadius: 16, padding: 18, boxShadow: '0 2px 8px rgba(27,42,74,.07)' }}>
                <div style={{ font: `700 14px ${FF}`, color: '#1B2A4A', marginBottom: 14 }}>{t('assessments.circumferences')}</div>
                {circMeasures.map(({ label, value, fill }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <span style={{ font: `500 13px ${FF}`, color: '#7C7869', width: 80, flexShrink: 0 }}>{label}</span>
                    <div style={{ flex: 1, height: 6, background: '#F4EFE3', borderRadius: 4 }}>
                      <div style={{ width: `${(value / maxCirc) * 100}%`, height: '100%', background: fill, borderRadius: 4 }} />
                    </div>
                    <span style={{ font: `700 13px ${FF}`, color: '#1B2A4A', minWidth: 52, textAlign: 'right' }}>{toDisplayLength(value, unit).toFixed(1)} {lUnit}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

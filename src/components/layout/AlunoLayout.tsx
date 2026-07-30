import { Outlet, useLocation, NavLink, Navigate, useNavigate } from 'react-router-dom'
import { Home, Dumbbell, MessageCircle, Activity, User } from 'lucide-react'
import { useAuthStore } from '../../store/auth'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'

const FF = '"Libre Franklin",sans-serif'

function AssessmentReminderModal({ daysPastDue, onStart, onSnooze }: {
  daysPastDue: number
  onStart: () => void
  onSnooze: () => void
}) {
  const { t } = useTranslation()
  const daysUsed = Math.min(daysPastDue, 7)
  const pct = (daysUsed / 7) * 100

  const title = daysPastDue === 0
    ? t('aluno_layout.assessment_today')
    : t('aluno_layout.assessment_overdue', { count: daysPastDue })

  const desc = daysPastDue === 0
    ? t('aluno_layout.assessment_today_desc')
    : t('aluno_layout.days_left', { count: 7 - daysPastDue })

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      background: 'rgba(0,0,0,.45)',
    }}>
      <div style={{
        background: '#F4EFE3', borderRadius: '20px 20px 0 0',
        padding: '28px 22px 40px', maxWidth: 390, width: '100%', margin: '0 auto',
      }}>
        {/* Icon */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#fff3ee', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#E8542A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
          </div>
        </div>

        <h2 style={{ font: `800 20px ${FF}`, color: '#1B2A4A', margin: '0 0 8px', textAlign: 'center', letterSpacing: '-.3px' }}>
          {title}
        </h2>
        <p style={{ font: `400 13px/1.6 ${FF}`, color: '#7C7869', margin: '0 0 20px', textAlign: 'center' }}>
          {desc}
        </p>

        {/* Progress bar */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ font: `600 11px ${FF}`, color: '#A39E90' }}>{t('aluno_layout.deadline_used')}</span>
            <span style={{ font: `600 11px ${FF}`, color: daysUsed >= 6 ? '#D2402A' : '#A39E90' }}>
              {t('aluno_layout.days_of_7', { count: daysUsed })}
            </span>
          </div>
          <div style={{ height: 6, background: '#EDE8DC', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 4,
              width: `${pct}%`,
              background: daysUsed >= 6 ? '#D2402A' : daysUsed >= 4 ? '#E8542A' : '#4CAF50',
              transition: 'width .3s',
            }} />
          </div>
        </div>

        <button
          type="button"
          onClick={onStart}
          style={{
            width: '100%', padding: '15px 0', marginBottom: 12,
            background: '#E8542A', border: 'none', borderRadius: 14,
            boxShadow: '0 4px 0 #C4421E',
            font: `700 16px ${FF}`, color: '#fff', cursor: 'pointer',
          }}
        >
          {t('aluno_layout.do_now')}
        </button>

        <button
          type="button"
          onClick={onSnooze}
          style={{
            width: '100%', padding: '13px 0',
            background: 'none', border: '1.5px solid #D6CFBE', borderRadius: 14,
            font: `600 14px ${FF}`, color: '#7C7869', cursor: 'pointer',
          }}
        >
          {t('aluno_layout.do_later')}
        </button>
      </div>
    </div>
  )
}

export default function AlunoLayout() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [blocked, setBlocked] = useState(false)
  const [nextAssessment, setNextAssessment] = useState<string | null>(null)
  const [assessmentSnoozed, setAssessmentSnoozed] = useState(false)
  const [dataLoaded, setDataLoaded] = useState(false)

  const TABS = [
    { to: '/aluno/home',       icon: Home,          label: t('nav.home')           },
    { to: '/aluno/treinos',    icon: Dumbbell,      label: t('nav.workouts')       },
    { to: '/aluno/chat',       icon: MessageCircle, label: t('nav.chat')           },
    { to: '/aluno/avaliacoes', icon: Activity,      label: t('nav.assessment_tab') },
    { to: '/aluno/perfil',     icon: User,          label: t('nav.profile')        },
  ]

  useEffect(() => {
    if (!user?.id) return
    supabase
      .from('students')
      .select('blocked, next_assessment')
      .eq('student_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.blocked) setBlocked(true)
        const na = data?.next_assessment ?? null
        setNextAssessment(na)

        if (na) {
          try {
            const raw = localStorage.getItem('kinea-assessment-snooze')
            if (raw) {
              const { date, assessmentDate } = JSON.parse(raw)
              const today = new Date().toISOString().split('T')[0]
              if (date === today && assessmentDate === na) setAssessmentSnoozed(true)
            }
          } catch {}
        }
        setDataLoaded(true)
      })
  }, [user?.id])

  const isAnamnese          = pathname.includes('/anamnese')
  const isPrimeiraAvaliacao = pathname.includes('/primeira-avaliacao')
  const isNovaAvaliacao     = pathname.includes('/nova-avaliacao')
  const hideTabBar = pathname.includes('/exec') || pathname.includes('/notificacoes') || pathname.includes('/configuracoes') || isAnamnese || isPrimeiraAvaliacao || isNovaAvaliacao

  if (!user || user.role !== 'student') return <Navigate to="/login" replace />

  if (blocked) return (
    <div style={{ minHeight: '100dvh', background: '#C8C2B2', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 390, minHeight: '100dvh', background: '#F4EFE3', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 32px', textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#fbe6e1', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#c4421e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </div>
        <div style={{ font: '800 22px "Libre Franklin",sans-serif', color: '#1B2A4A', marginBottom: 10 }}>
          {t('aluno_layout.access_suspended_title')}
        </div>
        <div style={{ font: '400 14px "Libre Franklin",sans-serif', color: '#7c7869', lineHeight: 1.6 }}>
          {t('aluno_layout.access_suspended_desc')}
        </div>
      </div>
    </div>
  )

  // Block going back to already completed onboarding pages
  if (isAnamnese && user.anamneseCompleted)           return <Navigate to="/aluno/home" replace />
  if (isPrimeiraAvaliacao && user.assessmentCompleted) return <Navigate to="/aluno/home" replace />

  // Enforce onboarding order: anamnese first, then assessment
  if (!user.anamneseCompleted && !isAnamnese)                                          return <Navigate to="/aluno/anamnese" replace />
  if (user.anamneseCompleted && !user.assessmentCompleted && !isPrimeiraAvaliacao)     return <Navigate to="/aluno/primeira-avaliacao" replace />

  // Assessment enforcement (only after onboarding complete and data loaded)
  const daysPastDue = (dataLoaded && nextAssessment)
    ? Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(nextAssessment + 'T00:00:00').getTime()) / 86_400_000)
    : null

  const isAssessmentForced = daysPastDue !== null && daysPastDue >= 8
  const isAssessmentDue    = daysPastDue !== null && daysPastDue >= 0

  // Force redirect on day 8+
  if (isAssessmentForced && !isNovaAvaliacao) return <Navigate to="/aluno/nova-avaliacao" replace />

  function snoozeAssessment() {
    const today = new Date().toISOString().split('T')[0]
    localStorage.setItem('kinea-assessment-snooze', JSON.stringify({ date: today, assessmentDate: nextAssessment }))
    setAssessmentSnoozed(true)
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#C8C2B2', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 390, minHeight: '100dvh', background: '#F4EFE3', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: hideTabBar ? 0 : 68 }}>
          <Outlet />
        </div>

        {!hideTabBar && (
          <nav style={{
            position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
            width: '100%', maxWidth: 390,
            background: '#fff', borderTop: '1px solid #EDE8DC',
            display: 'flex', height: 64, zIndex: 100,
          }}>
            {TABS.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, textDecoration: 'none', position: 'relative' }}
              >
                {({ isActive }) => (
                  <>
                    {label === t('nav.chat') && (
                      <span style={{
                        position: 'absolute', top: 8, left: '50%', marginLeft: 5,
                        width: 8, height: 8, borderRadius: '50%',
                        background: '#E8542A', border: '1.5px solid #fff',
                      }} />
                    )}
                    <Icon size={22} strokeWidth={2} color={isActive ? '#E8542A' : '#C5BFB0'} />
                    <span style={{ font: `600 10px "Libre Franklin",sans-serif`, color: isActive ? '#E8542A' : '#C5BFB0' }}>
                      {label}
                    </span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        )}

        {/* Assessment reminder bottom sheet */}
        {isAssessmentDue && !isAssessmentForced && !assessmentSnoozed && !isNovaAvaliacao && daysPastDue !== null && (
          <AssessmentReminderModal
            daysPastDue={daysPastDue}
            onStart={() => navigate('/aluno/nova-avaliacao')}
            onSnooze={snoozeAssessment}
          />
        )}
      </div>
    </div>
  )
}

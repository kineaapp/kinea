import { Outlet, useLocation, NavLink, Navigate } from 'react-router-dom'
import { Home, Dumbbell, MessageCircle, Activity, User } from 'lucide-react'
import { useAuthStore } from '../../store/auth'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const TABS = [
  { to: '/aluno/home',       icon: Home,          label: 'Início'    },
  { to: '/aluno/treinos',    icon: Dumbbell,      label: 'Treinos'   },
  { to: '/aluno/chat',       icon: MessageCircle, label: 'Chat'      },
  { to: '/aluno/avaliacoes', icon: Activity,      label: 'Avaliação' },
  { to: '/aluno/perfil',     icon: User,          label: 'Perfil'    },
]

export default function AlunoLayout() {
  const { pathname } = useLocation()
  const { user } = useAuthStore()
  const [blocked, setBlocked] = useState(false)

  useEffect(() => {
    if (!user?.id) return
    supabase
      .from('students')
      .select('blocked')
      .eq('student_id', user.id)
      .maybeSingle()
      .then(({ data }) => { if (data?.blocked) setBlocked(true) })
  }, [user?.id])

  const isAnamnese          = pathname.includes('/anamnese')
  const isPrimeiraAvaliacao = pathname.includes('/primeira-avaliacao')
  const hideTabBar = pathname.includes('/exec') || pathname.includes('/pagamentos') || pathname.includes('/notificacoes') || pathname.includes('/configuracoes') || isAnamnese || isPrimeiraAvaliacao

  if (!user || user.role !== 'student') return <Navigate to="/login" replace />

  if (blocked) return (
    <div style={{ minHeight: '100dvh', background: '#C8C2B2', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 390, minHeight: '100dvh', background: '#F4EFE3', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 32px', textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#fbe6e1', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#c4421e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </div>
        <div style={{ font: '800 22px "Libre Franklin",sans-serif', color: '#1B2A4A', marginBottom: 10 }}>Acesso suspenso</div>
        <div style={{ font: '400 14px "Libre Franklin",sans-serif', color: '#7c7869', lineHeight: 1.6 }}>
          Seu acesso ao Kinea foi suspenso por falta de pagamento. Entre em contato com seu coach para regularizar sua situação.
        </div>
      </div>
    </div>
  )

  // Block going back to already completed onboarding pages
  if (isAnamnese && user.anamneseCompleted)                     return <Navigate to="/aluno/home" replace />
  if (isPrimeiraAvaliacao && user.assessmentCompleted)           return <Navigate to="/aluno/home" replace />

  // Enforce onboarding order: anamnese first, then assessment
  if (!user.anamneseCompleted && !isAnamnese)                   return <Navigate to="/aluno/anamnese" replace />
  if (user.anamneseCompleted && !user.assessmentCompleted && !isPrimeiraAvaliacao) return <Navigate to="/aluno/primeira-avaliacao" replace />

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
                    {label === 'Chat' && (
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
      </div>
    </div>
  )
}

import { Outlet, useLocation, NavLink, Navigate } from 'react-router-dom'
import { Home, Dumbbell, MessageCircle, Activity, User } from 'lucide-react'
import { useAuthStore } from '../../store/auth'

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
  const isAnamnese          = pathname.includes('/anamnese')
  const isPrimeiraAvaliacao = pathname.includes('/primeira-avaliacao')
  const hideTabBar = pathname.includes('/exec') || pathname.includes('/pagamentos') || pathname.includes('/notificacoes') || pathname.includes('/configuracoes') || isAnamnese || isPrimeiraAvaliacao

  if (!user || user.role !== 'student') return <Navigate to="/login" replace />

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

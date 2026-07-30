import { NavLink, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard, Users, BarChart2, Dumbbell,
  CreditCard, ClipboardCheck, ClipboardList, MessageCircle, Settings, LogOut, Activity,
} from 'lucide-react'
import KineaLogo from '../KineaLogo'
import { useAuthStore } from '../../store/auth'
import { useSettingsStore } from '../../store/settings'
import { useCoachChatStore } from '../../store/coachChat'
import { useCoachNotificationsStore } from '../../store/coachNotifications'

interface Props { drawerOpen: boolean; onClose: () => void }

export default function Sidebar({ drawerOpen, onClose }: Props) {
  const { t } = useTranslation()
  const { user, logout } = useAuthStore()
  const { customLogoDataUrl } = useSettingsStore()
  const navigate = useNavigate()

  const unreadRecord = useCoachChatStore(s => s.unread)
  const totalUnreadMsgs = Object.values(unreadRecord).reduce((a, n) => a + n, 0)
  const newAssessments = useCoachNotificationsStore(s => s.newAssessments)

  const NAV: { to: string; label: string; Icon: React.ElementType; badge?: 'messages' | 'assessments' }[] = [
    { to: '/coach/dashboard', label: t('nav.dashboard'),    Icon: LayoutDashboard },
    { to: '/coach/alunos',    label: t('nav.students'),     Icon: Users },
    { to: '/coach/leads',     label: t('nav.leads'),        Icon: BarChart2 },
    { to: '/coach/treinos',   label: t('nav.workouts'),     Icon: Dumbbell },
    { to: '/coach/pagamentos',label: t('nav.payments'),     Icon: CreditCard },
    { to: '/coach/avaliacoes',label: t('nav.assessments'),  Icon: ClipboardCheck, badge: 'assessments' },
    { to: '/coach/feedbacks', label: t('nav.feedbacks'),    Icon: ClipboardList },
    { to: '/coach/checkins',  label: t('nav.checkins'),     Icon: Activity },
    { to: '/coach/mensagens', label: t('nav.messages'),     Icon: MessageCircle, badge: 'messages' },
  ]

  const name     = user?.name     ?? ''
  const initials = user?.initials ?? ''
  const roleLabel = user?.role === 'super_admin' ? t('nav.role_super_admin')
                  : user?.role === 'student'      ? t('nav.role_student')
                  : t('nav.role_coach')

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <aside
      className={`k-sidebar${drawerOpen ? ' k-open' : ''}`}
      style={{
        position: 'fixed', top: 0, left: 0, bottom: 0,
        width: 240, background: '#1B2A4A',
        display: 'flex', flexDirection: 'column',
        zIndex: 40, transition: 'transform .25s ease',
      }}
    >
      {/* Logo */}
      <div style={{ padding: '22px 22px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
        {customLogoDataUrl
          ? <img src={customLogoDataUrl} alt="Logo" style={{ height: 32, maxWidth: 160, objectFit: 'contain' }} />
          : <>
              <KineaLogo width={26} height={31} />
              <span style={{ font: '600 20px "Libre Franklin",sans-serif', color: '#FAEEDA', letterSpacing: '-.5px' }}>kinea</span>
            </>
        }
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
        {NAV.map(({ to, label, Icon, badge }) => {
          const count = badge === 'messages' ? totalUnreadMsgs
            : badge === 'assessments' ? newAssessments
            : 0
          return (
            <NavLink
              key={to}
              to={to}
              end={to === '/coach/dashboard'}
              className={({ isActive }) => `k-navitem${isActive ? ' active' : ''}`}
              onClick={onClose}
            >
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Icon size={18} strokeWidth={1.9} />
                {count > 0 && (
                  <span style={{
                    position: 'absolute', top: -6, right: -8,
                    minWidth: 16, height: 16, borderRadius: 8,
                    background: '#E8542A', color: '#fff',
                    font: '700 9.5px "Libre Franklin",sans-serif',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '0 3px', lineHeight: 1,
                    border: '1.5px solid #1B2A4A',
                  }}>
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </div>
              <span>{label}</span>
            </NavLink>
          )
        })}
      </nav>

      {/* Bottom */}
      <div style={{ padding: 12, borderTop: '1px solid rgba(255,255,255,.08)' }}>
        <NavLink
          to="/coach/configuracoes"
          className={({ isActive }) => `k-navitem${isActive ? ' active' : ''}`}
          style={{ marginBottom: 6 }}
          onClick={onClose}
        >
          <Settings size={18} strokeWidth={1.9} />
          <span>{t('nav.settings')}</span>
        </NavLink>

        {/* User card */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,.05)' }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#E8542A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '700 13px "Libre Franklin",sans-serif', flexShrink: 0 }}>
            {initials}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ font: '600 13px "Libre Franklin",sans-serif', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {name}
            </div>
            <div style={{ font: '400 11px "Libre Franklin",sans-serif', color: '#8b97ad' }}>
              {roleLabel}
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            title={t('nav.logout')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: '#8b97ad' }}
          >
            <LogOut size={16} strokeWidth={2} />
          </button>
        </div>
      </div>
    </aside>
  )
}

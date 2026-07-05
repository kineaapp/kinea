import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, BarChart2, Dumbbell,
  CreditCard, ClipboardCheck, MessageCircle, Settings, LogOut,
} from 'lucide-react'
import KineaLogo from '../KineaLogo'
import { useAuthStore } from '../../store/auth'
import { useSettingsStore } from '../../store/settings'

const NAV = [
  { to: '/coach/dashboard', label: 'Dashboard',    Icon: LayoutDashboard },
  { to: '/coach/alunos',    label: 'Alunos',       Icon: Users },
  { to: '/coach/leads',     label: 'Leads',        Icon: BarChart2 },
  { to: '/coach/treinos',   label: 'Treinos',      Icon: Dumbbell },
  { to: '/coach/pagamentos',label: 'Pagamentos',   Icon: CreditCard },
  { to: '/coach/avaliacoes',label: 'Avaliações',   Icon: ClipboardCheck },
  { to: '/coach/mensagens', label: 'Mensagens',    Icon: MessageCircle },
]

interface Props { drawerOpen: boolean; onClose: () => void }

export default function Sidebar({ drawerOpen, onClose }: Props) {
  const { user, logout } = useAuthStore()
  const { customLogoDataUrl } = useSettingsStore()
  const navigate = useNavigate()

  const name     = user?.name     ?? ''
  const initials = user?.initials ?? ''
  const roleLabel = user?.role === 'super_admin' ? 'Super Admin'
                  : user?.role === 'student'      ? 'Aluno'
                  : 'Coach'

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
        {NAV.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/coach/dashboard'}
            className={({ isActive }) => `k-navitem${isActive ? ' active' : ''}`}
            onClick={onClose}
          >
            <Icon size={18} strokeWidth={1.9} />
            <span>{label}</span>
          </NavLink>
        ))}
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
          <span>Configurações</span>
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
            title="Sair"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: '#8b97ad' }}
          >
            <LogOut size={16} strokeWidth={2} />
          </button>
        </div>
      </div>
    </aside>
  )
}

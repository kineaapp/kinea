import { useNavigate } from 'react-router-dom'
import { ChevronRight, CreditCard, Bell, Settings, HelpCircle, LogOut } from 'lucide-react'
import { useAuthStore } from '../../store/auth'

const STATS = [
  { value: '18', label: 'Semanas' },
  { value: '72', label: 'Treinos' },
  { value: '94%', label: 'Frequência' },
]

const MENU = [
  { icon: CreditCard,  label: 'Pagamentos',     to: '/aluno/perfil/pagamentos', danger: false },
  { icon: Bell,        label: 'Notificações',   to: '/aluno/notificacoes',       danger: false },
  { icon: Settings,    label: 'Configurações',  to: '/aluno/configuracoes',      danger: false },
  { icon: HelpCircle,  label: 'Suporte',        to: null,                        danger: false },
  { icon: LogOut,      label: 'Sair',           to: '/login',                   danger: true  },
]

export default function Perfil() {
  const navigate = useNavigate()
  const { user }  = useAuthStore()
  const photo     = user?.photo
  const initials  = user?.initials ?? 'JM'

  return (
    <div style={{ background: '#F4EFE3', minHeight: '100%' }}>
      {/* Navy header */}
      <div style={{ background: '#1B2A4A', padding: '28px 18px 60px', textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', margin: '0 auto 12px', border: '3px solid rgba(255,255,255,.2)', overflow: 'hidden', flexShrink: 0 }}>
          {photo ? (
            <img src={photo} alt="Foto" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', background: '#E8542A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ font: `800 26px "Libre Franklin",sans-serif`, color: '#fff' }}>{initials}</span>
            </div>
          )}
        </div>
        <div style={{ font: `800 20px "Libre Franklin",sans-serif`, color: '#FAEEDA', letterSpacing: '-.4px', marginBottom: 4 }}>June Mazotini</div>
        <div style={{ font: `400 13px "Libre Franklin",sans-serif`, color: '#8B97AD', marginBottom: 12 }}>Aluna desde mar/2025</div>
        <span style={{ background: '#E8542A', borderRadius: 20, padding: '5px 14px', font: `700 11px "Libre Franklin",sans-serif`, color: '#fff' }}>
          Plano Mensal
        </span>
      </div>

      {/* Stats card — floating overlap */}
      <div style={{ margin: '0 18px', marginTop: -28 }}>
        <div style={{ background: '#fff', borderRadius: 18, padding: 18, boxShadow: '0 4px 20px rgba(27,42,74,.12)', display: 'flex' }}>
          {STATS.map(({ value, label }, i) => (
            <div key={label} style={{ flex: 1, textAlign: 'center', borderRight: i < STATS.length - 1 ? '1px solid #EDE8DC' : 'none' }}>
              <div style={{ font: `800 22px "Libre Franklin",sans-serif`, color: '#1B2A4A', marginBottom: 4 }}>{value}</div>
              <div style={{ font: `500 11px "Libre Franklin",sans-serif`, color: '#A39E90' }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Menu */}
      <div style={{ padding: '20px 18px 32px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ font: `600 11px "Libre Franklin",sans-serif`, color: '#A39E90', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>
          Minha conta
        </div>
        {MENU.map(({ icon: Icon, label, to, danger }) => (
          <button
            key={label}
            onClick={() => to && navigate(to)}
            style={{ background: '#fff', borderRadius: 14, padding: '14px 18px', border: 'none', cursor: to ? 'pointer' : 'default', boxShadow: '0 2px 8px rgba(27,42,74,.07)', display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}
          >
            <div style={{ width: 36, height: 36, borderRadius: 10, background: danger ? '#FEF0EC' : '#F4EFE3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon size={18} color={danger ? '#E8542A' : '#1B2A4A'} strokeWidth={2} />
            </div>
            <span style={{ font: `600 14px "Libre Franklin",sans-serif`, color: danger ? '#E8542A' : '#1B2A4A', flex: 1, textAlign: 'left' }}>{label}</span>
            <ChevronRight size={16} color="#C5BFB0" strokeWidth={2} />
          </button>
        ))}
      </div>
    </div>
  )
}

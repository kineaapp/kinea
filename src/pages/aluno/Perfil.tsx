import { useNavigate } from 'react-router-dom'
import { ChevronRight, CreditCard, Bell, Settings, HelpCircle, LogOut, Paperclip } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../store/auth'

const FF = '"Libre Franklin",sans-serif'

export default function Perfil() {
  const navigate     = useNavigate()
  const { t } = useTranslation()
  const { user, logout } = useAuthStore()

  const photo    = user?.photo
  const initials = user?.initials ?? '?'
  const name     = user?.name     ?? ''
  const email    = user?.email    ?? ''

  const MENU = [
    { icon: CreditCard, label: t('nav.payments'),           to: '/aluno/perfil/pagamentos', danger: false },
    { icon: Paperclip,  label: t('profile.menu_files'),     to: '/aluno/arquivos',          danger: false },
    { icon: Bell,       label: t('profile.menu_notifications'), to: '/aluno/notificacoes',  danger: false },
    { icon: Settings,   label: t('profile.menu_settings'),  to: '/aluno/configuracoes',     danger: false },
    { icon: HelpCircle, label: t('profile.menu_support'),   to: null,                       danger: false },
    { icon: LogOut,     label: t('nav.logout'),             to: null,                       danger: true  },
  ]

  function handleMenu(to: string | null, danger: boolean) {
    if (danger) { logout(); navigate('/login'); return }
    if (to) navigate(to)
  }

  return (
    <div style={{ background: '#F4EFE3', minHeight: '100%' }}>
      {/* Navy header */}
      <div style={{ background: '#1B2A4A', padding: '28px 18px 60px', textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', margin: '0 auto 12px', border: '3px solid rgba(255,255,255,.2)', overflow: 'hidden', flexShrink: 0 }}>
          {photo ? (
            <img src={photo} alt="Foto" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', background: '#E8542A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ font: `800 26px ${FF}`, color: '#fff' }}>{initials}</span>
            </div>
          )}
        </div>
        <div style={{ font: `800 20px ${FF}`, color: '#FAEEDA', letterSpacing: '-.4px', marginBottom: 4 }}>{name}</div>
        <div style={{ font: `400 13px ${FF}`, color: '#8B97AD' }}>{email}</div>
      </div>

      {/* Floating card */}
      <div style={{ margin: '0 18px', marginTop: -28 }}>
        <div style={{ background: '#fff', borderRadius: 18, padding: '16px 18px', boxShadow: '0 4px 20px rgba(27,42,74,.12)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#e7f3ea', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#1B7a4a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <div>
              <div style={{ font: `700 13px ${FF}`, color: '#1B2A4A' }}>{t('profile.complete')}</div>
              <div style={{ font: `400 11.5px ${FF}`, color: '#9a948a', marginTop: 1 }}>{t('profile.complete_desc')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Menu */}
      <div style={{ padding: '20px 18px 32px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ font: `600 11px ${FF}`, color: '#A39E90', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>
          {t('profile.my_account')}
        </div>
        {MENU.map(({ icon: Icon, label, to, danger }) => (
          <button
            key={label}
            onClick={() => handleMenu(to, danger)}
            style={{ background: '#fff', borderRadius: 14, padding: '14px 18px', border: 'none', cursor: (to || danger) ? 'pointer' : 'default', boxShadow: '0 2px 8px rgba(27,42,74,.07)', display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}
          >
            <div style={{ width: 36, height: 36, borderRadius: 10, background: danger ? '#FEF0EC' : '#F4EFE3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon size={18} color={danger ? '#E8542A' : '#1B2A4A'} strokeWidth={2} />
            </div>
            <span style={{ font: `600 14px ${FF}`, color: danger ? '#E8542A' : '#1B2A4A', flex: 1, textAlign: 'left' }}>{label}</span>
            <ChevronRight size={16} color="#C5BFB0" strokeWidth={2} />
          </button>
        ))}
      </div>
    </div>
  )
}

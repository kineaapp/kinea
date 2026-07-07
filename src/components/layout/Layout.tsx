import { useState, useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import KineaLogo from '../KineaLogo'
import { useNotificationBanner } from '../../hooks/useNotifications'
import { useSettingsStore } from '../../store/settings'
import { useAuthStore } from '../../store/auth'
import { supabase } from '../../lib/supabase'

const FF = '"Libre Franklin",sans-serif'

function NotifBanner({ onActivate, onDismiss }: { onActivate: () => void; onDismiss: () => void }) {
  return (
    <div style={{
      background: '#1B2A4A',
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '12px 22px',
      borderBottom: '1px solid rgba(255,255,255,.08)',
    }}>
      {/* Bell icon */}
      <div style={{ flexShrink: 0, opacity: .85 }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FAEEDA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ font: `600 13px ${FF}`, color: '#FAEEDA' }}>
          Ative as notificações do navegador
        </span>
        <span style={{ font: `400 12px ${FF}`, color: '#8b97ad', marginLeft: 8 }}>
          Receba alertas de mensagens, pagamentos vencidos, reavaliações e check-ins.
        </span>
      </div>

      <button
        type="button"
        onClick={onActivate}
        style={{
          flexShrink: 0,
          height: 34, padding: '0 16px',
          border: 'none', background: '#E8542A', color: '#fff',
          borderRadius: 8, font: `700 12.5px ${FF}`,
          cursor: 'pointer', boxShadow: '0 2px 0 #c4421e',
          whiteSpace: 'nowrap',
        }}
      >
        Ativar notificações
      </button>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Fechar"
        style={{
          flexShrink: 0,
          border: 'none', background: 'none',
          cursor: 'pointer', color: '#8b97ad', padding: 4,
          display: 'flex', alignItems: 'center',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M18 6L6 18"/><path d="M6 6l12 12"/>
        </svg>
      </button>
    </div>
  )
}

export default function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { showBanner, requestPermission, dismiss } = useNotificationBanner()
  const { customLogoDataUrl } = useSettingsStore()
  const { logout } = useAuthStore()
  const navigate = useNavigate()

  // Guard: if the Supabase session doesn't match the stored user (e.g. after
  // signing up as a student in the same browser), force re-login immediately
  // instead of silently showing blank pages due to RLS returning empty rows.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const storedUser = useAuthStore.getState().user
      if (!storedUser) { navigate('/login', { replace: true }); return }
      if (!session || session.user.id !== storedUser.id) {
        logout()
        navigate('/login', { replace: true })
      }
    })
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: '#F4EFE3' }}>
      <Sidebar drawerOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* Mobile overlay */}
      {drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(20,25,40,.45)', zIndex: 35 }}
        />
      )}

      <div className="k-main" style={{ marginLeft: 240, minHeight: '100vh' }}>
        {/* Mobile top bar */}
        <div
          className="k-mobilebar"
          style={{ display: 'none', alignItems: 'center', gap: 12, padding: '14px 18px', background: '#1B2A4A', position: 'sticky', top: 0, zIndex: 30 }}
        >
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Abrir menu"
            style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FAEEDA" strokeWidth="2" strokeLinecap="round">
              <path d="M3 12h18" /><path d="M3 6h18" /><path d="M3 18h18" />
            </svg>
          </button>
          {customLogoDataUrl
            ? <img src={customLogoDataUrl} alt="Logo" style={{ height: 26, maxWidth: 120, objectFit: 'contain' }} />
            : <>
                <KineaLogo width={22} height={26} />
                <span style={{ font: '600 18px "Libre Franklin",sans-serif', color: '#FAEEDA', letterSpacing: '-.5px' }}>kinea</span>
              </>
          }
        </div>

        {/* Notification permission banner */}
        {showBanner && (
          <NotifBanner
            onActivate={requestPermission}
            onDismiss={dismiss}
          />
        )}

        <Outlet />
      </div>
    </div>
  )
}

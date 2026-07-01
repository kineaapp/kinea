import { useNavigate } from 'react-router-dom'
import { ChevronLeft, MessageCircle, CreditCard, Activity, ClipboardList, Bell, BellOff, Smartphone } from 'lucide-react'
import { useAlunoNotifications, type NotifCategory } from '../../hooks/useAlunoNotifications'

const CATEGORIES: { key: NotifCategory; icon: React.ElementType; label: string; desc: string }[] = [
  { key: 'mensagens',  icon: MessageCircle,  label: 'Mensagens do coach',    desc: 'Quando o coach enviar uma nova mensagem' },
  { key: 'pagamentos', icon: CreditCard,      label: 'Pagamentos vencidos',   desc: 'Mensalidades próximas ou em atraso' },
  { key: 'avaliacoes', icon: Activity,        label: 'Avaliação pendente',    desc: 'Lembrete após longo período sem avaliar' },
  { key: 'checkins',   icon: ClipboardList,   label: 'Check-ins semanais',    desc: 'Aviso para enviar o check-in da semana' },
]

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      style={{
        width: 46, height: 26, borderRadius: 13,
        background: disabled ? '#E0D9CC' : on ? '#E8542A' : '#D6CFBE',
        border: 'none', cursor: disabled ? 'default' : 'pointer',
        position: 'relative', flexShrink: 0, padding: 0,
        transition: 'background .2s',
        opacity: disabled ? .5 : 1,
      }}
    >
      <span style={{
        position: 'absolute', top: 3,
        left: on && !disabled ? 23 : 3,
        width: 20, height: 20, borderRadius: '50%',
        background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.22)',
        transition: 'left .18s', display: 'block',
      }} />
    </button>
  )
}

export default function Notificacoes() {
  const navigate = useNavigate()
  const { permission, isSupported, needsInstall, requesting, prefs, requestPermission, toggleCategory } = useAlunoNotifications()

  const granted = permission === 'granted'
  const denied  = permission === 'denied'

  return (
    <div style={{ background: '#F4EFE3', minHeight: '100%', paddingBottom: 32 }}>
      {/* Header */}
      <div style={{ padding: '18px 20px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={() => navigate(-1)}
          style={{ width: 36, height: 36, borderRadius: 10, background: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(27,42,74,.1)', flexShrink: 0 }}
        >
          <ChevronLeft size={20} color="#1B2A4A" strokeWidth={2.5} />
        </button>
        <h1 style={{ font: `800 18px "Libre Franklin",sans-serif`, color: '#1B2A4A', margin: 0, letterSpacing: '-.3px' }}>
          Notificações
        </h1>
      </div>

      <div style={{ padding: '0 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* iOS install tip */}
        {needsInstall && (
          <div style={{ background: '#1B2A4A', borderRadius: 16, padding: '16px 18px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
              <Smartphone size={18} color="#FAEEDA" strokeWidth={2} />
            </div>
            <div>
              <div style={{ font: `700 13px "Libre Franklin",sans-serif`, color: '#FAEEDA', marginBottom: 5 }}>
                Adicione à Tela de Início
              </div>
              <div style={{ font: `400 12px "Libre Franklin",sans-serif`, color: '#8B97AD', lineHeight: 1.5 }}>
                Para receber notificações no iPhone, abra no Safari, toque em <strong style={{ color: '#FAEEDA' }}>Compartilhar →</strong> e depois em <strong style={{ color: '#FAEEDA' }}>Adicionar à Tela de Início</strong>.
              </div>
            </div>
          </div>
        )}

        {/* Permission status card */}
        {!isSupported ? (
          <div style={{ background: '#fff', borderRadius: 16, padding: '18px', display: 'flex', gap: 14, alignItems: 'center', boxShadow: '0 2px 8px rgba(27,42,74,.07)' }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: '#F4EFE3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <BellOff size={20} color="#A39E90" strokeWidth={2} />
            </div>
            <div>
              <div style={{ font: `700 13.5px "Libre Franklin",sans-serif`, color: '#1B2A4A', marginBottom: 3 }}>Não suportado</div>
              <div style={{ font: `400 12px "Libre Franklin",sans-serif`, color: '#7C7869' }}>Seu navegador não suporta notificações.</div>
            </div>
          </div>
        ) : denied ? (
          <div style={{ background: '#fff', borderRadius: 16, padding: '18px', display: 'flex', gap: 14, alignItems: 'flex-start', boxShadow: '0 2px 8px rgba(27,42,74,.07)' }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: '#FEF0EC', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
              <BellOff size={20} color="#E8542A" strokeWidth={2} />
            </div>
            <div>
              <div style={{ font: `700 13.5px "Libre Franklin",sans-serif`, color: '#1B2A4A', marginBottom: 4 }}>Notificações bloqueadas</div>
              <div style={{ font: `400 12px "Libre Franklin",sans-serif`, color: '#7C7869', lineHeight: 1.5 }}>
                Vá em <strong>Configurações do navegador → Notificações</strong> e permita o acesso para o Kinea.
              </div>
            </div>
          </div>
        ) : !granted ? (
          <div style={{ background: '#1B2A4A', borderRadius: 16, padding: '18px', boxShadow: '0 4px 16px rgba(27,42,74,.18)' }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(232,84,42,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Bell size={20} color="#E8542A" strokeWidth={2} />
              </div>
              <div>
                <div style={{ font: `700 14px "Libre Franklin",sans-serif`, color: '#FAEEDA', marginBottom: 3 }}>Ativar notificações</div>
                <div style={{ font: `400 12px "Libre Franklin",sans-serif`, color: '#8B97AD' }}>Fique por dentro de tudo sem abrir o app.</div>
              </div>
            </div>
            <button
              onClick={requestPermission}
              disabled={requesting}
              style={{ width: '100%', padding: '13px 0', borderRadius: 12, background: '#E8542A', border: 'none', cursor: requesting ? 'default' : 'pointer', font: `700 14px "Libre Franklin",sans-serif`, color: '#fff', opacity: requesting ? .7 : 1, transition: 'opacity .15s' }}
            >
              {requesting ? 'Aguardando permissão…' : 'Permitir notificações'}
            </button>
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 16, padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'center', boxShadow: '0 2px 8px rgba(27,42,74,.07)' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4CAF8A', flexShrink: 0 }} />
            <span style={{ font: `600 13px "Libre Franklin",sans-serif`, color: '#1B2A4A' }}>Notificações ativas</span>
          </div>
        )}

        {/* Category toggles */}
        <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 8px rgba(27,42,74,.07)' }}>
          <div style={{ padding: '12px 18px 8px', font: `600 11px "Libre Franklin",sans-serif`, color: '#A39E90', textTransform: 'uppercase', letterSpacing: '.5px' }}>
            Alertas
          </div>
          {CATEGORIES.map(({ key, icon: Icon, label, desc }, idx) => (
            <div key={key}>
              {idx > 0 && <div style={{ height: 1, background: '#F4EFE3', margin: '0 18px' }} />}
              <div
                style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, cursor: granted ? 'pointer' : 'default' }}
                onClick={() => granted && toggleCategory(key)}
              >
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#F4EFE3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={17} color={granted && prefs[key] ? '#E8542A' : '#1B2A4A'} strokeWidth={2} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: `600 13.5px "Libre Franklin",sans-serif`, color: '#1B2A4A', marginBottom: 2 }}>{label}</div>
                  <div style={{ font: `400 11.5px "Libre Franklin",sans-serif`, color: '#A39E90' }}>{desc}</div>
                </div>
                <Toggle on={!!prefs[key]} onChange={() => toggleCategory(key)} disabled={!granted} />
              </div>
            </div>
          ))}
        </div>

        {granted && (
          <p style={{ font: `400 11.5px "Libre Franklin",sans-serif`, color: '#A39E90', textAlign: 'center', margin: '4px 0 0', lineHeight: 1.5 }}>
            Uma notificação de exemplo é enviada ao ativar cada alerta.
          </p>
        )}
      </div>
    </div>
  )
}

import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import { useSettingsStore } from '../../store/settings'
import KineaLogo from '../../components/KineaLogo'

const FF = '"Libre Franklin",sans-serif'

// ── Toggle switch ──────────────────────────────────────────────────────────────
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      style={{ width: 44, height: 24, borderRadius: 12, border: 'none', background: on ? '#E8542A' : '#d8d1c0', cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background .2s' }}
    >
      <span style={{ position: 'absolute', top: 3, left: on ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)', transition: 'left .2s' }} />
    </button>
  )
}

// ── Section card ───────────────────────────────────────────────────────────────
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ padding: '16px 22px', borderBottom: '1px solid #f4efe3' }}>
        <h2 style={{ font: `700 14px ${FF}`, color: '#1B2A4A', margin: 0, letterSpacing: '-.2px' }}>{title}</h2>
      </div>
      <div style={{ padding: '20px 22px' }}>{children}</div>
    </div>
  )
}

// ── Field wrapper ──────────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', font: `600 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase' as const, color: '#6b6657', marginBottom: 7 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function Input({ value, onChange, type = 'text', placeholder, readOnly }: { value: string; onChange?: (v: string) => void; type?: string; placeholder?: string; readOnly?: boolean }) {
  return (
    <input
      value={value}
      onChange={e => onChange?.(e.target.value)}
      type={type}
      placeholder={placeholder}
      readOnly={readOnly}
      style={{ width: '100%', height: 44, border: `1.5px solid ${readOnly ? '#ece7d9' : '#d9d3c4'}`, borderRadius: 10, background: readOnly ? '#faf7ee' : '#fff', padding: '0 14px', font: `400 14px ${FF}`, color: readOnly ? '#9a948a' : '#1B2A4A', outline: 'none', boxSizing: 'border-box' as const }}
    />
  )
}

// ── Toast ──────────────────────────────────────────────────────────────────────
function Toast({ msg }: { msg: string }) {
  if (!msg) return null
  return (
    <div style={{ position: 'fixed', left: '50%', bottom: 28, transform: 'translateX(-50%)', zIndex: 80, background: '#1B2A4A', color: '#FAEEDA', font: `600 13.5px ${FF}`, padding: '13px 20px', borderRadius: 11, boxShadow: '0 10px 30px rgba(0,0,0,.28)', whiteSpace: 'nowrap' }}>
      {msg}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function Configuracoes() {
  const { user, setUser, logout } = useAuthStore()
  const navigate = useNavigate()
  const [toast, setToast] = useState('')
  const toastRef = useRef<ReturnType<typeof setTimeout>>()

  // Profile
  const [name, setName] = useState(user?.name ?? 'Rafael Dias')
  const [specialty, setSpecialty] = useState('Musculação e Emagrecimento')
  const [bio, setBio] = useState('Coach certificado com 8 anos de experiência. Especialista em emagrecimento funcional e hipertrofia.')

  // Notifications
  const [notif, setNotif] = useState({
    messages: true,
    payments: true,
    reassessments: true,
    checkins: false,
  })

  // Logo
  const { customLogoDataUrl, setCustomLogo } = useSettingsStore()
  const logoInputRef = useRef<HTMLInputElement>(null)

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => { setCustomLogo(reader.result as string); showToast('Logotipo atualizado.') }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  // Security
  const [passFields, setPassFields] = useState({ current: '', next: '', confirm: '' })

  function showToast(msg: string) {
    setToast(msg)
    clearTimeout(toastRef.current)
    toastRef.current = setTimeout(() => setToast(''), 2000)
  }

  function saveProfile() {
    const trimmed = name.trim()
    if (!trimmed) { showToast('Informe seu nome.'); return }
    if (user) {
      const parts = trimmed.trim().split(/\s+/)
      const initials = ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase()
      setUser({ ...user, name: trimmed, initials })
    }
    showToast('Perfil atualizado com sucesso.')
  }

  function savePassword() {
    if (!passFields.current) { showToast('Informe a senha atual.'); return }
    if (passFields.next.length < 6) { showToast('A nova senha precisa ter pelo menos 6 caracteres.'); return }
    if (passFields.next !== passFields.confirm) { showToast('As senhas não coincidem.'); return }
    setPassFields({ current: '', next: '', confirm: '' })
    showToast('Senha alterada com sucesso.')
  }

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  const initials = (() => {
    const p = name.trim().split(/\s+/)
    return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase()
  })()

  return (
    <div style={{ padding: '30px 34px 60px', maxWidth: 720 }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ font: `800 27px ${FF}`, color: '#1B2A4A', margin: 0, letterSpacing: '-.6px' }}>Configurações</h1>
        <p style={{ font: `400 14px ${FF}`, color: '#7c7869', margin: '4px 0 0' }}>Gerencie seu perfil, notificações e segurança</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Identidade visual ── */}
        <Card title="Identidade visual">
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ width: 88, height: 60, border: '1.5px solid #ece7d9', borderRadius: 12, background: '#faf7ee', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden', padding: 8 }}>
              {customLogoDataUrl
                ? <img src={customLogoDataUrl} alt="Logo personalizado" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                : <KineaLogo width={24} height={29} />
              }
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ font: `600 14px ${FF}`, color: '#1B2A4A', marginBottom: 2 }}>
                {customLogoDataUrl ? 'Logotipo personalizado' : 'Logotipo padrão (Kinea)'}
              </div>
              <div style={{ font: `400 12.5px ${FF}`, color: '#9a948a', marginBottom: 12 }}>
                Substitua pelo logotipo da sua consultoria. Recomendado: PNG ou SVG com fundo transparente.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input ref={logoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} />
                <button
                  onClick={() => logoInputRef.current?.click()}
                  style={{ height: 36, padding: '0 16px', border: '1.5px solid #d9d3c4', background: '#fff', color: '#1B2A4A', borderRadius: 8, font: `600 12.5px ${FF}`, cursor: 'pointer' }}
                >
                  {customLogoDataUrl ? 'Alterar logotipo' : 'Enviar logotipo'}
                </button>
                {customLogoDataUrl && (
                  <button
                    onClick={() => { setCustomLogo(null); showToast('Logotipo removido.') }}
                    style={{ height: 36, padding: '0 16px', border: '1.5px solid #e8c5bb', background: '#fef5f3', color: '#c4421e', borderRadius: 8, font: `600 12.5px ${FF}`, cursor: 'pointer' }}
                  >
                    Remover
                  </button>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* ── Perfil ── */}
        <Card title="Perfil do coach">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Avatar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 4 }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#E8542A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', font: `700 22px ${FF}`, flexShrink: 0 }}>
                {initials}
              </div>
              <div>
                <div style={{ font: `700 14.5px ${FF}`, color: '#1B2A4A', marginBottom: 4 }}>{name || 'Coach'}</div>
                <button
                  onClick={() => showToast('Em breve.')}
                  style={{ border: '1.5px solid #d9d3c4', background: '#fff', color: '#6b6657', font: `600 12px ${FF}`, borderRadius: 8, padding: '6px 14px', cursor: 'pointer' }}
                >
                  Alterar foto
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Field label="Nome completo">
                <Input value={name} onChange={setName} placeholder="Seu nome" />
              </Field>
              <Field label="E-mail">
                <Input value={user?.email ?? 'coach@kinea.app'} readOnly />
              </Field>
            </div>

            <Field label="Especialidade">
              <Input value={specialty} onChange={setSpecialty} placeholder="Ex: Musculação e Emagrecimento" />
            </Field>

            <Field label="Bio">
              <textarea
                value={bio}
                onChange={e => setBio(e.target.value)}
                rows={3}
                placeholder="Breve descrição sobre você e sua metodologia"
                style={{ width: '100%', border: '1.5px solid #d9d3c4', borderRadius: 10, background: '#fff', padding: '11px 14px', font: `400 14px ${FF}`, color: '#1B2A4A', outline: 'none', resize: 'vertical' as const, boxSizing: 'border-box' as const, lineHeight: 1.5 }}
              />
            </Field>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={saveProfile}
                style={{ height: 42, padding: '0 22px', border: 'none', background: '#E8542A', color: '#fff', borderRadius: 10, font: `700 13.5px ${FF}`, cursor: 'pointer', boxShadow: '0 2px 0 #c4421e' }}
              >
                Salvar perfil
              </button>
            </div>
          </div>
        </Card>

        {/* ── Notificações ── */}
        <Card title="Notificações">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {([
              { key: 'messages',      label: 'Novas mensagens de alunos',    desc: 'Receba alertas quando um aluno enviar uma mensagem' },
              { key: 'payments',      label: 'Pagamentos vencidos',           desc: 'Alertas automáticos sobre cobranças em atraso' },
              { key: 'reassessments', label: 'Reavaliações pendentes',        desc: 'Lembrete quando um aluno precisar de reavaliação' },
              { key: 'checkins',      label: 'Check-ins semanais',            desc: 'Notificação quando alunos enviarem check-in' },
            ] as const).map((item, idx, arr) => (
              <div
                key={item.key}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '14px 0', borderBottom: idx < arr.length - 1 ? '1px solid #f4efe3' : 'none' }}
              >
                <div>
                  <div style={{ font: `600 14px ${FF}`, color: '#1B2A4A', marginBottom: 2 }}>{item.label}</div>
                  <div style={{ font: `400 12.5px ${FF}`, color: '#9a948a' }}>{item.desc}</div>
                </div>
                <Toggle on={notif[item.key]} onChange={v => setNotif(n => ({ ...n, [item.key]: v }))} />
              </div>
            ))}
          </div>
        </Card>

        {/* ── Segurança ── */}
        <Card title="Segurança">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Senha atual">
              <Input value={passFields.current} onChange={v => setPassFields(p => ({ ...p, current: v }))} type="password" placeholder="••••••••" />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Field label="Nova senha">
                <Input value={passFields.next} onChange={v => setPassFields(p => ({ ...p, next: v }))} type="password" placeholder="Mín. 6 caracteres" />
              </Field>
              <Field label="Confirmar nova senha">
                <Input value={passFields.confirm} onChange={v => setPassFields(p => ({ ...p, confirm: v }))} type="password" placeholder="Repita a senha" />
              </Field>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={savePassword}
                style={{ height: 42, padding: '0 22px', border: '1.5px solid #d9d3c4', background: '#fff', color: '#1B2A4A', borderRadius: 10, font: `700 13.5px ${FF}`, cursor: 'pointer' }}
              >
                Alterar senha
              </button>
            </div>
          </div>
        </Card>

        {/* ── Conta ── */}
        <Card title="Conta">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' as const, gap: 12 }}>
            <div>
              <div style={{ font: `600 14px ${FF}`, color: '#1B2A4A', marginBottom: 2 }}>Sair da conta</div>
              <div style={{ font: `400 12.5px ${FF}`, color: '#9a948a' }}>Você será redirecionado para a tela de login</div>
            </div>
            <button
              onClick={handleLogout}
              style={{ height: 42, padding: '0 22px', border: '1.5px solid #e8c5bb', background: '#fef5f3', color: '#c4421e', borderRadius: 10, font: `700 13.5px ${FF}`, cursor: 'pointer' }}
            >
              Sair da conta
            </button>
          </div>
        </Card>

      </div>

      <Toast msg={toast} />
    </div>
  )
}

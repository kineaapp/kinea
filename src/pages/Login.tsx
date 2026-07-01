import { useState, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import KineaLogo from '../components/KineaLogo'
import { useAuthStore } from '../store/auth'
import { useSettingsStore } from '../store/settings'

// ── Demo accounts ──────────────────────────────────────────
const ACCOUNTS: Record<string, { pass: string; name: string; role: 'coach' | 'student' | 'super_admin'; route: string; first: boolean }> = {
  'coach@kinea.app':  { pass: 'coach123',  name: 'Rafael Dias', role: 'coach',       route: '/coach/dashboard', first: false },
  'aluno@kinea.app':  { pass: 'aluno123',  name: 'June',        role: 'student',     route: '/aluno/home',      first: false },
  'novato@kinea.app': { pass: 'novato123', name: 'Lucas',       role: 'student',     route: '/aluno/anamnese',  first: true  },
  'admin@kinea.app':  { pass: 'admin123',  name: 'Admin',       role: 'super_admin', route: '/coach/dashboard', first: false },
}

const ROLE_LABEL: Record<string, string> = {
  coach: 'Coach', student: 'Aluno', super_admin: 'Super Admin',
}

// ── Shared styles ──────────────────────────────────────────
const FF = '"Libre Franklin",sans-serif'

const inputStyle: CSSProperties = {
  width: '100%', height: 48,
  border: '1.5px solid #d9d3c4', borderRadius: 11,
  background: '#fff', padding: '0 15px',
  font: `400 15px ${FF}`, color: '#1B2A4A',
  outline: 'none', transition: 'border-color .15s, box-shadow .15s',
}

const btnPrimary: CSSProperties = {
  width: '100%', height: 50, border: 'none',
  borderRadius: 11, background: '#E8542A', color: '#fff',
  font: `700 15px ${FF}`, cursor: 'pointer',
  boxShadow: '0 2px 0 #c4421e',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
  transition: 'background .15s',
}

const labelStyle: CSSProperties = {
  display: 'block', font: `600 11px ${FF}`,
  letterSpacing: '.5px', textTransform: 'uppercase',
  color: '#6b6657', marginBottom: 7,
}

// ── Component ──────────────────────────────────────────────
type View = 'login' | 'forgot' | 'sent' | 'invite' | 'success'

interface SuccessData { name: string; roleLabel: string; route: string; first: boolean }

export default function Login() {
  const navigate  = useNavigate()
  const { setUser } = useAuthStore()
  const { customLogoDataUrl } = useSettingsStore()

  const [view,         setView]         = useState<View>('login')
  const [email,        setEmail]        = useState('')
  const [password,     setPassword]     = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember,     setRemember]     = useState(true)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')
  const [forgotEmail,  setForgotEmail]  = useState('')
  const [forgotError,  setForgotError]  = useState('')
  const [success,      setSuccess]      = useState<SuccessData | null>(null)
  const [hovBtn,       setHovBtn]       = useState(false)

  const validEmail = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)

  // Auto-navigate after success animation
  useEffect(() => {
    if (view !== 'success' || !success) return
    const t = setTimeout(() => {
      setUser({
        email,
        name: success.name,
        role: ACCOUNTS[email]?.role ?? 'coach',
        initials: success.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
      })
      navigate(success.route)
    }, 2000)
    return () => clearTimeout(t)
  }, [view, success])

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const em = email.trim().toLowerCase()
    if (!em)              return setError('Informe seu e-mail.')
    if (!validEmail(em))  return setError('Digite um e-mail válido.')
    if (!password)        return setError('Informe sua senha.')
    setError(''); setLoading(true)
    setTimeout(() => {
      const acc = ACCOUNTS[em]
      if (!acc || acc.pass !== password) {
        setLoading(false); setError('E-mail ou senha incorretos.')
        return
      }
      setLoading(false)
      setSuccess({ name: acc.name, roleLabel: ROLE_LABEL[acc.role] ?? 'Coach', route: acc.route, first: acc.first })
      setView('success')
    }, 850)
  }

  function onSubmitForgot(e: React.FormEvent) {
    e.preventDefault()
    const v = forgotEmail.trim().toLowerCase()
    if (!v || !validEmail(v)) return setForgotError('Digite um e-mail válido.')
    setView('sent')
  }

  function fillAccount(em: string) {
    setEmail(em); setPassword(ACCOUNTS[em]?.pass ?? ''); setError('')
  }

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="k-split" style={{ display: 'flex', flexDirection: 'row', minHeight: '100vh', background: '#FAEEDA' }}>

      {/* ── Brand panel ─────────────────────────────────────── */}
      <div
        className="k-brand"
        style={{ width: '46%', background: '#1B2A4A', color: '#FAEEDA', padding: '52px 56px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', overflow: 'hidden' }}
      >
        {/* Watermark motif */}
        <div className="k-brand-motif" style={{ position: 'absolute', right: -90, bottom: -70, opacity: .07, transform: 'rotate(-8deg)', pointerEvents: 'none' }}>
          <KineaLogo width={440} height={532} />
        </div>

        {/* Logo row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, position: 'relative' }}>
          {customLogoDataUrl
            ? <img src={customLogoDataUrl} alt="Logo" style={{ height: 36, maxWidth: 180, objectFit: 'contain' }} />
            : <>
                <KineaLogo width={30} height={36} />
                <span style={{ font: `600 23px ${FF}`, color: '#FAEEDA', letterSpacing: '-.5px' }}>kinea</span>
              </>
          }
        </div>

        {/* Headline */}
        <div className="k-brand-mid" style={{ position: 'relative' }}>
          <h1 className="k-login-head" style={{ font: `800 42px/1.08 ${FF}`, color: '#fff', margin: 0, letterSpacing: '-1px' }}>
            Treine.<br />Acompanhe.<br />Evolua.
          </h1>
          <p className="k-login-sub" style={{ font: `400 15px/1.55 ${FF}`, color: '#9fb0cc', margin: '14px 0 0', maxWidth: 300 }}>
            A plataforma que conecta você ao seu coach — treinos e evolução num só lugar.
          </p>
        </div>

        {/* Feature bullets */}
        <div className="k-brand-foot" style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 13 }}>
          {['Treinos montados pelo seu coach', 'Acompanhamento de avaliações e progresso', 'Comunicação direta, sem ruído'].map(t => (
            <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#E8542A', flexShrink: 0 }} />
              <span style={{ font: `400 14px ${FF}`, color: '#c7d2e3' }}>{t}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Form panel ──────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 40px', background: '#FAEEDA' }}>
        <div className="k-formwrap" style={{ width: '100%', maxWidth: 392 }}>

          {/* ── LOGIN VIEW ─────────────────────────────────── */}
          {view === 'login' && (
            <div>
              <h2 style={{ font: `800 27px ${FF}`, color: '#1B2A4A', margin: '0 0 4px', letterSpacing: '-.5px' }}>Bem-vindo de volta</h2>
              <p style={{ font: `400 14px ${FF}`, color: '#7c7869', margin: '0 0 26px' }}>Entre com seus dados para continuar.</p>

              <form onSubmit={onSubmit}>
                <div style={{ marginBottom: 15 }}>
                  <label style={labelStyle}>E-mail</label>
                  <input
                    type="email" autoComplete="email" placeholder="voce@email.com"
                    value={email} onChange={e => { setEmail(e.target.value); setError('') }}
                    className="k-input" style={inputStyle}
                  />
                </div>

                <div style={{ marginBottom: 13 }}>
                  <label style={labelStyle}>Senha</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="••••••••"
                      value={password} onChange={e => { setPassword(e.target.value); setError('') }}
                      className="k-input" style={{ ...inputStyle, padding: '0 46px 0 15px' }}
                    />
                    <button
                      type="button" onClick={() => setShowPassword(v => !v)} aria-label="Mostrar senha"
                      style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', width: 36, height: 36, border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9a958a', borderRadius: 8 }}
                    >
                      {showPassword ? '🙈' : '👁'}
                    </button>
                  </div>
                </div>

                {error && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fdeee9', border: '1px solid #f6cdbf', borderRadius: 9, padding: '10px 12px', marginBottom: 14 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E8542A" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v6" /><path d="M12 16.5v.5" /></svg>
                    <span style={{ font: `500 13px ${FF}`, color: '#c4421e' }}>{error}</span>
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', userSelect: 'none' }}>
                    <input type="checkbox" checked={remember} onChange={() => setRemember(v => !v)} style={{ width: 16, height: 16, accentColor: '#E8542A', cursor: 'pointer' }} />
                    <span style={{ font: `400 13px ${FF}`, color: '#6b6657' }}>Lembrar de mim</span>
                  </label>
                  <button type="button" onClick={() => { setView('forgot'); setForgotEmail(email); setForgotError('') }} style={{ border: 'none', background: 'none', cursor: 'pointer', font: `600 13px ${FF}`, color: '#1B2A4A', padding: 0 }}>
                    Esqueci a senha
                  </button>
                </div>

                <button
                  type="submit" disabled={loading}
                  onMouseEnter={() => setHovBtn(true)} onMouseLeave={() => setHovBtn(false)}
                  style={{ ...btnPrimary, background: hovBtn && !loading ? '#d4471f' : '#E8542A', opacity: loading ? .85 : 1 }}
                >
                  {loading
                    ? <span style={{ width: 17, height: 17, border: '2.4px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'kspin .7s linear infinite' }} />
                    : <span>Entrar →</span>
                  }
                </button>
              </form>

              {/* Demo accounts */}
              <div style={{ marginTop: 22, border: '1px dashed #d2ccbb', borderRadius: 12, padding: '13px 14px', background: '#fbf7ec' }}>
                <div style={{ font: `600 10px ${FF}`, letterSpacing: '.6px', textTransform: 'uppercase', color: '#9a948a', marginBottom: 9 }}>
                  Contas de demonstração — clique para entrar
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {[
                    { em: 'coach@kinea.app',  label: 'Coach',      color: '#1B2A4A', bg: '#eef1f6' },
                    { em: 'aluno@kinea.app',  label: 'Aluno',      color: '#1B7a4a', bg: '#e7f3ea' },
                    { em: 'novato@kinea.app', label: '1º acesso',  color: '#b06a12', bg: '#f7ecd9' },
                    { em: 'admin@kinea.app',  label: 'Super Admin',color: '#5a4ea0', bg: '#eceaf6' },
                  ].map(({ em, label, color, bg }) => (
                    <button
                      key={em} type="button" onClick={() => fillAccount(em)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', border: '1px solid #e7e0cf', background: '#fff', borderRadius: 9, padding: '9px 11px', cursor: 'pointer', textAlign: 'left' }}
                    >
                      <span style={{ font: `600 13px ${FF}`, color: '#1B2A4A' }}>{em}</span>
                      <span style={{ font: `600 10px ${FF}`, color, background: bg, borderRadius: 20, padding: '3px 9px' }}>{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ textAlign: 'center', marginTop: 22, font: `400 13px ${FF}`, color: '#7c7869' }}>
                Tem um convite do seu coach?{' '}
                <button type="button" onClick={() => setView('invite')} style={{ border: 'none', background: 'none', cursor: 'pointer', font: `700 13px ${FF}`, color: '#E8542A', padding: 0 }}>
                  Criar conta
                </button>
              </div>
            </div>
          )}

          {/* ── FORGOT VIEW ────────────────────────────────── */}
          {view === 'forgot' && (
            <div>
              <button type="button" onClick={() => setView('login')} style={{ display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: 'none', cursor: 'pointer', font: `600 13px ${FF}`, color: '#7c7869', padding: 0, marginBottom: 20 }}>
                ← Voltar ao login
              </button>
              <h2 style={{ font: `800 26px ${FF}`, color: '#1B2A4A', margin: '0 0 4px', letterSpacing: '-.5px' }}>Recuperar acesso</h2>
              <p style={{ font: `400 14px/1.5 ${FF}`, color: '#7c7869', margin: '0 0 24px' }}>
                Informe seu e-mail e enviaremos um link para você redefinir a senha.
              </p>
              <form onSubmit={onSubmitForgot}>
                <div style={{ marginBottom: 15 }}>
                  <label style={labelStyle}>E-mail</label>
                  <input
                    type="email" placeholder="voce@email.com"
                    value={forgotEmail} onChange={e => { setForgotEmail(e.target.value); setForgotError('') }}
                    className="k-input" style={inputStyle}
                  />
                </div>
                {forgotError && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fdeee9', border: '1px solid #f6cdbf', borderRadius: 9, padding: '10px 12px', marginBottom: 14 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E8542A" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v6" /><path d="M12 16.5v.5" /></svg>
                    <span style={{ font: `500 13px ${FF}`, color: '#c4421e' }}>{forgotError}</span>
                  </div>
                )}
                <button type="submit" style={btnPrimary}>Enviar link</button>
              </form>
            </div>
          )}

          {/* ── SENT VIEW ──────────────────────────────────── */}
          {view === 'sent' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 62, height: 62, borderRadius: '50%', background: '#e7f3ea', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1B7a4a" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 7l-10 7L2 7" /><rect x="2" y="5" width="20" height="14" rx="2" />
                </svg>
              </div>
              <h2 style={{ font: `800 24px ${FF}`, color: '#1B2A4A', margin: '0 0 8px', letterSpacing: '-.5px' }}>Verifique seu e-mail</h2>
              <p style={{ font: `400 14px/1.55 ${FF}`, color: '#7c7869', margin: '0 0 24px' }}>
                Enviamos um link de recuperação para <strong style={{ color: '#1B2A4A' }}>{forgotEmail}</strong>. O link expira em 60 minutos.
              </p>
              <button type="button" onClick={() => setView('login')} style={{ width: '100%', height: 48, border: '1.5px solid #1B2A4A', borderRadius: 11, background: 'none', color: '#1B2A4A', font: `700 14px ${FF}`, cursor: 'pointer' }}>
                Voltar ao login
              </button>
            </div>
          )}

          {/* ── INVITE VIEW ────────────────────────────────── */}
          {view === 'invite' && (
            <div>
              <button type="button" onClick={() => setView('login')} style={{ display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: 'none', cursor: 'pointer', font: `600 13px ${FF}`, color: '#7c7869', padding: 0, marginBottom: 20 }}>
                ← Voltar ao login
              </button>
              <div style={{ width: 54, height: 54, borderRadius: 14, background: '#eef1f6', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1B2A4A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6" /><path d="M22 11h-6" />
                </svg>
              </div>
              <h2 style={{ font: `800 24px ${FF}`, color: '#1B2A4A', margin: '0 0 8px', letterSpacing: '-.5px' }}>Conta apenas por convite</h2>
              <p style={{ font: `400 14px/1.6 ${FF}`, color: '#7c7869', margin: '0 0 22px' }}>
                As contas da Kinea são criadas pelo seu coach. Você recebe um link de convite por e-mail ou WhatsApp e, ao abri-lo, define sua própria senha.
              </p>
              <div style={{ background: '#fbf7ec', border: '1px solid #e7e0cf', borderRadius: 11, padding: '14px 15px', font: `400 13px/1.55 ${FF}`, color: '#6b6657' }}>
                Ainda não tem convite? Fale com seu coach para receber o acesso. O link expira em 7 dias.
              </div>
            </div>
          )}

          {/* ── SUCCESS VIEW ───────────────────────────────── */}
          {view === 'success' && success && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 70, height: 70, borderRadius: '50%', background: '#E8542A', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', boxShadow: '0 6px 18px rgba(232,84,42,.32)' }}>
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
              <h2 style={{ font: `800 25px ${FF}`, color: '#1B2A4A', margin: '0 0 6px', letterSpacing: '-.5px' }}>Olá, {success.name}</h2>
              <div style={{ display: 'inline-block', font: `600 11px ${FF}`, letterSpacing: '.4px', color: '#1B2A4A', background: '#eef1f6', borderRadius: 20, padding: '5px 13px', marginBottom: 18 }}>
                {success.roleLabel}
              </div>
              <p style={{ font: `400 14px/1.5 ${FF}`, color: '#7c7869', margin: '0 0 6px' }}>Login efetuado. Redirecionando para</p>
              <div style={{ font: `600 15px ${FF}`, color: '#E8542A', marginBottom: 8 }}>sua área</div>
              {success.first && (
                <p style={{ font: `400 13px/1.5 ${FF}`, color: '#b06a12', background: '#f7ecd9', borderRadius: 9, padding: '9px 12px', margin: '0 0 4px' }}>
                  Primeiro acesso — você vai completar sua anamnese antes de liberar o app.
                </p>
              )}
              <div style={{ height: 5, background: '#eadfca', borderRadius: 3, overflow: 'hidden', margin: '18px 0 22px' }}>
                <div style={{ height: '100%', background: '#E8542A', borderRadius: 3, animation: 'kbar 1.8s ease forwards' }} />
              </div>
              <button type="button" onClick={() => { setView('login'); setPassword(''); setError('') }} style={{ width: '100%', height: 46, border: '1.5px solid #d9d3c4', borderRadius: 11, background: 'none', color: '#1B2A4A', font: `600 14px ${FF}`, cursor: 'pointer' }}>
                Entrar como outro usuário
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

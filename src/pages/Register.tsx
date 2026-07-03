import { useState, useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import KineaLogo from '../components/KineaLogo'
import { useAuthStore } from '../store/auth'
import { useSettingsStore } from '../store/settings'
import { supabase } from '../lib/supabase'

const FF = '"Libre Franklin",sans-serif'

const inputStyle: CSSProperties = {
  width: '100%', height: 48,
  border: '1.5px solid #d9d3c4', borderRadius: 11,
  background: '#fff', padding: '0 15px',
  font: `400 15px ${FF}`, color: '#1B2A4A',
  outline: 'none', transition: 'border-color .15s, box-shadow .15s',
  boxSizing: 'border-box',
}

const labelStyle: CSSProperties = {
  display: 'block', font: `600 11px ${FF}`,
  letterSpacing: '.5px', textTransform: 'uppercase',
  color: '#6b6657', marginBottom: 7,
}

const btnPrimary: CSSProperties = {
  width: '100%', height: 50, border: 'none',
  borderRadius: 11, background: '#E8542A', color: '#fff',
  font: `700 15px ${FF}`, cursor: 'pointer',
  boxShadow: '0 2px 0 #c4421e',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
}

type View = 'form' | 'confirm' | 'done'

export default function Register() {
  const navigate    = useNavigate()
  const { setUser } = useAuthStore()
  const { coachId } = useParams<{ coachId: string }>()
  const { customLogoDataUrl } = useSettingsStore()

  const [view,         setView]         = useState<View>('form')
  const [name,         setName]         = useState('')
  const [email,        setEmail]        = useState('')
  const [password,     setPassword]     = useState('')
  const [confirm,      setConfirm]      = useState('')
  const [showPass,     setShowPass]     = useState(false)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')
  const pendingEmail = useRef('')

  const validEmail = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)

  // If a session already exists (user clicked confirmation link), create profile and redirect
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      const { data: existing } = await supabase.from('profiles').select('id').eq('id', session.user.id).single()
      if (existing) {
        // Profile already exists — just go to login
        navigate('/login', { replace: true })
      }
    })
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const n = name.trim()
    const em = email.trim().toLowerCase()

    if (!n)                        return setError('Informe seu nome completo.')
    if (!em || !validEmail(em))    return setError('Digite um e-mail válido.')
    if (password.length < 6)       return setError('A senha deve ter no mínimo 6 caracteres.')
    if (password !== confirm)      return setError('As senhas não coincidem.')

    setError(''); setLoading(true)

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({ email: em, password })

      if (signUpError) {
        setLoading(false)
        if (signUpError.message.toLowerCase().includes('already registered')) {
          setError('Este e-mail já possui uma conta. Faça login.')
        } else {
          setError('Não foi possível criar a conta. Tente novamente.')
        }
        return
      }

      const userId = data.user?.id
      if (!userId) { setLoading(false); setError('Erro inesperado. Tente novamente.'); return }

      // Insert profile row
      await supabase.from('profiles').insert({
        id:    userId,
        name:  n,
        email: em,
        role:  'student',
        anamnese_completed:   false,
        assessment_completed: false,
      })

      // Link student to coach if coachId is present in the invite URL.
      // plan is intentionally left as 'Sem plano' — the coach assigns it after registration.
      if (coachId) {
        await supabase.from('students').insert({
          coach_id:   coachId,
          student_id: userId,
          name:       n,
          email:      em,
          plan:       'Sem plano',
        })
      }

      // If Supabase returned a session immediately (email confirmation disabled)
      if (data.session) {
        setUser({
          id:                  userId,
          email:               em,
          name:                n,
          role:                'student',
          initials:            n.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
          anamneseCompleted:   false,
          assessmentCompleted: false,
        })
        setLoading(false)
        setView('done')
        setTimeout(() => navigate('/aluno/anamnese', { replace: true }), 1600)
      } else {
        // Email confirmation required
        pendingEmail.current = em
        setLoading(false)
        setView('confirm')
      }

    } catch {
      setLoading(false)
      setError('Erro de conexão. Tente novamente.')
    }
  }

  return (
    <div className="k-split" style={{ display: 'flex', flexDirection: 'row', minHeight: '100vh', background: '#FAEEDA' }}>

      {/* ── Brand panel ── */}
      <div
        className="k-brand"
        style={{ width: '46%', background: '#1B2A4A', color: '#FAEEDA', padding: '52px 56px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', overflow: 'hidden' }}
      >
        <div className="k-brand-motif" style={{ position: 'absolute', right: -90, bottom: -70, opacity: .07, transform: 'rotate(-8deg)', pointerEvents: 'none' }}>
          <KineaLogo width={440} height={532} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 11, position: 'relative' }}>
          {customLogoDataUrl
            ? <img src={customLogoDataUrl} alt="Logo" style={{ height: 36, maxWidth: 180, objectFit: 'contain' }} />
            : <>
                <KineaLogo width={30} height={36} />
                <span style={{ font: `600 23px ${FF}`, color: '#FAEEDA', letterSpacing: '-.5px' }}>kinea</span>
              </>
          }
        </div>

        <div className="k-brand-mid" style={{ position: 'relative' }}>
          <h1 className="k-login-head" style={{ font: `800 42px/1.08 ${FF}`, color: '#fff', margin: 0, letterSpacing: '-1px' }}>
            Treine.<br />Acompanhe.<br />Evolua.
          </h1>
          <p className="k-login-sub" style={{ font: `400 15px/1.55 ${FF}`, color: '#9fb0cc', margin: '14px 0 0', maxWidth: 300 }}>
            Crie sua conta e comece sua jornada com seu coach.
          </p>
        </div>

        <div className="k-brand-foot" style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 13 }}>
          {['Treinos montados pelo seu coach', 'Acompanhamento de avaliações e progresso', 'Comunicação direta, sem ruído'].map(t => (
            <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#E8542A', flexShrink: 0 }} />
              <span style={{ font: `400 14px ${FF}`, color: '#c7d2e3' }}>{t}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Form panel ── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 40px' }}>
        <div className="k-formwrap" style={{ width: '100%', maxWidth: 392 }}>

          {/* FORM VIEW */}
          {view === 'form' && (
            <div>
              <h2 style={{ font: `800 27px ${FF}`, color: '#1B2A4A', margin: '0 0 4px', letterSpacing: '-.5px' }}>Criar conta</h2>
              <p style={{ font: `400 14px ${FF}`, color: '#7c7869', margin: '0 0 26px' }}>
                Você recebeu um convite do seu coach. Defina seu acesso abaixo.
              </p>

              <form onSubmit={onSubmit}>
                <div style={{ marginBottom: 15 }}>
                  <label style={labelStyle}>Nome completo</label>
                  <input
                    type="text" autoComplete="name" placeholder="Seu nome"
                    value={name} onChange={e => { setName(e.target.value); setError('') }}
                    className="k-input" style={inputStyle}
                  />
                </div>

                <div style={{ marginBottom: 15 }}>
                  <label style={labelStyle}>E-mail</label>
                  <input
                    type="email" autoComplete="email" placeholder="voce@email.com"
                    value={email} onChange={e => { setEmail(e.target.value); setError('') }}
                    className="k-input" style={inputStyle}
                  />
                </div>

                <div style={{ marginBottom: 15 }}>
                  <label style={labelStyle}>Senha</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPass ? 'text' : 'password'} autoComplete="new-password" placeholder="Mínimo 6 caracteres"
                      value={password} onChange={e => { setPassword(e.target.value); setError('') }}
                      className="k-input" style={{ ...inputStyle, padding: '0 46px 0 15px' }}
                    />
                    <button
                      type="button" onClick={() => setShowPass(v => !v)} aria-label="Mostrar senha"
                      style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', width: 36, height: 36, border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9a958a', borderRadius: 8 }}
                    >
                      {showPass ? '🙈' : '👁'}
                    </button>
                  </div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={labelStyle}>Confirmar senha</label>
                  <input
                    type={showPass ? 'text' : 'password'} autoComplete="new-password" placeholder="Repita a senha"
                    value={confirm} onChange={e => { setConfirm(e.target.value); setError('') }}
                    className="k-input" style={inputStyle}
                  />
                </div>

                {error && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fdeee9', border: '1px solid #f6cdbf', borderRadius: 9, padding: '10px 12px', marginBottom: 16 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E8542A" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v6" /><path d="M12 16.5v.5" /></svg>
                    <span style={{ font: `500 13px ${FF}`, color: '#c4421e' }}>{error}</span>
                  </div>
                )}

                <button type="submit" disabled={loading} style={{ ...btnPrimary, opacity: loading ? .85 : 1 }}>
                  {loading
                    ? <span style={{ width: 17, height: 17, border: '2.4px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'kspin .7s linear infinite' }} />
                    : 'Criar minha conta →'
                  }
                </button>
              </form>

              <div style={{ textAlign: 'center', marginTop: 22, font: `400 13px ${FF}`, color: '#7c7869' }}>
                Já tem conta?{' '}
                <button type="button" onClick={() => navigate('/login')} style={{ border: 'none', background: 'none', cursor: 'pointer', font: `700 13px ${FF}`, color: '#E8542A', padding: 0 }}>
                  Fazer login
                </button>
              </div>
            </div>
          )}

          {/* CONFIRM EMAIL VIEW */}
          {view === 'confirm' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 62, height: 62, borderRadius: '50%', background: '#e7f3ea', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1B7a4a" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 7l-10 7L2 7" /><rect x="2" y="5" width="20" height="14" rx="2" />
                </svg>
              </div>
              <h2 style={{ font: `800 24px ${FF}`, color: '#1B2A4A', margin: '0 0 8px', letterSpacing: '-.5px' }}>Confirme seu e-mail</h2>
              <p style={{ font: `400 14px/1.55 ${FF}`, color: '#7c7869', margin: '0 0 24px' }}>
                Enviamos um link de confirmação para{' '}
                <strong style={{ color: '#1B2A4A' }}>{pendingEmail.current}</strong>.
                Clique no link para ativar sua conta e depois faça login.
              </p>
              <button type="button" onClick={() => navigate('/login')} style={{ ...btnPrimary }}>
                Ir para o login
              </button>
            </div>
          )}

          {/* DONE VIEW */}
          {view === 'done' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 70, height: 70, borderRadius: '50%', background: '#E8542A', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', boxShadow: '0 6px 18px rgba(232,84,42,.32)' }}>
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
              <h2 style={{ font: `800 25px ${FF}`, color: '#1B2A4A', margin: '0 0 8px', letterSpacing: '-.5px' }}>Conta criada!</h2>
              <p style={{ font: `400 14px/1.5 ${FF}`, color: '#7c7869', margin: 0 }}>
                Vamos completar seu perfil. Abrindo o app...
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

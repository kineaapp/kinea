import { useState, useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
  const navigate    = useNavigate()
  const { setUser } = useAuthStore()
  const { coachId } = useParams<{ coachId: string }>()
  const { customLogoDataUrl } = useSettingsStore()

  const [view,         setView]         = useState<View>('form')
  const [name,         setName]         = useState('')
  const [email,        setEmail]        = useState('')
  const [cpf,          setCpf]          = useState('')
  const [password,     setPassword]     = useState('')
  const [confirm,      setConfirm]      = useState('')
  const [showPass,     setShowPass]     = useState(false)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')
  const pendingEmail = useRef('')

  const validEmail = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)

  function formatCpf(v: string): string {
    const d = v.replace(/\D/g, '').slice(0, 11)
    if (d.length <= 3) return d
    if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`
    if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`
    return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`
  }

  function validCpf(v: string): boolean {
    const d = v.replace(/\D/g, '')
    if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false
    let s = 0
    for (let i = 0; i < 9; i++) s += parseInt(d[i]) * (10 - i)
    let c = (s * 10) % 11; if (c >= 10) c = 0
    if (c !== parseInt(d[9])) return false
    s = 0
    for (let i = 0; i < 10; i++) s += parseInt(d[i]) * (11 - i)
    c = (s * 10) % 11; if (c >= 10) c = 0
    return c === parseInt(d[10])
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      const { data: existing } = await supabase.from('profiles').select('id').eq('id', session.user.id).single()
      if (existing) {
        navigate('/login', { replace: true })
      }
    })
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const n = name.trim()
    const em = email.trim().toLowerCase()

    if (!n)                        return setError(t('register.err_name'))
    if (!em || !validEmail(em))    return setError(t('register.err_valid_email'))
    if (!validCpf(cpf))            return setError(t('register.err_cpf'))
    if (password.length < 6)       return setError(t('register.err_short_password'))
    if (password !== confirm)      return setError(t('register.err_passwords_match'))

    setError(''); setLoading(true)

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({ email: em, password })

      if (signUpError) {
        setLoading(false)
        if (signUpError.message.toLowerCase().includes('already registered')) {
          setError(t('register.err_email_in_use'))
        } else {
          setError(t('register.err_create_failed'))
        }
        return
      }

      const userId = data.user?.id
      if (!userId) { setLoading(false); setError(t('register.err_unexpected')); return }

      await supabase.from('profiles').insert({
        id:    userId,
        name:  n,
        email: em,
        role:  'student',
        anamnese_completed:   false,
        assessment_completed: false,
      })

      if (coachId) {
        await supabase.from('students').insert({
          coach_id:   coachId,
          student_id: userId,
          name:       n,
          email:      em,
          plan:       'Sem plano',
          cpf:        cpf.replace(/\D/g, ''),
        })
      }

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
        pendingEmail.current = em
        setLoading(false)
        setView('confirm')
      }

    } catch {
      setLoading(false)
      setError(t('register.err_connection'))
    }
  }

  const brandLines = t('register.brand_sub').split('\n')
  const features = [t('login.feature_1'), t('login.feature_2'), t('login.feature_3')]

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
            {t('login.brand_headline').split('\n').map((line, i, arr) => (
              <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
            ))}
          </h1>
          <p className="k-login-sub" style={{ font: `400 15px/1.55 ${FF}`, color: '#9fb0cc', margin: '14px 0 0', maxWidth: 300 }}>
            {brandLines.join(' ')}
          </p>
        </div>

        <div className="k-brand-foot" style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 13 }}>
          {features.map(feat => (
            <div key={feat} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#E8542A', flexShrink: 0 }} />
              <span style={{ font: `400 14px ${FF}`, color: '#c7d2e3' }}>{feat}</span>
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
              <h2 style={{ font: `800 27px ${FF}`, color: '#1B2A4A', margin: '0 0 4px', letterSpacing: '-.5px' }}>{t('register.title')}</h2>
              <p style={{ font: `400 14px ${FF}`, color: '#7c7869', margin: '0 0 26px' }}>
                {t('register.subtitle')}
              </p>

              <form onSubmit={onSubmit}>
                <div style={{ marginBottom: 15 }}>
                  <label style={labelStyle}>{t('register.full_name')}</label>
                  <input
                    type="text" autoComplete="name" placeholder={t('register.full_name_ph')}
                    value={name} onChange={e => { setName(e.target.value); setError('') }}
                    className="k-input" style={inputStyle}
                  />
                </div>

                <div style={{ marginBottom: 15 }}>
                  <label style={labelStyle}>{t('register.email')}</label>
                  <input
                    type="email" autoComplete="email" placeholder="voce@email.com"
                    value={email} onChange={e => { setEmail(e.target.value); setError('') }}
                    className="k-input" style={inputStyle}
                  />
                </div>

                <div style={{ marginBottom: 15 }}>
                  <label style={labelStyle}>{t('register.cpf')}</label>
                  <input
                    type="text" autoComplete="off" inputMode="numeric" placeholder="000.000.000-00"
                    value={cpf} onChange={e => { setCpf(formatCpf(e.target.value)); setError('') }}
                    className="k-input" style={inputStyle}
                  />
                </div>

                <div style={{ marginBottom: 15 }}>
                  <label style={labelStyle}>{t('register.password')}</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPass ? 'text' : 'password'} autoComplete="new-password" placeholder={t('register.password_ph')}
                      value={password} onChange={e => { setPassword(e.target.value); setError('') }}
                      className="k-input" style={{ ...inputStyle, padding: '0 46px 0 15px' }}
                    />
                    <button
                      type="button" onClick={() => setShowPass(v => !v)} aria-label={t('register.show_password')}
                      style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', width: 36, height: 36, border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9a958a', borderRadius: 8 }}
                    >
                      {showPass ? '🙈' : '👁'}
                    </button>
                  </div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={labelStyle}>{t('register.confirm_password')}</label>
                  <input
                    type={showPass ? 'text' : 'password'} autoComplete="new-password" placeholder={t('register.repeat_ph')}
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
                    : t('register.submit')
                  }
                </button>
              </form>

              <div style={{ textAlign: 'center', marginTop: 22, font: `400 13px ${FF}`, color: '#7c7869' }}>
                {t('register.already_have_account')}{' '}
                <button type="button" onClick={() => navigate('/login')} style={{ border: 'none', background: 'none', cursor: 'pointer', font: `700 13px ${FF}`, color: '#E8542A', padding: 0 }}>
                  {t('register.sign_in')}
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
              <h2 style={{ font: `800 24px ${FF}`, color: '#1B2A4A', margin: '0 0 8px', letterSpacing: '-.5px' }}>{t('register.confirm_email_title')}</h2>
              <p style={{ font: `400 14px/1.55 ${FF}`, color: '#7c7869', margin: '0 0 24px' }}>
                {t('register.confirm_email_body').replace('<1>', '').replace('</1>', '')} <strong style={{ color: '#1B2A4A' }}>{pendingEmail.current}</strong>
              </p>
              <button type="button" onClick={() => navigate('/login')} style={{ ...btnPrimary }}>
                {t('register.go_to_login')}
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
              <h2 style={{ font: `800 25px ${FF}`, color: '#1B2A4A', margin: '0 0 8px', letterSpacing: '-.5px' }}>{t('register.done_title')}</h2>
              <p style={{ font: `400 14px/1.5 ${FF}`, color: '#7c7869', margin: 0 }}>
                {t('register.done_body')}
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

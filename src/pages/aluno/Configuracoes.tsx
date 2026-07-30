import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Camera, Eye, EyeOff, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../store/auth'
import { useSettingsStore } from '../../store/settings'
import type { Language } from '../../store/settings'
import { supabase } from '../../lib/supabase'
import i18n from '../../i18n'

// ── shared primitives ──────────────────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
  return (
    <div style={{ font: `600 11px "Libre Franklin",sans-serif`, color: '#A39E90', textTransform: 'uppercase', letterSpacing: '.5px', padding: '0 2px', marginBottom: 8 }}>
      {children}
    </div>
  )
}

function PasswordField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ font: `600 12px "Libre Franklin",sans-serif`, color: '#7C7869' }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder ?? '••••••••'}
          style={{ width: '100%', boxSizing: 'border-box', padding: '12px 44px 12px 14px', borderRadius: 12, border: '1.5px solid #E0D9CC', background: '#FAFAF8', font: `400 14px "Libre Franklin",sans-serif`, color: '#1B2A4A', outline: 'none' }}
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
        >
          {show ? <EyeOff size={17} color="#A39E90" strokeWidth={2} /> : <Eye size={17} color="#A39E90" strokeWidth={2} />}
        </button>
      </div>
    </div>
  )
}

function SaveButton({ loading, saved, onClick, label }: { loading?: boolean; saved?: boolean; onClick: () => void; label: string }) {
  const { t } = useTranslation()
  return (
    <button
      onClick={onClick}
      disabled={loading || saved}
      style={{ width: '100%', padding: '13px 0', borderRadius: 12, background: saved ? '#4CAF8A' : '#1B2A4A', border: 'none', cursor: loading || saved ? 'default' : 'pointer', font: `700 14px "Libre Franklin",sans-serif`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'background .25s', opacity: loading ? .7 : 1 }}
    >
      {saved ? <><Check size={16} strokeWidth={2.5} /> {t('common.saved')}</> : loading ? t('common.saving') : label}
    </button>
  )
}

// ── main page ──────────────────────────────────────────────────────────────

export default function Configuracoes() {
  const { t } = useTranslation()
  const navigate   = useNavigate()
  const { user, updateUser } = useAuthStore()
  const { unit, setUnit, language, setLanguage } = useSettingsStore()

  // — photo
  const fileRef = useRef<HTMLInputElement>(null)
  const pickPhoto = useCallback(() => fileRef.current?.click(), [])
  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string
      updateUser({ photo: dataUrl })
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }, [updateUser])

  // — account
  const [email, setEmail]   = useState(user?.email ?? '')
  const [phone, setPhone]   = useState(user?.phone ?? '')
  const [acctSaved, setAcctSaved]   = useState(false)
  const [acctLoading, setAcctLoading] = useState(false)

  const saveAccount = useCallback(async () => {
    setAcctLoading(true)
    await new Promise(r => setTimeout(r, 600))
    updateUser({ email, phone })
    setAcctLoading(false)
    setAcctSaved(true)
    setTimeout(() => setAcctSaved(false), 2500)
  }, [email, phone, updateUser])

  // — password
  const [pwCurrent, setPwCurrent] = useState('')
  const [pwNew,     setPwNew]     = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [pwError,   setPwError]   = useState('')
  const [pwSaved,   setPwSaved]   = useState(false)
  const [pwLoading, setPwLoading] = useState(false)

  const savePassword = useCallback(async () => {
    if (!pwCurrent)               return setPwError(t('settings.err_enter_current_pw_aluno'))
    if (pwNew.length < 6)         return setPwError(t('settings.err_short_new_pw_aluno'))
    if (pwNew !== pwConfirm)      return setPwError(t('settings.err_pw_mismatch_aluno'))
    if (pwNew === pwCurrent)      return setPwError(t('settings.err_same_pw'))
    setPwError('')
    setPwLoading(true)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: user?.email ?? '', password: pwCurrent })
    if (signInError) { setPwLoading(false); return setPwError(t('settings.err_wrong_pw')) }
    const { error: updateError } = await supabase.auth.updateUser({ password: pwNew })
    setPwLoading(false)
    if (updateError) return setPwError(t('settings.err_pw_change', { message: updateError.message }))
    setPwSaved(true)
    setPwCurrent(''); setPwNew(''); setPwConfirm('')
    setTimeout(() => setPwSaved(false), 2500)
  }, [pwCurrent, pwNew, pwConfirm, user?.email, t])

  function handleLanguageChange(lang: Language) {
    setLanguage(lang)
    i18n.changeLanguage(lang)
  }

  const initials = user?.initials ?? 'JM'
  const photo    = user?.photo

  return (
    <div style={{ background: '#F4EFE3', minHeight: '100%', paddingBottom: 36 }}>
      {/* Header */}
      <div style={{ padding: '18px 20px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={() => navigate(-1)}
          style={{ width: 36, height: 36, borderRadius: 10, background: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(27,42,74,.1)', flexShrink: 0 }}
        >
          <ChevronLeft size={20} color="#1B2A4A" strokeWidth={2.5} />
        </button>
        <h1 style={{ font: `800 18px "Libre Franklin",sans-serif`, color: '#1B2A4A', margin: 0, letterSpacing: '-.3px' }}>{t('settings.title')}</h1>
      </div>

      <div style={{ padding: '0 18px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Photo ── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <button
            onClick={pickPhoto}
            style={{ position: 'relative', width: 88, height: 88, borderRadius: '50%', border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
          >
            {photo ? (
              <img src={photo} alt="Foto" style={{ width: 88, height: 88, borderRadius: '50%', objectFit: 'cover', border: '3px solid #fff', boxShadow: '0 4px 16px rgba(27,42,74,.14)' }} />
            ) : (
              <div style={{ width: 88, height: 88, borderRadius: '50%', background: '#E8542A', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid #fff', boxShadow: '0 4px 16px rgba(27,42,74,.14)' }}>
                <span style={{ font: `800 28px "Libre Franklin",sans-serif`, color: '#fff' }}>{initials}</span>
              </div>
            )}
            <span style={{ position: 'absolute', bottom: 2, right: 2, width: 26, height: 26, borderRadius: '50%', background: '#1B2A4A', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #F4EFE3' }}>
              <Camera size={13} color="#fff" strokeWidth={2} />
            </span>
          </button>
          <span style={{ font: `500 12px "Libre Franklin",sans-serif`, color: '#A39E90' }}>{t('settings.tap_to_change_photo')}</span>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onFileChange} />
        </div>

        {/* ── Account ── */}
        <div>
          <SectionLabel>{t('settings.account_section')}</SectionLabel>
          <div style={{ background: '#fff', borderRadius: 16, padding: '18px', display: 'flex', flexDirection: 'column', gap: 14, boxShadow: '0 2px 8px rgba(27,42,74,.07)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ font: `600 12px "Libre Franklin",sans-serif`, color: '#7C7869' }}>{t('settings.email')}</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                style={{ padding: '12px 14px', borderRadius: 12, border: '1.5px solid #E0D9CC', background: '#FAFAF8', font: `400 14px "Libre Franklin",sans-serif`, color: '#1B2A4A', outline: 'none' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ font: `600 12px "Libre Franklin",sans-serif`, color: '#7C7869' }}>Telefone</label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="(11) 99999-9999"
                style={{ padding: '12px 14px', borderRadius: 12, border: '1.5px solid #E0D9CC', background: '#FAFAF8', font: `400 14px "Libre Franklin",sans-serif`, color: '#1B2A4A', outline: 'none' }}
              />
            </div>
            <SaveButton loading={acctLoading} saved={acctSaved} onClick={saveAccount} label={t('settings.save_changes')} />
          </div>
        </div>

        {/* ── Password ── */}
        <div>
          <SectionLabel>{t('settings.security_section')}</SectionLabel>
          <div style={{ background: '#fff', borderRadius: 16, padding: '18px', display: 'flex', flexDirection: 'column', gap: 14, boxShadow: '0 2px 8px rgba(27,42,74,.07)' }}>
            <PasswordField label={t('settings.current_password')}  value={pwCurrent} onChange={setPwCurrent} />
            <PasswordField label={t('settings.new_password')}      value={pwNew}     onChange={v => { setPwNew(v); setPwError('') }} placeholder={t('settings.min_chars_ph')} />
            <PasswordField label={t('settings.confirm_password')}  value={pwConfirm} onChange={v => { setPwConfirm(v); setPwError('') }} />
            {pwError && (
              <p style={{ font: `500 12px "Libre Franklin",sans-serif`, color: '#E8542A', margin: 0 }}>{pwError}</p>
            )}
            <SaveButton loading={pwLoading} saved={pwSaved} onClick={savePassword} label={t('settings.change_password')} />
          </div>
        </div>

        {/* ── Preferences ── */}
        <div>
          <SectionLabel>{t('settings.preferences')}</SectionLabel>
          <div style={{ background: '#fff', borderRadius: 16, padding: '18px', display: 'flex', flexDirection: 'column', gap: 16, boxShadow: '0 2px 8px rgba(27,42,74,.07)' }}>

            {/* Unit */}
            <div>
              <div style={{ font: `600 13px "Libre Franklin",sans-serif`, color: '#1B2A4A', marginBottom: 12 }}>{t('settings.unit_system')}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {(['metric', 'imperial'] as const).map(u => {
                  const active = unit === u
                  return (
                    <button
                      key={u}
                      onClick={() => setUnit(u)}
                      style={{ padding: '12px 8px', borderRadius: 12, border: `2px solid ${active ? '#1B2A4A' : '#E0D9CC'}`, background: active ? '#1B2A4A' : '#FAFAF8', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, transition: 'all .15s' }}
                    >
                      <span style={{ font: `700 13px "Libre Franklin",sans-serif`, color: active ? '#FAEEDA' : '#1B2A4A' }}>
                        {u === 'metric' ? t('common.metric') : t('common.imperial')}
                      </span>
                      <span style={{ font: `400 11px "Libre Franklin",sans-serif`, color: active ? '#8B97AD' : '#A39E90' }}>
                        {u === 'metric' ? t('common.kg_cm') : t('common.lbs_in')}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Language */}
            <div>
              <div style={{ font: `600 13px "Libre Franklin",sans-serif`, color: '#1B2A4A', marginBottom: 12 }}>{t('settings.language')}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {(['pt-BR', 'en-US'] as Language[]).map(lang => {
                  const active = language === lang
                  const label = lang === 'pt-BR' ? t('settings.language_pt') : t('settings.language_en')
                  return (
                    <button
                      key={lang}
                      onClick={() => handleLanguageChange(lang)}
                      style={{ padding: '12px 8px', borderRadius: 12, border: `2px solid ${active ? '#1B2A4A' : '#E0D9CC'}`, background: active ? '#1B2A4A' : '#FAFAF8', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, transition: 'all .15s' }}
                    >
                      <span style={{ font: `700 13px "Libre Franklin",sans-serif`, color: active ? '#FAEEDA' : '#1B2A4A' }}>
                        {label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

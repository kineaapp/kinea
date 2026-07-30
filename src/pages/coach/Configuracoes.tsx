import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../store/auth'
import { useSettingsStore } from '../../store/settings'
import type { Language } from '../../store/settings'
import KineaLogo from '../../components/KineaLogo'
import { supabase } from '../../lib/supabase'
import i18n from '../../i18n'

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
  const { t } = useTranslation()
  const { user, setUser, updateUser, logout } = useAuthStore()
  const { customLogoDataUrl, setCustomLogo, language, setLanguage } = useSettingsStore()
  const navigate = useNavigate()
  const [toast, setToast] = useState('')
  const toastRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Profile
  const [name, setName] = useState(user?.name ?? '')
  const [specialty, setSpecialty] = useState('')
  const [bio, setBio] = useState('')

  // Notifications
  const [notif, setNotif] = useState({
    messages: true,
    payments: true,
    reassessments: true,
    checkins: false,
  })

  // Photo
  const photoInputRef = useRef<HTMLInputElement>(null)
  const onPhotoChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => updateUser({ photo: ev.target?.result as string })
    reader.readAsDataURL(file)
    e.target.value = ''
  }, [updateUser])

  // Logo
  const logoInputRef = useRef<HTMLInputElement>(null)

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => { setCustomLogo(reader.result as string); showToast(t('settings.toast_logo_updated')) }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  // Security
  const [passFields, setPassFields] = useState({ current: '', next: '', confirm: '' })
  const [passError, setPassError] = useState('')

  function showToast(msg: string) {
    setToast(msg)
    clearTimeout(toastRef.current)
    toastRef.current = setTimeout(() => setToast(''), 2000)
  }

  function saveProfile() {
    const trimmed = name.trim()
    if (!trimmed) { showToast(t('settings.err_name')); return }
    if (user) {
      const parts = trimmed.trim().split(/\s+/)
      const initials = ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase()
      setUser({ ...user, name: trimmed, initials })
    }
    showToast(t('settings.toast_profile_updated'))
  }

  async function savePassword() {
    setPassError('')
    if (!passFields.current) { setPassError(t('settings.err_enter_current_pw')); return }
    if (passFields.next.length < 6) { setPassError(t('settings.err_short_new_pw')); return }
    if (passFields.next !== passFields.confirm) { setPassError(t('settings.err_pw_mismatch')); return }
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: user?.email ?? '', password: passFields.current })
    if (signInError) { setPassError(t('settings.err_wrong_pw')); return }
    const { error: updateError } = await supabase.auth.updateUser({ password: passFields.next })
    if (updateError) { setPassError(t('settings.err_pw_change', { message: updateError.message })); return }
    setPassFields({ current: '', next: '', confirm: '' })
    showToast(t('settings.toast_password_changed'))
  }

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  function handleLanguageChange(lang: Language) {
    setLanguage(lang)
    i18n.changeLanguage(lang)
  }

  const initials = (() => {
    const p = name.trim().split(/\s+/)
    return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase()
  })()

  return (
    <div style={{ padding: '30px 34px 60px', maxWidth: 720 }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ font: `800 27px ${FF}`, color: '#1B2A4A', margin: 0, letterSpacing: '-.6px' }}>{t('settings.title')}</h1>
        <p style={{ font: `400 14px ${FF}`, color: '#7c7869', margin: '4px 0 0' }}>{t('settings.manage_desc')}</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Identidade visual ── */}
        <Card title={t('settings.visual_identity')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ width: 88, height: 60, border: '1.5px solid #ece7d9', borderRadius: 12, background: '#faf7ee', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden', padding: 8 }}>
              {customLogoDataUrl
                ? <img src={customLogoDataUrl} alt="Logo personalizado" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                : <KineaLogo width={24} height={29} />
              }
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ font: `600 14px ${FF}`, color: '#1B2A4A', marginBottom: 2 }}>
                {customLogoDataUrl ? t('settings.custom_logo') : t('settings.default_logo')}
              </div>
              <div style={{ font: `400 12.5px ${FF}`, color: '#9a948a', marginBottom: 12 }}>
                {t('settings.logo_desc')}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input ref={logoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} />
                <button
                  onClick={() => logoInputRef.current?.click()}
                  style={{ height: 36, padding: '0 16px', border: '1.5px solid #d9d3c4', background: '#fff', color: '#1B2A4A', borderRadius: 8, font: `600 12.5px ${FF}`, cursor: 'pointer' }}
                >
                  {customLogoDataUrl ? t('settings.change_logo') : t('settings.upload_logo')}
                </button>
                {customLogoDataUrl && (
                  <button
                    onClick={() => { setCustomLogo(null); showToast(t('settings.toast_logo_removed')) }}
                    style={{ height: 36, padding: '0 16px', border: '1.5px solid #e8c5bb', background: '#fef5f3', color: '#c4421e', borderRadius: 8, font: `600 12.5px ${FF}`, cursor: 'pointer' }}
                  >
                    {t('common.remove')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* ── Perfil ── */}
        <Card title={t('settings.coach_profile')}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Avatar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 4 }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                {user?.photo
                  ? <img src={user.photo} alt="Foto" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '2px solid #ece7d9' }} />
                  : <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#E8542A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', font: `700 22px ${FF}` }}>{initials}</div>
                }
                <button
                  onClick={() => photoInputRef.current?.click()}
                  style={{ position: 'absolute', bottom: 0, right: 0, width: 22, height: 22, borderRadius: '50%', background: '#1B2A4A', border: '2px solid #fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                </button>
                <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onPhotoChange} />
              </div>
              <div>
                <div style={{ font: `700 14.5px ${FF}`, color: '#1B2A4A', marginBottom: 4 }}>{name || 'Coach'}</div>
                <button
                  onClick={() => photoInputRef.current?.click()}
                  style={{ border: '1.5px solid #d9d3c4', background: '#fff', color: '#6b6657', font: `600 12px ${FF}`, borderRadius: 8, padding: '6px 14px', cursor: 'pointer' }}
                >
                  {t('common.change_photo')}
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Field label={t('settings.full_name')}>
                <Input value={name} onChange={setName} placeholder={t('settings.your_name_ph')} />
              </Field>
              <Field label={t('settings.email')}>
                <Input value={user?.email ?? 'coach@kinea.app'} readOnly />
              </Field>
            </div>

            <Field label={t('settings.specialty')}>
              <Input value={specialty} onChange={setSpecialty} placeholder={t('settings.specialty_ph')} />
            </Field>

            <Field label={t('settings.bio')}>
              <textarea
                value={bio}
                onChange={e => setBio(e.target.value)}
                rows={3}
                placeholder={t('settings.bio_ph')}
                style={{ width: '100%', border: '1.5px solid #d9d3c4', borderRadius: 10, background: '#fff', padding: '11px 14px', font: `400 14px ${FF}`, color: '#1B2A4A', outline: 'none', resize: 'vertical' as const, boxSizing: 'border-box' as const, lineHeight: 1.5 }}
              />
            </Field>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={saveProfile}
                style={{ height: 42, padding: '0 22px', border: 'none', background: '#E8542A', color: '#fff', borderRadius: 10, font: `700 13.5px ${FF}`, cursor: 'pointer', boxShadow: '0 2px 0 #c4421e' }}
              >
                {t('settings.save_profile')}
              </button>
            </div>
          </div>
        </Card>

        {/* ── Notificações ── */}
        <Card title={t('settings.notifications')}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {([
              { key: 'messages',      label: t('settings.notif_messages'),      desc: t('settings.notif_messages_desc') },
              { key: 'payments',      label: t('settings.notif_payments'),       desc: t('settings.notif_payments_desc') },
              { key: 'reassessments', label: t('settings.notif_reassessments'),  desc: t('settings.notif_reassessments_desc') },
              { key: 'checkins',      label: t('settings.notif_checkins'),       desc: t('settings.notif_checkins_desc') },
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

        {/* ── Idioma ── */}
        <Card title={t('settings.language_section')}>
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
                  <span style={{ font: `700 13px ${FF}`, color: active ? '#FAEEDA' : '#1B2A4A' }}>
                    {label}
                  </span>
                </button>
              )
            })}
          </div>
        </Card>

        {/* ── Segurança ── */}
        <Card title={t('settings.security')}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label={t('settings.current_password')}>
              <Input value={passFields.current} onChange={v => setPassFields(p => ({ ...p, current: v }))} type="password" placeholder="••••••••" />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Field label={t('settings.new_password')}>
                <Input value={passFields.next} onChange={v => setPassFields(p => ({ ...p, next: v }))} type="password" placeholder={t('settings.min_chars_ph')} />
              </Field>
              <Field label={t('settings.confirm_password')}>
                <Input value={passFields.confirm} onChange={v => setPassFields(p => ({ ...p, confirm: v }))} type="password" placeholder={t('settings.repeat_password_ph')} />
              </Field>
            </div>
            {passError && <div style={{ font: `500 12px ${FF}`, color: '#c4421e' }}>{passError}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={savePassword}
                style={{ height: 42, padding: '0 22px', border: '1.5px solid #d9d3c4', background: '#fff', color: '#1B2A4A', borderRadius: 10, font: `700 13.5px ${FF}`, cursor: 'pointer' }}
              >
                {t('settings.change_password')}
              </button>
            </div>
          </div>
        </Card>

        {/* ── Conta ── */}
        <Card title={t('settings.account')}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' as const, gap: 12 }}>
            <div>
              <div style={{ font: `600 14px ${FF}`, color: '#1B2A4A', marginBottom: 2 }}>{t('settings.logout_title')}</div>
              <div style={{ font: `400 12.5px ${FF}`, color: '#9a948a' }}>{t('settings.logout_desc')}</div>
            </div>
            <button
              onClick={handleLogout}
              style={{ height: 42, padding: '0 22px', border: '1.5px solid #e8c5bb', background: '#fef5f3', color: '#c4421e', borderRadius: 10, font: `700 13.5px ${FF}`, cursor: 'pointer' }}
            >
              {t('settings.logout_btn')}
            </button>
          </div>
        </Card>

      </div>

      <Toast msg={toast} />
    </div>
  )
}

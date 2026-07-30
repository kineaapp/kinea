import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../store/auth'
import { useSettingsStore } from '../../store/settings'
import { supabase } from '../../lib/supabase'

const FF = '"Libre Franklin",sans-serif'

const inputStyle: CSSProperties = {
  width: '100%', height: 48, border: '1.5px solid #D6CFBE', borderRadius: 11,
  background: '#fff', padding: '0 14px', font: `400 14px ${FF}`, color: '#1B2A4A',
  outline: 'none', boxSizing: 'border-box',
}

const labelStyle: CSSProperties = {
  display: 'block', font: `600 11px ${FF}`, color: '#7C7869',
  textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 8,
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
      {error && <span style={{ font: `400 11.5px ${FF}`, color: '#D2402A', marginTop: 4, display: 'block' }}>{error}</span>}
    </div>
  )
}

type PhotoKey = 'frente' | 'ladoEsq' | 'ladoDir' | 'costas'

const PHOTO_SLOT_KEYS: PhotoKey[] = ['frente', 'ladoEsq', 'ladoDir', 'costas']

const KEY_TO_COL: Record<PhotoKey, string> = {
  frente:  'photo_frente_url',
  ladoEsq: 'photo_lado_esq_url',
  ladoDir: 'photo_lado_dir_url',
  costas:  'photo_costas_url',
}

function pickPhoto(key: PhotoKey, onPick: (key: PhotoKey, preview: string, file: File) => void) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => onPick(key, ev.target?.result as string, file)
    reader.readAsDataURL(file)
  }
  input.click()
}

export default function NovaAvaliacao() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { t } = useTranslation()
  const { language } = useSettingsStore()
  const locale = language === 'en-US' ? 'en-US' : 'pt-BR'

  const PHOTO_LABELS: Record<PhotoKey, string> = {
    frente:  t('nova_avaliacao.photo_front'),
    ladoEsq: t('nova_avaliacao.photo_left'),
    ladoDir: t('nova_avaliacao.photo_right'),
    costas:  t('nova_avaliacao.photo_back'),
  }

  const [peso,    setPeso]    = useState('')
  const [cintura, setCintura] = useState('')
  const [quadril, setQuadril] = useState('')
  const [torax,   setTorax]   = useState('')
  const [braco,   setBraco]   = useState('')
  const [photos,  setPhotos]  = useState<Record<PhotoKey, { preview: string; file: File | null }>>({
    frente:  { preview: '', file: null },
    ladoEsq: { preview: '', file: null },
    ladoDir: { preview: '', file: null },
    costas:  { preview: '', file: null },
  })
  const [errors,  setErrors]  = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [nextDate, setNextDate] = useState('')

  function handlePick(key: PhotoKey, preview: string, file: File) {
    setPhotos(p => ({ ...p, [key]: { preview, file } }))
  }

  function removePhoto(key: PhotoKey, e: React.MouseEvent) {
    e.stopPropagation()
    setPhotos(p => ({ ...p, [key]: { preview: '', file: null } }))
  }

  async function submit() {
    const errs: Record<string, string> = {}
    const p = parseFloat(peso)
    if (!peso.trim() || isNaN(p) || p < 20 || p > 400) errs.peso = t('nova_avaliacao.err_weight')
    const missingPhotos = PHOTO_SLOT_KEYS.filter(s => !photos[s].file)
    if (missingPhotos.length > 0) errs.fotos = t('nova_avaliacao.err_photos')
    if (Object.keys(errs).length) { setErrors(errs); return }

    setLoading(true)
    try {
      const { data: studentRow, error: sErr } = await supabase
        .from('students')
        .select('id')
        .eq('student_id', user!.id)
        .maybeSingle()
      if (sErr || !studentRow) throw new Error('Aluno não encontrado.')

      const today = new Date().toISOString().split('T')[0]
      const { data: assessRow, error: insErr } = await supabase.from('assessments').insert({
        student_id:  studentRow.id,
        assessed_at: today,
        weight_kg:   p,
        waist_cm:    cintura ? parseFloat(cintura) : null,
        hip_cm:      quadril ? parseFloat(quadril) : null,
        chest_cm:    torax   ? parseFloat(torax)   : null,
        arm_cm:      braco   ? parseFloat(braco)   : null,
      }).select().single()
      if (insErr) throw insErr

      const urlUpdates: Record<string, string> = {}
      for (const key of PHOTO_SLOT_KEYS) {
        const ph = photos[key]
        if (ph.file) {
          const ext  = ph.file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
          const path = `${studentRow.id}/${assessRow.id}/${key}.${ext}`
          const { error: upErr } = await supabase.storage
            .from('assessment-photos').upload(path, ph.file, { upsert: true })
          if (!upErr) {
            const { data: pd } = supabase.storage.from('assessment-photos').getPublicUrl(path)
            urlUpdates[KEY_TO_COL[key]] = pd.publicUrl
          }
        }
      }
      if (Object.keys(urlUpdates).length > 0) {
        await supabase.from('assessments').update(urlUpdates).eq('id', assessRow.id)
      }

      const nextAssessmentDate = new Date()
      nextAssessmentDate.setDate(nextAssessmentDate.getDate() + 30)
      await supabase.from('students')
        .update({ next_assessment: nextAssessmentDate.toISOString().split('T')[0] })
        .eq('id', studentRow.id)

      localStorage.removeItem('kinea-assessment-snooze')
      const nd = new Date()
      nd.setDate(nd.getDate() + 30)
      setNextDate(nd.toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' }))
    } catch {
      setErrors({ global: t('nova_avaliacao.err_save') })
      setLoading(false)
      return
    }
    setLoading(false)
  }

  if (nextDate) {
    return (
      <div style={{ background: '#F4EFE3', minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 300 }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#E8542A', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 22px', boxShadow: '0 8px 28px rgba(232,84,42,.32)' }}>
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <h2 style={{ font: `800 24px ${FF}`, color: '#1B2A4A', margin: '0 0 10px', letterSpacing: '-.4px' }}>
            {t('nova_avaliacao.success_title')}
          </h2>
          <p style={{ font: `400 14px/1.6 ${FF}`, color: '#7C7869', margin: '0 0 20px' }}>
            {t('nova_avaliacao.success_body', { date: nextDate })}
          </p>
          <button
            type="button"
            onClick={() => navigate('/aluno/home', { replace: true })}
            style={{
              width: '100%', padding: '14px 0', background: '#E8542A',
              border: 'none', borderRadius: 14, boxShadow: '0 4px 0 #C4421E',
              font: `700 15px ${FF}`, color: '#fff', cursor: 'pointer',
            }}
          >
            {t('nova_avaliacao.back_home')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: '#F4EFE3', minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>

      {/* Top bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #EDE8DC', padding: '16px 18px', flexShrink: 0 }}>
        <div style={{ font: `800 18px ${FF}`, color: '#1B2A4A', letterSpacing: '-.3px' }}>{t('nova_avaliacao.title')}</div>
        <div style={{ font: `400 12px ${FF}`, color: '#A39E90', marginTop: 2 }}>{t('nova_avaliacao.subtitle')}</div>
      </div>

      {/* Form */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 18px 120px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        <Field label={t('nova_avaliacao.field_weight')} error={errors.peso}>
          <input
            type="number" inputMode="decimal" step="0.1" min="20" max="400" placeholder="Ex: 75.4"
            value={peso} onChange={e => { setPeso(e.target.value); setErrors(p => ({ ...p, peso: '' })) }}
            style={{ ...inputStyle, borderColor: errors.peso ? '#D2402A' : '#D6CFBE' }}
          />
        </Field>

        <div>
          <p style={{ font: `600 11px ${FF}`, color: '#7C7869', textTransform: 'uppercase', letterSpacing: '.4px', margin: '0 0 12px' }}>
            {t('nova_avaliacao.optional_section')}{' '}
            <span style={{ font: `400 10px ${FF}`, textTransform: 'none', letterSpacing: 0, color: '#A39E90' }}>{t('nova_avaliacao.optional_label')}</span>
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label={t('nova_avaliacao.field_waist')}>
              <input type="number" inputMode="decimal" step="0.5" placeholder="Ex: 82"
                value={cintura} onChange={e => setCintura(e.target.value)} style={inputStyle} />
            </Field>
            <Field label={t('nova_avaliacao.field_hip')}>
              <input type="number" inputMode="decimal" step="0.5" placeholder="Ex: 96"
                value={quadril} onChange={e => setQuadril(e.target.value)} style={inputStyle} />
            </Field>
            <Field label={t('nova_avaliacao.field_chest')}>
              <input type="number" inputMode="decimal" step="0.5" placeholder="Ex: 100"
                value={torax} onChange={e => setTorax(e.target.value)} style={inputStyle} />
            </Field>
            <Field label={t('nova_avaliacao.field_arm')}>
              <input type="number" inputMode="decimal" step="0.5" placeholder="Ex: 34"
                value={braco} onChange={e => setBraco(e.target.value)} style={inputStyle} />
            </Field>
          </div>
        </div>

        {/* Photos */}
        <div>
          <p style={{ font: `600 11px ${FF}`, color: '#7C7869', textTransform: 'uppercase', letterSpacing: '.4px', margin: '0 0 4px' }}>
            {t('nova_avaliacao.photos_section')}
          </p>
          <p style={{ font: `400 12px ${FF}`, color: '#A39E90', margin: '0 0 14px', lineHeight: 1.4 }}>
            {t('nova_avaliacao.photos_hint')}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {PHOTO_SLOT_KEYS.map(key => (
              <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <button
                  type="button"
                  onClick={() => { pickPhoto(key, handlePick); setErrors(p => ({ ...p, fotos: '' })) }}
                  style={{
                    width: '100%', aspectRatio: '3/4', padding: 0,
                    borderRadius: 12, cursor: 'pointer', overflow: 'hidden', position: 'relative',
                    border: photos[key].preview ? 'none' : `1.5px dashed ${errors.fotos ? '#D2402A' : '#D6CFBE'}`,
                    background: photos[key].preview ? 'transparent' : (errors.fotos ? '#fef5f3' : '#fff'),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {photos[key].preview ? (
                    <>
                      <img
                        src={photos[key].preview} alt={PHOTO_LABELS[key]}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                      <div
                        onClick={(e) => removePhoto(key, e)}
                        style={{
                          position: 'absolute', top: 5, right: 5,
                          width: 24, height: 24, borderRadius: '50%',
                          background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(2px)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                        }}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </div>
                    </>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={errors.fotos ? '#D2402A' : '#C5BFB0'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                        <circle cx="12" cy="13" r="4" />
                      </svg>
                      <span style={{ font: `500 10px ${FF}`, color: errors.fotos ? '#D2402A' : '#A39E90' }}>
                        {t('nova_avaliacao.photo_add')}
                      </span>
                    </div>
                  )}
                </button>
                <span style={{ font: `600 11px ${FF}`, color: '#7C7869', textAlign: 'center', letterSpacing: '.2px' }}>
                  {PHOTO_LABELS[key]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {errors.fotos && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fdeee9', border: '1px solid #f6cdbf', borderRadius: 10, padding: '11px 13px', marginTop: 4 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#E8542A" strokeWidth="2.2" strokeLinecap="round">
              <circle cx="12" cy="12" r="9" /><path d="M12 7v6" /><path d="M12 16.5v.5" />
            </svg>
            <span style={{ font: `500 13px ${FF}`, color: '#c4421e' }}>{errors.fotos}</span>
          </div>
        )}

        {errors.global && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fdeee9', border: '1px solid #f6cdbf', borderRadius: 10, padding: '11px 13px' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#E8542A" strokeWidth="2.2" strokeLinecap="round">
              <circle cx="12" cy="12" r="9" /><path d="M12 7v6" /><path d="M12 16.5v.5" />
            </svg>
            <span style={{ font: `500 13px ${FF}`, color: '#c4421e' }}>{errors.global}</span>
          </div>
        )}
      </div>

      {/* Fixed CTA */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 390, padding: '12px 18px 32px',
        background: '#F4EFE3', borderTop: '1px solid #EDE8DC',
      }}>
        <button
          type="button" onClick={submit} disabled={loading}
          style={{
            width: '100%', padding: '15px 0',
            background: loading ? '#c4421e' : '#E8542A',
            border: 'none', borderRadius: 14, boxShadow: loading ? 'none' : '0 4px 0 #C4421E',
            font: `700 16px ${FF}`, color: '#fff', cursor: loading ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}
        >
          {loading ? (
            <>
              <span style={{ width: 18, height: 18, border: '2.5px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'kspin .7s linear infinite' }} />
              {t('nova_avaliacao.saving')}
            </>
          ) : t('nova_avaliacao.submit')}
        </button>
      </div>
      <style>{`@keyframes kspin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

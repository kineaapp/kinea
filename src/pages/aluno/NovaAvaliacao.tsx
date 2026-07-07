import { useState, useRef } from 'react'
import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
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

function formatNextDate(from: Date): string {
  const d = new Date(from)
  d.setDate(d.getDate() + 30)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

export default function NovaAvaliacao() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const fileRef = useRef<HTMLInputElement>(null)

  const [peso,    setPeso]    = useState('')
  const [cintura, setCintura] = useState('')
  const [quadril, setQuadril] = useState('')
  const [torax,   setTorax]   = useState('')
  const [braco,   setBraco]   = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [errors,  setErrors]  = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [nextDate, setNextDate] = useState('')

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
    setErrors(p => ({ ...p, foto: '' }))
  }

  function removePhoto(e: React.MouseEvent) {
    e.stopPropagation()
    setPhotoFile(null)
    setPhotoPreview('')
    if (fileRef.current) fileRef.current.value = ''
  }

  async function submit() {
    const errs: Record<string, string> = {}
    const p = parseFloat(peso)
    if (!peso.trim() || isNaN(p) || p < 20 || p > 400) errs.peso = 'Informe um peso válido (kg).'
    if (Object.keys(errs).length) { setErrors(errs); return }

    setLoading(true)
    try {
      // Fetch the student's numeric DB id
      const { data: studentRow, error: sErr } = await supabase
        .from('students')
        .select('id')
        .eq('student_id', user!.id)
        .maybeSingle()
      if (sErr || !studentRow) throw new Error('Aluno não encontrado.')

      let photoUrl: string | null = null
      if (photoFile) {
        const ext = photoFile.name.split('.').pop() ?? 'jpg'
        const path = `${user!.id}/${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage
          .from('assessment-photos')
          .upload(path, photoFile, { upsert: false })
        if (!upErr) {
          const { data: urlData } = supabase.storage
            .from('assessment-photos')
            .getPublicUrl(path)
          photoUrl = urlData.publicUrl
        }
      }

      const today = new Date().toISOString().split('T')[0]
      const { error: insErr } = await supabase.from('assessments').insert({
        student_id:  studentRow.id,
        assessed_at: today,
        weight_kg:   p,
        waist_cm:    cintura ? parseFloat(cintura) : null,
        hip_cm:      quadril ? parseFloat(quadril) : null,
        chest_cm:    torax   ? parseFloat(torax)   : null,
        arm_cm:      braco   ? parseFloat(braco)   : null,
        photo_url:   photoUrl,
      })
      if (insErr) throw insErr

      // Clear snooze so the modal doesn't reappear
      localStorage.removeItem('kinea-assessment-snooze')
      setNextDate(formatNextDate(new Date()))
    } catch {
      setErrors({ global: 'Erro ao salvar. Tente novamente.' })
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
          <h2 style={{ font: `800 24px ${FF}`, color: '#1B2A4A', margin: '0 0 10px', letterSpacing: '-.4px' }}>Avaliação registrada!</h2>
          <p style={{ font: `400 14px/1.6 ${FF}`, color: '#7C7869', margin: '0 0 20px' }}>
            Sua próxima avaliação está agendada para <strong style={{ color: '#1B2A4A' }}>{nextDate}</strong>.
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
            Voltar ao início
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: '#F4EFE3', minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>

      {/* Top bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #EDE8DC', padding: '16px 18px', flexShrink: 0 }}>
        <div style={{ font: `800 18px ${FF}`, color: '#1B2A4A', letterSpacing: '-.3px' }}>Avaliação Periódica</div>
        <div style={{ font: `400 12px ${FF}`, color: '#A39E90', marginTop: 2 }}>Registre seu peso e medidas de hoje</div>
      </div>

      {/* Form */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 18px 120px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        <Field label="Peso atual (kg) *" error={errors.peso}>
          <input
            type="number" inputMode="decimal" step="0.1" min="20" max="400" placeholder="Ex: 75.4"
            value={peso} onChange={e => { setPeso(e.target.value); setErrors(p => ({ ...p, peso: '' })) }}
            style={{ ...inputStyle, borderColor: errors.peso ? '#D2402A' : '#D6CFBE' }}
          />
        </Field>

        <div>
          <p style={{ font: `600 11px ${FF}`, color: '#7C7869', textTransform: 'uppercase', letterSpacing: '.4px', margin: '0 0 12px' }}>
            Medidas corporais{' '}
            <span style={{ font: `400 10px ${FF}`, textTransform: 'none', letterSpacing: 0, color: '#A39E90' }}>(opcional)</span>
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Cintura (cm)">
              <input type="number" inputMode="decimal" step="0.5" placeholder="Ex: 82"
                value={cintura} onChange={e => setCintura(e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Quadril (cm)">
              <input type="number" inputMode="decimal" step="0.5" placeholder="Ex: 96"
                value={quadril} onChange={e => setQuadril(e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Tórax (cm)">
              <input type="number" inputMode="decimal" step="0.5" placeholder="Ex: 100"
                value={torax} onChange={e => setTorax(e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Braço D (cm)">
              <input type="number" inputMode="decimal" step="0.5" placeholder="Ex: 34"
                value={braco} onChange={e => setBraco(e.target.value)} style={inputStyle} />
            </Field>
          </div>
        </div>

        <div>
          <p style={{ font: `600 11px ${FF}`, color: '#7C7869', textTransform: 'uppercase', letterSpacing: '.4px', margin: '0 0 4px' }}>
            Foto de progresso{' '}
            <span style={{ font: `400 10px ${FF}`, textTransform: 'none', letterSpacing: 0, color: '#A39E90' }}>(opcional)</span>
          </p>
          <p style={{ font: `400 12px ${FF}`, color: '#A39E90', margin: '0 0 12px', lineHeight: 1.4 }}>
            Uma foto de corpo inteiro ajuda a visualizar seu progresso.
          </p>
          <input
            ref={fileRef} type="file" accept="image/*"
            onChange={handlePhotoChange} style={{ display: 'none' }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            style={{
              width: '100%', aspectRatio: '16/9', padding: 0,
              borderRadius: 14, cursor: 'pointer', overflow: 'hidden', position: 'relative',
              border: photoPreview ? 'none' : '1.5px dashed #D6CFBE',
              background: photoPreview ? 'transparent' : '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {photoPreview ? (
              <>
                <img src={photoPreview} alt="Foto de progresso" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                <div onClick={removePhoto} style={{
                  position: 'absolute', top: 8, right: 8,
                  width: 28, height: 28, borderRadius: '50%',
                  background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(2px)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C5BFB0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                <span style={{ font: `500 12px ${FF}`, color: '#A39E90' }}>Adicionar foto</span>
              </div>
            )}
          </button>
        </div>

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
              Salvando...
            </>
          ) : 'Registrar avaliação →'}
        </button>
      </div>
    </div>
  )
}

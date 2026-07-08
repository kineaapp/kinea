import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const FF = '"Libre Franklin",sans-serif'

function pollockBF(sum: number, age: number, sex: 'M' | 'F'): number {
  const d = sex === 'M'
    ? 1.112 - 0.00043499 * sum + 0.00000055 * sum * sum - 0.00028826 * age
    : 1.097 - 0.00046971 * sum + 0.00000056 * sum * sum - 0.00012828 * age
  return Math.max(0, (4.95 / d - 4.5) * 100)
}

function calcAgeFromISO(iso: string): number {
  const birth = new Date(iso)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

type SFKey = 'd1' | 'd2' | 'd3' | 'd4' | 'd5' | 'd6' | 'd7'
const SKINFOLDS: { key: SFKey; label: string }[] = [
  { key: 'd1', label: 'Peito' },
  { key: 'd2', label: 'Axilar médio' },
  { key: 'd3', label: 'Tríceps' },
  { key: 'd4', label: 'Subescapular' },
  { key: 'd5', label: 'Abdômen' },
  { key: 'd6', label: 'Supra-ilíaca' },
  { key: 'd7', label: 'Coxa' },
]

const MEASURES = [
  { key: 'chest_cm',  label: 'Peito'   },
  { key: 'waist_cm',  label: 'Cintura' },
  { key: 'hip_cm',    label: 'Quadril' },
  { key: 'arm_cm',    label: 'Braço'   },
  { key: 'thigh_cm',  label: 'Coxa'    },
] as const

export interface SavedAssessmentRow {
  id: number; assessed_at: string
  weight_kg: number | null; body_fat_pct: number | null
  chest_cm: number | null; waist_cm: number | null; hip_cm: number | null
  arm_cm: number | null; thigh_cm: number | null; notes: string | null
  photo_url: string | null
}

interface Props {
  studentId:   number
  studentName: string
  studentUuid: string
  onClose:     () => void
  onSaved:     (row: SavedAssessmentRow) => void
}

export function ProfileAssessmentModal({ studentId, studentName, studentUuid, onClose, onSaved }: Props) {
  const [weight,    setWeight]    = useState('')
  const [sex,       setSex]       = useState<'M' | 'F'>('F')
  const [age,       setAge]       = useState('')
  const [ageFromDb, setAgeFromDb] = useState(false)
  const [dobras,    setDobras]    = useState<Record<SFKey, string>>({ d1:'',d2:'',d3:'',d4:'',d5:'',d6:'',d7:'' })
  const [circ,      setCirc]      = useState<Record<string, string>>({ chest_cm:'',waist_cm:'',hip_cm:'',arm_cm:'',thigh_cm:'' })
  const [notes,     setNotes]     = useState('')
  const [saving,    setSaving]    = useState(false)
  const [err,       setErr]       = useState('')

  useEffect(() => {
    if (!studentUuid) return
    supabase.from('anamneses').select('data_nasc')
      .eq('student_id', studentUuid)
      .order('created_at', { ascending: false }).limit(1).single()
      .then(({ data }) => {
        if (data?.data_nasc) {
          const a = calcAgeFromISO(data.data_nasc)
          if (a > 0) { setAge(String(a)); setAgeFromDb(true) }
        }
      })
  }, [studentUuid])

  const ageN    = parseInt(age) || 0
  const weightN = parseFloat(weight.replace(',', '.')) || 0
  const vals    = SKINFOLDS.map(s => parseFloat(dobras[s.key].replace(',', '.')) || 0)
  const allFilled = SKINFOLDS.every(s => dobras[s.key].trim() !== '')
  const sum7    = vals.reduce((a, v) => a + v, 0)
  const bfCalc  = allFilled && ageN > 0 ? pollockBF(sum7, ageN, sex) : null
  const massaGorda = bfCalc !== null && weightN ? (bfCalc / 100) * weightN : null
  const massaMagra = massaGorda !== null && weightN ? weightN - massaGorda : null

  function fmt1(n: number) { return n.toFixed(1).replace('.', ',') }

  const inputBase: React.CSSProperties = {
    width: '100%', height: 44, border: '1.5px solid #d9d3c4', borderRadius: 10,
    background: '#fff', padding: '0 12px', font: `400 14px ${FF}`, color: '#1B2A4A',
    outline: 'none', boxSizing: 'border-box',
  }
  function focusOn(e: React.FocusEvent<HTMLInputElement>) {
    e.currentTarget.style.borderColor = '#E8542A'
    e.currentTarget.style.boxShadow   = '0 0 0 3px rgba(232,84,42,.13)'
  }
  function focusOff(e: React.FocusEvent<HTMLInputElement>) {
    e.currentTarget.style.borderColor = '#d9d3c4'
    e.currentTarget.style.boxShadow   = 'none'
  }

  async function handleSave() {
    if (!weight.trim()) { setErr('Informe o peso.'); return }
    setSaving(true)
    const today = new Date().toISOString().split('T')[0]
    const insert: Record<string, unknown> = {
      student_id:    studentId,
      assessed_at:   today,
      weight_kg:     weightN || null,
      body_fat_pct:  bfCalc !== null ? Math.round(bfCalc * 10) / 10 : null,
    }
    MEASURES.forEach(m => {
      const v = parseFloat(circ[m.key].replace(',', '.'))
      insert[m.key] = v > 0 ? v : null
    })
    if (notes.trim()) insert.notes = notes.trim()

    const { data, error } = await supabase.from('assessments').insert(insert).select().single()
    setSaving(false)
    if (error) { setErr('Erro ao salvar. Tente novamente.'); return }
    onSaved(data as SavedAssessmentRow)
    onClose()
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,25,40,.5)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, background: '#fff', borderRadius: 16, boxShadow: '0 24px 60px rgba(0,0,0,.3)', display: 'flex', flexDirection: 'column', maxHeight: '92vh', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ padding: '24px 26px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h2 style={{ font: `800 20px ${FF}`, color: '#1B2A4A', margin: 0, letterSpacing: '-.4px' }}>Nova avaliação</h2>
              <p style={{ font: `400 12.5px ${FF}`, color: '#9a948a', margin: '3px 0 0' }}>
                {studentName} · Peso obrigatório · dobras e medidas opcionais
              </p>
            </div>
            <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9a948a', padding: 2 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
            </button>
          </div>
        </div>

        <div style={{ padding: '0 26px 26px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Dados básicos */}
          <div>
            <div style={{ font: `700 10.5px ${FF}`, letterSpacing: '.6px', textTransform: 'uppercase', color: '#9a948a', marginBottom: 12 }}>Dados básicos</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', font: `600 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#6b6657', marginBottom: 7 }}>Peso (kg)</label>
                  <input type="text" value={weight} placeholder="Ex: 78,4" onChange={e => { setWeight(e.target.value); setErr('') }} style={inputBase} onFocus={focusOn} onBlur={focusOff} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                    <label style={{ font: `600 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#6b6657' }}>Idade</label>
                    {ageFromDb && <span style={{ font: `500 9px ${FF}`, color: '#1B7a4a', background: '#e7f3ea', borderRadius: 20, padding: '1px 6px' }}>anamnese</span>}
                  </div>
                  <input type="text" value={age} placeholder="25"
                    onChange={e => { setAge(e.target.value); setAgeFromDb(false) }}
                    style={{ ...inputBase, textAlign: 'center', borderColor: ageFromDb ? '#8ecfad' : '#d9d3c4', background: ageFromDb ? '#f4fbf7' : '#fff' }}
                    onFocus={focusOn} onBlur={focusOff} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', font: `600 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#6b6657', marginBottom: 8 }}>Sexo</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['F', 'M'] as const).map(s => (
                    <button key={s} type="button" onClick={() => setSex(s)}
                      style={{ flex: 1, height: 40, border: `1.5px solid ${sex === s ? '#E8542A' : '#e0d9c8'}`, background: sex === s ? '#fdf3ee' : '#fff', color: sex === s ? '#E8542A' : '#7c7869', font: `700 13px ${FF}`, borderRadius: 9, cursor: 'pointer' }}>
                      {s === 'F' ? 'Feminino' : 'Masculino'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Circunferências */}
          <div>
            <div style={{ font: `700 10.5px ${FF}`, letterSpacing: '.6px', textTransform: 'uppercase', color: '#9a948a', marginBottom: 12 }}>
              Medidas (cm) <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0, fontSize: 10 }}>— opcional</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {MEASURES.map((m, i) => (
                <div key={m.key} style={i === 4 ? { gridColumn: '1 / -1', maxWidth: 'calc(50% - 5px)' } : {}}>
                  <label style={{ display: 'block', font: `600 10.5px ${FF}`, letterSpacing: '.4px', textTransform: 'uppercase', color: '#6b6657', marginBottom: 6 }}>{m.label}</label>
                  <input type="text" value={circ[m.key]} placeholder="0"
                    onChange={e => setCirc(prev => ({ ...prev, [m.key]: e.target.value }))}
                    style={{ ...inputBase, height: 42, textAlign: 'center', font: `700 15px ${FF}` }}
                    onFocus={focusOn} onBlur={focusOff} />
                </div>
              ))}
            </div>
          </div>

          {/* 7 Dobras */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ font: `700 10.5px ${FF}`, letterSpacing: '.6px', textTransform: 'uppercase', color: '#9a948a' }}>
                7 Dobras cutâneas (mm) <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0, fontSize: 10 }}>— opcional</span>
              </div>
              {allFilled && <span style={{ font: `700 12px ${FF}`, color: '#1B2A4A' }}>Σ = {fmt1(sum7)} mm</span>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {SKINFOLDS.map((sf, i) => (
                <div key={sf.key} style={i === 6 ? { gridColumn: '1 / -1', maxWidth: 'calc(50% - 5px)' } : {}}>
                  <label style={{ display: 'block', font: `600 10.5px ${FF}`, letterSpacing: '.4px', textTransform: 'uppercase', color: '#6b6657', marginBottom: 6 }}>{sf.label}</label>
                  <input type="text" value={dobras[sf.key]} placeholder="0,0"
                    onChange={e => setDobras(prev => ({ ...prev, [sf.key]: e.target.value }))}
                    style={{ ...inputBase, height: 42, textAlign: 'center', font: `700 15px ${FF}` }}
                    onFocus={focusOn} onBlur={focusOff} />
                </div>
              ))}
            </div>
          </div>

          {/* Resultado Pollock */}
          {bfCalc !== null ? (
            <div style={{ background: '#faf7ee', border: '1px solid #e0d9c8', borderRadius: 12, padding: '14px 18px' }}>
              <div style={{ font: `600 10.5px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#9a948a', marginBottom: 12 }}>Resultado calculado</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, textAlign: 'center' }}>
                <div>
                  <div style={{ font: `800 24px ${FF}`, color: '#E8542A', letterSpacing: '-.5px' }}>{fmt1(bfCalc)}%</div>
                  <div style={{ font: `500 10.5px ${FF}`, color: '#9a948a', marginTop: 2 }}>% Gordura</div>
                </div>
                <div>
                  <div style={{ font: `800 24px ${FF}`, color: '#c4421e', letterSpacing: '-.5px' }}>{massaGorda !== null ? fmt1(massaGorda) + ' kg' : '—'}</div>
                  <div style={{ font: `500 10.5px ${FF}`, color: '#9a948a', marginTop: 2 }}>Massa gorda</div>
                </div>
                <div>
                  <div style={{ font: `800 24px ${FF}`, color: '#1B7a4a', letterSpacing: '-.5px' }}>{massaMagra !== null ? fmt1(massaMagra) + ' kg' : '—'}</div>
                  <div style={{ font: `500 10.5px ${FF}`, color: '#9a948a', marginTop: 2 }}>Massa magra</div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#faf7ee', border: '1px dashed #d8d1c0', borderRadius: 11, padding: '11px 14px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b06a12" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="9"/><path d="M12 8v4"/><circle cx="12" cy="16.5" r=".8" fill="#b06a12"/>
              </svg>
              <span style={{ font: `500 12px ${FF}`, color: '#7c7869' }}>Preencha as 7 dobras e a idade para calcular o % de gordura (opcional).</span>
            </div>
          )}

          {/* Observações */}
          <div>
            <label style={{ display: 'block', font: `600 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#6b6657', marginBottom: 7 }}>Observações</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Anotações livres sobre esta avaliação…"
              style={{ width: '100%', border: '1.5px solid #d9d3c4', borderRadius: 10, background: '#fff', padding: '10px 12px', font: `400 14px ${FF}`, color: '#1B2A4A', outline: 'none', resize: 'none', boxSizing: 'border-box', lineHeight: 1.5 }} />
          </div>

          {err && <div style={{ font: `600 12.5px ${FF}`, color: '#c4421e' }}>{err}</div>}

          <button type="button" onClick={handleSave} disabled={saving}
            style={{ width: '100%', height: 48, border: 'none', background: saving ? '#E8542Acc' : '#E8542A', color: '#fff', borderRadius: 10, font: `700 14.5px ${FF}`, cursor: saving ? 'default' : 'pointer', boxShadow: saving ? 'none' : '0 2px 0 #c4421e', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {saving
              ? <><span style={{ width: 15, height: 15, border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'kspin .7s linear infinite' }} /> Salvando...</>
              : 'Salvar avaliação'
            }
          </button>
        </div>
      </div>
    </div>
  )
}

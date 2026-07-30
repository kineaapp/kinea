import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Check } from 'lucide-react'
import { jsPDF } from 'jspdf'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../store/auth'
import { supabase } from '../../lib/supabase'

// ── Types ────────────────────────────────────────────────────

interface AnamneseData {
  nome: string; dataNasc: string; telefone: string; profissao: string; altura: string
  doencas: string[]; outraDoenca: string; medicamentos: string; cirurgia: string; limitacoes: string
  praticaAtual: string; atividadeAtual: string; treinouPersonal: string
  objetivo: string; diasSemana: string; horario: string
  horasSono: string; nivelEstresse: string; fuma: string; alcool: string
}

const EMPTY: AnamneseData = {
  nome: '', dataNasc: '', telefone: '', profissao: '', altura: '',
  doencas: [], outraDoenca: '', medicamentos: '', cirurgia: '', limitacoes: '',
  praticaAtual: '', atividadeAtual: '', treinouPersonal: '',
  objetivo: '', diasSemana: '', horario: '',
  horasSono: '', nivelEstresse: '', fuma: '', alcool: '',
}

// DB-stored values for diseases — never change these
const DOENCAS_OPTIONS = ['Diabetes', 'Hipertensão', 'Doença cardíaca', 'Asma', 'Obesidade', 'Colesterol alto', 'Nenhuma']

// ── Design tokens ────────────────────────────────────────────

const FF = '"Libre Franklin",sans-serif'

const inputStyle: CSSProperties = {
  width: '100%', height: 48, border: '1.5px solid #D6CFBE', borderRadius: 11,
  background: '#fff', padding: '0 14px', font: `400 14px ${FF}`, color: '#1B2A4A',
  outline: 'none', boxSizing: 'border-box',
}

const textareaStyle: CSSProperties = {
  width: '100%', border: '1.5px solid #D6CFBE', borderRadius: 11, background: '#fff',
  padding: '12px 14px', font: `400 14px ${FF}`, color: '#1B2A4A', outline: 'none',
  resize: 'none', boxSizing: 'border-box', lineHeight: 1.5,
}

const labelStyle: CSSProperties = {
  display: 'block', font: `600 11px ${FF}`, color: '#7C7869',
  textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 8,
}

// ── Sub-components ───────────────────────────────────────────

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input style={inputStyle} {...props} />
    </div>
  )
}

function Textarea({ label, rows = 3, value, onChange }: { label: string; rows?: number; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <textarea rows={rows} value={value} onChange={e => onChange(e.target.value)} style={textareaStyle} />
    </div>
  )
}

function RadioGroup({ label, options, value, onChange }: {
  label?: string; options: { value: string; label: string }[]; value: string; onChange: (v: string) => void
}) {
  return (
    <div>
      {label && <label style={labelStyle}>{label}</label>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {options.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{
              padding: '9px 16px', borderRadius: 22, cursor: 'pointer',
              border: `1.5px solid ${value === opt.value ? '#E8542A' : '#D6CFBE'}`,
              background: value === opt.value ? '#E8542A' : '#fff',
              color: value === opt.value ? '#fff' : '#1B2A4A',
              font: `600 13px ${FF}`,
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function CheckItem({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 14px', borderRadius: 12, cursor: 'pointer', width: '100%', textAlign: 'left',
        background: checked ? '#FEF0EC' : '#fff',
        border: `1.5px solid ${checked ? '#E8542A' : '#D6CFBE'}`,
      }}
    >
      <div style={{
        width: 20, height: 20, borderRadius: 6, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: checked ? '#E8542A' : 'transparent',
        border: `1.5px solid ${checked ? '#E8542A' : '#D6CFBE'}`,
      }}>
        {checked && <Check size={12} color="#fff" strokeWidth={3} />}
      </div>
      <span style={{ font: `500 13px ${FF}`, color: '#1B2A4A' }}>{label}</span>
    </button>
  )
}

// ── Validation per step ──────────────────────────────────────

function validate(step: number, data: AnamneseData, t: (key: string) => string): string | null {
  if (step === 0) {
    if (!data.nome.trim())     return t('anamnese.err_name')
    if (!data.dataNasc)        return t('anamnese.err_birth_date')
    if (!data.telefone.trim()) return t('anamnese.err_phone')
  }
  if (step === 2) {
    if (!data.praticaAtual)    return t('anamnese.err_exercises_now')
    if (!data.treinouPersonal) return t('anamnese.err_personal_trainer')
  }
  if (step === 3) {
    if (!data.objetivo)   return t('anamnese.err_main_goal')
    if (!data.diasSemana) return t('anamnese.err_days_week')
    if (!data.horario)    return t('anamnese.err_preferred_time')
  }
  if (step === 4) {
    if (!data.horasSono)     return t('anamnese.err_sleep_hours')
    if (!data.nivelEstresse) return t('anamnese.err_stress_level')
    if (!data.fuma)          return t('anamnese.err_smoking')
    if (!data.alcool)        return t('anamnese.err_alcohol')
  }
  return null
}

// ── Main component ───────────────────────────────────────────

export default function Anamnese() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user, setUser } = useAuthStore()

  const STEPS = [
    t('anamnese.step_personal'),
    t('anamnese.step_health'),
    t('anamnese.step_activity'),
    t('anamnese.step_goals'),
    t('anamnese.step_lifestyle'),
  ]

  // Display labels for diseases — values (Portuguese) stay in DOENCAS_OPTIONS for DB storage
  const DOENCAS_LABELS: Record<string, string> = {
    'Diabetes':        t('anamnese.disease_diabetes'),
    'Hipertensão':     t('anamnese.disease_hypertension'),
    'Doença cardíaca': t('anamnese.disease_heart'),
    'Asma':            t('anamnese.disease_asthma'),
    'Obesidade':       t('anamnese.disease_obesity'),
    'Colesterol alto': t('anamnese.disease_cholesterol'),
    'Nenhuma':         t('anamnese.disease_none'),
  }

  const [step, setStep]     = useState(0)
  const [data, setData]     = useState<AnamneseData>({ ...EMPTY, nome: user?.name ?? '' })
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const total = STEPS.length
  const progress = ((step + 1) / total) * 100

  function set1<K extends keyof AnamneseData>(key: K, val: AnamneseData[K]) {
    setData(d => ({ ...d, [key]: val }))
    setError('')
  }

  function toggleDoenca(d: string) {
    setData(prev => {
      const list = prev.doencas
      if (d === 'Nenhuma') return { ...prev, doencas: list.includes('Nenhuma') ? [] : ['Nenhuma'] }
      const filtered = list.filter(x => x !== 'Nenhuma')
      return { ...prev, doencas: filtered.includes(d) ? filtered.filter(x => x !== d) : [...filtered, d] }
    })
    setError('')
  }

  function goNext() {
    const err = validate(step, data, t)
    if (err) { setError(err); return }
    setError('')
    if (step < total - 1) { setStep(s => s + 1); return }
    void finish()
  }

  async function finish() {
    if (!user?.id) return
    setLoading(true)
    try {
      // 1. Save anamnese to DB
      await supabase.from('profiles').update({ anamnese_completed: true }).eq('id', user.id)
      await supabase.from('anamneses').insert({
        student_id:       user.id,
        nome:             data.nome,
        data_nasc:        data.dataNasc,
        telefone:         data.telefone,
        profissao:        data.profissao,
        altura:           data.altura,
        doencas:          JSON.stringify(data.doencas),
        outra_doenca:     data.outraDoenca,
        medicamentos:     data.medicamentos,
        cirurgia:         data.cirurgia,
        limitacoes:       data.limitacoes,
        pratica_atual:    data.praticaAtual,
        atividade_atual:  data.atividadeAtual,
        treinou_personal: data.treinouPersonal,
        objetivo:         data.objetivo,
        dias_semana:      data.diasSemana,
        horario:          data.horario,
        horas_sono:       data.horasSono,
        nivel_estresse:   data.nivelEstresse,
        fuma:             data.fuma,
        alcool:           data.alcool,
      })

      // 2. Generate PDF (always in Portuguese — goes to Brazilian coach)
      const doc = new jsPDF({ unit: 'mm', format: 'a4' })
      const W = 210, ml = 18, mr = 18, cw = W - ml - mr
      let y = 0

      function header() {
        doc.setFillColor(27, 42, 74)
        doc.rect(0, 0, W, 22, 'F')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(15)
        doc.setTextColor(250, 238, 218)
        doc.text('KINEA', ml, 14)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        doc.setTextColor(139, 151, 173)
        doc.text('Ficha de Anamnese', ml + 26, 14)
        y = 32
      }

      function section(title: string) {
        if (y > 255) { doc.addPage(); header() }
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.setTextColor(232, 84, 42)
        doc.text(title.toUpperCase(), ml, y)
        y += 1
        doc.setDrawColor(232, 84, 42)
        doc.setLineWidth(0.4)
        doc.line(ml, y, ml + cw, y)
        y += 5
        doc.setTextColor(27, 42, 74)
      }

      function field(label: string, value: string) {
        if (!value) return
        if (y > 268) { doc.addPage(); header() }
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.setTextColor(124, 120, 105)
        doc.text(label + ':', ml, y)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(27, 42, 74)
        const lines = doc.splitTextToSize(value, cw - 36)
        doc.text(lines, ml + 36, y)
        y += lines.length * 5 + 2
      }

      header()

      section('Dados Pessoais')
      field('Nome', data.nome)
      field('Data de Nascimento', data.dataNasc)
      field('Telefone', data.telefone)
      field('Profissão', data.profissao || '—')
      field('Altura (cm)', data.altura || '—')
      y += 3

      section('Histórico de Saúde')
      field('Doenças', data.doencas.length ? data.doencas.join(', ') : 'Nenhuma')
      if (data.outraDoenca) field('Outras doenças', data.outraDoenca)
      field('Medicamentos', data.medicamentos || 'Nenhum')
      field('Cirurgias', data.cirurgia || 'Nenhuma')
      field('Limitações / Dores', data.limitacoes || 'Nenhuma')
      y += 3

      section('Atividade Física')
      field('Pratica exercício', data.praticaAtual)
      if (data.atividadeAtual) field('Atividade atual', data.atividadeAtual)
      field('Treinou com personal', data.treinouPersonal)
      y += 3

      section('Objetivos')
      field('Objetivo principal', data.objetivo)
      field('Dias por semana', data.diasSemana + 'x')
      field('Horário preferido', data.horario)
      y += 3

      section('Estilo de Vida')
      field('Horas de sono', data.horasSono)
      field('Nível de estresse', data.nivelEstresse + ' / 5')
      field('Tabagismo', data.fuma)
      field('Consumo de álcool', data.alcool)

      // Footer
      const pageCount = doc.getNumberOfPages()
      for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7)
        doc.setTextColor(180, 170, 155)
        const dateStr = new Date().toLocaleDateString('pt-BR')
        doc.text(`Gerado em ${dateStr}  •  Página ${p} de ${pageCount}`, ml, 292)
      }

      const pdfBlob = doc.output('blob')
      const fileName = `anamnese/${user.id}_${Date.now()}.pdf`

      // 3. Upload PDF to storage
      await supabase.storage.from('chat-attachments').upload(fileName, pdfBlob, { contentType: 'application/pdf' })
      const { data: { publicUrl } } = supabase.storage.from('chat-attachments').getPublicUrl(fileName)

      // 4. Find numeric student ID and send to coach chat
      const { data: studentRow } = await supabase
        .from('students')
        .select('id')
        .eq('student_id', user.id)
        .maybeSingle()

      if (studentRow) {
        await supabase.from('chat_messages').insert({
          student_id:      studentRow.id,
          from_role:       'student',
          text:            null,
          attachment_url:  publicUrl,
          attachment_name: `Anamnese — ${data.nome}.pdf`,
          attachment_size: pdfBlob.size,
          attachment_kind: 'file',
        })
      }
    } catch (err) {
      console.error('[Anamnese] finish error:', err)
    }

    if (user) setUser({ ...user, anamneseCompleted: true })
    navigate('/aluno/primeira-avaliacao')
  }

  // ── Step renders ─────────────────────────────────────────

  const stepContent = [
    // Step 0 — Personal data
    <div key={0} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Field label={t('anamnese.field_full_name')} type="text" placeholder="Seu nome completo" value={data.nome} onChange={e => set1('nome', e.target.value)} />
      <Field label={t('anamnese.field_birth_date')} type="date" value={data.dataNasc} onChange={e => set1('dataNasc', e.target.value)} />
      <Field label={t('anamnese.field_phone')} type="tel" placeholder="(11) 99999-9999" value={data.telefone} onChange={e => set1('telefone', e.target.value)} />
      <Field label={t('anamnese.field_profession')} type="text" placeholder="Ex.: professora, analista..." value={data.profissao} onChange={e => set1('profissao', e.target.value)} />
      <Field label={t('anamnese.field_height')} type="number" placeholder="Ex.: 170" min="100" max="250" value={data.altura} onChange={e => set1('altura', e.target.value)} />
    </div>,

    // Step 1 — Health history
    <div key={1} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label style={labelStyle}>{t('anamnese.field_diseases')}</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {DOENCAS_OPTIONS.map(d => (
            <CheckItem key={d} label={DOENCAS_LABELS[d] ?? d} checked={data.doencas.includes(d)} onToggle={() => toggleDoenca(d)} />
          ))}
        </div>
        {data.doencas.includes('Nenhuma') ? null : (
          <input
            type="text"
            placeholder={t('anamnese.field_other_disease_ph')}
            value={data.outraDoenca}
            onChange={e => set1('outraDoenca', e.target.value)}
            style={{ ...inputStyle, marginTop: 8 }}
          />
        )}
      </div>
      <Textarea label={t('anamnese.field_medications')} value={data.medicamentos} onChange={v => set1('medicamentos', v)} />
      <Textarea label={t('anamnese.field_surgeries')} value={data.cirurgia} onChange={v => set1('cirurgia', v)} />
      <Textarea label={t('anamnese.field_limitations')} value={data.limitacoes} onChange={v => set1('limitacoes', v)} />
    </div>,

    // Step 2 — Physical activity
    <div key={2} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <RadioGroup
        label={t('anamnese.field_exercises_now')}
        options={[
          { value: 'Sim', label: t('anamnese.opt_yes') },
          { value: 'Não', label: t('anamnese.opt_no') },
        ]}
        value={data.praticaAtual}
        onChange={v => set1('praticaAtual', v)}
      />
      {data.praticaAtual === 'Sim' && (
        <Textarea label={t('anamnese.field_current_activity')} rows={2} value={data.atividadeAtual} onChange={v => set1('atividadeAtual', v)} />
      )}
      <RadioGroup
        label={t('anamnese.field_personal_trainer')}
        options={[
          { value: 'Sim',           label: t('anamnese.opt_yes') },
          { value: 'Não',           label: t('anamnese.opt_no') },
          { value: 'Nunca treinei', label: t('anamnese.opt_never_trained') },
        ]}
        value={data.treinouPersonal}
        onChange={v => set1('treinouPersonal', v)}
      />
    </div>,

    // Step 3 — Goals
    <div key={3} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <RadioGroup
        label={t('anamnese.field_main_goal')}
        options={[
          { value: 'Emagrecimento',  label: t('anamnese.obj_weight_loss') },
          { value: 'Hipertrofia',    label: t('anamnese.obj_hypertrophy') },
          { value: 'Condicionamento', label: t('anamnese.obj_conditioning') },
          { value: 'Saúde geral',    label: t('anamnese.obj_general_health') },
          { value: 'Ganho de força', label: t('anamnese.obj_strength') },
          { value: 'Outro',          label: t('anamnese.obj_other') },
        ]}
        value={data.objetivo}
        onChange={v => set1('objetivo', v)}
      />
      <RadioGroup
        label={t('anamnese.field_days_week')}
        options={['2', '3', '4', '5', '6'].map(d => ({ value: d, label: `${d}×` }))}
        value={data.diasSemana}
        onChange={v => set1('diasSemana', v)}
      />
      <RadioGroup
        label={t('anamnese.field_preferred_time')}
        options={[
          { value: 'Manhã',    label: t('anamnese.time_morning') },
          { value: 'Tarde',    label: t('anamnese.time_afternoon') },
          { value: 'Noite',    label: t('anamnese.time_evening') },
          { value: 'Flexível', label: t('anamnese.time_flexible') },
        ]}
        value={data.horario}
        onChange={v => set1('horario', v)}
      />
    </div>,

    // Step 4 — Lifestyle
    <div key={4} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <RadioGroup
        label={t('anamnese.field_sleep_hours')}
        options={[
          { value: 'Menos de 5h', label: t('anamnese.sleep_less5') },
          { value: '5–6h',        label: t('anamnese.sleep_5_6') },
          { value: '7–8h',        label: t('anamnese.sleep_7_8') },
          { value: 'Mais de 8h',  label: t('anamnese.sleep_more8') },
        ]}
        value={data.horasSono}
        onChange={v => set1('horasSono', v)}
      />
      <div>
        <label style={labelStyle}>{t('anamnese.field_stress_level')}</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n} type="button"
              onClick={() => { set1('nivelEstresse', String(n)); setError('') }}
              style={{
                flex: 1, height: 44, borderRadius: 11, cursor: 'pointer',
                border: `1.5px solid ${data.nivelEstresse === String(n) ? '#E8542A' : '#D6CFBE'}`,
                background: data.nivelEstresse === String(n) ? '#E8542A' : '#fff',
                color: data.nivelEstresse === String(n) ? '#fff' : '#1B2A4A',
                font: `700 15px ${FF}`,
              }}
            >
              {n}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
          <span style={{ font: `400 11px ${FF}`, color: '#A39E90' }}>{t('anamnese.stress_low')}</span>
          <span style={{ font: `400 11px ${FF}`, color: '#A39E90' }}>{t('anamnese.stress_high')}</span>
        </div>
      </div>
      <RadioGroup
        label={t('anamnese.field_smoking')}
        options={[
          { value: 'Não fumo',    label: t('anamnese.smoke_no') },
          { value: 'Sim',         label: t('anamnese.smoke_yes') },
          { value: 'Ex-fumante',  label: t('anamnese.smoke_ex') },
        ]}
        value={data.fuma}
        onChange={v => set1('fuma', v)}
      />
      <RadioGroup
        label={t('anamnese.field_alcohol')}
        options={[
          { value: 'Não consumo',    label: t('anamnese.alcohol_no') },
          { value: 'Socialmente',    label: t('anamnese.alcohol_social') },
          { value: 'Frequentemente', label: t('anamnese.alcohol_often') },
        ]}
        value={data.alcool}
        onChange={v => set1('alcool', v)}
      />
    </div>,
  ]

  return (
    <div style={{ background: '#F4EFE3', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #EDE8DC', padding: '14px 18px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          {step > 0 && (
            <button
              onClick={() => { setStep(s => s - 1); setError('') }}
              style={{ width: 34, height: 34, borderRadius: 10, background: '#F4EFE3', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            >
              <ChevronLeft size={18} color="#1B2A4A" strokeWidth={2} />
            </button>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <span style={{ font: `700 14px ${FF}`, color: '#1B2A4A' }}>{STEPS[step]}</span>
              <span style={{ font: `500 11px ${FF}`, color: '#A39E90' }}>{t('anamnese.step_of', { step: step + 1, total })}</span>
            </div>
            <div style={{ height: 4, background: '#EDE8DC', borderRadius: 4 }}>
              <div style={{ height: '100%', width: `${progress}%`, background: '#E8542A', borderRadius: 4, transition: 'width 300ms ease' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Intro (only step 0) */}
      {step === 0 && (
        <div style={{ padding: '20px 18px 0' }}>
          <div style={{ background: '#1B2A4A', borderRadius: 16, padding: '18px 18px' }}>
            <div style={{ font: `800 18px ${FF}`, color: '#FAEEDA', letterSpacing: '-.3px', marginBottom: 6 }}>
              {t('anamnese.welcome_title')}
            </div>
            <div style={{ font: `400 13px ${FF}`, color: '#8B97AD', lineHeight: 1.55 }}>
              {t('anamnese.welcome_desc')}
            </div>
          </div>
        </div>
      )}

      {/* Form content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 18px 120px' }}>
        {stepContent[step]}

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fdeee9', border: '1px solid #f6cdbf', borderRadius: 10, padding: '11px 13px', marginTop: 16 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#E8542A" strokeWidth="2.2" strokeLinecap="round">
              <circle cx="12" cy="12" r="9" /><path d="M12 7v6" /><path d="M12 16.5v.5" />
            </svg>
            <span style={{ font: `500 13px ${FF}`, color: '#c4421e' }}>{error}</span>
          </div>
        )}
      </div>

      {/* Fixed CTA */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 390,
        padding: '12px 18px 24px', background: '#F4EFE3',
        borderTop: '1px solid #EDE8DC',
      }}>
        <button
          type="button"
          onClick={goNext}
          disabled={loading}
          style={{
            width: '100%', padding: '15px 0', background: loading ? '#c4421e' : '#E8542A',
            border: 'none', borderRadius: 14, boxShadow: loading ? 'none' : '0 4px 0 #C4421E',
            font: `700 16px ${FF}`, color: '#fff', cursor: loading ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}
        >
          {loading ? (
            <>
              <span style={{ width: 18, height: 18, border: '2.5px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'kspin .7s linear infinite' }} />
              {t('anamnese.generating_pdf')}
            </>
          ) : step < total - 1 ? t('anamnese.continue') : t('anamnese.submit_and_send')}
        </button>
      </div>
    </div>
  )
}

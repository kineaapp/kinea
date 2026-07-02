import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Check } from 'lucide-react'
import jsPDF from 'jspdf'
import { useAuthStore } from '../../store/auth'
import { useChatStore } from '../../store/chat'
import { supabase } from '../../lib/supabase'

// ── Types ────────────────────────────────────────────────────

interface AnamneseData {
  nome: string; dataNasc: string; telefone: string; profissao: string
  doencas: string[]; outraDoenca: string; medicamentos: string; cirurgia: string; limitacoes: string
  praticaAtual: string; atividadeAtual: string; treinouPersonal: string
  objetivo: string; diasSemana: string; horario: string
  horasSono: string; nivelEstresse: string; fuma: string; alcool: string
}

const EMPTY: AnamneseData = {
  nome: '', dataNasc: '', telefone: '', profissao: '',
  doencas: [], outraDoenca: '', medicamentos: '', cirurgia: '', limitacoes: '',
  praticaAtual: '', atividadeAtual: '', treinouPersonal: '',
  objetivo: '', diasSemana: '', horario: '',
  horasSono: '', nivelEstresse: '', fuma: '', alcool: '',
}

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

// ── PDF generation ───────────────────────────────────────────

function buildPDF(data: AnamneseData, nomeAluno: string): string {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = 210
  const L = 18
  let y = 0

  // Header navy
  doc.setFillColor(27, 42, 74)
  doc.rect(0, 0, W, 38, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(250, 238, 218)
  doc.text('kinea', L, 18)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(139, 151, 173)
  doc.text('Anamnese Inicial', L, 28)

  const dataHoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
  doc.text(`Data: ${dataHoje}`, W - L, 18, { align: 'right' })
  doc.text(`Aluno(a): ${data.nome || nomeAluno}`, W - L, 26, { align: 'right' })

  y = 50

  function section(title: string) {
    doc.setFillColor(244, 239, 227)
    doc.roundedRect(L - 4, y - 5, W - 2 * L + 8, 9, 2, 2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(27, 42, 74)
    doc.text(title.toUpperCase(), L, y)
    y += 9
  }

  function qa(question: string, answer: string) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(124, 120, 105)
    doc.text(question, L, y)
    y += 5

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(27, 42, 74)
    const lines = doc.splitTextToSize(answer || 'Não informado', W - 2 * L)
    doc.text(lines, L, y)
    y += lines.length * 5 + 5

    if (y > 270) { doc.addPage(); y = 20 }
  }

  // ── Dados Pessoais
  section('Dados Pessoais')
  qa('Nome completo', data.nome)
  qa('Data de nascimento', data.dataNasc)
  qa('Telefone', data.telefone)
  qa('Profissão', data.profissao)
  y += 3

  // ── Histórico de Saúde
  section('Histórico de Saúde')
  const doencasStr = data.doencas.filter(d => d !== 'Nenhuma').join(', ') + (data.outraDoenca ? `, ${data.outraDoenca}` : '')
  qa('Doenças pré-existentes', doencasStr || 'Nenhuma')
  qa('Medicamentos em uso', data.medicamentos)
  qa('Histórico de cirurgias', data.cirurgia)
  qa('Limitações ou dores físicas', data.limitacoes)
  y += 3

  // ── Atividade Física
  section('Atividade Física')
  qa('Pratica exercício atualmente', data.praticaAtual)
  if (data.praticaAtual === 'Sim') qa('Atividade e frequência', data.atividadeAtual)
  qa('Já treinou com personal trainer', data.treinouPersonal)
  y += 3

  // ── Objetivos
  section('Objetivos')
  qa('Objetivo principal', data.objetivo)
  qa('Dias disponíveis por semana', data.diasSemana ? `${data.diasSemana} dias` : '')
  qa('Horário preferido', data.horario)
  y += 3

  // ── Estilo de Vida
  section('Estilo de Vida')
  qa('Horas de sono por noite', data.horasSono)
  qa('Nível de estresse (1–5)', data.nivelEstresse)
  qa('Tabagismo', data.fuma)
  qa('Consumo de álcool', data.alcool)
  y += 8

  // Footer
  doc.setDrawColor(214, 207, 190)
  doc.setLineWidth(0.3)
  doc.line(L, y, W - L, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(163, 158, 144)
  doc.text('Documento gerado automaticamente pelo app Kinea. Uso exclusivo do coach responsável.', L, y)

  return doc.output('datauristring')
}

// ── Validation per step ──────────────────────────────────────

function validate(step: number, data: AnamneseData): string | null {
  if (step === 0) {
    if (!data.nome.trim())     return 'Informe seu nome completo.'
    if (!data.dataNasc)        return 'Informe sua data de nascimento.'
    if (!data.telefone.trim()) return 'Informe seu telefone.'
  }
  if (step === 2) {
    if (!data.praticaAtual)    return 'Responda se pratica exercício atualmente.'
    if (!data.treinouPersonal) return 'Responda se já treinou com personal.'
  }
  if (step === 3) {
    if (!data.objetivo)   return 'Escolha seu objetivo principal.'
    if (!data.diasSemana) return 'Informe quantos dias por semana você tem disponíveis.'
    if (!data.horario)    return 'Escolha seu horário preferido.'
  }
  if (step === 4) {
    if (!data.horasSono)    return 'Informe suas horas de sono.'
    if (!data.nivelEstresse) return 'Avalie seu nível de estresse.'
    if (!data.fuma)          return 'Responda sobre tabagismo.'
    if (!data.alcool)        return 'Responda sobre consumo de álcool.'
  }
  return null
}

// ── Step content ─────────────────────────────────────────────

const DOENCAS_OPTIONS = ['Diabetes', 'Hipertensão', 'Doença cardíaca', 'Asma', 'Obesidade', 'Colesterol alto', 'Nenhuma']

const STEPS = [
  'Dados Pessoais',
  'Histórico de Saúde',
  'Atividade Física',
  'Objetivos',
  'Estilo de Vida',
]

// ── Main component ───────────────────────────────────────────

export default function Anamnese() {
  const navigate = useNavigate()
  const { user, setUser } = useAuthStore()
  const { addMessage } = useChatStore()

  const [step, setStep]     = useState(0)
  const [data, setData]     = useState<AnamneseData>(EMPTY)
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
    const err = validate(step, data)
    if (err) { setError(err); return }
    setError('')
    if (step < total - 1) { setStep(s => s + 1); return }
    finish()
  }

  function finish() {
    setLoading(true)
    const nomeAluno = user?.name ?? 'Aluno'
    setTimeout(async () => {
      const dataUri = buildPDF(data, nomeAluno)
      const agora   = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      const filename = `Anamnese_${nomeAluno.replace(/\s+/g, '_')}.pdf`

      addMessage({ type: 'file', from: 'aluno', filename, dataUri, size: '~42 KB', time: agora })
      addMessage({
        type: 'text', from: 'coach',
        text: `Olá, ${nomeAluno}! 👋 Recebi sua anamnese. Vou analisar tudo e já começo a montar seu treino personalizado. Em breve entro em contato!`,
        time: agora,
      })

      if (user?.id) {
        await supabase.from('profiles').update({ anamnese_completed: true }).eq('id', user.id)
      }
      if (user) setUser({ ...user, anamneseCompleted: true })
      navigate('/aluno/primeira-avaliacao')
    }, 1200)
  }

  // ── Step renders ─────────────────────────────────────────

  const stepContent = [
    // Step 0 — Dados Pessoais
    <div key={0} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Field label="Nome completo *" type="text" placeholder="Seu nome completo" value={data.nome} onChange={e => set1('nome', e.target.value)} />
      <Field label="Data de nascimento *" type="date" value={data.dataNasc} onChange={e => set1('dataNasc', e.target.value)} />
      <Field label="Telefone / WhatsApp *" type="tel" placeholder="(11) 99999-9999" value={data.telefone} onChange={e => set1('telefone', e.target.value)} />
      <Field label="Profissão" type="text" placeholder="Ex.: professora, analista..." value={data.profissao} onChange={e => set1('profissao', e.target.value)} />
    </div>,

    // Step 1 — Histórico de Saúde
    <div key={1} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label style={labelStyle}>Doenças pré-existentes</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {DOENCAS_OPTIONS.map(d => (
            <CheckItem key={d} label={d} checked={data.doencas.includes(d)} onToggle={() => toggleDoenca(d)} />
          ))}
        </div>
        {data.doencas.includes('Nenhuma') ? null : (
          <input
            type="text"
            placeholder="Outras — descreva aqui"
            value={data.outraDoenca}
            onChange={e => set1('outraDoenca', e.target.value)}
            style={{ ...inputStyle, marginTop: 8 }}
          />
        )}
      </div>
      <Textarea label="Medicamentos em uso (se nenhum, deixe em branco)" value={data.medicamentos} onChange={v => set1('medicamentos', v)} />
      <Textarea label="Histórico de cirurgias (se nenhuma, deixe em branco)" value={data.cirurgia} onChange={v => set1('cirurgia', v)} />
      <Textarea label="Limitações ou dores físicas (se nenhuma, deixe em branco)" value={data.limitacoes} onChange={v => set1('limitacoes', v)} />
    </div>,

    // Step 2 — Atividade Física
    <div key={2} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <RadioGroup
        label="Pratica exercício físico atualmente? *"
        options={[{ value: 'Sim', label: 'Sim' }, { value: 'Não', label: 'Não' }]}
        value={data.praticaAtual}
        onChange={v => set1('praticaAtual', v)}
      />
      {data.praticaAtual === 'Sim' && (
        <Textarea label="Qual atividade e frequência?" rows={2} value={data.atividadeAtual} onChange={v => set1('atividadeAtual', v)} />
      )}
      <RadioGroup
        label="Já treinou com personal trainer? *"
        options={[
          { value: 'Sim', label: 'Sim' },
          { value: 'Não', label: 'Não' },
          { value: 'Nunca treinei', label: 'Nunca treinei' },
        ]}
        value={data.treinouPersonal}
        onChange={v => set1('treinouPersonal', v)}
      />
    </div>,

    // Step 3 — Objetivos
    <div key={3} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <RadioGroup
        label="Objetivo principal *"
        options={[
          { value: 'Emagrecimento', label: 'Emagrecimento' },
          { value: 'Hipertrofia', label: 'Hipertrofia' },
          { value: 'Condicionamento', label: 'Condicionamento' },
          { value: 'Saúde geral', label: 'Saúde geral' },
          { value: 'Ganho de força', label: 'Ganho de força' },
          { value: 'Outro', label: 'Outro' },
        ]}
        value={data.objetivo}
        onChange={v => set1('objetivo', v)}
      />
      <RadioGroup
        label="Dias disponíveis por semana *"
        options={['2', '3', '4', '5', '6'].map(d => ({ value: d, label: `${d}×` }))}
        value={data.diasSemana}
        onChange={v => set1('diasSemana', v)}
      />
      <RadioGroup
        label="Horário preferido *"
        options={[
          { value: 'Manhã', label: 'Manhã' },
          { value: 'Tarde', label: 'Tarde' },
          { value: 'Noite', label: 'Noite' },
          { value: 'Flexível', label: 'Flexível' },
        ]}
        value={data.horario}
        onChange={v => set1('horario', v)}
      />
    </div>,

    // Step 4 — Estilo de Vida
    <div key={4} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <RadioGroup
        label="Horas de sono por noite *"
        options={[
          { value: 'Menos de 5h', label: '< 5h' },
          { value: '5–6h', label: '5–6h' },
          { value: '7–8h', label: '7–8h' },
          { value: 'Mais de 8h', label: '> 8h' },
        ]}
        value={data.horasSono}
        onChange={v => set1('horasSono', v)}
      />
      <div>
        <label style={labelStyle}>Nível de estresse *</label>
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
          <span style={{ font: `400 11px ${FF}`, color: '#A39E90' }}>Baixo</span>
          <span style={{ font: `400 11px ${FF}`, color: '#A39E90' }}>Alto</span>
        </div>
      </div>
      <RadioGroup
        label="Tabagismo *"
        options={[
          { value: 'Não fumo', label: 'Não fumo' },
          { value: 'Sim', label: 'Sim' },
          { value: 'Ex-fumante', label: 'Ex-fumante' },
        ]}
        value={data.fuma}
        onChange={v => set1('fuma', v)}
      />
      <RadioGroup
        label="Consumo de álcool *"
        options={[
          { value: 'Não consumo', label: 'Não consumo' },
          { value: 'Socialmente', label: 'Socialmente' },
          { value: 'Frequentemente', label: 'Frequentemente' },
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
              <span style={{ font: `500 11px ${FF}`, color: '#A39E90' }}>Passo {step + 1} de {total}</span>
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
              Bem-vindo(a) à Kinea!
            </div>
            <div style={{ font: `400 13px ${FF}`, color: '#8B97AD', lineHeight: 1.55 }}>
              Antes de liberar seus treinos, seu coach precisa conhecer você. Preencha a anamnese — leva cerca de 3 minutos.
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
              Gerando PDF e enviando...
            </>
          ) : step < total - 1 ? 'Continuar →' : 'Concluir e enviar'}
        </button>
      </div>
    </div>
  )
}

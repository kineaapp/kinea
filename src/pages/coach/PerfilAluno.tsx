import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getInitials, payInfo, semInfo, avatarPalette } from '../../data/mock'
import { useStudentsStore } from '../../store/students'
import { useAuthStore } from '../../store/auth'
import { supabase } from '../../lib/supabase'
import { ProfileAssessmentModal } from '../../components/coach/ProfileAssessmentModal'
import type { SavedAssessmentRow } from '../../components/coach/ProfileAssessmentModal'

const FF = '"Libre Franklin",sans-serif'

type Tab = 'overview' | 'anamnese' | 'treino' | 'feedback' | 'avaliacoes' | 'pagamentos' | 'anexos' | 'historico'

// ── Interfaces ─────────────────────────────────────────────────
interface AnamneseRow {
  nome: string; data_nasc: string; telefone: string; profissao: string; altura: string
  doencas: string; outra_doenca: string; medicamentos: string; cirurgia: string; limitacoes: string
  pratica_atual: string; atividade_atual: string; treinou_personal: string
  objetivo: string; dias_semana: string; horario: string
  horas_sono: string; nivel_estresse: string; fuma: string; alcool: string
  created_at: string
  student_id: string | null
  students_row_id: number | null
}

interface ExerciseRow { name: string; sets: number; reps: string; sort_order: number }

interface WorkoutRow {
  id: number; name: string; description: string | null
  muscle_group: string | null; difficulty: string; duration_min: number
  exercises: ExerciseRow[]
}

interface AssignmentRow { id: number; day_of_week: number | null; workouts: WorkoutRow }

interface ProgramSlotDetail {
  id: number; position: number; day_of_week: number | null
  workouts: { id: number; name: string; muscle_group: string | null; duration_min: number } | null
}
interface ActiveProgram {
  assignment_id: number; program_id: number; name: string; days_per_week: number
  slots: ProgramSlotDetail[]
}
interface ProgramOption {
  id: number; name: string; days_per_week: number; is_template: boolean
  slots: { position: number; workouts: { name: string } | null }[]
}

interface AssessmentRow {
  id: number; assessed_at: string
  weight_kg: number | null; body_fat_pct: number | null
  chest_cm: number | null; waist_cm: number | null; hip_cm: number | null
  arm_cm: number | null; thigh_cm: number | null; notes: string | null
  photo_frente_url: string | null
  photo_lado_esq_url: string | null
  photo_lado_dir_url: string | null
  photo_costas_url: string | null
}

interface PaymentRow {
  id: number; amount: number; status: string
  due_date: string; paid_at: string | null; description: string | null
}

interface AttachmentRow {
  id: number; name: string; url: string
  size: number | null; mime_type: string | null; uploaded_at: string
}

interface CheckInRow { id: number; content: string; created_at: string }

interface SessionRow {
  id:           number
  completed_at: string
  intensity:    number | null
  pain:         number | null
  notes:        string | null
  workouts:     { name: string } | null
}

// ── Helpers ────────────────────────────────────────────────────
const MONTHS_PT: Record<string, number> = {
  jan:0,fev:1,mar:2,abr:3,mai:4,jun:5,jul:6,ago:7,set:8,out:9,nov:10,dez:11,
}
function calcSemanas(since: string): number {
  const [mon, yr] = since.split('/')
  const d = new Date(parseInt(yr), MONTHS_PT[mon] ?? 0, 1)
  return Math.max(1, Math.floor((Date.now() - d.getTime()) / 604800000))
}
function fmtDate(iso: string) {
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}
function fmtMoney(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
const DAY_NAMES = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
const STATUS_PAY: Record<string, { label: string; color: string; bg: string }> = {
  active:  { label: 'Pago',     color: '#1B7a4a', bg: '#e7f3ea' },
  pending: { label: 'Pendente', color: '#b06a12', bg: '#f7ecd9' },
  overdue: { label: 'Atrasado', color: '#c4421e', bg: '#fbe6e1' },
}

// ── Coach Anamnese Drawer ──────────────────────────────────────
const DOENCAS_OPTS = ['Diabetes', 'Hipertensão', 'Doença cardíaca', 'Asma', 'Obesidade', 'Colesterol alto', 'Nenhuma']

interface AnamneseFormData {
  nome: string; dataNasc: string; telefone: string; profissao: string; altura: string
  doencas: string[]; outraDoenca: string; medicamentos: string; cirurgia: string; limitacoes: string
  praticaAtual: string; atividadeAtual: string; treinouPersonal: string
  objetivo: string; diasSemana: string; horario: string
  horasSono: string; nivelEstresse: string; fuma: string; alcool: string
}

const ANAMNESE_EMPTY: AnamneseFormData = {
  nome: '', dataNasc: '', telefone: '', profissao: '', altura: '',
  doencas: [], outraDoenca: '', medicamentos: '', cirurgia: '', limitacoes: '',
  praticaAtual: '', atividadeAtual: '', treinouPersonal: '',
  objetivo: '', diasSemana: '', horario: '',
  horasSono: '', nivelEstresse: '', fuma: '', alcool: '',
}

function CoachAnamneseDrawer({ studentName, studentUuid, studentRowId, existing, onClose, onSaved }: {
  studentName:  string
  studentUuid:  string
  studentRowId: number
  existing:     AnamneseRow | null
  onClose:      () => void
  onSaved:      (row: AnamneseRow) => void
}) {
  const init: AnamneseFormData = existing ? {
    nome: existing.nome, dataNasc: existing.data_nasc, telefone: existing.telefone, profissao: existing.profissao, altura: existing.altura ?? '',
    doencas: (() => { try { const p = JSON.parse(existing.doencas); return Array.isArray(p) ? p : [] } catch { return [] } })(),
    outraDoenca: existing.outra_doenca, medicamentos: existing.medicamentos, cirurgia: existing.cirurgia, limitacoes: existing.limitacoes,
    praticaAtual: existing.pratica_atual, atividadeAtual: existing.atividade_atual, treinouPersonal: existing.treinou_personal,
    objetivo: existing.objetivo, diasSemana: existing.dias_semana, horario: existing.horario,
    horasSono: existing.horas_sono, nivelEstresse: existing.nivel_estresse, fuma: existing.fuma, alcool: existing.alcool,
  } : { ...ANAMNESE_EMPTY, nome: studentName }

  const [form, setForm] = useState<AnamneseFormData>(init)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set1<K extends keyof AnamneseFormData>(key: K, val: AnamneseFormData[K]) {
    setForm(f => ({ ...f, [key]: val })); setError('')
  }

  function toggleDoenca(d: string) {
    setForm(prev => {
      const list = prev.doencas
      if (d === 'Nenhuma') return { ...prev, doencas: list.includes('Nenhuma') ? [] : ['Nenhuma'] }
      const filtered = list.filter(x => x !== 'Nenhuma')
      return { ...prev, doencas: filtered.includes(d) ? filtered.filter(x => x !== d) : [...filtered, d] }
    })
  }

  async function save() {
    if (!form.nome.trim()) { setError('Informe o nome do aluno.'); return }
    setSaving(true)
    const payload: Record<string, unknown> = {
      ...(studentUuid ? { student_id: studentUuid } : { students_row_id: studentRowId }),
      nome:             form.nome,
      data_nasc:        form.dataNasc,
      telefone:         form.telefone,
      profissao:        form.profissao,
      altura:           form.altura,
      doencas:          JSON.stringify(form.doencas),
      outra_doenca:     form.outraDoenca,
      medicamentos:     form.medicamentos,
      cirurgia:         form.cirurgia,
      limitacoes:       form.limitacoes,
      pratica_atual:    form.praticaAtual,
      atividade_atual:  form.atividadeAtual,
      treinou_personal: form.treinouPersonal,
      objetivo:         form.objetivo,
      dias_semana:      form.diasSemana,
      horario:          form.horario,
      horas_sono:       form.horasSono,
      nivel_estresse:   form.nivelEstresse,
      fuma:             form.fuma,
      alcool:           form.alcool,
    }
    const { data, error: err } = await supabase.from('anamneses').insert(payload).select().single()
    if (err) { setError('Erro ao salvar: ' + err.message); setSaving(false); return }
    await supabase.from('profiles').update({ anamnese_completed: true }).eq('id', studentUuid)
    onSaved(data as AnamneseRow)
    setSaving(false)
    onClose()
  }

  const inp: React.CSSProperties = { width: '100%', height: 44, border: '1.5px solid #d9d3c4', borderRadius: 10, background: '#fff', padding: '0 13px', font: `400 14px ${FF}`, color: '#1B2A4A', outline: 'none', boxSizing: 'border-box' }
  const ta: React.CSSProperties  = { width: '100%', border: '1.5px solid #d9d3c4', borderRadius: 10, background: '#fff', padding: '10px 13px', font: `400 14px ${FF}`, color: '#1B2A4A', outline: 'none', resize: 'none', boxSizing: 'border-box', lineHeight: 1.5 }
  const lbl: React.CSSProperties = { display: 'block', font: `600 11px ${FF}`, color: '#6b6657', textTransform: 'uppercase' as const, letterSpacing: '.4px', marginBottom: 7 }

  function Chip({ val, active, onClick }: { val: string; active: boolean; onClick: () => void }) {
    return (
      <button type="button" onClick={onClick} style={{ padding: '8px 14px', borderRadius: 20, cursor: 'pointer', font: `600 12.5px ${FF}`, border: `1.5px solid ${active ? '#E8542A' : '#d9d3c4'}`, background: active ? '#E8542A' : '#fff', color: active ? '#fff' : '#1B2A4A' }}>
        {val}
      </button>
    )
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,25,40,.45)', zIndex: 70 }} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 520, maxWidth: '94vw', background: '#F4EFE3', zIndex: 71, boxShadow: '-12px 0 40px rgba(0,0,0,.22)', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ background: '#1B2A4A', padding: '20px 22px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ font: `800 17px ${FF}`, color: '#FAEEDA', letterSpacing: '-.3px' }}>
              {existing ? 'Editar anamnese' : 'Preencher anamnese'}
            </div>
            <div style={{ font: `500 12px ${FF}`, color: '#8B97AD', marginTop: 3 }}>{studentName}</div>
          </div>
          <button type="button" onClick={onClose} style={{ border: 'none', background: 'rgba(255,255,255,.1)', cursor: 'pointer', color: '#fff', width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Scrollable form */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px 24px', display: 'flex', flexDirection: 'column', gap: 22 }}>

          {/* Dados pessoais */}
          <section>
            <div style={{ font: `700 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#E8542A', marginBottom: 12 }}>Dados pessoais</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label style={lbl}>Nome completo</label><input style={inp} value={form.nome} onChange={e => set1('nome', e.target.value)} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={lbl}>Data de nascimento</label><input type="date" style={inp} value={form.dataNasc} onChange={e => set1('dataNasc', e.target.value)} /></div>
                <div><label style={lbl}>Telefone / WhatsApp</label><input style={inp} placeholder="(11) 99999-9999" value={form.telefone} onChange={e => set1('telefone', e.target.value)} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={lbl}>Profissão</label><input style={inp} placeholder="Ex.: professora, analista..." value={form.profissao} onChange={e => set1('profissao', e.target.value)} /></div>
                <div><label style={lbl}>Altura (cm)</label><input type="number" style={inp} placeholder="Ex.: 170" min={100} max={250} value={form.altura} onChange={e => set1('altura', e.target.value)} /></div>
              </div>
            </div>
          </section>

          {/* Histórico de saúde */}
          <section>
            <div style={{ font: `700 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#E8542A', marginBottom: 12 }}>Histórico de saúde</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={lbl}>Doenças pré-existentes</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {DOENCAS_OPTS.map(d => <Chip key={d} val={d} active={form.doencas.includes(d)} onClick={() => toggleDoenca(d)} />)}
                </div>
                {!form.doencas.includes('Nenhuma') && (
                  <input style={{ ...inp, marginTop: 8 }} placeholder="Outras — descreva aqui" value={form.outraDoenca} onChange={e => set1('outraDoenca', e.target.value)} />
                )}
              </div>
              <div><label style={lbl}>Medicamentos em uso</label><textarea rows={2} style={ta} placeholder="Se nenhum, deixe em branco" value={form.medicamentos} onChange={e => set1('medicamentos', e.target.value)} /></div>
              <div><label style={lbl}>Histórico de cirurgias</label><textarea rows={2} style={ta} placeholder="Se nenhuma, deixe em branco" value={form.cirurgia} onChange={e => set1('cirurgia', e.target.value)} /></div>
              <div><label style={lbl}>Limitações ou dores físicas</label><textarea rows={2} style={ta} placeholder="Se nenhuma, deixe em branco" value={form.limitacoes} onChange={e => set1('limitacoes', e.target.value)} /></div>
            </div>
          </section>

          {/* Atividade física */}
          <section>
            <div style={{ font: `700 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#E8542A', marginBottom: 12 }}>Atividade física</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={lbl}>Pratica exercício atualmente?</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['Sim', 'Não'].map(v => <Chip key={v} val={v} active={form.praticaAtual === v} onClick={() => set1('praticaAtual', v)} />)}
                </div>
              </div>
              {form.praticaAtual === 'Sim' && (
                <div><label style={lbl}>Qual atividade e frequência?</label><textarea rows={2} style={ta} value={form.atividadeAtual} onChange={e => set1('atividadeAtual', e.target.value)} /></div>
              )}
              <div>
                <label style={lbl}>Já treinou com personal trainer?</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {['Sim', 'Não', 'Nunca treinei'].map(v => <Chip key={v} val={v} active={form.treinouPersonal === v} onClick={() => set1('treinouPersonal', v)} />)}
                </div>
              </div>
            </div>
          </section>

          {/* Objetivos */}
          <section>
            <div style={{ font: `700 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#E8542A', marginBottom: 12 }}>Objetivos</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={lbl}>Objetivo principal</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {['Emagrecimento', 'Hipertrofia', 'Condicionamento', 'Saúde geral', 'Ganho de força', 'Outro'].map(v =>
                    <Chip key={v} val={v} active={form.objetivo === v} onClick={() => set1('objetivo', v)} />)}
                </div>
              </div>
              <div>
                <label style={lbl}>Dias disponíveis por semana</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['2', '3', '4', '5', '6'].map(v => <Chip key={v} val={`${v}×`} active={form.diasSemana === v} onClick={() => set1('diasSemana', v)} />)}
                </div>
              </div>
              <div>
                <label style={lbl}>Horário preferido</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {['Manhã', 'Tarde', 'Noite', 'Flexível'].map(v => <Chip key={v} val={v} active={form.horario === v} onClick={() => set1('horario', v)} />)}
                </div>
              </div>
            </div>
          </section>

          {/* Estilo de vida */}
          <section>
            <div style={{ font: `700 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#E8542A', marginBottom: 12 }}>Estilo de vida</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={lbl}>Horas de sono por noite</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {[['Menos de 5h', '< 5h'], ['5–6h', '5–6h'], ['7–8h', '7–8h'], ['Mais de 8h', '> 8h']].map(([val, label]) =>
                    <Chip key={val} val={label} active={form.horasSono === val} onClick={() => set1('horasSono', val)} />)}
                </div>
              </div>
              <div>
                <label style={lbl}>Nível de estresse (1 = baixo, 5 = alto)</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} type="button" onClick={() => set1('nivelEstresse', String(n))} style={{ flex: 1, height: 42, borderRadius: 10, cursor: 'pointer', border: `1.5px solid ${form.nivelEstresse === String(n) ? '#E8542A' : '#d9d3c4'}`, background: form.nivelEstresse === String(n) ? '#E8542A' : '#fff', color: form.nivelEstresse === String(n) ? '#fff' : '#1B2A4A', font: `700 15px ${FF}` }}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={lbl}>Tabagismo</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {['Não fumo', 'Sim', 'Ex-fumante'].map(v => <Chip key={v} val={v} active={form.fuma === v} onClick={() => set1('fuma', v)} />)}
                </div>
              </div>
              <div>
                <label style={lbl}>Consumo de álcool</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {['Não consumo', 'Socialmente', 'Frequentemente'].map(v => <Chip key={v} val={v} active={form.alcool === v} onClick={() => set1('alcool', v)} />)}
                </div>
              </div>
            </div>
          </section>

          {error && (
            <div style={{ background: '#fdeee9', border: '1px solid #f6cdbf', borderRadius: 10, padding: '11px 14px', font: `500 13px ${FF}`, color: '#c4421e' }}>{error}</div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 22px 20px', borderTop: '1px solid #e6e0d0', background: '#F4EFE3', flexShrink: 0, display: 'flex', gap: 10 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, height: 46, border: '1.5px solid #d9d3c4', background: '#fff', color: '#1B2A4A', borderRadius: 10, font: `600 13.5px ${FF}`, cursor: 'pointer' }}>
            Cancelar
          </button>
          <button type="button" onClick={save} disabled={saving} style={{ flex: 2, height: 46, border: 'none', background: saving ? '#c4421e' : '#E8542A', color: '#fff', borderRadius: 10, font: `700 14px ${FF}`, cursor: saving ? 'default' : 'pointer', boxShadow: saving ? 'none' : '0 2px 0 #c4421e', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {saving ? 'Salvando...' : (existing ? 'Salvar alterações' : 'Salvar anamnese')}
          </button>
        </div>
      </div>
    </>
  )
}

// ── Empty state ────────────────────────────────────────────────
function Empty({ icon, title, sub }: { icon: string; title: string; sub?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 14, padding: '40px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 32, marginBottom: 10 }}>{icon}</div>
      <div style={{ font: `700 15px ${FF}`, color: '#1B2A4A', marginBottom: 4 }}>{title}</div>
      {sub && <div style={{ font: `400 13px ${FF}`, color: '#9a948a' }}>{sub}</div>}
    </div>
  )
}

// ── Toast ──────────────────────────────────────────────────────
function Toast({ msg }: { msg: string }) {
  if (!msg) return null
  return (
    <div style={{ position: 'fixed', left: '50%', bottom: 28, transform: 'translateX(-50%)', zIndex: 90, background: '#1B2A4A', color: '#FAEEDA', font: `600 13.5px ${FF}`, padding: '13px 20px', borderRadius: 11, boxShadow: '0 10px 30px rgba(0,0,0,.28)' }}>
      {msg}
    </div>
  )
}

// ── Assign Program Modal ───────────────────────────────────────
function AssignProgramModal({ studentId, coachId, onClose, onAssigned }: {
  studentId: number; coachId: string; onClose: () => void; onAssigned: () => void
}) {
  const [programs, setPrograms] = useState<ProgramOption[]>([])
  const [loading,  setLoading]  = useState(true)
  const [selId,    setSelId]    = useState<number | null>(null)
  const [saving,   setSaving]   = useState(false)
  const [err,      setErr]      = useState('')

  useEffect(() => {
    supabase.from('programs')
      .select('id, name, days_per_week, is_template, program_slots(position, workouts(name))')
      .eq('coach_id', coachId)
      .order('is_template', { ascending: false })
      .order('created_at', { ascending: false })
      .then(({ data }) => { setPrograms((data as ProgramOption[] | null) ?? []); setLoading(false) })
  }, [coachId])

  async function handleConfirm() {
    if (!selId) { setErr('Selecione um programa.'); return }
    setSaving(true)
    await supabase.from('program_assignments').update({ active: false }).eq('student_id', studentId).eq('active', true)
    const { error } = await supabase.from('program_assignments').insert({ program_id: selId, student_id: studentId, active: true })
    if (error) { setErr('Erro: ' + error.message); setSaving(false); return }
    onAssigned(); onClose()
  }

  const slotLabel = (pos: number) => String.fromCharCode(64 + pos)

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,25,40,.5)', zIndex: 82, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, background: '#fff', borderRadius: 16, boxShadow: '0 24px 60px rgba(0,0,0,.3)', display: 'flex', flexDirection: 'column', maxHeight: '86vh' }}>

        <div style={{ padding: '24px 24px 16px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
            <h2 style={{ font: `800 20px ${FF}`, color: '#1B2A4A', margin: 0, letterSpacing: '-.4px' }}>Atribuir programa</h2>
            <button type="button" onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9a948a', padding: 2 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
            </button>
          </div>
          <p style={{ font: `400 13px ${FF}`, color: '#7c7869', margin: '6px 0 0' }}>Selecione um programa para atribuir a este aluno.</p>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loading ? (
            <div style={{ font: `400 13px ${FF}`, color: '#9a948a', padding: '20px 0' }}>Carregando...</div>
          ) : programs.length === 0 ? (
            <div style={{ font: `400 13px ${FF}`, color: '#9a948a', padding: '20px 0', textAlign: 'center' }}>Nenhum programa criado ainda. Crie um programa na aba Treinos.</div>
          ) : programs.map(p => {
            const active = selId === p.id
            const slots = [...(p.slots ?? [])].sort((a, b) => a.position - b.position)
            return (
              <button key={p.id} type="button" onClick={() => { setSelId(p.id); setErr('') }}
                style={{ width: '100%', textAlign: 'left', border: `2px solid ${active ? '#E8542A' : '#ece7d9'}`, background: active ? '#fff8f6' : '#fff', borderRadius: 12, padding: '14px 16px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ font: `700 14px ${FF}`, color: '#1B2A4A', flex: 1 }}>{p.name}</span>
                  {p.is_template && (
                    <span style={{ font: `600 10px ${FF}`, color: '#5a4ea0', background: '#ece9f6', borderRadius: 20, padding: '2px 8px', flexShrink: 0 }}>Template</span>
                  )}
                  <span style={{ font: `400 11px ${FF}`, color: '#9a948a', flexShrink: 0 }}>{p.days_per_week}×/sem</span>
                </div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {slots.map(sl => (
                    <span key={sl.position} style={{ font: `500 11.5px ${FF}`, color: '#4a4742', background: '#f4efe3', borderRadius: 6, padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ font: `700 10px ${FF}`, color: '#E8542A' }}>{slotLabel(sl.position)}</span>
                      {sl.workouts ? sl.workouts.name : <span style={{ color: '#9a948a' }}>Vazio</span>}
                    </span>
                  ))}
                </div>
              </button>
            )
          })}
        </div>

        <div style={{ padding: '16px 24px 24px', flexShrink: 0, borderTop: '1px solid #f4efe3' }}>
          {err && <div style={{ font: `500 13px ${FF}`, color: '#c4421e', marginBottom: 10 }}>{err}</div>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={onClose}
              style={{ flex: 1, height: 46, border: '1.5px solid #d6cfbe', background: '#fff', color: '#4a4742', borderRadius: 10, font: `600 14px ${FF}`, cursor: 'pointer' }}>
              Cancelar
            </button>
            <button type="button" onClick={handleConfirm} disabled={saving || !selId}
              style={{ flex: 2, height: 46, border: 'none', background: saving || !selId ? '#e0cfc7' : '#E8542A', color: '#fff', borderRadius: 10, font: `700 14px ${FF}`, cursor: saving || !selId ? 'default' : 'pointer', boxShadow: saving || !selId ? 'none' : '0 2px 0 #c4421e' }}>
              {saving ? 'Atribuindo...' : 'Atribuir programa'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Assign Workout Modal ───────────────────────────────────────
const WORKOUT_GOAL_COLORS: Record<string, { color: string; bg: string }> = {
  Hipertrofia:     { color: '#c4421e', bg: '#fbe6e1' },
  Emagrecimento:   { color: '#1B7a4a', bg: '#e7f3ea' },
  Força:           { color: '#1B2A4A', bg: '#eef1f6' },
  Condicionamento: { color: '#b06a12', bg: '#f7ecd9' },
  Mobilidade:      { color: '#5a4ea0', bg: '#ece9f6' },
}
interface WorkoutOption { id: number; name: string; goal: string; muscle_group: string | null; duration_min: number }

function AssignWorkoutModal({ studentId, coachId, onClose, onAssigned }: {
  studentId: number; coachId: string; onClose: () => void; onAssigned: () => void
}) {
  const [workouts, setWorkouts] = useState<WorkoutOption[]>([])
  const [listLoad, setListLoad] = useState(true)
  const [query,    setQuery]    = useState('')
  const [selId,    setSelId]    = useState<number | null>(null)
  const [dow,      setDow]      = useState<number | null>(null)
  const [saving,   setSaving]   = useState(false)
  const [err,      setErr]      = useState('')

  useEffect(() => {
    supabase.from('workouts').select('id,name,goal,muscle_group,duration_min')
      .eq('coach_id', coachId).order('created_at', { ascending: false })
      .then(({ data }) => { setWorkouts((data as WorkoutOption[] | null) ?? []); setListLoad(false) })
  }, [])

  async function handleConfirm() {
    if (!selId) { setErr('Selecione um treino.'); return }
    setSaving(true)
    const { error } = await supabase.from('workout_assignments').insert({ workout_id: selId, student_id: studentId, day_of_week: dow })
    if (error) { setErr('Erro ao atribuir: ' + error.message); setSaving(false); return }
    onAssigned(); onClose()
  }

  const q = query.trim().toLowerCase()
  const filtered = q ? workouts.filter(w => w.name.toLowerCase().includes(q) || (w.goal ?? '').toLowerCase().includes(q)) : workouts

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,25,40,.5)', zIndex: 82, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 460, background: '#fff', borderRadius: 16, boxShadow: '0 24px 60px rgba(0,0,0,.3)', display: 'flex', flexDirection: 'column', maxHeight: '86vh' }}>

        {/* Header */}
        <div style={{ padding: '24px 24px 16px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
            <h2 style={{ font: `800 20px ${FF}`, color: '#1B2A4A', margin: 0, letterSpacing: '-.4px' }}>Atribuir treino</h2>
            <button type="button" onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9a948a', padding: 2 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
            </button>
          </div>
          <p style={{ font: `400 13px ${FF}`, color: '#9a948a', margin: '0 0 14px' }}>Selecione um treino da sua biblioteca</p>

          {/* Search */}
          <div style={{ position: 'relative', marginBottom: 14 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9a948a" strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>
            <input autoFocus type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar treino…"
              style={{ width: '100%', height: 40, border: '1.5px solid #e0d9c8', borderRadius: 10, background: '#faf7ee', padding: '0 14px 0 36px', font: `400 13.5px ${FF}`, color: '#1B2A4A', outline: 'none', boxSizing: 'border-box' as const }}
              onFocus={e => { e.currentTarget.style.borderColor = '#E8542A' }} onBlur={e => { e.currentTarget.style.borderColor = '#e0d9c8' }} />
          </div>

          {/* Day picker */}
          <div style={{ font: `600 11px ${FF}`, color: '#6b6657', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
            Dia da semana <span style={{ font: `400 11px ${FF}`, color: '#b0a99c', textTransform: 'none', letterSpacing: 0 }}>(opcional)</span>
          </div>
          <div style={{ display: 'flex', gap: 5 }}>
            {DAY_NAMES.map((d, i) => {
              const active = dow === i
              return (
                <button key={i} type="button" onClick={() => setDow(active ? null : i)}
                  style={{ flex: 1, height: 36, border: `1.5px solid ${active ? '#E8542A' : '#e0d9c8'}`, background: active ? '#E8542A' : '#fff', color: active ? '#fff' : '#7c7869', font: `700 11px ${FF}`, borderRadius: 8, cursor: 'pointer' }}>
                  {d}
                </button>
              )
            })}
          </div>
        </div>

        {/* Workout list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 14px', minHeight: 0 }}>
          {listLoad ? (
            <div style={{ padding: '32px 0', textAlign: 'center', font: `400 13px ${FF}`, color: '#9a948a' }}>Carregando treinos…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '32px 0', textAlign: 'center', font: `400 13px ${FF}`, color: '#9a948a' }}>
              {workouts.length === 0 ? 'Nenhum treino na biblioteca ainda. Crie um na aba Treinos.' : 'Nenhum treino encontrado.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 8 }}>
              {filtered.map(w => {
                const gc = WORKOUT_GOAL_COLORS[w.goal] ?? { color: '#1B2A4A', bg: '#eef1f6' }
                const sel = selId === w.id
                return (
                  <button key={w.id} type="button" onClick={() => { setSelId(w.id); setErr('') }}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, border: `1.5px solid ${sel ? '#E8542A' : '#ece7d9'}`, background: sel ? '#fff8f6' : '#fff', borderRadius: 12, padding: '11px 13px', cursor: 'pointer', textAlign: 'left', width: '100%' }}
                    onMouseEnter={e => { if (!sel) { e.currentTarget.style.borderColor = '#E8542A'; e.currentTarget.style.background = '#fff8f6' } }}
                    onMouseLeave={e => { if (!sel) { e.currentTarget.style.borderColor = '#ece7d9'; e.currentTarget.style.background = '#fff' } }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: gc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={gc.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6.5 6.5l11 11"/><path d="M21 21l-1-1"/><path d="M3 3l1 1"/><path d="M18 22l4-4"/><path d="M2 6l4-4"/>
                      </svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ font: `700 13.5px ${FF}`, color: '#1B2A4A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.name}</div>
                      <div style={{ font: `400 11.5px ${FF}`, color: '#9a948a', marginTop: 2 }}>{w.muscle_group ?? w.goal} · {w.duration_min} min</div>
                    </div>
                    <span style={{ flexShrink: 0, font: `600 10.5px ${FF}`, color: gc.color, background: gc.bg, borderRadius: 20, padding: '3px 9px', whiteSpace: 'nowrap' }}>{w.goal}</span>
                    <div style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${sel ? '#E8542A' : '#d2cbbb'}`, background: sel ? '#E8542A' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: sel ? 1 : 0 }}><path d="M20 6L9 17l-5-5"/></svg>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px 20px', flexShrink: 0, borderTop: '1px solid #f4efe3' }}>
          {err && <div style={{ background: '#fdeee9', border: '1px solid #f6cdbf', borderRadius: 9, padding: '9px 13px', font: `500 13px ${FF}`, color: '#c4421e', marginBottom: 10 }}>{err}</div>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, height: 46, border: '1.5px solid #d9d3c4', background: '#fff', color: '#1B2A4A', borderRadius: 10, font: `600 13.5px ${FF}`, cursor: 'pointer' }}>Cancelar</button>
            <button type="button" onClick={handleConfirm} disabled={saving || !selId}
              style={{ flex: 2, height: 46, border: 'none', background: saving || !selId ? '#e0ccc6' : '#E8542A', color: '#fff', borderRadius: 10, font: `700 14px ${FF}`, cursor: saving || !selId ? 'default' : 'pointer', boxShadow: saving || !selId ? 'none' : '0 2px 0 #c4421e', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {saving
                ? <><span style={{ width: 15, height: 15, border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'kspin .7s linear infinite' }} /> Atribuindo...</>
                : `Atribuir treino${dow !== null ? ' · ' + DAY_NAMES[dow] : ''}`
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Assessment Detail Drawer ───────────────────────────────────
function AssessmentDetailDrawer({
  assessment,
  prevAssessment,
  uploadingId,
  onClose,
  onPhotoUpload,
}: {
  assessment:     AssessmentRow
  prevAssessment: AssessmentRow | null
  uploadingId:    number | null
  onClose:        () => void
  onPhotoUpload:  (assId: number, col: string, file: File) => void
}) {
  const photoRef   = useRef<HTMLInputElement>(null)
  const pendingRef = useRef<string | null>(null)

  const PHOTOS = [
    { col: 'photo_frente_url',   label: 'Frente'    },
    { col: 'photo_lado_esq_url', label: 'Lado Esq.' },
    { col: 'photo_lado_dir_url', label: 'Lado Dir.' },
    { col: 'photo_costas_url',   label: 'Costas'    },
  ]

  function metricDelta(curr: number | null, prev: number | null, betterLower: boolean | null, dec: number, unit: string) {
    if (curr == null || prev == null) return null
    const d = curr - prev
    if (d === 0) return { txt: '=', color: '#9a948a' }
    const good = betterLower === null ? null : (betterLower ? d < 0 : d > 0)
    const color = good === null ? '#7c7869' : good ? '#1B7a4a' : '#c4421e'
    return { txt: `${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(dec)} ${unit}`, color }
  }

  const uploading = uploadingId === assessment.id

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,25,40,.45)', zIndex: 77 }} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 480, maxWidth: '94vw', background: '#F4EFE3', zIndex: 78, boxShadow: '-12px 0 40px rgba(0,0,0,.22)', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ background: '#1B2A4A', padding: '20px 22px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ font: `800 17px ${FF}`, color: '#FAEEDA', letterSpacing: '-.3px' }}>Avaliação física</div>
            <div style={{ font: `500 12px ${FF}`, color: '#8B97AD', marginTop: 3 }}>
              {fmtDate(assessment.assessed_at)}{!prevAssessment ? ' · 1ª avaliação' : ''}
            </div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'rgba(255,255,255,.1)', cursor: 'pointer', color: '#fff', width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Métricas */}
          <div style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 14, padding: '16px 18px' }}>
            <div style={{ font: `600 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#9a948a', marginBottom: 12 }}>
              Métricas {prevAssessment && <span style={{ color: '#c9c1b0', textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>(vs. avaliação anterior)</span>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { label: 'Peso',      curr: assessment.weight_kg,    prev: prevAssessment?.weight_kg    ?? null, betterLower: true as boolean | null, dec: 1, unit: 'kg' },
                { label: '% Gordura', curr: assessment.body_fat_pct, prev: prevAssessment?.body_fat_pct ?? null, betterLower: true as boolean | null, dec: 1, unit: '%'  },
              ].map(m => {
                const d = metricDelta(m.curr, m.prev, m.betterLower, m.dec, m.unit)
                return (
                  <div key={m.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#faf7ee', borderRadius: 10, padding: '11px 13px' }}>
                    <div>
                      <div style={{ font: `600 11px ${FF}`, color: '#7c7869' }}>{m.label}</div>
                      <div style={{ font: `800 18px ${FF}`, color: '#1B2A4A', marginTop: 2 }}>
                        {m.curr != null ? `${m.curr.toFixed(m.dec)} ${m.unit}` : '—'}
                      </div>
                    </div>
                    {d && <span style={{ font: `700 11.5px ${FF}`, color: d.color }}>{d.txt}</span>}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Medidas */}
          {[assessment.chest_cm, assessment.waist_cm, assessment.hip_cm, assessment.arm_cm, assessment.thigh_cm].some(v => v != null) && (
            <div style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 14, padding: '16px 18px' }}>
              <div style={{ font: `600 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#9a948a', marginBottom: 12 }}>Medidas corporais</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {([
                  { label: 'Peito',   curr: assessment.chest_cm,  prev: prevAssessment?.chest_cm  ?? null },
                  { label: 'Cintura', curr: assessment.waist_cm,  prev: prevAssessment?.waist_cm  ?? null },
                  { label: 'Quadril', curr: assessment.hip_cm,    prev: prevAssessment?.hip_cm    ?? null },
                  { label: 'Braço',   curr: assessment.arm_cm,    prev: prevAssessment?.arm_cm    ?? null },
                  { label: 'Coxa',    curr: assessment.thigh_cm,  prev: prevAssessment?.thigh_cm  ?? null },
                ] as { label: string; curr: number | null; prev: number | null }[]).filter(m => m.curr != null).map(m => {
                  const d = metricDelta(m.curr, m.prev, null, 0, 'cm')
                  return (
                    <div key={m.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#faf7ee', borderRadius: 10, padding: '11px 13px' }}>
                      <div>
                        <div style={{ font: `600 11px ${FF}`, color: '#7c7869' }}>{m.label}</div>
                        <div style={{ font: `800 15px ${FF}`, color: '#1B2A4A', marginTop: 2 }}>{(m.curr as number).toFixed(0)} cm</div>
                      </div>
                      {d && <span style={{ font: `700 11.5px ${FF}`, color: d.color }}>{d.txt}</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Fotos */}
          <div style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 14, padding: '16px 18px' }}>
            <div style={{ font: `600 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#9a948a', marginBottom: 12 }}>Fotos corporais</div>
            <input ref={photoRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => {
                const f = e.target.files?.[0]
                const col = pendingRef.current
                if (f && col) onPhotoUpload(assessment.id, col, f)
                if (photoRef.current) photoRef.current.value = ''
              }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 9 }}>
              {PHOTOS.map(p => {
                const url = (assessment as unknown as Record<string, unknown>)[p.col] as string | null
                return (
                  <div key={p.col} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                    {url ? (
                      <img
                        src={url} alt={p.label}
                        onClick={() => { pendingRef.current = p.col; photoRef.current?.click() }}
                        style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover', borderRadius: 8, cursor: 'pointer', display: 'block' }}
                        title="Clique para substituir"
                      />
                    ) : (
                      <button type="button" disabled={uploading}
                        onClick={() => { pendingRef.current = p.col; photoRef.current?.click() }}
                        style={{ width: '100%', aspectRatio: '3/4', background: '#f4efe3', border: '1.5px dashed #d6cfbe', borderRadius: 8, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                        {uploading
                          ? <span style={{ width: 14, height: 14, border: '2px solid #d6cfbe', borderTopColor: '#E8542A', borderRadius: '50%', display: 'block', animation: 'kspin .7s linear infinite' }} />
                          : <>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b0a99c" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                              <span style={{ font: `500 9px ${FF}`, color: '#b0a99c' }}>+ Foto</span>
                            </>
                        }
                      </button>
                    )}
                    <span style={{ font: `600 9.5px ${FF}`, color: '#9a948a' }}>{p.label}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Observações */}
          {assessment.notes && (
            <div style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 14, padding: '16px 18px' }}>
              <div style={{ font: `600 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#9a948a', marginBottom: 8 }}>Observações</div>
              <p style={{ font: `400 13.5px ${FF}`, color: '#4a4742', margin: 0, lineHeight: 1.5 }}>{assessment.notes}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ flexShrink: 0, padding: '15px 22px', background: '#fff', borderTop: '1px solid #ece7d9' }}>
          <button onClick={onClose} style={{ width: '100%', height: 46, border: '1.5px solid #d9d3c4', background: '#fff', color: '#1B2A4A', borderRadius: 10, font: `700 13.5px ${FF}`, cursor: 'pointer' }}>
            Fechar
          </button>
        </div>
      </div>
    </>
  )
}

// ── Main ───────────────────────────────────────────────────────
export default function PerfilAluno() {
  const { id }    = useParams<{ id: string }>()
  const navigate  = useNavigate()
  const [tab, setTab] = useState<Tab>('overview')
  const [toast, setToast] = useState('')
  const toastRef  = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // ── Auth / student ────────────────────────────────────────
  const { students, fetchStudents, deleteStudent, updatePlan, updateStudentInfo, blockStudent, updateAssessmentFrequency, updateNextAssessment } = useStudentsStore()
  const { user }  = useAuthStore()
  const studentId = parseInt(id ?? '0', 10)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [compareMode,     setCompareMode]     = useState(false)
  const [compareSelected, setCompareSelected] = useState<number[]>([])
  const [showComparison,  setShowComparison]  = useState(false)
  const [uploadingAssId,  setUploadingAssId]  = useState<number | null>(null)
  const assessPhotoRef  = useRef<HTMLInputElement>(null)
  const pendingAssIdRef = useRef<number | null>(null)
  const [showNewAssessment, setShowNewAssessment] = useState(false)
  const [showPlanPicker, setShowPlanPicker]   = useState(false)
  const [savingPlan,    setSavingPlan]        = useState(false)
  const [showEditModal, setShowEditModal]     = useState(false)
  const [editName,      setEditName]          = useState('')
  const [editEmail,     setEditEmail]         = useState('')
  const [editGoal,      setEditGoal]          = useState('')
  const [editPhone,     setEditPhone]         = useState('')
  const [editSaving,    setEditSaving]        = useState(false)
  const [blockLoading,  setBlockLoading]      = useState(false)
  const [showAnamneseForm,  setShowAnamneseForm]  = useState(false)
  const [showAssignModal,   setShowAssignModal]   = useState(false)
  const [openAssessId,      setOpenAssessId]      = useState<number | null>(null)

  useEffect(() => {
    if (students.length === 0 && user?.id) fetchStudents(user.id)
  }, [user?.id])

  const student = students.find(s => s.id === studentId)

  // ── Remote data ───────────────────────────────────────────
  const [anamnese,        setAnamnese]        = useState<AnamneseRow | null>(null)
  const [anamneseLoading, setAnamneseLoading] = useState(false)
  const [, setAssignments]     = useState<AssignmentRow[]>([])
  const [, setAssignLoading]   = useState(false)
  const [activeProgram,   setActiveProgram]   = useState<ActiveProgram | null>(null)
  const [programLoading,  setProgramLoading]  = useState(false)
  const [showAssignProgram, setShowAssignProgram] = useState(false)
  const [assessments,     setAssessments]     = useState<AssessmentRow[]>([])
  const [assessLoading,   setAssessLoading]   = useState(false)
  const [assessError,     setAssessError]     = useState<string | null>(null)
  const [payments,        setPayments]        = useState<PaymentRow[]>([])
  const [payLoading,      setPayLoading]      = useState(false)
  const [editingDueId,    setEditingDueId]    = useState<number | null>(null)
  const [editingDueVal,   setEditingDueVal]   = useState('')
  const [newPayOpen,      setNewPayOpen]      = useState(false)
  const [newPayDesc,      setNewPayDesc]      = useState('')
  const [newPayAmount,    setNewPayAmount]    = useState('')
  const [newPayDue,       setNewPayDue]       = useState('')
  const [newPaySaving,    setNewPaySaving]    = useState(false)
  const [markingPaidId,   setMarkingPaidId]   = useState<number | null>(null)
  const [attachments,     setAttachments]     = useState<AttachmentRow[]>([])
  const [attachLoading,   setAttachLoading]   = useState(false)
  const [attachUploading, setAttachUploading] = useState(false)
  const attachInputRef = useRef<HTMLInputElement>(null)
  const [checkins,        setCheckins]        = useState<CheckInRow[]>([])
  const [checkLoading,    setCheckLoading]    = useState(false)
  const [sessions,        setSessions]        = useState<SessionRow[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const loaded = useRef(new Set<string>())

  const fetchAnamnese = useCallback(async () => {
    if (!student || loaded.current.has('anamnese')) return
    loaded.current.add('anamnese')
    setAnamneseLoading(true)
    let q = supabase.from('anamneses').select('*').order('created_at', { ascending: false }).limit(1)
    if (student.studentUuid) {
      q = q.eq('student_id', student.studentUuid)
    } else {
      q = q.eq('students_row_id', studentId)
    }
    const { data } = await q.single()
    setAnamnese(data ?? null)
    setAnamneseLoading(false)
  }, [student?.studentUuid, studentId])

  const fetchAssignments = useCallback(async () => {
    if (!studentId || loaded.current.has('assignments')) return
    loaded.current.add('assignments')
    setAssignLoading(true)
    const { data } = await supabase.from('workout_assignments')
      .select('id, day_of_week, workouts(id,name,description,muscle_group,difficulty,duration_min,exercises(name,sets,reps,sort_order))')
      .eq('student_id', studentId).order('id', { ascending: true })
    setAssignments((data as AssignmentRow[] | null) ?? [])
    setAssignLoading(false)
  }, [studentId])

  const fetchActiveProgram = useCallback(async () => {
    if (!studentId || loaded.current.has('program')) return
    loaded.current.add('program')
    setProgramLoading(true)
    const { data } = await supabase
      .from('program_assignments')
      .select(`id, programs(id, name, days_per_week, program_slots(id, position, day_of_week, workouts(id, name, muscle_group, duration_min)))`)
      .eq('student_id', studentId)
      .eq('active', true)
      .order('assigned_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data?.programs) {
      const prog = data.programs as unknown as { id: number; name: string; days_per_week: number; program_slots: ProgramSlotDetail[] }
      setActiveProgram({
        assignment_id: data.id,
        program_id: prog.id,
        name: prog.name,
        days_per_week: prog.days_per_week,
        slots: [...(prog.program_slots ?? [])].sort((a, b) => a.position - b.position),
      })
    } else {
      setActiveProgram(null)
    }
    setProgramLoading(false)
  }, [studentId])

  const fetchAssessments = useCallback(async () => {
    if (!studentId || loaded.current.has('assessments')) return
    loaded.current.add('assessments')
    setAssessLoading(true)
    const { data, error } = await supabase.from('assessments')
      .select('id,assessed_at,weight_kg,body_fat_pct,chest_cm,waist_cm,hip_cm,arm_cm,thigh_cm,notes,photo_frente_url,photo_lado_esq_url,photo_lado_dir_url,photo_costas_url')
      .eq('student_id', studentId).order('assessed_at', { ascending: true })
    if (error) {
      console.error('[fetchAssessments]', error.message)
      setAssessError(error.message)
    }
    setAssessments((data as AssessmentRow[] | null) ?? [])
    setAssessLoading(false)
  }, [studentId])

  async function saveDueDate(id: number, val: string) {
    if (!val) { setEditingDueId(null); return }
    await supabase.from('payments').update({ due_date: val }).eq('id', id)
    setPayments(prev => prev.map(p => p.id === id ? { ...p, due_date: val } : p))
    setEditingDueId(null)
    showToast('Data de vencimento atualizada.')
  }

  async function saveNewPayment() {
    if (!newPayAmount || !newPayDue || !studentId) return
    setNewPaySaving(true)
    const amount = parseFloat(newPayAmount.replace(',', '.'))
    const { data } = await supabase.from('payments')
      .insert({ student_id: studentId, description: newPayDesc || 'Mensalidade', amount, due_date: newPayDue, status: 'pending' })
      .select('id,amount,status,due_date,paid_at,description').single()
    if (data) setPayments(prev => [data as PaymentRow, ...prev])
    setNewPayOpen(false); setNewPayDesc(''); setNewPayAmount(''); setNewPayDue('')
    setNewPaySaving(false)
    showToast('Fatura registrada.')
  }

  async function markAsPaid(id: number) {
    setMarkingPaidId(id)
    const paid_at = new Date().toISOString()
    await supabase.from('payments').update({ status: 'active', paid_at }).eq('id', id)
    setPayments(prev => prev.map(p => p.id === id ? { ...p, status: 'active', paid_at } : p))
    setMarkingPaidId(null)
    showToast('Pagamento confirmado.')
  }

  const fetchAttachments = useCallback(async () => {
    if (!studentId || loaded.current.has('attachments')) return
    loaded.current.add('attachments')
    setAttachLoading(true)
    const { data } = await supabase.from('student_attachments')
      .select('id,name,url,size,mime_type,uploaded_at')
      .eq('student_id', studentId).order('uploaded_at', { ascending: false })
    setAttachments((data as AttachmentRow[] | null) ?? [])
    setAttachLoading(false)
  }, [studentId])

  async function uploadAttachment(file: File) {
    if (!studentId) return
    setAttachUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${studentId}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('student-attachments').upload(path, file)
    if (error) { showToast('Erro ao enviar arquivo.'); setAttachUploading(false); return }
    const { data: pd } = supabase.storage.from('student-attachments').getPublicUrl(path)
    const { data: row } = await supabase.from('student_attachments')
      .insert({ student_id: studentId, name: file.name, url: pd.publicUrl, size: file.size, mime_type: file.type })
      .select('id,name,url,size,mime_type,uploaded_at').single()
    if (row) setAttachments(prev => [row as AttachmentRow, ...prev])
    setAttachUploading(false)
    showToast('Arquivo enviado.')
  }

  async function deleteAttachment(id: number, url: string) {
    const path = url.split('/student-attachments/')[1]
    await Promise.all([
      supabase.storage.from('student-attachments').remove([path]),
      supabase.from('student_attachments').delete().eq('id', id),
    ])
    setAttachments(prev => prev.filter(a => a.id !== id))
    showToast('Arquivo removido.')
  }

  const fetchPayments = useCallback(async () => {
    if (!studentId || loaded.current.has('payments')) return
    loaded.current.add('payments')
    setPayLoading(true)
    const { data } = await supabase.from('payments')
      .select('id,amount,status,due_date,paid_at,description')
      .eq('student_id', studentId).order('due_date', { ascending: false })
    setPayments((data as PaymentRow[] | null) ?? [])
    setPayLoading(false)
  }, [studentId])

  const fetchCheckins = useCallback(async () => {
    if (!studentId || loaded.current.has('checkins')) return
    loaded.current.add('checkins')
    setCheckLoading(true)
    const { data } = await supabase.from('check_ins')
      .select('id,content,created_at').eq('student_id', studentId)
      .order('created_at', { ascending: false }).limit(20)
    setCheckins((data as CheckInRow[] | null) ?? [])
    setCheckLoading(false)
  }, [studentId])

  const fetchSessions = useCallback(async () => {
    if (!studentId || loaded.current.has('sessions')) return
    loaded.current.add('sessions')
    setSessionsLoading(true)
    const { data } = await supabase
      .from('workout_sessions')
      .select('id, completed_at, intensity, pain, notes, workouts(name)')
      .eq('student_id', studentId)
      .order('completed_at', { ascending: false })
      .limit(50)
    setSessions((data as SessionRow[] | null) ?? [])
    setSessionsLoading(false)
  }, [studentId])

  useEffect(() => {
    if (!student) return
    if (tab === 'overview')   { fetchActiveProgram(); fetchCheckins() }
    if (tab === 'anamnese')   fetchAnamnese()
    if (tab === 'treino')     fetchActiveProgram()
    if (tab === 'feedback')   fetchSessions()
    if (tab === 'avaliacoes') fetchAssessments()
    if (tab === 'pagamentos') fetchPayments()
    if (tab === 'anexos')     fetchAttachments()
    if (tab === 'historico')  { fetchCheckins(); fetchAssessments(); fetchPayments() }
  }, [tab, student?.id])

  // ── Derived ───────────────────────────────────────────────
  const pal  = avatarPalette(studentId % 5)
  const pay  = student ? payInfo(student.pay)  : payInfo('pending')
  const sem  = student ? semInfo(student.sem)  : semInfo('green')
  const semanas      = student ? calcSemanas(student.since) : 0
  const lastAssess   = assessments.length > 0 ? assessments[assessments.length - 1] : null
  const pesoAtual    = lastAssess?.weight_kg    != null ? `${lastAssess.weight_kg.toFixed(1)} kg`    : null
  const gorduraAtual = lastAssess?.body_fat_pct != null ? `${lastAssess.body_fat_pct.toFixed(1)}%`  : null
  const openAssess     = assessments.find(a => a.id === openAssessId) ?? null
  const openAssessIdx  = openAssess ? assessments.findIndex(a => a.id === openAssessId) : -1
  const openAssessPrev = openAssessIdx > 0 ? assessments[openAssessIdx - 1] : null

  const PLANS = ['Mensal', 'Anual', 'Trimestral', 'Semestral', 'Permuta']

  async function handleAssessmentPhotoUpload(file: File) {
    const assId = pendingAssIdRef.current
    if (!assId) return
    setUploadingAssId(assId)
    const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const path = `${studentId}/${assId}/frente.${ext}`
    const { error } = await supabase.storage
      .from('assessment-photos').upload(path, file, { upsert: true })
    if (!error) {
      const { data: pd } = supabase.storage.from('assessment-photos').getPublicUrl(path)
      await supabase.from('assessments').update({ photo_frente_url: pd.publicUrl }).eq('id', assId)
      setAssessments(prev => prev.map(a => a.id === assId ? { ...a, photo_frente_url: pd.publicUrl } : a))
    }
    setUploadingAssId(null)
    pendingAssIdRef.current = null
  }

  async function handleDrawerPhotoUpload(assId: number, col: string, file: File) {
    setUploadingAssId(assId)
    const slotName = col.replace('photo_', '').replace('_url', '')
    const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const path = `${studentId}/${assId}/${slotName}.${ext}`
    const { error } = await supabase.storage
      .from('assessment-photos').upload(path, file, { upsert: true })
    if (!error) {
      const { data: pd } = supabase.storage.from('assessment-photos').getPublicUrl(path)
      await supabase.from('assessments').update({ [col]: pd.publicUrl }).eq('id', assId)
      setAssessments(prev => prev.map(a => a.id === assId ? { ...a, [col]: pd.publicUrl } : a))
    }
    setUploadingAssId(null)
  }

  function openEditModal() {
    setEditName(student?.name ?? '')
    setEditEmail(student?.email ?? '')
    setEditGoal(student?.goal ?? '')
    setEditPhone(student?.phone ?? '')
    setShowEditModal(true)
  }

  async function handleSaveStudentInfo() {
    const name  = editName.trim()
    const email = editEmail.trim().toLowerCase()
    const goal  = editGoal.trim()
    if (!name || !email || !goal) return
    setEditSaving(true)
    await updateStudentInfo(studentId, { name, email, goal, phone: editPhone.trim() || null })
    setEditSaving(false)
    setShowEditModal(false)
    showToast('Dados atualizados.')
  }

  async function handleSavePlan(plan: string) {
    setSavingPlan(true)
    const ok = await updatePlan(studentId, plan)
    setSavingPlan(false)
    if (ok) {
      setShowPlanPicker(false)
      showToast(`Plano atualizado para ${plan}`)
    } else {
      showToast('Erro ao salvar plano. Verifique a conexão e tente novamente.')
    }
  }

  function showToast(msg: string) {
    setToast(msg)
    clearTimeout(toastRef.current)
    toastRef.current = setTimeout(() => setToast(''), 2000)
  }
  useEffect(() => () => clearTimeout(toastRef.current), [])

  async function handleAfterAssign() {
    loaded.current.delete('assignments')
    await fetchAssignments()
    showToast('Treino atribuído com sucesso.')
  }

  async function handleAfterAssignProgram() {
    loaded.current.delete('program')
    await fetchActiveProgram()
    showToast('Programa atribuído com sucesso.')
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'overview',   label: 'Visão geral' },
    { key: 'anamnese',   label: 'Anamnese'    },
    { key: 'treino',     label: 'Treino'      },
    { key: 'feedback',   label: 'Feedback'    },
    { key: 'avaliacoes', label: 'Avaliações'  },
    { key: 'pagamentos', label: 'Pagamentos'  },
    { key: 'anexos',     label: 'Anexos'      },
    { key: 'historico',  label: 'Histórico'   },
  ]

  if (!student) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', font: `500 15px ${FF}`, color: '#7c7869' }}>
      Carregando...
    </div>
  )

  return (
    <div>

      {/* ── Plan picker modal ─────────────────────────────── */}
      {showPlanPicker && (
        <div onClick={() => setShowPlanPicker(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(20,25,40,.5)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: '28px 28px 24px', width: '100%', maxWidth: 360, boxShadow: '0 24px 60px rgba(0,0,0,.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ font: `800 18px ${FF}`, color: '#1B2A4A', margin: 0, letterSpacing: '-.4px' }}>Plano de {student.name.split(' ')[0]}</h2>
              <button onClick={() => setShowPlanPicker(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9a948a', padding: 4, display: 'flex' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {PLANS.map(p => (
                <button key={p} type="button" disabled={savingPlan} onClick={() => handleSavePlan(p)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '13px 16px', border: `2px solid ${student.plan === p ? '#E8542A' : '#ece7d9'}`, background: student.plan === p ? '#fff8f6' : '#fff', borderRadius: 12, font: `600 14px ${FF}`, color: student.plan === p ? '#E8542A' : '#1B2A4A', cursor: savingPlan ? 'default' : 'pointer', opacity: savingPlan ? .6 : 1, textAlign: 'left' }}
                >
                  {p}
                  {student.plan === p && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E8542A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Edit student modal ───────────────────────────── */}
      {showEditModal && (
        <div onClick={() => setShowEditModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(20,25,40,.5)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: '28px 28px 24px', width: '100%', maxWidth: 400, boxShadow: '0 24px 60px rgba(0,0,0,.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
              <h2 style={{ font: `800 18px ${FF}`, color: '#1B2A4A', margin: 0, letterSpacing: '-.4px' }}>Editar dados do aluno</h2>
              <button onClick={() => setShowEditModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9a948a', padding: 4, display: 'flex' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: 'Nome completo', value: editName,  set: setEditName,  type: 'text'  },
                { label: 'E-mail',        value: editEmail, set: setEditEmail, type: 'email' },
                { label: 'Objetivo',      value: editGoal,  set: setEditGoal,  type: 'text'  },
                { label: 'Telefone (WhatsApp)', value: editPhone, set: setEditPhone, type: 'tel' },
              ].map(({ label, value, set, type }) => (
                <div key={label}>
                  <label style={{ display: 'block', font: `600 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#6b6657', marginBottom: 7 }}>{label}</label>
                  <input
                    type={type} value={value} onChange={e => set(e.target.value)}
                    disabled={editSaving}
                    style={{ width: '100%', height: 44, border: '1.5px solid #d9d3c4', borderRadius: 10, background: '#fff', padding: '0 13px', font: `400 14px ${FF}`, color: '#1B2A4A', outline: 'none', boxSizing: 'border-box' }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#E8542A'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,84,42,.12)' }}
                    onBlur={e =>  { e.currentTarget.style.borderColor = '#d9d3c4'; e.currentTarget.style.boxShadow = 'none' }}
                  />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 22 }}>
              <button type="button" onClick={() => setShowEditModal(false)} disabled={editSaving}
                style={{ flex: 1, height: 46, border: '1.5px solid #d9d3c4', background: '#fff', color: '#1B2A4A', borderRadius: 10, font: `600 14px ${FF}`, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button type="button" onClick={handleSaveStudentInfo} disabled={editSaving || !editName.trim() || !editEmail.trim() || !editGoal.trim()}
                style={{ flex: 2, height: 46, border: 'none', background: '#E8542A', color: '#fff', borderRadius: 10, font: `700 14px ${FF}`, cursor: editSaving ? 'default' : 'pointer', opacity: editSaving ? .7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {editSaving
                  ? <><span style={{ width: 15, height: 15, border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'kspin .7s linear infinite' }} /> Salvando...</>
                  : 'Salvar alterações'
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Page ─────────────────────────────────────────── */}
      <div className="k-pagepad" style={{ padding: '30px 34px 64px', maxWidth: 1180 }}>

        {/* Back + delete */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <button type="button" onClick={() => navigate('/coach/alunos')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, font: `600 13px ${FF}`, color: '#7c7869', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
            Voltar para Alunos
          </button>
          {!confirmDelete
            ? <button type="button" onClick={() => setConfirmDelete(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 14px', border: '1.5px solid #e8c5bb', background: '#fef5f3', color: '#c4421e', borderRadius: 9, font: `600 13px ${FF}`, cursor: 'pointer' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                Excluir aluno
              </button>
            : <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ font: `500 13px ${FF}`, color: '#7c7869' }}>Confirmar exclusão?</span>
                <button type="button" onClick={async () => { await deleteStudent(studentId); navigate('/coach/alunos') }}
                  style={{ height: 36, padding: '0 16px', border: 'none', background: '#c4421e', color: '#fff', borderRadius: 9, font: `700 13px ${FF}`, cursor: 'pointer' }}>Excluir</button>
                <button type="button" onClick={() => setConfirmDelete(false)}
                  style={{ height: 36, padding: '0 14px', border: '1.5px solid #d9d3c4', background: '#fff', color: '#1B2A4A', borderRadius: 9, font: `600 13px ${FF}`, cursor: 'pointer' }}>Cancelar</button>
              </div>
          }
        </div>

        {/* ── Hero ──────────────────────────────────────── */}
        <div className="k-hero" style={{ background: '#1B2A4A', borderRadius: 16, overflow: 'hidden', marginBottom: 18 }}>
          <div className="k-heropad" style={{ padding: '26px 28px', display: 'flex', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ width: 74, height: 74, borderRadius: '50%', background: pal[0], color: pal[1], display: 'flex', alignItems: 'center', justifyContent: 'center', font: `800 27px ${FF}`, flexShrink: 0 }}>
              {getInitials(student.name)}
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h1 style={{ font: `800 25px ${FF}`, color: '#fff', margin: 0, letterSpacing: '-.5px' }}>{student.name}</h1>
                  <button type="button" onClick={openEditModal} title="Editar dados do aluno"
                    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.08)', borderRadius: 8, cursor: 'pointer', color: '#aeb9cc', flexShrink: 0 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: `600 11px ${FF}`, color: sem.label === 'Engajado' ? '#bfe6cd' : sem.label === 'Em alerta' ? '#f5dcae' : '#f5c8c0', background: sem.label === 'Engajado' ? 'rgba(43,157,95,.22)' : sem.label === 'Em alerta' ? 'rgba(224,169,59,.22)' : 'rgba(224,83,59,.22)', borderRadius: 20, padding: '4px 11px' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: sem.color }} />{sem.label}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 10 }}>
                <span style={{ font: `400 13px ${FF}`, color: '#aeb9cc' }}>🎯 {student.goal}</span>
                <button type="button" onClick={() => setShowPlanPicker(true)} title="Clique para alterar o plano"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: `400 13px ${FF}`, color: student.plan === 'Sem plano' ? '#E8542A' : '#aeb9cc', background: student.plan === 'Sem plano' ? 'rgba(232,84,42,.12)' : 'rgba(255,255,255,.06)', border: student.plan === 'Sem plano' ? '1px solid rgba(232,84,42,.3)' : '1px solid rgba(255,255,255,.1)', borderRadius: 20, padding: '3px 12px', cursor: 'pointer' }}>
                  📋 {student.plan === 'Sem plano' ? 'Atribuir plano' : `Plano ${student.plan}`}
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <span style={{ font: `400 13px ${FF}`, color: '#aeb9cc' }}>📅 Aluno(a) desde {student.since}</span>
                <span style={{ font: `400 13px ${FF}`, color: '#aeb9cc' }}>✉️ {student.email}</span>
              </div>
            </div>
            <div className="k-herostats" style={{ display: 'flex', gap: 10 }}>
              {[
                { val: String(semanas), unit: '', sub: 'semanas' },
                { val: pesoAtual ?? '—', unit: '', sub: 'peso atual' },
                { val: gorduraAtual ?? '—', unit: '', sub: 'gordura' },
              ].map(({ val, unit, sub }) => (
                <div key={sub} style={{ background: 'rgba(255,255,255,.07)', borderRadius: 12, padding: '13px 16px', textAlign: 'center', minWidth: 78 }}>
                  <div style={{ font: `800 22px/1 ${FF}`, color: '#fff' }}>{val}<span style={{ fontSize: 13 }}>{unit}</span></div>
                  <div style={{ font: `500 10.5px ${FF}`, color: '#8b97ad', marginTop: 4 }}>{sub}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div className="k-tabscroll" style={{ display: 'flex', gap: 2, padding: '0 28px', background: 'rgba(255,255,255,.04)', overflowX: 'auto' }}>
            {TABS.map(({ key, label }) => (
              <button key={key} type="button" onClick={() => setTab(key)}
                style={{ border: 'none', background: 'none', color: tab === key ? '#fff' : '#aeb9cc', font: `600 13.5px ${FF}`, padding: '14px 14px', cursor: 'pointer', borderBottom: `2.5px solid ${tab === key ? '#E8542A' : 'transparent'}`, whiteSpace: 'nowrap' }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tab body ────────────────────────────────────── */}
        <div className="k-bodypad">

          {/* VISÃO GERAL */}
          {tab === 'overview' && (
            <div className="k-twocol" style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* Treino atual */}
                <div style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 14, padding: '20px 22px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <h2 style={{ font: `700 16px ${FF}`, color: '#1B2A4A', margin: 0 }}>Programa ativo</h2>
                    {activeProgram && <span style={{ font: `600 11px ${FF}`, color: '#1B7a4a', background: '#e7f3ea', borderRadius: 20, padding: '4px 11px' }}>Ativo</span>}
                  </div>
                  {programLoading ? (
                    <div style={{ font: `400 13px ${FF}`, color: '#9a948a' }}>Carregando...</div>
                  ) : !activeProgram ? (
                    <div style={{ font: `400 13px ${FF}`, color: '#9a948a' }}>Nenhum programa atribuído ainda.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ font: `600 13px ${FF}`, color: '#E8542A', marginBottom: 6 }}>{activeProgram.name} · {activeProgram.days_per_week}×/sem</div>
                      {activeProgram.slots.map(sl => (
                        <div key={sl.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #f4efe3' }}>
                          <span style={{ font: `700 11px ${FF}`, color: '#fff', background: '#1B2A4A', borderRadius: 5, padding: '2px 7px', flexShrink: 0 }}>
                            {String.fromCharCode(64 + sl.position)}
                          </span>
                          <span style={{ font: `500 13px ${FF}`, color: sl.workouts ? '#1B2A4A' : '#9a948a' }}>
                            {sl.workouts ? sl.workouts.name : 'Sem treino'}
                          </span>
                          {sl.day_of_week != null && (
                            <span style={{ marginLeft: 'auto', font: `400 11px ${FF}`, color: '#9a948a', flexShrink: 0 }}>{DAY_NAMES[sl.day_of_week]}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Check-ins recentes */}
                <div style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 14, padding: '20px 22px' }}>
                  <h2 style={{ font: `700 16px ${FF}`, color: '#1B2A4A', margin: '0 0 14px' }}>Check-ins recentes</h2>
                  {checkLoading ? (
                    <div style={{ font: `400 13px ${FF}`, color: '#9a948a' }}>Carregando...</div>
                  ) : checkins.length === 0 ? (
                    <div style={{ font: `400 13px ${FF}`, color: '#9a948a' }}>Nenhum check-in registrado ainda.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {checkins.slice(0, 5).map(c => (
                        <div key={c.id} style={{ padding: '9px 12px', background: '#fbf8f1', borderRadius: 9, borderLeft: '3px solid #E8542A' }}>
                          <div style={{ font: `500 12.5px ${FF}`, color: '#1B2A4A' }}>{c.content}</div>
                          <div style={{ font: `400 11px ${FF}`, color: '#9a948a', marginTop: 3 }}>{fmtDate(c.created_at)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="k-aside" style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Ações rápidas */}
                <div style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 14, padding: 18 }}>
                  <h2 style={{ font: `700 15px ${FF}`, color: '#1B2A4A', margin: '0 0 12px' }}>Ações rápidas</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {['⚡ Editar treino', '📅 Agendar avaliação', '📎 Enviar anexo', '💬 Enviar mensagem'].map(label => (
                      <button key={label} type="button" onClick={() => label === '⚡ Editar treino' ? setTab('treino') : showToast('Em breve!')}
                        style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', border: '1.5px solid #ece7d9', background: '#fff', padding: '11px 13px', borderRadius: 10, cursor: 'pointer', font: `600 13.5px ${FF}`, color: '#1B2A4A', textAlign: 'left' }}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Resumo */}
                <div style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 14, padding: 18 }}>
                  <h2 style={{ font: `700 15px ${FF}`, color: '#1B2A4A', margin: '0 0 12px' }}>Resumo</h2>
                  {[
                    { label: 'Próxima avaliação', val: student.next, valColor: '#1B2A4A' },
                    { label: 'Pagamento',          val: pay.label,   valColor: pay.color  },
                    { label: 'Plano',              val: student.plan === 'Sem plano' ? 'Não definido' : student.plan, valColor: student.plan === 'Sem plano' ? '#9a948a' : '#1B2A4A' },
                    { label: 'Avaliações',         val: assessments.length > 0 ? `${assessments.length}` : '—', valColor: '#1B2A4A' },
                  ].map(({ label, val, valColor }, i, arr) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < arr.length - 1 ? '1px solid #f1ece0' : 'none' }}>
                      <span style={{ font: `400 13px ${FF}`, color: '#7c7869' }}>{label}</span>
                      <span style={{ font: `600 13px ${FF}`, color: valColor }}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ANAMNESE */}
          {tab === 'anamnese' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {anamneseLoading ? (
                <div style={{ font: `500 14px ${FF}`, color: '#7c7869', padding: '40px 0', textAlign: 'center' }}>Carregando...</div>
              ) : !anamnese ? (
                <div style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 14, padding: '40px 24px', textAlign: 'center' }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
                  <div style={{ font: `700 15px ${FF}`, color: '#1B2A4A', marginBottom: 4 }}>Anamnese não preenchida</div>
                  <div style={{ font: `400 13px ${FF}`, color: '#9a948a', marginBottom: 20 }}>O aluno ainda não completou a anamnese.</div>
                  <button
                    type="button"
                    onClick={() => setShowAnamneseForm(true)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 42, padding: '0 20px', border: 'none', background: '#E8542A', color: '#fff', borderRadius: 10, font: `700 13.5px ${FF}`, cursor: 'pointer', boxShadow: '0 2px 0 #c4421e' }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                    Preencher anamnese
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <h2 style={{ font: `800 20px ${FF}`, color: '#1B2A4A', margin: 0, letterSpacing: '-.4px' }}>Anamnese</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ font: `400 12px ${FF}`, color: '#9a948a' }}>Preenchida em {new Date(anamnese.created_at).toLocaleDateString('pt-BR')}</span>
                      <button type="button" onClick={() => setShowAnamneseForm(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px', border: '1.5px solid #d6cfbe', background: '#fff', color: '#1B2A4A', borderRadius: 8, font: `600 12.5px ${FF}`, cursor: 'pointer' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        Editar
                      </button>
                    </div>
                  </div>
                  {[
                    { title: 'Dados pessoais', rows: [
                      { label: 'Nome', val: anamnese.nome }, { label: 'Nascimento', val: anamnese.data_nasc },
                      { label: 'Telefone', val: anamnese.telefone }, { label: 'Profissão', val: anamnese.profissao },
                      { label: 'Altura', val: anamnese.altura ? `${anamnese.altura} cm` : '' },
                    ], grid: true },
                    { title: 'Saúde', rows: [
                      { label: 'Doenças / condições', val: (() => { try { const p = JSON.parse(anamnese.doencas); return Array.isArray(p) ? p.join(', ') : anamnese.doencas } catch { return anamnese.doencas } })() },
                      { label: 'Outra doença', val: anamnese.outra_doenca }, { label: 'Medicamentos', val: anamnese.medicamentos },
                      { label: 'Cirurgia', val: anamnese.cirurgia }, { label: 'Limitações físicas', val: anamnese.limitacoes },
                    ], grid: false },
                    { title: 'Atividade física', rows: [
                      { label: 'Pratica atividade?', val: anamnese.pratica_atual },
                      { label: 'Qual atividade?', val: anamnese.atividade_atual },
                      { label: 'Treinou com personal?', val: anamnese.treinou_personal },
                    ], grid: false },
                    { title: 'Objetivo e preferências', rows: [
                      { label: 'Objetivo', val: anamnese.objetivo },
                      { label: 'Dias por semana', val: anamnese.dias_semana }, { label: 'Horário', val: anamnese.horario },
                    ], grid: false },
                    { title: 'Estilo de vida', rows: [
                      { label: 'Horas de sono', val: anamnese.horas_sono }, { label: 'Nível de estresse', val: anamnese.nivel_estresse },
                      { label: 'Fuma?', val: anamnese.fuma }, { label: 'Álcool?', val: anamnese.alcool },
                    ], grid: true },
                  ].map(({ title, rows, grid }) => (
                    <div key={title} style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 14, padding: '20px 22px' }}>
                      <h3 style={{ font: `700 13px ${FF}`, color: '#9a948a', textTransform: 'uppercase', letterSpacing: '.5px', margin: '0 0 14px' }}>{title}</h3>
                      {grid ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: '10px 24px' }}>
                          {rows.map(({ label, val }) => (
                            <div key={label}><div style={{ font: `500 11px ${FF}`, color: '#9a948a', marginBottom: 2 }}>{label}</div><div style={{ font: `600 13.5px ${FF}`, color: '#1B2A4A' }}>{val || '—'}</div></div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                          {rows.map(({ label, val }) => (
                            <div key={label} style={{ display: 'flex', gap: 16, padding: '8px 0', borderBottom: '1px solid #f4efe3' }}>
                              <div style={{ font: `400 13px ${FF}`, color: '#7c7869', minWidth: 180, flexShrink: 0 }}>{label}</div>
                              <div style={{ font: `600 13px ${FF}`, color: '#1B2A4A' }}>{val || '—'}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* TREINO */}
          {tab === 'treino' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h2 style={{ font: `800 20px ${FF}`, color: '#1B2A4A', margin: 0, letterSpacing: '-.4px' }}>Programa de treino</h2>
                  {activeProgram && <p style={{ font: `400 13px ${FF}`, color: '#7c7869', margin: '3px 0 0' }}>{activeProgram.name} · {activeProgram.days_per_week} dias/semana</p>}
                </div>
                <button type="button" onClick={() => setShowAssignProgram(true)}
                  style={{ height: 42, padding: '0 18px', border: 'none', background: '#E8542A', color: '#fff', borderRadius: 10, font: `700 13.5px ${FF}`, cursor: 'pointer', boxShadow: '0 2px 0 #c4421e' }}>
                  {activeProgram ? 'Trocar programa' : '+ Atribuir programa'}
                </button>
              </div>

              {programLoading ? (
                <div style={{ font: `400 13px ${FF}`, color: '#9a948a', padding: '20px 0' }}>Carregando...</div>
              ) : !activeProgram ? (
                <Empty icon="📋" title="Nenhum programa atribuído" sub="Atribua um programa de treino a este aluno para que ele visualize os treinos da semana." />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Program header card */}
                  <div style={{ background: '#1B2A4A', borderRadius: 14, padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                      <div style={{ font: `700 16px ${FF}`, color: '#FAEEDA', letterSpacing: '-.3px' }}>{activeProgram.name}</div>
                      <div style={{ font: `400 12.5px ${FF}`, color: '#8B97AD', marginTop: 4 }}>{activeProgram.days_per_week} treinos por semana · {activeProgram.slots.length} slots</div>
                    </div>
                    <span style={{ font: `700 11px ${FF}`, color: '#1B7a4a', background: 'rgba(27,122,74,.18)', border: '1px solid rgba(27,122,74,.3)', borderRadius: 20, padding: '5px 12px', flexShrink: 0 }}>Ativo</span>
                  </div>

                  {/* Slot cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 10 }}>
                    {activeProgram.slots.map(sl => (
                      <div key={sl.id} style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 14, padding: '16px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
                          <span style={{ font: `800 13px ${FF}`, color: '#fff', background: '#E8542A', borderRadius: 7, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {String.fromCharCode(64 + sl.position)}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ font: `700 13.5px ${FF}`, color: '#1B2A4A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {sl.workouts ? sl.workouts.name : <span style={{ color: '#9a948a', fontWeight: 400 }}>Sem treino</span>}
                            </div>
                            {sl.workouts && (
                              <div style={{ font: `400 11px ${FF}`, color: '#9a948a', marginTop: 2 }}>
                                {sl.workouts.muscle_group ?? '—'} · {sl.workouts.duration_min} min
                              </div>
                            )}
                          </div>
                        </div>
                        {sl.day_of_week != null && (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#f1ece0', borderRadius: 7, padding: '4px 10px' }}>
                            <span style={{ font: `600 11px ${FF}`, color: '#6b5c3e' }}>{DAY_NAMES[sl.day_of_week]}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Remove assignment */}
                  <button type="button"
                    onClick={async () => {
                      if (!window.confirm('Remover programa deste aluno?')) return
                      await supabase.from('program_assignments').update({ active: false }).eq('id', activeProgram.assignment_id)
                      loaded.current.delete('program')
                      await fetchActiveProgram()
                      showToast('Programa removido.')
                    }}
                    style={{ alignSelf: 'flex-start', height: 36, padding: '0 14px', border: '1.5px solid #d6cfbe', background: '#fff', color: '#7c7869', borderRadius: 8, font: `500 12.5px ${FF}`, cursor: 'pointer' }}>
                    Remover programa
                  </button>
                </div>
              )}
            </div>
          )}

          {/* FEEDBACK */}
          {tab === 'feedback' && (() => {
            const INTENSITY_LABEL: Record<number, { emoji: string; label: string; color: string; bg: string }> = {
              1: { emoji: '😴', label: 'Muito fácil', color: '#1B7a4a', bg: '#e7f3ea' },
              2: { emoji: '🙂', label: 'Fácil',       color: '#1B7a4a', bg: '#e7f3ea' },
              3: { emoji: '💪', label: 'Moderado',    color: '#b06a12', bg: '#f7ecd9' },
              4: { emoji: '🔥', label: 'Difícil',     color: '#c4421e', bg: '#fbe6e1' },
              5: { emoji: '😤', label: 'Exaustivo',   color: '#c4421e', bg: '#fbe6e1' },
            }
            const PAIN_LABEL: Record<number, { label: string; color: string }> = {
              0: { label: 'Nenhuma dor',   color: '#1B7a4a' },
              1: { label: 'Dor leve',      color: '#b06a12' },
              2: { label: 'Dor moderada',  color: '#c4421e' },
              3: { label: 'Dor intensa',   color: '#c4421e' },
            }
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <h2 style={{ font: `800 20px ${FF}`, color: '#1B2A4A', margin: 0, letterSpacing: '-.4px' }}>Feedback dos treinos</h2>
                    {!sessionsLoading && sessions.length > 0 && (
                      <p style={{ font: `400 13px ${FF}`, color: '#7c7869', margin: '3px 0 0' }}>{sessions.length} sessão{sessions.length !== 1 ? 'ões' : ''} registrada{sessions.length !== 1 ? 's' : ''}</p>
                    )}
                  </div>
                </div>
                {sessionsLoading ? (
                  <div style={{ font: `400 13px ${FF}`, color: '#9a948a', padding: '20px 0' }}>Carregando…</div>
                ) : sessions.length === 0 ? (
                  <Empty icon="💬" title="Nenhum feedback ainda" sub="Os feedbacks dos treinos concluídos pelo aluno aparecerão aqui." />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {sessions.map(s => {
                      const intensity = s.intensity != null ? INTENSITY_LABEL[s.intensity] : null
                      const pain      = s.pain      != null ? PAIN_LABEL[s.pain]           : null
                      return (
                        <div key={s.id} style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 14, padding: '16px 18px' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                            <div>
                              <div style={{ font: `700 14px ${FF}`, color: '#1B2A4A' }}>{s.workouts?.name ?? 'Treino'}</div>
                              <div style={{ font: `400 12px ${FF}`, color: '#9a948a', marginTop: 2 }}>
                                {new Date(s.completed_at).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                            {intensity && (
                              <span style={{ flexShrink: 0, font: `600 11px ${FF}`, color: intensity.color, background: intensity.bg, borderRadius: 20, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4 }}>
                                {intensity.emoji} {intensity.label}
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {pain && (
                              <span style={{ font: `600 11px ${FF}`, color: pain.color, background: pain.color === '#1B7a4a' ? '#e7f3ea' : '#fbe6e1', borderRadius: 20, padding: '3px 10px' }}>
                                {pain.label}
                              </span>
                            )}
                            {s.notes && (
                              <span style={{ font: `400 12px ${FF}`, color: '#4a4742', background: '#f4efe3', borderRadius: 8, padding: '4px 10px', flex: 1 }}>
                                {s.notes}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })()}

          {/* AVALIAÇÕES */}
          {tab === 'avaliacoes' && (() => {
            type MetricKey = 'weight_kg' | 'body_fat_pct' | 'chest_cm' | 'waist_cm' | 'hip_cm' | 'arm_cm' | 'thigh_cm'
            const METRICS: { key: MetricKey; label: string; unit: string; dec: number; lib: boolean | null }[] = [
              { key: 'weight_kg',    label: 'Peso',      unit: 'kg', dec: 1, lib: true  },
              { key: 'body_fat_pct', label: '% Gordura', unit: '%',  dec: 1, lib: true  },
              { key: 'chest_cm',     label: 'Peito',     unit: 'cm', dec: 0, lib: null  },
              { key: 'waist_cm',     label: 'Cintura',   unit: 'cm', dec: 0, lib: true  },
              { key: 'hip_cm',       label: 'Quadril',   unit: 'cm', dec: 0, lib: null  },
              { key: 'arm_cm',       label: 'Braço',     unit: 'cm', dec: 0, lib: null  },
              { key: 'thigh_cm',     label: 'Coxa',      unit: 'cm', dec: 0, lib: null  },
            ]

            // garantir que compLeft é o mais antigo
            const rawA = assessments.find(a => a.id === compareSelected[0]) ?? null
            const rawB = assessments.find(a => a.id === compareSelected[1]) ?? null
            const [compLeft, compRight] = (rawA && rawB && new Date(rawA.assessed_at) > new Date(rawB.assessed_at))
              ? [rawB, rawA] : [rawA, rawB]

            const fmtVal  = (v: number | null, dec: number, unit: string) => v == null ? '—' : `${v.toFixed(dec)} ${unit}`
            const fmtDelta = (d: number, dec: number, unit: string) => {
              const s = Math.abs(d).toFixed(dec)
              return d > 0 ? `+${s} ${unit}` : `−${s} ${unit}`
            }

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* hidden photo input */}
                <input ref={assessPhotoRef} type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) void handleAssessmentPhotoUpload(f) }} />

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <h2 style={{ font: `800 20px ${FF}`, color: '#1B2A4A', margin: 0, letterSpacing: '-.4px' }}>Avaliações físicas</h2>
                    {assessments.length > 0 && <p style={{ font: `400 13px ${FF}`, color: '#7c7869', margin: '3px 0 0' }}>{assessments.length} avaliação{assessments.length !== 1 ? 'ões' : ''} · ordem cronológica</p>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
                    {/* Periodicidade */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ font: `600 11px ${FF}`, letterSpacing: '.4px', textTransform: 'uppercase', color: '#9a948a', whiteSpace: 'nowrap' }}>Periodicidade</span>
                      <div style={{ display: 'flex', background: '#f4efe3', borderRadius: 10, padding: 3, gap: 2 }}>
                        {([
                          { value: 'weekly',   label: 'Semanal'   },
                          { value: 'biweekly', label: 'Quinzenal' },
                          { value: 'monthly',  label: 'Mensal'    },
                        ] as const).map(opt => {
                          const active = student.assessmentFrequency === opt.value
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={async () => {
                                const next = active ? null : opt.value
                                await updateAssessmentFrequency(studentId, next)
                                showToast(next ? `Periodicidade definida: ${opt.label}` : 'Periodicidade removida.')
                              }}
                              style={{ height: 34, padding: '0 13px', border: 'none', borderRadius: 8, font: `600 12.5px ${FF}`, cursor: 'pointer', background: active ? '#1B2A4A' : 'transparent', color: active ? '#fff' : '#7c7869', transition: 'all .12s', whiteSpace: 'nowrap' }}
                            >
                              {opt.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    {/* Ações */}
                    <div style={{ display: 'flex', gap: 8 }}>
                      {assessments.length >= 2 && (
                        <button type="button"
                          onClick={() => { setCompareMode(v => !v); setCompareSelected([]); setShowComparison(false) }}
                          style={{ height: 42, padding: '0 16px', border: `1.5px solid ${compareMode ? '#E8542A' : '#d6cfbe'}`, background: compareMode ? '#fff8f6' : '#fff', color: compareMode ? '#E8542A' : '#1B2A4A', borderRadius: 10, font: `600 13px ${FF}`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                          {compareMode
                            ? <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg> Cancelar</>
                            : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 1v3M10 1v3M14 1v3"/></svg> Comparar</>
                          }
                        </button>
                      )}
                      <button type="button" onClick={() => setShowNewAssessment(true)}
                        style={{ height: 42, padding: '0 18px', border: 'none', background: '#E8542A', color: '#fff', borderRadius: 10, font: `700 13.5px ${FF}`, cursor: 'pointer', boxShadow: '0 2px 0 #c4421e' }}>
                        + Nova avaliação
                      </button>
                    </div>
                  </div>
                </div>

                {assessLoading ? (
                  <div style={{ font: `400 13px ${FF}`, color: '#9a948a', padding: '20px 0' }}>Carregando...</div>
                ) : assessError ? (
                  <div style={{ background: '#fbe6e1', border: '1px solid #f4c4b8', borderRadius: 12, padding: '14px 16px', marginTop: 8 }}>
                    <div style={{ font: `700 13px ${FF}`, color: '#c4421e', marginBottom: 4 }}>Erro ao carregar avaliações</div>
                    <div style={{ font: `400 12px ${FF}`, color: '#7c3a2a', fontFamily: 'monospace', wordBreak: 'break-all' }}>{assessError}</div>
                    <div style={{ font: `400 12px ${FF}`, color: '#7c3a2a', marginTop: 6 }}>Verifique se a migração <strong>024_assessments_photo_columns.sql</strong> foi aplicada no banco.</div>
                  </div>
                ) : assessments.length === 0 ? (
                  <Empty icon="📊" title="Nenhuma avaliação registrada" sub="Clique em '+ Nova avaliação' para registrar a primeira avaliação deste aluno." />
                ) : showComparison && compLeft && compRight ? (

                  /* ── COMPARAÇÃO ───────────────────────────────── */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <button type="button" onClick={() => setShowComparison(false)}
                      style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6, font: `600 13px ${FF}`, color: '#7c7869', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
                      Voltar à lista
                    </button>

                    {/* Fotos lado a lado */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      {([compLeft, compRight] as AssessmentRow[]).map((a, ci) => (
                        <div key={ci} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={{ font: `600 12px ${FF}`, color: '#1B2A4A', textAlign: 'center' }}>
                            {ci === 0 ? 'Antes' : 'Depois'} · {fmtDate(a.assessed_at)}
                          </div>
                          {a.photo_frente_url ? (
                            <img src={a.photo_frente_url} alt="" style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover', borderRadius: 12 }} />
                          ) : (
                            <div style={{ width: '100%', aspectRatio: '3/4', background: '#f4efe3', border: '1.5px dashed #d6cfbe', borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#c8bfb0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                              <button type="button"
                                onClick={() => { pendingAssIdRef.current = a.id; assessPhotoRef.current?.click() }}
                                style={{ font: `600 11px ${FF}`, color: '#E8542A', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                                + Adicionar foto
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Tabela de comparação */}
                    <div style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 14, overflow: 'hidden' }}>
                      {/* Cabeçalho */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr', padding: '11px 16px', background: '#fbf8f1', borderBottom: '1px solid #ece7d9', gap: 8 }}>
                        {['Métrica', fmtDate(compLeft.assessed_at), fmtDate(compRight.assessed_at), 'Variação'].map((h, hi) => (
                          <div key={hi} style={{ font: `700 11px ${FF}`, color: hi === 0 ? '#9a948a' : '#1B2A4A', textTransform: hi === 0 || hi === 3 ? 'uppercase' : 'none', letterSpacing: '.4px', textAlign: hi > 0 ? 'center' : 'left' }}>{h}</div>
                        ))}
                      </div>
                      {METRICS.map((m, mi) => {
                        const vA = compLeft[m.key]  as number | null
                        const vB = compRight[m.key] as number | null
                        if (vA == null && vB == null) return null
                        const delta = vA != null && vB != null ? vB - vA : null
                        let dc = '#7c7869'
                        if (delta != null && m.lib !== null) {
                          dc = (m.lib ? delta < 0 : delta > 0) ? '#1B7a4a' : delta !== 0 ? '#c4421e' : '#7c7869'
                        }
                        return (
                          <div key={m.key} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr', padding: '11px 16px', borderTop: mi === 0 ? 'none' : '1px solid #f1ece0', gap: 8, alignItems: 'center' }}>
                            <div style={{ font: `500 13px ${FF}`, color: '#4a4742' }}>{m.label}</div>
                            <div style={{ font: `600 13px ${FF}`, color: '#1B2A4A', textAlign: 'center' }}>{fmtVal(vA, m.dec, m.unit)}</div>
                            <div style={{ font: `600 13px ${FF}`, color: '#1B2A4A', textAlign: 'center' }}>{fmtVal(vB, m.dec, m.unit)}</div>
                            <div style={{ font: `700 13px ${FF}`, color: dc, textAlign: 'center' }}>
                              {delta == null ? '—' : delta === 0 ? '=' : fmtDelta(delta, m.dec, m.unit)}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                ) : (

                  /* ── LISTA NORMAL ──────────────────────────────── */
                  <>
                    {/* Resumo mais recente */}
                    {lastAssess && !compareMode && (
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {[
                          { label: 'Peso atual',  val: lastAssess.weight_kg    != null ? `${lastAssess.weight_kg.toFixed(1)} kg`   : '—' },
                          { label: '% Gordura',   val: lastAssess.body_fat_pct != null ? `${lastAssess.body_fat_pct.toFixed(1)}%`  : '—' },
                          { label: 'Cintura',     val: lastAssess.waist_cm     != null ? `${lastAssess.waist_cm.toFixed(1)} cm`    : '—' },
                          { label: 'Quadril',     val: lastAssess.hip_cm       != null ? `${lastAssess.hip_cm.toFixed(1)} cm`      : '—' },
                        ].map(({ label, val }) => (
                          <div key={label} style={{ flex: 1, minWidth: 120, background: '#fff', border: '1px solid #ece7d9', borderRadius: 12, padding: 16 }}>
                            <div style={{ font: `500 11px ${FF}`, color: '#9a948a' }}>{label}</div>
                            <div style={{ font: `800 22px ${FF}`, color: '#1B2A4A', marginTop: 4 }}>{val}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Dica do modo comparação */}
                    {compareMode && (
                      <div style={{ background: '#fff8f6', border: '1.5px solid rgba(232,84,42,.2)', borderRadius: 12, padding: '11px 16px', font: `500 13px ${FF}`, color: '#E8542A', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
                        {compareSelected.length === 0 && 'Selecione 2 avaliações para comparar'}
                        {compareSelected.length === 1 && 'Selecione mais 1 avaliação'}
                        {compareSelected.length === 2 && '2 avaliações selecionadas — clique em "Ver comparação"'}
                      </div>
                    )}

                    {/* Lista cronológica */}
                    <div style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 14, overflow: 'hidden' }}>
                      <div style={{ padding: '11px 18px', background: '#fbf8f1', borderBottom: '1px solid #ece7d9', font: `700 11px ${FF}`, color: '#9a948a', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                        Histórico · mais antigo primeiro
                      </div>
                      {assessments.map((a, i) => {
                        const isLatest   = i === assessments.length - 1
                        const isSelected = compareSelected.includes(a.id)
                        return (
                          <div key={a.id}
                            onClick={() => compareMode
                              ? setCompareSelected(prev =>
                                  prev.includes(a.id) ? prev.filter(x => x !== a.id) : prev.length < 2 ? [...prev, a.id] : [prev[1], a.id]
                                )
                              : setOpenAssessId(a.id)
                            }
                            style={{ borderTop: i === 0 ? 'none' : '1px solid #f1ece0', background: isSelected ? '#fff8f6' : '#fff', cursor: 'pointer', transition: 'background .12s' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 18px' }}>

                              {/* Checkbox comparação */}
                              {compareMode && (
                                <div style={{ flexShrink: 0, marginTop: 3, width: 20, height: 20, borderRadius: '50%', border: `2px solid ${isSelected ? '#E8542A' : '#d6cfbe'}`, background: isSelected ? '#E8542A' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  {isSelected && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>}
                                </div>
                              )}

                              {/* Thumbnail / botão foto */}
                              <div style={{ flexShrink: 0 }}>
                                {a.photo_frente_url ? (
                                  <img src={a.photo_frente_url} alt="" style={{ width: 56, height: 72, objectFit: 'cover', borderRadius: 8, display: 'block' }} />
                                ) : (
                                  <button type="button"
                                    onClick={e => { e.stopPropagation(); pendingAssIdRef.current = a.id; assessPhotoRef.current?.click() }}
                                    disabled={uploadingAssId === a.id}
                                    style={{ width: 56, height: 72, background: '#f4efe3', border: '1.5px dashed #d6cfbe', borderRadius: 8, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                                    {uploadingAssId === a.id
                                      ? <span style={{ width: 14, height: 14, border: '2px solid #d6cfbe', borderTopColor: '#E8542A', borderRadius: '50%', display: 'block', animation: 'kspin .7s linear infinite' }} />
                                      : <>
                                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b0a99c" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                                          <span style={{ font: `500 9px ${FF}`, color: '#b0a99c' }}>+ Foto</span>
                                        </>
                                    }
                                  </button>
                                )}
                              </div>

                              {/* Métricas */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                                  <span style={{ font: `600 13px ${FF}`, color: '#1B2A4A' }}>{fmtDate(a.assessed_at)}</span>
                                  {isLatest && <span style={{ font: `600 10px ${FF}`, color: '#1B7a4a', background: '#e7f3ea', borderRadius: 20, padding: '2px 9px' }}>Mais recente</span>}
                                </div>
                                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                  {a.weight_kg    != null && <span style={{ font: `400 12.5px ${FF}`, color: '#4a4742' }}>⚖️ {a.weight_kg.toFixed(1)} kg</span>}
                                  {a.body_fat_pct != null && <span style={{ font: `400 12.5px ${FF}`, color: '#4a4742' }}>📊 {a.body_fat_pct.toFixed(1)}%</span>}
                                  {a.waist_cm     != null && <span style={{ font: `400 12.5px ${FF}`, color: '#4a4742' }}>Cintura {a.waist_cm.toFixed(0)} cm</span>}
                                  {a.hip_cm       != null && <span style={{ font: `400 12.5px ${FF}`, color: '#4a4742' }}>Quadril {a.hip_cm.toFixed(0)} cm</span>}
                                  {a.arm_cm       != null && <span style={{ font: `400 12.5px ${FF}`, color: '#4a4742' }}>Braço {a.arm_cm.toFixed(0)} cm</span>}
                                  {a.thigh_cm     != null && <span style={{ font: `400 12.5px ${FF}`, color: '#4a4742' }}>Coxa {a.thigh_cm.toFixed(0)} cm</span>}
                                </div>
                                {a.notes && <div style={{ font: `400 12px ${FF}`, color: '#9a948a', marginTop: 6, fontStyle: 'italic' }}>{a.notes}</div>}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Botão ver comparação */}
                    {compareMode && compareSelected.length === 2 && (
                      <button type="button" onClick={() => setShowComparison(true)}
                        style={{ height: 48, border: 'none', background: '#1B2A4A', color: '#fff', borderRadius: 12, font: `700 14px ${FF}`, cursor: 'pointer', boxShadow: '0 2px 0 #0f1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="18"/><rect x="14" y="3" width="7" height="18"/></svg>
                        Ver comparação das avaliações selecionadas
                      </button>
                    )}
                  </>
                )}
              </div>
            )
          })()}

          {/* PAGAMENTOS */}
          {tab === 'pagamentos' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 150, background: '#1B2A4A', borderRadius: 14, padding: '18px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                    <div style={{ font: `500 12px ${FF}`, color: '#aeb9cc' }}>Plano atual</div>
                    <button type="button" onClick={() => setShowPlanPicker(true)}
                      style={{ font: `600 11px ${FF}`, color: '#E8542A', background: 'rgba(232,84,42,.15)', border: 'none', borderRadius: 20, padding: '3px 10px', cursor: 'pointer' }}>
                      {student.plan === 'Sem plano' ? 'Atribuir' : 'Alterar'}
                    </button>
                  </div>
                  <div style={{ font: `800 19px ${FF}`, color: student.plan === 'Sem plano' ? '#6b7a9a' : '#fff', fontStyle: student.plan === 'Sem plano' ? 'italic' : 'normal' }}>
                    {student.plan === 'Sem plano' ? 'Sem plano definido' : student.plan}
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 150, background: '#fff', border: `1px solid ${student.blocked ? '#f6cdbf' : '#ece7d9'}`, borderRadius: 14, padding: '18px 20px' }}>
                  <div style={{ font: `500 12px ${FF}`, color: '#9a948a' }}>Status</div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', font: `700 14px ${FF}`, color: pay.color, background: pay.bg, borderRadius: 20, padding: '4px 12px', marginTop: 7 }}>{pay.label}</div>
                  {(student.pay === 'overdue' || student.blocked) && (
                    <div style={{ marginTop: 12 }}>
                      {student.blocked && (
                        <div style={{ font: `400 11px ${FF}`, color: '#9a7060', marginBottom: 8 }}>
                          Bloqueado automaticamente por atraso
                        </div>
                      )}
                      <button
                        type="button"
                        disabled={blockLoading}
                        onClick={async () => {
                          setBlockLoading(true)
                          await blockStudent(studentId, !student.blocked)
                          setBlockLoading(false)
                          showToast(student.blocked ? 'Acesso restaurado.' : 'Aluno bloqueado.')
                        }}
                        style={{ height: 32, padding: '0 14px', border: 'none', borderRadius: 8, font: `700 12px ${FF}`, cursor: blockLoading ? 'default' : 'pointer', opacity: blockLoading ? .6 : 1, background: student.blocked ? '#e7f3ea' : '#fbe6e1', color: student.blocked ? '#1B7a4a' : '#c4421e' }}
                      >
                        {blockLoading ? '...' : student.blocked ? 'Liberar acesso' : 'Bloquear'}
                      </button>
                    </div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 150, background: '#fff', border: '1px solid #ece7d9', borderRadius: 14, padding: '18px 20px' }}>
                  <div style={{ font: `500 12px ${FF}`, color: '#9a948a' }}>Total pago</div>
                  <div style={{ font: `800 19px ${FF}`, color: '#1B2A4A', marginTop: 5 }}>
                    {fmtMoney(payments.filter(p => p.status === 'active').reduce((s, p) => s + p.amount, 0))}
                  </div>
                  <div style={{ font: `400 12px ${FF}`, color: '#9a948a', marginTop: 3 }}>{payments.filter(p => p.status === 'active').length} fatura{payments.filter(p => p.status === 'active').length !== 1 ? 's' : ''}</div>
                </div>
              </div>
              {/* Botão nova fatura quando lista vazia */}
              {payments.length === 0 && !newPayOpen && !payLoading && (
                <div style={{ textAlign: 'right' }}>
                  <button type="button" onClick={() => setNewPayOpen(true)}
                    style={{ height: 38, padding: '0 16px', border: 'none', background: '#E8542A', color: '#fff', borderRadius: 9, font: `700 13px ${FF}`, cursor: 'pointer', boxShadow: '0 2px 0 #c4421e' }}>
                    + Nova fatura
                  </button>
                </div>
              )}

              {/* Nova fatura inline */}
              {newPayOpen && (
                <div style={{ background: '#fff', border: '1.5px solid #E8542A', borderRadius: 14, padding: '18px 20px' }}>
                  <div style={{ font: `700 14px ${FF}`, color: '#1B2A4A', marginBottom: 14 }}>Nova fatura</div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ flex: 2, minWidth: 140 }}>
                      <div style={{ font: `600 11px ${FF}`, color: '#6b6657', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 5 }}>Descrição</div>
                      <input value={newPayDesc} onChange={e => setNewPayDesc(e.target.value)} placeholder="Mensalidade" style={{ width: '100%', height: 40, border: '1.5px solid #d9d3c4', borderRadius: 9, padding: '0 12px', font: `400 13.5px ${FF}`, color: '#1B2A4A', outline: 'none', background: '#fff' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 100 }}>
                      <div style={{ font: `600 11px ${FF}`, color: '#6b6657', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 5 }}>Valor (R$)</div>
                      <input value={newPayAmount} onChange={e => setNewPayAmount(e.target.value)} placeholder="0,00" inputMode="decimal" style={{ width: '100%', height: 40, border: '1.5px solid #d9d3c4', borderRadius: 9, padding: '0 12px', font: `400 13.5px ${FF}`, color: '#1B2A4A', outline: 'none', background: '#fff' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 120 }}>
                      <div style={{ font: `600 11px ${FF}`, color: '#6b6657', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 5 }}>Vencimento</div>
                      <input type="date" value={newPayDue} onChange={e => setNewPayDue(e.target.value)} style={{ width: '100%', height: 40, border: '1.5px solid #d9d3c4', borderRadius: 9, padding: '0 12px', font: `400 13.5px ${FF}`, color: '#1B2A4A', outline: 'none', background: '#fff' }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button type="button" onClick={saveNewPayment} disabled={newPaySaving || !newPayAmount || !newPayDue}
                      style={{ height: 38, padding: '0 18px', border: 'none', background: '#E8542A', color: '#fff', borderRadius: 9, font: `700 13px ${FF}`, cursor: 'pointer', opacity: (!newPayAmount || !newPayDue) ? .5 : 1 }}>
                      {newPaySaving ? 'Salvando...' : 'Registrar'}
                    </button>
                    <button type="button" onClick={() => { setNewPayOpen(false); setNewPayDesc(''); setNewPayAmount(''); setNewPayDue('') }}
                      style={{ height: 38, padding: '0 14px', border: '1.5px solid #d9d3c4', background: '#fff', color: '#7c7869', borderRadius: 9, font: `600 13px ${FF}`, cursor: 'pointer' }}>
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {payLoading ? (
                <div style={{ font: `400 13px ${FF}`, color: '#9a948a', padding: '20px 0' }}>Carregando...</div>
              ) : payments.length === 0 && !newPayOpen ? (
                <Empty icon="💳" title="Nenhuma fatura registrada" sub="Clique em + Nova fatura para registrar." />
              ) : payments.length > 0 ? (
                <div style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 14, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: '#fbf8f1', borderBottom: '1px solid #ece7d9' }}>
                    <span style={{ font: `700 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#9a948a' }}>Faturas</span>
                    <button type="button" onClick={() => setNewPayOpen(true)}
                      style={{ border: 'none', background: 'none', color: '#E8542A', font: `600 12px ${FF}`, cursor: 'pointer' }}>+ Nova fatura</button>
                  </div>
                  {payments.map((p, i) => {
                    const s = STATUS_PAY[p.status] ?? STATUS_PAY.pending
                    const isPending = p.status === 'pending' || p.status === 'overdue'
                    return (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '13px 18px', borderTop: i === 0 ? 'none' : '1px solid #f1ece0' }}>
                        <div>
                          <div style={{ font: `600 14px ${FF}`, color: '#1B2A4A' }}>{p.description ?? 'Fatura'}</div>
                          {editingDueId === p.id ? (
                            <input
                              type="date"
                              value={editingDueVal}
                              autoFocus
                              onChange={e => setEditingDueVal(e.target.value)}
                              onBlur={() => saveDueDate(p.id, editingDueVal)}
                              onKeyDown={e => { if (e.key === 'Enter') saveDueDate(p.id, editingDueVal); if (e.key === 'Escape') setEditingDueId(null) }}
                              style={{ font: `400 12px ${FF}`, color: '#1B2A4A', border: '1.5px solid #E8542A', borderRadius: 6, padding: '2px 6px', outline: 'none', background: '#fff', marginTop: 2 }}
                            />
                          ) : (
                            <div
                              onClick={() => { setEditingDueId(p.id); setEditingDueVal(p.due_date) }}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, font: `400 12px ${FF}`, color: '#9a948a', cursor: 'pointer' }}
                              title="Clique para editar"
                            >
                              venc. {fmtDate(p.due_date)}
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ font: `700 13px ${FF}`, color: '#1B2A4A' }}>{fmtMoney(p.amount)}</span>
                          {isPending && (
                            <button type="button" onClick={() => markAsPaid(p.id)} disabled={markingPaidId === p.id}
                              style={{ height: 28, padding: '0 10px', border: 'none', borderRadius: 7, background: '#e7f3ea', color: '#1B7a4a', font: `700 11px ${FF}`, cursor: 'pointer', opacity: markingPaidId === p.id ? .6 : 1, whiteSpace: 'nowrap' }}>
                              {markingPaidId === p.id ? '...' : 'Marcar pago'}
                            </button>
                          )}
                          <span style={{ display: 'inline-flex', alignItems: 'center', font: `600 11px ${FF}`, color: s.color, background: s.bg, borderRadius: 20, padding: '3px 10px', whiteSpace: 'nowrap' }}>{s.label}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : null}
            </div>
          )}

          {/* ANEXOS */}
          {tab === 'anexos' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h2 style={{ font: `800 20px ${FF}`, color: '#1B2A4A', margin: 0, letterSpacing: '-.4px' }}>Anexos</h2>
                  <p style={{ font: `400 13px ${FF}`, color: '#7c7869', margin: '3px 0 0' }}>Exames, fotos de progresso, laudos e documentos</p>
                </div>
                <button type="button" onClick={() => attachInputRef.current?.click()} disabled={attachUploading}
                  style={{ height: 42, padding: '0 18px', border: 'none', background: '#E8542A', color: '#fff', borderRadius: 10, font: `700 13.5px ${FF}`, cursor: attachUploading ? 'default' : 'pointer', boxShadow: '0 2px 0 #c4421e', opacity: attachUploading ? .7 : 1 }}>
                  {attachUploading ? 'Enviando...' : '+ Adicionar anexo'}
                </button>
                <input ref={attachInputRef} type="file" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadAttachment(f); if (attachInputRef.current) attachInputRef.current.value = '' }} />
              </div>

              {attachLoading ? (
                <div style={{ font: `400 13px ${FF}`, color: '#9a948a' }}>Carregando...</div>
              ) : attachments.length === 0 ? (
                <Empty icon="📎" title="Nenhum anexo enviado" sub="Clique em + Adicionar anexo para enviar exames, laudos ou documentos." />
              ) : (
                <div style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 14, overflow: 'hidden' }}>
                  {attachments.map((a, i) => {
                    const isImg = a.mime_type?.startsWith('image/')
                    const isPdf = a.mime_type === 'application/pdf'
                    const sizeFmt = a.size ? a.size < 1024 * 1024 ? `${(a.size / 1024).toFixed(0)} KB` : `${(a.size / 1024 / 1024).toFixed(1)} MB` : ''
                    return (
                      <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '12px 18px', borderTop: i === 0 ? 'none' : '1px solid #f1ece0' }}>
                        <div style={{ width: 38, height: 38, borderRadius: 9, background: isImg ? '#eef1f6' : isPdf ? '#fbe6e1' : '#f1ece0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {isImg
                            ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1B2A4A" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                            : isPdf
                              ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c4421e" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>
                              : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c7869" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>
                          }
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ font: `600 13.5px ${FF}`, color: '#1B2A4A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
                          <div style={{ font: `400 11.5px ${FF}`, color: '#9a948a' }}>{sizeFmt}{sizeFmt && ' · '}{fmtDate(a.uploaded_at)}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                          <a href={a.url} target="_blank" rel="noreferrer"
                            style={{ height: 32, padding: '0 12px', border: '1.5px solid #d9d3c4', borderRadius: 8, background: '#fff', color: '#1B2A4A', font: `600 12px ${FF}`, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
                            Abrir
                          </a>
                          <button type="button" onClick={() => deleteAttachment(a.id, a.url)}
                            style={{ height: 32, padding: '0 12px', border: 'none', borderRadius: 8, background: '#fbe6e1', color: '#c4421e', font: `600 12px ${FF}`, cursor: 'pointer' }}>
                            Remover
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* HISTÓRICO */}
          {tab === 'historico' && (
            <div style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 14, padding: '22px 24px' }}>
              <h2 style={{ font: `800 18px ${FF}`, color: '#1B2A4A', margin: '0 0 18px', letterSpacing: '-.3px' }}>Linha do tempo</h2>
              {(checkLoading || assessLoading || payLoading) ? (
                <div style={{ font: `400 13px ${FF}`, color: '#9a948a' }}>Carregando...</div>
              ) : (() => {
                const events: { dot: string; title: string; desc: string; date: string; ts: number }[] = []

                // Registration event
                const [mon, yr] = student.since.split('/')
                const sinceTs = new Date(parseInt(yr), MONTHS_PT[mon] ?? 0, 1).getTime()
                events.push({ dot: '#9a948a', title: 'Início do acompanhamento', desc: `Aluno ingressou · plano ${student.plan === 'Sem plano' ? 'a definir' : student.plan}`, date: student.since, ts: sinceTs })

                // Check-ins
                checkins.forEach(c => events.push({ dot: '#E8542A', title: 'Check-in', desc: c.content.slice(0, 80) + (c.content.length > 80 ? '…' : ''), date: fmtDate(c.created_at), ts: new Date(c.created_at).getTime() }))

                // Assessments
                assessments.forEach(a => events.push({ dot: '#1B2A4A', title: 'Avaliação física', desc: [a.weight_kg != null ? `Peso ${a.weight_kg.toFixed(1)} kg` : '', a.body_fat_pct != null ? `${a.body_fat_pct.toFixed(1)}% gordura` : ''].filter(Boolean).join(' · ') || 'Avaliação registrada', date: fmtDate(a.assessed_at), ts: new Date(a.assessed_at).getTime() }))

                // Payments
                payments.forEach(p => {
                  events.push({ dot: p.status === 'active' ? '#1B7a4a' : '#b06a12', title: p.status === 'active' ? 'Pagamento confirmado' : 'Fatura gerada', desc: `${p.description ?? 'Fatura'} · ${fmtMoney(p.amount)}`, date: p.paid_at ? fmtDate(p.paid_at) : fmtDate(p.due_date), ts: new Date(p.paid_at ?? p.due_date).getTime() })
                })

                events.sort((a, b) => b.ts - a.ts)

                if (events.length === 1) return <div style={{ font: `400 13px ${FF}`, color: '#9a948a' }}>Nenhum evento registrado além do cadastro.</div>

                return events.map((t, i) => (
                  <div key={i} style={{ display: 'flex', gap: 14 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{ width: 11, height: 11, borderRadius: '50%', background: t.dot, marginTop: 4, flexShrink: 0 }} />
                      {i < events.length - 1 && <div style={{ width: 2, flex: 1, background: '#eee5d2' }} />}
                    </div>
                    <div style={{ paddingBottom: 18 }}>
                      <div style={{ font: `600 13.5px ${FF}`, color: '#1B2A4A' }}>{t.title}</div>
                      <div style={{ font: `400 12.5px ${FF}`, color: '#7c7869', marginTop: 2 }}>{t.desc}</div>
                      <div style={{ font: `500 11px ${FF}`, color: '#b0a99c', marginTop: 4 }}>{t.date}</div>
                    </div>
                  </div>
                ))
              })()}
            </div>
          )}

        </div>
      </div>

      {openAssess && (
        <AssessmentDetailDrawer
          assessment={openAssess}
          prevAssessment={openAssessPrev}
          uploadingId={uploadingAssId}
          onClose={() => setOpenAssessId(null)}
          onPhotoUpload={handleDrawerPhotoUpload}
        />
      )}

      {showNewAssessment && student && (
        <ProfileAssessmentModal
          studentId={studentId}
          studentName={student.name}
          studentUuid={student.studentUuid}
          onClose={() => setShowNewAssessment(false)}
          onSaved={(row: SavedAssessmentRow) => {
            const updated = [...assessments, row as AssessmentRow].sort(
              (a, b) => new Date(a.assessed_at).getTime() - new Date(b.assessed_at).getTime()
            )
            setAssessments(updated)
            const freq = student?.assessmentFrequency
            const days = freq === 'monthly' ? 28 : freq === 'biweekly' ? 14 : freq === 'weekly' ? 7 : 0
            if (days > 0 && updated.length > 0) {
              const firstMs = new Date(updated[0].assessed_at).getTime()
              const rowMs   = new Date(row.assessed_at).getTime()
              const n       = Math.floor((rowMs - firstMs) / (days * 86400000)) + 1
              const nd      = new Date(firstMs + n * days * 86400000)
              const next    = `${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, '0')}-${String(nd.getDate()).padStart(2, '0')}`
              updateNextAssessment(studentId, next)
              const [y, m, d] = next.split('-')
              showToast(`Avaliação salva. Próxima agendada para ${d}/${m}/${y}.`)
            } else {
              showToast('Avaliação salva com sucesso.')
            }
          }}
        />
      )}

      {showAnamneseForm && student && (
        <CoachAnamneseDrawer
          studentName={student.name}
          studentUuid={student.studentUuid}
          studentRowId={studentId}
          existing={anamnese}
          onClose={() => setShowAnamneseForm(false)}
          onSaved={row => {
            setAnamnese(row)
            showToast('Anamnese salva com sucesso.')
          }}
        />
      )}

      {showAssignProgram && user && (
        <AssignProgramModal
          studentId={studentId}
          coachId={user.id!}
          onClose={() => setShowAssignProgram(false)}
          onAssigned={handleAfterAssignProgram}
        />
      )}

      {showAssignModal && student && user && (
        <AssignWorkoutModal
          studentId={studentId}
          coachId={user.id!}
          onClose={() => setShowAssignModal(false)}
          onAssigned={handleAfterAssign}
        />
      )}

      <Toast msg={toast} />
    </div>
  )
}

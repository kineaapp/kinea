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
  nome: string; data_nasc: string; telefone: string; profissao: string
  doencas: string; outra_doenca: string; medicamentos: string; cirurgia: string; limitacoes: string
  pratica_atual: string; atividade_atual: string; treinou_personal: string
  objetivo: string; dias_semana: string; horario: string
  horas_sono: string; nivel_estresse: string; fuma: string; alcool: string
  created_at: string
}

interface ExerciseRow { name: string; sets: number; reps: string; sort_order: number }

interface WorkoutRow {
  id: number; name: string; description: string | null
  muscle_group: string | null; difficulty: string; duration_min: number
  exercises: ExerciseRow[]
}

interface AssignmentRow { id: number; day_of_week: number | null; workouts: WorkoutRow }

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
  return new Date(iso).toLocaleDateString('pt-BR')
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
  nome: string; dataNasc: string; telefone: string; profissao: string
  doencas: string[]; outraDoenca: string; medicamentos: string; cirurgia: string; limitacoes: string
  praticaAtual: string; atividadeAtual: string; treinouPersonal: string
  objetivo: string; diasSemana: string; horario: string
  horasSono: string; nivelEstresse: string; fuma: string; alcool: string
}

const ANAMNESE_EMPTY: AnamneseFormData = {
  nome: '', dataNasc: '', telefone: '', profissao: '',
  doencas: [], outraDoenca: '', medicamentos: '', cirurgia: '', limitacoes: '',
  praticaAtual: '', atividadeAtual: '', treinouPersonal: '',
  objetivo: '', diasSemana: '', horario: '',
  horasSono: '', nivelEstresse: '', fuma: '', alcool: '',
}

function CoachAnamneseDrawer({ studentName, studentUuid, existing, onClose, onSaved }: {
  studentName: string
  studentUuid: string
  existing:    AnamneseRow | null
  onClose:     () => void
  onSaved:     (row: AnamneseRow) => void
}) {
  const init: AnamneseFormData = existing ? {
    nome: existing.nome, dataNasc: existing.data_nasc, telefone: existing.telefone, profissao: existing.profissao,
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
    const payload = {
      student_id:       studentUuid,
      nome:             form.nome,
      data_nasc:        form.dataNasc,
      telefone:         form.telefone,
      profissao:        form.profissao,
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
              <div><label style={lbl}>Profissão</label><input style={inp} placeholder="Ex.: professora, analista..." value={form.profissao} onChange={e => set1('profissao', e.target.value)} /></div>
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

// ── Main ───────────────────────────────────────────────────────
export default function PerfilAluno() {
  const { id }    = useParams<{ id: string }>()
  const navigate  = useNavigate()
  const [tab, setTab] = useState<Tab>('overview')
  const [toast, setToast] = useState('')
  const toastRef  = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // ── Auth / student ────────────────────────────────────────
  const { students, fetchStudents, deleteStudent, updatePlan, updateStudentInfo, blockStudent, setStudentStripeSubId, updateAssessmentFrequency } = useStudentsStore()
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
  const [editSaving,    setEditSaving]        = useState(false)
  const [blockLoading,  setBlockLoading]      = useState(false)
  const [subLoading,    setSubLoading]        = useState(false)
  const [subError,      setSubError]          = useState<string | null>(null)
  const [checkoutUrl,   setCheckoutUrl]       = useState<string | null>(null)
  const [urlCopied,       setUrlCopied]       = useState(false)
  const [showAnamneseForm, setShowAnamneseForm] = useState(false)

  useEffect(() => {
    if (students.length === 0 && user?.id) fetchStudents(user.id)
  }, [user?.id])

  const student = students.find(s => s.id === studentId)

  // ── Remote data ───────────────────────────────────────────
  const [anamnese,        setAnamnese]        = useState<AnamneseRow | null>(null)
  const [anamneseLoading, setAnamneseLoading] = useState(false)
  const [assignments,     setAssignments]     = useState<AssignmentRow[]>([])
  const [assignLoading,   setAssignLoading]   = useState(false)
  const [assessments,     setAssessments]     = useState<AssessmentRow[]>([])
  const [assessLoading,   setAssessLoading]   = useState(false)
  const [payments,        setPayments]        = useState<PaymentRow[]>([])
  const [payLoading,      setPayLoading]      = useState(false)
  const [checkins,        setCheckins]        = useState<CheckInRow[]>([])
  const [checkLoading,    setCheckLoading]    = useState(false)
  const [sessions,        setSessions]        = useState<SessionRow[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const loaded = useRef(new Set<string>())

  const fetchAnamnese = useCallback(async () => {
    if (!student?.studentUuid || loaded.current.has('anamnese')) return
    loaded.current.add('anamnese')
    setAnamneseLoading(true)
    const { data } = await supabase.from('anamneses').select('*')
      .eq('student_id', student.studentUuid).order('created_at', { ascending: false }).limit(1).single()
    setAnamnese(data ?? null)
    setAnamneseLoading(false)
  }, [student?.studentUuid])

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

  const fetchAssessments = useCallback(async () => {
    if (!studentId || loaded.current.has('assessments')) return
    loaded.current.add('assessments')
    setAssessLoading(true)
    const { data } = await supabase.from('assessments')
      .select('id,assessed_at,weight_kg,body_fat_pct,chest_cm,waist_cm,hip_cm,arm_cm,thigh_cm,notes,photo_frente_url,photo_lado_esq_url,photo_lado_dir_url,photo_costas_url')
      .eq('student_id', studentId).order('assessed_at', { ascending: true })
    setAssessments((data as AssessmentRow[] | null) ?? [])
    setAssessLoading(false)
  }, [studentId])

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
    if (tab === 'overview')   { fetchAssignments(); fetchCheckins() }
    if (tab === 'anamnese')   fetchAnamnese()
    if (tab === 'treino')     fetchAssignments()
    if (tab === 'feedback')   fetchSessions()
    if (tab === 'avaliacoes') fetchAssessments()
    if (tab === 'pagamentos') fetchPayments()
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

  const PLANS = ['Mensal', 'Trimestral', 'Semestral', 'Permuta']

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

  async function handleCreateCheckout() {
    setSubLoading(true); setSubError(null); setCheckoutUrl(null)
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { studentId },
      })
      if (error) throw new Error(error.message)
      if (data?.error) throw new Error(data.error)
      if (data?.url) {
        setCheckoutUrl(data.url)
        if (data?.subscriptionId) setStudentStripeSubId(studentId, data.subscriptionId)
      }
    } catch (err) {
      setSubError(err instanceof Error ? err.message : 'Erro ao gerar cobrança')
    }
    setSubLoading(false)
  }

  function copyCheckoutUrl() {
    if (!checkoutUrl) return
    try { navigator.clipboard.writeText(checkoutUrl) } catch {}
    setUrlCopied(true); setTimeout(() => setUrlCopied(false), 1800)
  }

  function openEditModal() {
    setEditName(student?.name ?? '')
    setEditEmail(student?.email ?? '')
    setEditGoal(student?.goal ?? '')
    setShowEditModal(true)
  }

  async function handleSaveStudentInfo() {
    const name  = editName.trim()
    const email = editEmail.trim().toLowerCase()
    const goal  = editGoal.trim()
    if (!name || !email || !goal) return
    setEditSaving(true)
    await updateStudentInfo(studentId, { name, email, goal })
    setEditSaving(false)
    setShowEditModal(false)
    showToast('Dados atualizados.')
  }

  async function handleSavePlan(plan: string) {
    setSavingPlan(true)
    await updatePlan(studentId, plan)
    setSavingPlan(false)
    setShowPlanPicker(false)
    showToast(`Plano atualizado para ${plan}`)
  }

  function showToast(msg: string) {
    setToast(msg)
    clearTimeout(toastRef.current)
    toastRef.current = setTimeout(() => setToast(''), 2000)
  }
  useEffect(() => () => clearTimeout(toastRef.current), [])

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

  // ── Unique workouts for overview / treino ─────────────────
  const uniqueWorkouts = assignments.reduce<WorkoutRow[]>((acc, a) => {
    if (!acc.find(w => w.id === a.workouts.id)) acc.push(a.workouts)
    return acc
  }, [])

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
                { label: 'Nome completo', value: editName, set: setEditName, type: 'text' },
                { label: 'E-mail',        value: editEmail, set: setEditEmail, type: 'email' },
                { label: 'Objetivo',      value: editGoal,  set: setEditGoal,  type: 'text' },
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
                    <h2 style={{ font: `700 16px ${FF}`, color: '#1B2A4A', margin: 0 }}>Treino atual</h2>
                    {uniqueWorkouts.length > 0 && <span style={{ font: `600 11px ${FF}`, color: '#1B7a4a', background: '#e7f3ea', borderRadius: 20, padding: '4px 11px' }}>Ativo</span>}
                  </div>
                  {assignLoading ? (
                    <div style={{ font: `400 13px ${FF}`, color: '#9a948a' }}>Carregando...</div>
                  ) : uniqueWorkouts.length === 0 ? (
                    <div style={{ font: `400 13px ${FF}`, color: '#9a948a' }}>Nenhum treino atribuído ainda.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {uniqueWorkouts.map(w => (
                        <div key={w.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f4efe3' }}>
                          <span style={{ font: `600 14px ${FF}`, color: '#1B2A4A' }}>{w.name}</span>
                          <span style={{ font: `400 12px ${FF}`, color: '#9a948a' }}>{w.muscle_group ?? w.difficulty} · {w.duration_min} min</span>
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
                      <button key={label} type="button" onClick={() => showToast('Em breve!')}
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
                  <h2 style={{ font: `800 20px ${FF}`, color: '#1B2A4A', margin: 0, letterSpacing: '-.4px' }}>Treinos atribuídos</h2>
                  {uniqueWorkouts.length > 0 && <p style={{ font: `400 13px ${FF}`, color: '#7c7869', margin: '3px 0 0' }}>{uniqueWorkouts.length} treino{uniqueWorkouts.length > 1 ? 's' : ''} · {assignments.length} sessão{assignments.length > 1 ? 'ões' : ''} por semana</p>}
                </div>
                <button type="button" onClick={() => showToast('Em breve!')}
                  style={{ height: 42, padding: '0 18px', border: 'none', background: '#E8542A', color: '#fff', borderRadius: 10, font: `700 13.5px ${FF}`, cursor: 'pointer', boxShadow: '0 2px 0 #c4421e' }}>
                  + Atribuir treino
                </button>
              </div>
              {assignLoading ? (
                <div style={{ font: `400 13px ${FF}`, color: '#9a948a', padding: '20px 0' }}>Carregando...</div>
              ) : uniqueWorkouts.length === 0 ? (
                <Empty icon="🏋️" title="Nenhum treino atribuído" sub="Use o botão acima para atribuir um treino a este aluno." />
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 12 }}>
                  {uniqueWorkouts.map(w => {
                    const days = assignments.filter(a => a.workouts.id === w.id && a.day_of_week != null).map(a => DAY_NAMES[a.day_of_week!])
                    return (
                      <div key={w.id} style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 14, padding: '16px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                          <div>
                            <div style={{ font: `700 14px ${FF}`, color: '#1B2A4A' }}>{w.name}</div>
                            <div style={{ font: `400 11.5px ${FF}`, color: '#9a948a', marginTop: 2 }}>{w.muscle_group ?? w.difficulty} · {w.duration_min} min</div>
                          </div>
                        </div>
                        {days.length > 0 && (
                          <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
                            {days.map(d => <span key={d} style={{ font: `600 10px ${FF}`, color: '#1B2A4A', background: '#f1ece0', borderRadius: 6, padding: '2px 7px' }}>{d}</span>)}
                          </div>
                        )}
                        {w.exercises.length > 0 && (
                          <div style={{ borderTop: '1px solid #f4efe3', paddingTop: 8 }}>
                            {[...w.exercises].sort((a,b) => a.sort_order - b.sort_order).map(ex => (
                              <div key={ex.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f8f5ef' }}>
                                <span style={{ font: `500 12.5px ${FF}`, color: '#4a4742' }}>{ex.name}</span>
                                <span style={{ font: `400 12px ${FF}`, color: '#9a948a' }}>{ex.sets}×{ex.reps}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
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
                            onClick={compareMode ? () => setCompareSelected(prev =>
                              prev.includes(a.id) ? prev.filter(x => x !== a.id) : prev.length < 2 ? [...prev, a.id] : [prev[1], a.id]
                            ) : undefined}
                            style={{ borderTop: i === 0 ? 'none' : '1px solid #f1ece0', background: isSelected ? '#fff8f6' : '#fff', cursor: compareMode ? 'pointer' : 'default', transition: 'background .12s' }}>
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
                        {blockLoading ? '...' : student.blocked ? 'Desbloquear' : 'Bloquear'}
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
              {/* ── Stripe Checkout ───────────────────────── */}
              {student.plan !== 'Permuta' && (!student.stripeSubId ? (
                <div style={{ background: '#fff', border: '2px dashed #d9d3c4', borderRadius: 14, padding: '22px 24px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ font: `700 15px ${FF}`, color: '#1B2A4A', marginBottom: 4 }}>Cobrança automática via Stripe</div>
                      <div style={{ font: `400 13px ${FF}`, color: '#7c7869', maxWidth: 420 }}>
                        Gera um link de pagamento de <strong>R$ 247 / mês</strong>. O aluno escolhe Pix, boleto ou cartão. Renovação automática todo mês.
                      </div>
                    </div>
                    <button type="button" onClick={handleCreateCheckout} disabled={subLoading}
                      style={{ flexShrink: 0, height: 44, padding: '0 20px', border: 'none', background: '#1B2A4A', color: '#fff', borderRadius: 10, font: `700 13.5px ${FF}`, cursor: subLoading ? 'default' : 'pointer', opacity: subLoading ? .7 : 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {subLoading
                        ? <><span style={{ width: 15, height: 15, border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'kspin .7s linear infinite' }} /> Gerando...</>
                        : '⚡ Gerar link de pagamento'
                      }
                    </button>
                  </div>
                  {subError && (
                    <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8, background: '#fdeee9', border: '1px solid #f6cdbf', borderRadius: 9, padding: '10px 13px' }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#E8542A" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v6"/><path d="M12 16.5v.5"/></svg>
                      <span style={{ font: `500 13px ${FF}`, color: '#c4421e' }}>{subError}</span>
                    </div>
                  )}
                  {checkoutUrl && (
                    <div style={{ marginTop: 16, background: '#f0f9f3', border: '1px solid #b7e0c6', borderRadius: 11, padding: '14px 16px' }}>
                      <div style={{ font: `600 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#1B7a4a', marginBottom: 8 }}>Link de pagamento gerado</div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <div style={{ flex: 1, minWidth: 0, height: 42, border: '1px solid #c2e0ce', borderRadius: 9, background: '#fff', display: 'flex', alignItems: 'center', padding: '0 13px', font: `500 12px ${FF}`, color: '#1B2A4A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{checkoutUrl}</div>
                        <button type="button" onClick={copyCheckoutUrl}
                          style={{ flexShrink: 0, height: 42, padding: '0 16px', border: 'none', borderRadius: 9, background: urlCopied ? '#1B7a4a' : '#1B2A4A', color: '#fff', font: `700 13px ${FF}`, cursor: 'pointer', transition: 'background .2s' }}>
                          {urlCopied ? '✓ Copiado' : 'Copiar'}
                        </button>
                      </div>
                      <div style={{ font: `400 12px ${FF}`, color: '#4a9a6a', marginTop: 8 }}>Envie este link ao aluno. Ele escolhe Pix, boleto ou cartão na hora do pagamento.</div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ background: '#f0f9f3', border: '1px solid #b7e0c6', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1B7a4a" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-6"/></svg>
                  <div>
                    <div style={{ font: `700 13.5px ${FF}`, color: '#1B7a4a' }}>Assinatura Stripe ativa</div>
                    <div style={{ font: `400 12px ${FF}`, color: '#4a9a6a', marginTop: 2 }}>Renovação automática mensal · Pix, boleto ou cartão</div>
                  </div>
                </div>
              ))}

              {payLoading ? (
                <div style={{ font: `400 13px ${FF}`, color: '#9a948a', padding: '20px 0' }}>Carregando...</div>
              ) : payments.length === 0 ? (
                <Empty icon="💳" title="Nenhuma fatura registrada" sub="As faturas serão listadas aqui assim que forem geradas." />
              ) : (
                <div style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 14, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: '#fbf8f1', borderBottom: '1px solid #ece7d9' }}>
                    <span style={{ font: `700 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#9a948a' }}>Faturas</span>
                    <button type="button" onClick={() => showToast('Em breve!')}
                      style={{ border: 'none', background: 'none', color: '#E8542A', font: `600 12px ${FF}`, cursor: 'pointer' }}>Registrar pagamento</button>
                  </div>
                  {payments.map((p, i) => {
                    const s = STATUS_PAY[p.status] ?? STATUS_PAY.pending
                    return (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '13px 18px', borderTop: i === 0 ? 'none' : '1px solid #f1ece0' }}>
                        <div>
                          <div style={{ font: `600 14px ${FF}`, color: '#1B2A4A' }}>{p.description ?? 'Fatura'}</div>
                          <div style={{ font: `400 12px ${FF}`, color: '#9a948a' }}>venc. {fmtDate(p.due_date)}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                          <span style={{ font: `700 13px ${FF}`, color: '#1B2A4A' }}>{fmtMoney(p.amount)}</span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', font: `600 11px ${FF}`, color: s.color, background: s.bg, borderRadius: 20, padding: '3px 10px', whiteSpace: 'nowrap' }}>{s.label}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
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
                <button type="button" onClick={() => showToast('Em breve!')}
                  style={{ height: 42, padding: '0 18px', border: 'none', background: '#E8542A', color: '#fff', borderRadius: 10, font: `700 13.5px ${FF}`, cursor: 'pointer', boxShadow: '0 2px 0 #c4421e' }}>+ Adicionar anexo</button>
              </div>
              <Empty icon="📎" title="Nenhum anexo enviado" sub="Envio de arquivos em breve." />
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

      {showNewAssessment && student && (
        <ProfileAssessmentModal
          studentId={studentId}
          studentName={student.name}
          studentUuid={student.studentUuid}
          onClose={() => setShowNewAssessment(false)}
          onSaved={(row: SavedAssessmentRow) => {
            setAssessments(prev => [...prev, row as AssessmentRow].sort(
              (a, b) => new Date(a.assessed_at).getTime() - new Date(b.assessed_at).getTime()
            ))
            showToast('Avaliação salva com sucesso.')
          }}
        />
      )}

      {showAnamneseForm && student?.studentUuid && (
        <CoachAnamneseDrawer
          studentName={student.name}
          studentUuid={student.studentUuid}
          existing={anamnese}
          onClose={() => setShowAnamneseForm(false)}
          onSaved={row => {
            setAnamnese(row)
            showToast('Anamnese salva com sucesso.')
          }}
        />
      )}

      <Toast msg={toast} />
    </div>
  )
}

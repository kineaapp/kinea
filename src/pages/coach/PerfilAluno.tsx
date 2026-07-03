import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getInitials, payInfo, semInfo, avatarPalette } from '../../data/mock'
import { useStudentsStore } from '../../store/students'
import { useAuthStore } from '../../store/auth'
import { supabase } from '../../lib/supabase'

const FF = '"Libre Franklin",sans-serif'

type Tab = 'overview' | 'anamnese' | 'treino' | 'avaliacoes' | 'pagamentos' | 'anexos' | 'historico'

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
}

interface PaymentRow {
  id: number; amount: number; status: string
  due_date: string; paid_at: string | null; description: string | null
}

interface CheckInRow { id: number; content: string; created_at: string }

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
  const { students, fetchStudents, deleteStudent, updatePlan } = useStudentsStore()
  const { user }  = useAuthStore()
  const studentId = parseInt(id ?? '0', 10)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showPlanPicker, setShowPlanPicker] = useState(false)
  const [savingPlan, setSavingPlan]         = useState(false)

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
      .select('id,assessed_at,weight_kg,body_fat_pct,chest_cm,waist_cm,hip_cm,arm_cm,thigh_cm,notes')
      .eq('student_id', studentId).order('assessed_at', { ascending: false })
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

  useEffect(() => {
    if (!student) return
    if (tab === 'overview')   { fetchAssignments(); fetchCheckins() }
    if (tab === 'anamnese')   fetchAnamnese()
    if (tab === 'treino')     fetchAssignments()
    if (tab === 'avaliacoes') fetchAssessments()
    if (tab === 'pagamentos') fetchPayments()
    if (tab === 'historico')  { fetchCheckins(); fetchAssessments(); fetchPayments() }
  }, [tab, student?.id])

  // ── Derived ───────────────────────────────────────────────
  const pal  = avatarPalette(studentId % 5)
  const pay  = student ? payInfo(student.pay)  : payInfo('pending')
  const sem  = student ? semInfo(student.sem)  : semInfo('green')
  const semanas      = student ? calcSemanas(student.since) : 0
  const lastAssess   = assessments[0] ?? null
  const pesoAtual    = lastAssess?.weight_kg    != null ? `${lastAssess.weight_kg.toFixed(1)} kg`    : null
  const gorduraAtual = lastAssess?.body_fat_pct != null ? `${lastAssess.body_fat_pct.toFixed(1)}%`  : null

  const PLANS = ['Mensal', 'Trimestral', 'Semestral', 'Permuta']

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
                <Empty icon="📋" title="Anamnese não preenchida" sub="O aluno ainda não completou a anamnese." />
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <h2 style={{ font: `800 20px ${FF}`, color: '#1B2A4A', margin: 0, letterSpacing: '-.4px' }}>Anamnese</h2>
                    <span style={{ font: `400 12px ${FF}`, color: '#9a948a' }}>Preenchida em {new Date(anamnese.created_at).toLocaleDateString('pt-BR')}</span>
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

          {/* AVALIAÇÕES */}
          {tab === 'avaliacoes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <h2 style={{ font: `800 20px ${FF}`, color: '#1B2A4A', margin: 0, letterSpacing: '-.4px' }}>Avaliações físicas</h2>
                <button type="button" onClick={() => showToast('Em breve!')}
                  style={{ height: 42, padding: '0 18px', border: '1.5px solid #d6cfbe', background: '#fff', color: '#1B2A4A', borderRadius: 10, font: `600 13.5px ${FF}`, cursor: 'pointer' }}>
                  + Nova avaliação
                </button>
              </div>
              {assessLoading ? (
                <div style={{ font: `400 13px ${FF}`, color: '#9a948a', padding: '20px 0' }}>Carregando...</div>
              ) : assessments.length === 0 ? (
                <Empty icon="📊" title="Nenhuma avaliação registrada" sub="Clique em '+ Nova avaliação' para registrar a primeira avaliação deste aluno." />
              ) : (
                <>
                  {/* Resumo últimos dados */}
                  {lastAssess && (
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      {[
                        { label: 'Peso atual',   val: lastAssess.weight_kg    != null ? `${lastAssess.weight_kg.toFixed(1)} kg`    : '—' },
                        { label: '% Gordura',    val: lastAssess.body_fat_pct != null ? `${lastAssess.body_fat_pct.toFixed(1)}%`   : '—' },
                        { label: 'Cintura',      val: lastAssess.waist_cm     != null ? `${lastAssess.waist_cm.toFixed(1)} cm`     : '—' },
                        { label: 'Quadril',      val: lastAssess.hip_cm       != null ? `${lastAssess.hip_cm.toFixed(1)} cm`       : '—' },
                      ].map(({ label, val }) => (
                        <div key={label} style={{ flex: 1, minWidth: 120, background: '#fff', border: '1px solid #ece7d9', borderRadius: 12, padding: 16 }}>
                          <div style={{ font: `500 11px ${FF}`, color: '#9a948a' }}>{label}</div>
                          <div style={{ font: `800 22px ${FF}`, color: '#1B2A4A', marginTop: 4 }}>{val}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Lista de avaliações */}
                  <div style={{ background: '#fff', border: '1px solid #ece7d9', borderRadius: 14, overflow: 'hidden' }}>
                    <div style={{ padding: '12px 18px', background: '#fbf8f1', borderBottom: '1px solid #ece7d9', font: `700 11px ${FF}`, color: '#9a948a', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                      Histórico de avaliações
                    </div>
                    {assessments.map((a, i) => (
                      <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '13px 18px', borderTop: i === 0 ? 'none' : '1px solid #f1ece0' }}>
                        <div style={{ font: `600 13px ${FF}`, color: '#1B2A4A', minWidth: 100 }}>{fmtDate(a.assessed_at)}</div>
                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', flex: 1 }}>
                          {a.weight_kg    != null && <span style={{ font: `400 12.5px ${FF}`, color: '#4a4742' }}>⚖️ {a.weight_kg.toFixed(1)} kg</span>}
                          {a.body_fat_pct != null && <span style={{ font: `400 12.5px ${FF}`, color: '#4a4742' }}>📊 {a.body_fat_pct.toFixed(1)}% gordura</span>}
                          {a.waist_cm     != null && <span style={{ font: `400 12.5px ${FF}`, color: '#4a4742' }}>📏 Cintura {a.waist_cm.toFixed(0)} cm</span>}
                        </div>
                        {i === 0 && <span style={{ font: `600 10px ${FF}`, color: '#1B7a4a', background: '#e7f3ea', borderRadius: 20, padding: '3px 9px', whiteSpace: 'nowrap' }}>Mais recente</span>}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

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
                <div style={{ flex: 1, minWidth: 150, background: '#fff', border: '1px solid #ece7d9', borderRadius: 14, padding: '18px 20px' }}>
                  <div style={{ font: `500 12px ${FF}`, color: '#9a948a' }}>Status</div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', font: `700 14px ${FF}`, color: pay.color, background: pay.bg, borderRadius: 20, padding: '4px 12px', marginTop: 7 }}>{pay.label}</div>
                </div>
                <div style={{ flex: 1, minWidth: 150, background: '#fff', border: '1px solid #ece7d9', borderRadius: 14, padding: '18px 20px' }}>
                  <div style={{ font: `500 12px ${FF}`, color: '#9a948a' }}>Total pago</div>
                  <div style={{ font: `800 19px ${FF}`, color: '#1B2A4A', marginTop: 5 }}>
                    {fmtMoney(payments.filter(p => p.status === 'active').reduce((s, p) => s + p.amount, 0))}
                  </div>
                  <div style={{ font: `400 12px ${FF}`, color: '#9a948a', marginTop: 3 }}>{payments.filter(p => p.status === 'active').length} fatura{payments.filter(p => p.status === 'active').length !== 1 ? 's' : ''}</div>
                </div>
              </div>
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

      <Toast msg={toast} />
    </div>
  )
}

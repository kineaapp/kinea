import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageCircle } from 'lucide-react'
import { useAuthStore } from '../../store/auth'
import { supabase } from '../../lib/supabase'

const GOAL_STYLE: Record<string, { color: string; bg: string }> = {
  Hipertrofia:     { color: '#c4421e', bg: '#fbe6e1' },
  Emagrecimento:   { color: '#1B7a4a', bg: '#e7f3ea' },
  Força:           { color: '#1B2A4A', bg: '#eef1f6' },
  Condicionamento: { color: '#b06a12', bg: '#f7ecd9' },
  Mobilidade:      { color: '#5a4ea0', bg: '#ece9f6' },
}

const FF = '"Libre Franklin",sans-serif'

function formatCpf(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`
}

export default function Home() {
  const navigate        = useNavigate()
  const { user, updateUser } = useAuthStore()

  const firstName = user?.name?.split(' ')[0] ?? 'Aluno'
  const dateStr   = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

  const [editOpen,    setEditOpen]    = useState(false)
  const [editName,    setEditName]    = useState('')
  const [editCpf,     setEditCpf]     = useState('')
  const [editLoading, setEditLoading] = useState(false)
  const [editSaving,  setEditSaving]  = useState(false)
  const [editError,   setEditError]   = useState('')
  const [saved,       setSaved]       = useState(false)

  const [todayWorkout, setTodayWorkout] = useState<{ id: number; name: string; goal: string; muscle_group: string; exercise_count: number } | null>(null)

  useEffect(() => { if (user?.id) void loadTodayWorkout() }, [user?.id])

  async function loadTodayWorkout() {
    const { data: studentRow } = await supabase
      .from('students').select('id').eq('student_id', user!.id).single()
    if (!studentRow) return

    const { data } = await supabase
      .from('workout_assignments')
      .select('workouts ( id, name, goal, muscle_group, exercises ( id ) )')
      .eq('student_id', (studentRow as any).id)
      .order('assigned_at', { ascending: false })
      .limit(1)
      .single()

    if (data && (data as any).workouts) {
      const w = (data as any).workouts
      setTodayWorkout({ id: w.id, name: w.name, goal: w.goal, muscle_group: w.muscle_group, exercise_count: (w.exercises ?? []).length })
    }
  }

  async function openEdit() {
    setEditName(user?.name ?? '')
    setEditError('')
    setSaved(false)
    setEditLoading(true)
    setEditOpen(true)
    const { data } = await supabase
      .from('students')
      .select('cpf')
      .eq('student_id', user?.id)
      .single()
    setEditCpf(data?.cpf ? formatCpf(data.cpf) : '')
    setEditLoading(false)
  }

  async function handleSave() {
    const name = editName.trim()
    const cpf  = editCpf.replace(/\D/g, '')
    if (!name) { setEditError('Informe seu nome.'); return }
    if (cpf && cpf.length !== 11) { setEditError('CPF incompleto.'); return }

    setEditSaving(true); setEditError('')
    try {
      await Promise.all([
        supabase.from('profiles').update({ name }).eq('id', user?.id),
        supabase.from('students').update({ name, ...(cpf ? { cpf } : {}) }).eq('student_id', user?.id),
      ])
      updateUser({
        name,
        initials: name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
      })
      setSaved(true)
      setTimeout(() => { setEditOpen(false); setSaved(false) }, 1200)
    } catch {
      setEditError('Não foi possível salvar. Tente novamente.')
    }
    setEditSaving(false)
  }

  return (
    <div style={{ background: '#F4EFE3', minHeight: '100%' }}>

      {/* Nav title */}
      <div style={{ padding: '18px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ font: `800 20px ${FF}`, color: '#1B2A4A', margin: 0, letterSpacing: '-.4px' }}>Início</h1>
      </div>

      {/* Hero block */}
      <div style={{ background: '#1B2A4A', padding: '20px 20px 24px', margin: '12px 0 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ font: `500 11px ${FF}`, color: '#8B97AD', textTransform: 'uppercase', letterSpacing: '.3px', marginBottom: 5 }}>
              {dateStr}
            </div>
            <div style={{ font: `800 22px ${FF}`, color: '#FAEEDA', letterSpacing: '-.5px' }}>
              Olá, {firstName}!
            </div>
            <div style={{ font: `400 12px ${FF}`, color: '#8B97AD', marginTop: 5 }}>
              Bem-vindo ao seu espaço de treino.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={openEdit}
              title="Editar meus dados"
              style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,.1)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#FAEEDA" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button
              onClick={() => navigate('/aluno/chat')}
              style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,.1)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            >
              <MessageCircle size={20} color="#FAEEDA" strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>

      {/* Edit profile drawer */}
      {editOpen && (
        <div onClick={() => { if (!editSaving) setEditOpen(false) }} style={{ position: 'fixed', inset: 0, background: 'rgba(20,25,40,.5)', zIndex: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, background: '#fff', borderRadius: '20px 20px 0 0', padding: '24px 22px 36px', boxShadow: '0 -12px 40px rgba(0,0,0,.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ font: `800 17px ${FF}`, color: '#1B2A4A', margin: 0 }}>Meus dados</h2>
              <button onClick={() => setEditOpen(false)} disabled={editSaving} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9a948a', padding: 4, display: 'flex' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
              </button>
            </div>

            {editLoading ? (
              <div style={{ textAlign: 'center', padding: '24px 0', font: `400 14px ${FF}`, color: '#9a948a' }}>Carregando...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', font: `600 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#6b6657', marginBottom: 7 }}>Nome completo</label>
                  <input
                    type="text" value={editName} onChange={e => { setEditName(e.target.value); setEditError('') }}
                    disabled={editSaving}
                    style={{ width: '100%', height: 46, border: '1.5px solid #d9d3c4', borderRadius: 10, background: '#fff', padding: '0 13px', font: `400 14px ${FF}`, color: '#1B2A4A', outline: 'none', boxSizing: 'border-box' }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#E8542A' }}
                    onBlur={e =>  { e.currentTarget.style.borderColor = '#d9d3c4' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', font: `600 11px ${FF}`, letterSpacing: '.5px', textTransform: 'uppercase', color: '#6b6657', marginBottom: 7 }}>CPF</label>
                  <input
                    type="text" inputMode="numeric" placeholder="000.000.000-00"
                    value={editCpf} onChange={e => { setEditCpf(formatCpf(e.target.value)); setEditError('') }}
                    disabled={editSaving}
                    style={{ width: '100%', height: 46, border: '1.5px solid #d9d3c4', borderRadius: 10, background: '#fff', padding: '0 13px', font: `400 14px ${FF}`, color: '#1B2A4A', outline: 'none', boxSizing: 'border-box' }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#E8542A' }}
                    onBlur={e =>  { e.currentTarget.style.borderColor = '#d9d3c4' }}
                  />
                </div>

                {editError && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fdeee9', border: '1px solid #f6cdbf', borderRadius: 9, padding: '9px 12px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E8542A" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v6"/><path d="M12 16.5v.5"/></svg>
                    <span style={{ font: `500 13px ${FF}`, color: '#c4421e' }}>{editError}</span>
                  </div>
                )}

                <button
                  type="button" onClick={handleSave} disabled={editSaving || saved}
                  style={{ width: '100%', height: 48, border: 'none', borderRadius: 11, background: saved ? '#1B7a4a' : '#E8542A', color: '#fff', font: `700 14.5px ${FF}`, cursor: editSaving ? 'default' : 'pointer', opacity: editSaving ? .75 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'background .2s', marginTop: 4 }}>
                  {saved
                    ? <><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg> Salvo!</>
                    : editSaving
                      ? <><span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'kspin .7s linear infinite' }} /> Salvando...</>
                      : 'Salvar'
                  }
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Treino de Hoje */}
      <div style={{ padding: '18px 18px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ font: `700 15px ${FF}`, color: '#1B2A4A', margin: 0 }}>Treino de Hoje</h2>
          <button
            onClick={() => navigate('/aluno/treinos')}
            style={{ font: `600 12px ${FF}`, color: '#E8542A', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            Ver todos
          </button>
        </div>

        {todayWorkout ? (() => {
          const g = GOAL_STYLE[todayWorkout.goal] ?? { color: '#1B2A4A', bg: '#eef1f6' }
          return (
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #ece7d9', overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ font: `600 11px ${FF}`, color: g.color, background: g.bg, borderRadius: 20, padding: '3px 9px' }}>{todayWorkout.goal}</span>
                  <span style={{ font: `500 11px ${FF}`, color: '#9a948a' }}>{todayWorkout.exercise_count} exercício{todayWorkout.exercise_count !== 1 ? 's' : ''}</span>
                </div>
                <div style={{ font: `800 16px ${FF}`, color: '#1B2A4A', letterSpacing: '-.3px', marginBottom: 2 }}>{todayWorkout.name}</div>
                <div style={{ font: `400 12px ${FF}`, color: '#9a948a' }}>{todayWorkout.muscle_group}</div>
              </div>
              <button
                onClick={() => navigate('/aluno/treinos/exec', { state: { workoutId: todayWorkout.id, workoutName: todayWorkout.name } })}
                style={{ width: '100%', height: 42, border: 'none', background: '#1B2A4A', color: '#FAEEDA', font: `700 13px ${FF}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                Iniciar treino
              </button>
            </div>
          )
        })() : (
          <div style={{ background: '#fff', borderRadius: 16, border: '1.5px dashed #D6CFBE', padding: '28px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: '#eef1f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1B2A4A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8h1a4 4 0 0 1 0 8h-1" /><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" /><line x1="6" y1="1" x2="6" y2="4" /><line x1="10" y1="1" x2="10" y2="4" /><line x1="14" y1="1" x2="14" y2="4" />
              </svg>
            </div>
            <div style={{ font: `700 14px ${FF}`, color: '#1B2A4A' }}>Nenhum treino cadastrado ainda</div>
            <div style={{ font: `400 12.5px ${FF}`, color: '#9a948a', lineHeight: 1.5 }}>
              Seu coach ainda está preparando seu programa.<br />Você será notificado quando estiver pronto.
            </div>
          </div>
        )}
      </div>

      {/* Mensagem do Coach */}
      <div style={{ padding: '16px 18px 0' }}>
        <h2 style={{ font: `700 15px ${FF}`, color: '#1B2A4A', margin: '0 0 12px' }}>Mensagem do Coach</h2>
        <div
          onClick={() => navigate('/aluno/chat')}
          style={{ background: '#fff', borderRadius: 14, border: '1.5px dashed #D6CFBE', padding: '20px 16px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center' }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C5BFB0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <div style={{ font: `400 12.5px ${FF}`, color: '#9a948a' }}>Nenhuma mensagem ainda. Toque para abrir o chat.</div>
        </div>
      </div>

      {/* Progresso */}
      <div style={{ padding: '16px 18px 28px' }}>
        <h2 style={{ font: `700 15px ${FF}`, color: '#1B2A4A', margin: '0 0 12px' }}>Sua jornada</h2>
        <div style={{ background: '#fff', borderRadius: 14, padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: '#e7f3ea', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1B7a4a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <div>
              <div style={{ font: `700 13.5px ${FF}`, color: '#1B2A4A' }}>Anamnese e avaliação concluídas</div>
              <div style={{ font: `400 12px ${FF}`, color: '#9a948a', marginTop: 2 }}>
                Perfil completo — seu coach já pode montar seu programa.
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}

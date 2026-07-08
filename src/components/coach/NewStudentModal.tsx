import { useState } from 'react'
import type { NewStudentData } from '../../store/students'

const FF = '"Libre Franklin",sans-serif'
const GOALS = ['Hipertrofia','Emagrecimento','Recomposição','Força','Condicionamento']
const PLANS = ['Mensal','Anual','Trimestral','Semestral','Permuta']

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ font: `600 11px ${FF}`, color: '#6b6657', letterSpacing: '.45px', textTransform: 'uppercase' }}>{label}</label>
      {children}
      {error && <span style={{ font: `400 11.5px ${FF}`, color: '#D2402A' }}>{error}</span>}
    </div>
  )
}

interface Props {
  onClose: () => void
  onAdd: (data: NewStudentData) => void
}

export function NewStudentModal({ onClose, onAdd }: Props) {
  const [nome,     setNome]     = useState('')
  const [email,    setEmail]    = useState('')
  const [telefone, setTelefone] = useState('')
  const [objetivo, setObjetivo] = useState(GOALS[0])
  const [plano,    setPlano]    = useState(PLANS[0])
  const [errors,   setErrors]   = useState<Record<string,string>>({})
  const [loading,  setLoading]  = useState(false)
  const [addedName,setAddedName]= useState('')

  const inp: React.CSSProperties = {
    height: 44, border: '1.5px solid #d9d3c4', borderRadius: 10,
    background: '#fff', padding: '0 14px',
    font: `400 14px ${FF}`, color: '#1B2A4A', outline: 'none',
    width: '100%', boxSizing: 'border-box',
  }
  const sel: React.CSSProperties = {
    ...inp, cursor: 'pointer', appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%239a948a' stroke-width='1.8' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: 36,
  }

  async function submit() {
    const errs: Record<string,string> = {}
    if (!nome.trim())  errs.nome  = 'Nome obrigatório.'
    if (!email.trim()) errs.email = 'E-mail obrigatório.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errs.email = 'E-mail inválido.'
    if (Object.keys(errs).length) { setErrors(errs); return }
    setLoading(true)
    await new Promise(r => setTimeout(r, 700))
    onAdd({ name: nome.trim(), email: email.trim(), goal: objetivo, plan: plano })
    setAddedName(nome.trim())
    setLoading(false)
  }

  function reset() {
    setNome(''); setEmail(''); setTelefone(''); setObjetivo(GOALS[0]); setPlano(PLANS[0])
    setErrors({}); setAddedName('')
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,25,40,.5)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, background: '#fff', borderRadius: 16, boxShadow: '0 24px 60px rgba(0,0,0,.3)', overflow: 'hidden' }}>

        {addedName ? (
          <div style={{ padding: '40px 28px 32px', textAlign: 'center' }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#e7f3ea', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1B7a4a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
            </div>
            <h2 style={{ font: `800 20px ${FF}`, color: '#1B2A4A', margin: '0 0 8px', letterSpacing: '-.4px' }}>Aluno cadastrado!</h2>
            <p style={{ font: `400 14px/1.5 ${FF}`, color: '#7c7869', margin: '0 0 24px' }}>
              <strong style={{ color: '#1B2A4A' }}>{addedName}</strong> foi adicionado
              {plano === 'Permuta'
                ? <> com plano <strong style={{ color: '#1B7a4a' }}>Permuta</strong> — sem cobranças geradas.</>
                : <> com status <strong style={{ color: '#b06a12' }}>Pagamento pendente</strong>.</>
              }
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={onClose}
                style={{ flex: 1, height: 46, border: '1.5px solid #d9d3c4', background: 'none', color: '#1B2A4A', borderRadius: 10, font: `600 14px ${FF}`, cursor: 'pointer' }}>
                Fechar
              </button>
              <button type="button" onClick={reset}
                style={{ flex: 1, height: 46, border: 'none', background: '#E8542A', color: '#fff', borderRadius: 10, font: `700 14px ${FF}`, cursor: 'pointer', boxShadow: '0 2px 0 #c4421e' }}>
                Adicionar outro
              </button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ padding: '22px 28px 18px', borderBottom: '1px solid #ece7d9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ font: `800 20px ${FF}`, color: '#1B2A4A', margin: 0, letterSpacing: '-.4px' }}>Novo aluno</h2>
              <button type="button" onClick={onClose}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9a948a', padding: 4, display: 'flex', alignItems: 'center' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
              </button>
            </div>

            <div style={{ padding: '22px 28px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Field label="Nome completo" error={errors.nome}>
                <input type="text" value={nome} placeholder="Ex: Ana Costa"
                  onChange={e => { setNome(e.target.value); setErrors(p => ({...p, nome: ''})) }}
                  style={{ ...inp, borderColor: errors.nome ? '#D2402A' : '#d9d3c4' }} />
              </Field>

              <Field label="E-mail" error={errors.email}>
                <input type="email" value={email} placeholder="aluno@email.com"
                  onChange={e => { setEmail(e.target.value); setErrors(p => ({...p, email: ''})) }}
                  style={{ ...inp, borderColor: errors.email ? '#D2402A' : '#d9d3c4' }} />
              </Field>

              <Field label="Telefone (opcional)">
                <input type="tel" value={telefone} placeholder="(11) 99999-9999"
                  onChange={e => setTelefone(e.target.value)} style={inp} />
              </Field>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Objetivo">
                  <select value={objetivo} onChange={e => setObjetivo(e.target.value)} style={sel}>
                    {GOALS.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </Field>
                <Field label="Plano">
                  <select value={plano} onChange={e => setPlano(e.target.value)} style={sel}>
                    {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </Field>
              </div>

              <button type="button" onClick={submit} disabled={loading}
                style={{ width: '100%', height: 50, border: 'none', background: '#E8542A', color: '#fff', borderRadius: 12, font: `700 15px ${FF}`, cursor: loading ? 'default' : 'pointer', opacity: loading ? .75 : 1, boxShadow: '0 2px 0 #c4421e', marginTop: 2, transition: 'opacity .15s' }}>
                {loading ? 'Cadastrando…' : 'Cadastrar aluno'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

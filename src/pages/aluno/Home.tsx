import { useNavigate } from 'react-router-dom'
import { MessageCircle } from 'lucide-react'
import { useAuthStore } from '../../store/auth'

const FF = '"Libre Franklin",sans-serif'

export default function Home() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const firstName = user?.name?.split(' ')[0] ?? 'Aluno'
  const dateStr   = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

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
          <button
            onClick={() => navigate('/aluno/chat')}
            style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,.1)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            <MessageCircle size={20} color="#FAEEDA" strokeWidth={2} />
          </button>
        </div>
      </div>

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

import { useNavigate } from 'react-router-dom'

const FF = '"Libre Franklin",sans-serif'

export default function Treinos() {
  const navigate = useNavigate()

  return (
    <div style={{ paddingBottom: 24 }}>
      <div style={{ padding: '18px 20px 16px' }}>
        <h1 style={{ font: `800 24px ${FF}`, color: '#1B2A4A', margin: '0 0 4px', letterSpacing: '-.5px' }}>Meus Treinos</h1>
        <p style={{ font: `400 13px ${FF}`, color: '#7C7869', margin: 0 }}>Programação semanal</p>
      </div>

      <div style={{ padding: '0 18px' }}>
        <div style={{ background: '#fff', borderRadius: 16, border: '1.5px dashed #D6CFBE', padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: '#eef1f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1B2A4A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8h1a4 4 0 0 1 0 8h-1" /><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
              <line x1="6" y1="1" x2="6" y2="4" /><line x1="10" y1="1" x2="10" y2="4" /><line x1="14" y1="1" x2="14" y2="4" />
            </svg>
          </div>
          <div style={{ font: `700 15px ${FF}`, color: '#1B2A4A' }}>Nenhum treino cadastrado ainda</div>
          <div style={{ font: `400 13px ${FF}`, color: '#9a948a', lineHeight: 1.55, maxWidth: 260 }}>
            Seu coach está preparando sua programação. Você será avisado assim que estiver pronta.
          </div>
          <button
            onClick={() => navigate('/aluno/chat')}
            style={{ marginTop: 4, height: 40, padding: '0 20px', border: 'none', background: '#1B2A4A', color: '#FAEEDA', borderRadius: 10, font: `600 13px ${FF}`, cursor: 'pointer' }}
          >
            Falar com o coach
          </button>
        </div>
      </div>
    </div>
  )
}

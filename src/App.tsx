import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Login from './pages/Login'
import Dashboard from './pages/coach/Dashboard'
import Alunos from './pages/coach/Alunos'
import PerfilAluno from './pages/coach/PerfilAluno'
import Leads from './pages/coach/Leads'
import Treinos from './pages/coach/Treinos'
import Pagamentos from './pages/coach/Pagamentos'
import Avaliacoes from './pages/coach/Avaliacoes'
import Mensagens from './pages/coach/Mensagens'
import Configuracoes from './pages/coach/Configuracoes'
import AlunoLayout from './components/layout/AlunoLayout'
import AlunoHome from './pages/aluno/Home'
import AlunoTreinos from './pages/aluno/Treinos'
import Execucao from './pages/aluno/Execucao'
import AlunoAvaliacoes from './pages/aluno/Avaliacoes'
import AlunoChat from './pages/aluno/Chat'
import AlunoPerfil from './pages/aluno/Perfil'
import AlunoPagamentos from './pages/aluno/Pagamentos'
import Anamnese from './pages/aluno/Anamnese'
import AlunoNotificacoes from './pages/aluno/Notificacoes'
import AlunoConfiguracoes from './pages/aluno/Configuracoes'

function Placeholder({ name }: { name: string }) {
  return (
    <div style={{ padding: '80px 34px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', minHeight: '60vh' }}>
      <div style={{ width: 72, height: 72, borderRadius: 18, background: '#fff', border: '1px solid #ece7d9', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#E8542A" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
        </svg>
      </div>
      <h2 style={{ font: '800 24px "Libre Franklin",sans-serif', color: '#1B2A4A', margin: '0 0 8px', letterSpacing: '-.5px' }}>{name}</h2>
      <p style={{ font: '400 15px "Libre Franklin",sans-serif', color: '#7c7869', margin: 0 }}>
        Esta tela será implementada em seguida.
      </p>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/coach" element={<Layout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard"    element={<Dashboard />} />
        <Route path="alunos"       element={<Alunos />} />
        <Route path="alunos/:id"  element={<PerfilAluno />} />
        <Route path="leads"        element={<Leads />} />
        <Route path="treinos"      element={<Treinos />} />
        <Route path="pagamentos"   element={<Pagamentos />} />
        <Route path="avaliacoes"   element={<Avaliacoes />} />
        <Route path="mensagens"    element={<Mensagens />} />
        <Route path="configuracoes" element={<Configuracoes />} />
      </Route>
      <Route path="/aluno" element={<AlunoLayout />}>
        <Route index element={<Navigate to="home" replace />} />
        <Route path="anamnese"           element={<Anamnese />} />
        <Route path="home"              element={<AlunoHome />} />
        <Route path="treinos"           element={<AlunoTreinos />} />
        <Route path="treinos/exec"      element={<Execucao />} />
        <Route path="chat"              element={<AlunoChat />} />
        <Route path="avaliacoes"        element={<AlunoAvaliacoes />} />
        <Route path="perfil"            element={<AlunoPerfil />} />
        <Route path="perfil/pagamentos"   element={<AlunoPagamentos />} />
        <Route path="notificacoes"        element={<AlunoNotificacoes />} />
        <Route path="configuracoes"       element={<AlunoConfiguracoes />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

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
import PrimeiraAvaliacao from './pages/aluno/PrimeiraAvaliacao'
import AlunoNotificacoes from './pages/aluno/Notificacoes'
import AlunoConfiguracoes from './pages/aluno/Configuracoes'


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
        <Route path="anamnese"             element={<Anamnese />} />
        <Route path="primeira-avaliacao"  element={<PrimeiraAvaliacao />} />
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

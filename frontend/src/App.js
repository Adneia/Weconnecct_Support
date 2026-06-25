import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { Layout } from "./components/Layout";

// Pages
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import NovoChamado from "./pages/NovoChamado";
import ListaChamados from "./pages/ListaChamados";
import DetalhesChamado from "./pages/DetalhesChamado";
import ImportarPedidos from "./pages/ImportarPedidos";
import Perfil from "./pages/Perfil";
import TextosPadroes from "./pages/TextosPadroes";
import AgRetirada from "./pages/AgRetirada";
import PagamentoNaoAprovado from "./pages/PagamentoNaoAprovado";
import Cancelamentos from "./pages/Cancelamentos";
import BuscaProduto from "./pages/BuscaProduto";
import AvisosCompras from "./pages/AvisosCompras";

// Protected Route wrapper
const ProtectedRoute = ({ children, dashboardOnly = false, allowConsulta = false }) => {
  const { token, loading, isDashboardOnly, isConsulta } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Usuário com role "dashboard" só pode acessar o dashboard
  if (isDashboardOnly && !dashboardOnly) {
    return <Navigate to="/dashboard" replace />;
  }

  // Usuário com role "consulta" só acessa as telas liberadas (somente leitura)
  if (isConsulta && !allowConsulta) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Layout>{children}</Layout>;
};

// Public Route wrapper (redirects to dashboard if already logged in)
const PublicRoute = ({ children }) => {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (token) {
    return <Navigate to="/importar" replace />;
  }

  return children;
};

function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />

      {/* Protected Routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute dashboardOnly={true} allowConsulta={true}>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/chamados/novo"
        element={
          <ProtectedRoute>
            <NovoChamado />
          </ProtectedRoute>
        }
      />
      <Route
        path="/chamados/editar/:id"
        element={
          <ProtectedRoute>
            <NovoChamado />
          </ProtectedRoute>
        }
      />
      <Route
        path="/chamados/:id"
        element={
          <ProtectedRoute allowConsulta={true}>
            <DetalhesChamado />
          </ProtectedRoute>
        }
      />
      <Route
        path="/chamados"
        element={
          <ProtectedRoute allowConsulta={true}>
            <ListaChamados />
          </ProtectedRoute>
        }
      />
      <Route
        path="/importar"
        element={
          <ProtectedRoute>
            <ImportarPedidos />
          </ProtectedRoute>
        }
      />
      <Route
        path="/perfil"
        element={
          <ProtectedRoute allowConsulta={true}>
            <Perfil />
          </ProtectedRoute>
        }
      />
      <Route
        path="/textos-padroes"
        element={
          <ProtectedRoute>
            <TextosPadroes />
          </ProtectedRoute>
        }
      />
      <Route
        path="/retirada"
        element={
          <ProtectedRoute>
            <AgRetirada />
          </ProtectedRoute>
        }
      />
      <Route
        path="/pagamento"
        element={
          <ProtectedRoute allowConsulta={true}>
            <PagamentoNaoAprovado />
          </ProtectedRoute>
        }
      />
      <Route
        path="/cancelamentos"
        element={
          <ProtectedRoute allowConsulta={true}>
            <Cancelamentos />
          </ProtectedRoute>
        }
      />
      <Route
        path="/busca-produto"
        element={
          <ProtectedRoute>
            <BuscaProduto />
          </ProtectedRoute>
        }
      />
      <Route
        path="/avisos-compras"
        element={
          <ProtectedRoute>
            <AvisosCompras />
          </ProtectedRoute>
        }
      />

      {/* Redirects */}
      <Route path="/" element={<Navigate to="/importar" replace />} />
      <Route path="*" element={<Navigate to="/importar" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
          <Toaster 
            position="top-right" 
            richColors 
            closeButton
            toastOptions={{
              duration: 4000,
            }}
          />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

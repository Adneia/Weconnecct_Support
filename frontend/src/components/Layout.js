import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from './ui/button';
import { Avatar, AvatarFallback } from './ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './ui/popover';
import {
  LayoutDashboard,
  Plus,
  List,
  RotateCcw,
  Upload,
  Menu,
  X,
  Sun,
  Moon,
  LogOut,
  User,
  ChevronLeft,
  FileText,
  Bell,
  Check
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/chamados/novo', label: 'Novo Atendimento', icon: Plus },
  { path: '/chamados', label: 'Atendimentos', icon: List },
  { path: '/textos-padroes', label: 'Textos Padrões', icon: FileText },
  { path: '/importar', label: 'Base ELO', icon: Upload },
];

export const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificacoes, setNotificacoes] = useState([]);
  const [notificacoesNaoLidas, setNotificacoesNaoLidas] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, getAuthHeader } = useAuth();
  const { theme, toggleTheme } = useTheme();
  
  // Buscar notificações ao carregar
  useEffect(() => {
    const fetchNotificacoes = async () => {
      try {
        const response = await axios.get(
          `${API_URL}/api/notificacoes`,
          { headers: getAuthHeader() }
        );
        setNotificacoes(response.data.notificacoes || []);
        setNotificacoesNaoLidas(response.data.nao_lidas || 0);
      } catch (error) {
        console.error('Erro ao buscar notificações:', error);
      }
    };
    
    if (user) {
      fetchNotificacoes();
      // Atualizar a cada 60 segundos
      const interval = setInterval(fetchNotificacoes, 60000);
      return () => clearInterval(interval);
    }
  }, [user, getAuthHeader]);

  // Marcar notificação como lida
  const marcarComoLida = async (notificacaoId) => {
    try {
      await axios.put(
        `${API_URL}/api/notificacoes/${notificacaoId}/lida`,
        {},
        { headers: getAuthHeader() }
      );
      setNotificacoes(prev => prev.map(n => 
        n.id === notificacaoId ? { ...n, lida: true } : n
      ));
      setNotificacoesNaoLidas(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Erro ao marcar notificação como lida:', error);
    }
  };

  // Marcar todas como lidas
  const marcarTodasComoLidas = async () => {
    try {
      await axios.put(
        `${API_URL}/api/notificacoes/marcar-todas-lidas`,
        {},
        { headers: getAuthHeader() }
      );
      setNotificacoes(prev => prev.map(n => ({ ...n, lida: true })));
      setNotificacoesNaoLidas(0);
    } catch (error) {
      console.error('Erro ao marcar notificações como lidas:', error);
    }
  };

  // Verificar se é ambiente de teste (preview)
  const isPreview = window.location.hostname.includes('preview.emergentagent.com');
  const appTitle = isPreview ? 'ELO - Ambiente de Teste' : 'ELO - Sistema de Atendimentos';
  
  // Filtrar itens de navegação baseado no usuário
  const filteredNavItems = navItems.filter(item => {
    if (item.adminOnly) {
      return user?.email === 'adneia@weconnect360.com.br';
    }
    return true;
  });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside 
        className={`hidden md:flex flex-col bg-slate-50 dark:bg-slate-900 border-r border-border transition-all duration-300 ${
          sidebarOpen ? 'w-64' : 'w-16'
        }`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-border">
          {sidebarOpen && (
            <span className="font-bold text-lg tracking-tight font-['Plus_Jakarta_Sans']">
              ELO
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            data-testid="toggle-sidebar-btn"
            className="h-8 w-8"
          >
            <ChevronLeft className={`h-4 w-4 transition-transform ${!sidebarOpen ? 'rotate-180' : ''}`} />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {filteredNavItems.map((item) => {
            const isActive = location.pathname === item.path || 
              (item.path === '/chamados' && location.pathname.startsWith('/chamados/') && item.path !== '/chamados/novo');
            const Icon = item.icon;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                data-testid={`nav-${item.path.replace(/\//g, '-')}`}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  isActive 
                    ? 'bg-primary text-primary-foreground' 
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                }`}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="p-3 border-t border-border">
          {sidebarOpen ? (
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {getInitials(user?.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
            </div>
          ) : (
            <Avatar className="h-9 w-9 mx-auto">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                {getInitials(user?.name)}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      </aside>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 w-64 bg-slate-50 dark:bg-slate-900 border-r border-border z-50 transform transition-transform md:hidden ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-border">
          <span className="font-bold text-lg tracking-tight font-['Plus_Jakarta_Sans']">
            WeConnect
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(false)}
            data-testid="close-mobile-menu-btn"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {filteredNavItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  isActive 
                    ? 'bg-primary text-primary-foreground' 
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-40 flex items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(true)}
              data-testid="open-mobile-menu-btn"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="hidden sm:flex items-center gap-2">
              <h1 className="text-lg font-semibold tracking-tight font-['Plus_Jakarta_Sans']">
                {appTitle}
              </h1>
              {isPreview && (
                <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 rounded-full border border-amber-300">
                  TESTE
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Notificações */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative"
                  data-testid="notifications-btn"
                >
                  <Bell className="h-5 w-5" />
                  {notificacoesNaoLidas > 0 && (
                    <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                      {notificacoesNaoLidas > 9 ? '9+' : notificacoesNaoLidas}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0">
                <div className="flex items-center justify-between p-3 border-b">
                  <h4 className="font-semibold">Notificações</h4>
                  {notificacoesNaoLidas > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={marcarTodasComoLidas}
                      className="text-xs"
                    >
                      <Check className="h-3 w-3 mr-1" />
                      Marcar todas lidas
                    </Button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notificacoes.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8 text-sm">
                      Nenhuma notificação
                    </p>
                  ) : (
                    notificacoes.slice(0, 10).map((notif) => (
                      <div
                        key={notif.id}
                        className={`p-3 border-b hover:bg-muted/50 cursor-pointer transition-colors ${
                          !notif.lida ? 'bg-blue-50 dark:bg-blue-950/20' : ''
                        }`}
                        onClick={() => !notif.lida && marcarComoLida(notif.id)}
                      >
                        <div className="flex items-start gap-2">
                          {!notif.lida && (
                            <span className="h-2 w-2 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{notif.titulo}</p>
                            <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line line-clamp-3">
                              {notif.mensagem}
                            </p>
                            <p className="text-xs text-muted-foreground mt-2">
                              {new Date(notif.data_criacao).toLocaleString('pt-BR')}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>

            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              data-testid="theme-toggle-btn"
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" data-testid="user-menu-btn">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {getInitials(user?.name)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/perfil')} data-testid="profile-menu-item">
                  <User className="h-4 w-4 mr-2" />
                  Perfil
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} data-testid="logout-menu-item">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

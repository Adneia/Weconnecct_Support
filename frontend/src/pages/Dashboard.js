import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { 
  AlertCircle, 
  Clock, 
  CheckCircle2, 
  Package, 
  Mail, 
  MessageSquare,
  ArrowRight,
  Plus
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedResponsavel, setSelectedResponsavel] = useState('all');
  const navigate = useNavigate();
  const { getAuthHeader } = useAuth();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, usersRes] = await Promise.all([
        axios.get(`${API_URL}/api/dashboard/stats`, { headers: getAuthHeader() }),
        axios.get(`${API_URL}/api/users`, { headers: getAuthHeader() })
      ]);
      setStats(statsRes.data);
      setUsers(usersRes.data);
    } catch (error) {
      toast.error('Erro ao carregar dados do dashboard');
    } finally {
      setLoading(false);
    }
  };

  const getPriorityBadge = (prioridade) => {
    const styles = {
      Baixa: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
      Media: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400',
      Alta: 'bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400',
      Urgente: 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400 font-bold'
    };
    return styles[prioridade] || styles.Media;
  };

  const getStatusBadge = (status) => {
    const styles = {
      Aberto: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400',
      Fechado: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
    };
    return styles[status] || styles.Aberto;
  };

  const canalIcons = {
    Email: Mail,
    WhatsApp: MessageSquare,
    'Conecta-lá': Package,
    Bravium: Package,
    Zendesk: MessageSquare
  };

  if (loading) {
    return (
      <div className="space-y-6" data-testid="dashboard-loading">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const filteredChamadosAtencao = selectedResponsavel === 'all' 
    ? stats?.chamados_atencao 
    : stats?.chamados_atencao?.filter(c => c.responsavel_id === selectedResponsavel);

  return (
    <div className="space-y-6" data-testid="dashboard">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-['Plus_Jakarta_Sans']">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Visão geral dos chamados</p>
        </div>
        <Button onClick={() => navigate('/chamados/novo')} data-testid="new-chamado-btn">
          <Plus className="h-4 w-4 mr-2" />
          Novo Chamado
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="card-abertos">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Chamados Abertos</CardTitle>
            <AlertCircle className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.total_abertos || 0}</div>
          </CardContent>
        </Card>

        <Card data-testid="card-fechados">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Chamados Fechados</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.total_fechados || 0}</div>
          </CardContent>
        </Card>

        <Card data-testid="card-tempo-medio">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tempo Médio Resolução</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.media_tempo_resolucao_dias || 0}</div>
            <p className="text-xs text-muted-foreground">dias</p>
          </CardContent>
        </Card>

        <Card data-testid="card-atencao">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Precisam Atenção</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.chamados_atencao?.length || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Stats Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <Card className="lg:col-span-2" data-testid="chart-card">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Últimos 7 Dias</CardTitle>
            <CardDescription>Chamados abertos vs resolvidos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats?.ultimos_7_dias || []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="data" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px'
                    }}
                  />
                  <Legend />
                  <Bar dataKey="abertos" name="Abertos" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="resolvidos" name="Resolvidos" fill="hsl(160, 84%, 39%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Stats Breakdown */}
        <Card data-testid="stats-breakdown-card">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Por Categoria</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(stats?.por_categoria || {}).map(([categoria, count]) => (
              <div key={categoria} className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{categoria}</span>
                <Badge variant="secondary">{count}</Badge>
              </div>
            ))}
            {Object.keys(stats?.por_categoria || {}).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum chamado aberto</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Por Canal e Prioridade */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card data-testid="por-canal-card">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Por Canal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(stats?.por_canal || {}).map(([canal, count]) => {
              const Icon = canalIcons[canal] || Package;
              return (
                <div key={canal} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{canal}</span>
                  </div>
                  <Badge variant="secondary">{count}</Badge>
                </div>
              );
            })}
            {Object.keys(stats?.por_canal || {}).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum chamado aberto</p>
            )}
          </CardContent>
        </Card>

        <Card data-testid="por-prioridade-card">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Por Prioridade</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {['Urgente', 'Alta', 'Media', 'Baixa'].map((prioridade) => {
              const count = stats?.por_prioridade?.[prioridade] || 0;
              if (count === 0) return null;
              return (
                <div key={prioridade} className="flex items-center justify-between">
                  <span className="text-sm">{prioridade}</span>
                  <Badge className={getPriorityBadge(prioridade)}>{count}</Badge>
                </div>
              );
            })}
            {Object.keys(stats?.por_prioridade || {}).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum chamado aberto</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Chamados que precisam de atenção */}
      <Card data-testid="chamados-atencao-card">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-semibold">Chamados que Precisam de Atenção</CardTitle>
              <CardDescription>Abertos há mais de 3 dias ou com prioridade alta/urgente</CardDescription>
            </div>
            <Select value={selectedResponsavel} onValueChange={setSelectedResponsavel}>
              <SelectTrigger className="w-48" data-testid="filter-responsavel">
                <SelectValue placeholder="Filtrar por responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {users.map(user => (
                  <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredChamadosAtencao?.length > 0 ? (
            <div className="space-y-3">
              {filteredChamadosAtencao.map((chamado) => (
                <div 
                  key={chamado.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/chamados/${chamado.id}`)}
                  data-testid={`chamado-atencao-${chamado.id}`}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">#{chamado.numero_pedido}</span>
                        <Badge className={getPriorityBadge(chamado.prioridade)}>
                          {chamado.prioridade}
                        </Badge>
                        <Badge className={getStatusBadge(chamado.status_atendimento)}>
                          {chamado.status_atendimento}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground truncate mt-1">
                        {chamado.sintese_problema}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{chamado.canal_origem}</span>
                        <span>•</span>
                        <span>{chamado.dias_aberto} dias aberto</span>
                        {chamado.responsavel_nome && (
                          <>
                            <span>•</span>
                            <span>{chamado.responsavel_nome}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-emerald-500" />
              <p>Nenhum chamado precisando de atenção urgente</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;

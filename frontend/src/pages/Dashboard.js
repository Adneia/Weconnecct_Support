import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { 
  Clock, CheckCircle, Package, Database, Plus, ArrowRight, User, Cloud, CloudOff
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sheetsStatus, setSheetsStatus] = useState(null);
  const navigate = useNavigate();
  const { getAuthHeader, user } = useAuth();

  useEffect(() => {
    fetchData();
    fetchSheetsStatus();
  }, []);

  const fetchData = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/dashboard/stats`, { headers: getAuthHeader() });
      setStats(response.data);
    } catch (error) {
      toast.error('Erro ao carregar dados do dashboard');
    } finally {
      setLoading(false);
    }
  };

  const fetchSheetsStatus = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/google-sheets/status`, { headers: getAuthHeader() });
      setSheetsStatus(response.data);
    } catch (error) {
      console.error('Error fetching sheets status:', error);
    }
  };

  const getCategoryBadgeColor = (categoria) => {
    const colors = {
      'Falha Produção': 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400',
      'Falha de Compras': 'bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400',
      'Falha Transporte': 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400',
      'Produto com Avaria': 'bg-pink-50 text-pink-700 dark:bg-pink-950/50 dark:text-pink-400',
      'Divergência de Produto': 'bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400',
      'Arrependimento': 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400',
    };
    return colors[categoria] || 'bg-slate-100 text-slate-700';
  };

  if (loading) {
    return (
      <div className="space-y-6" data-testid="loading">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader>
              <CardContent><Skeleton className="h-8 w-16" /></CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="dashboard">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-['Plus_Jakarta_Sans']">Dashboard Emergent</h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-muted-foreground text-sm">Bem-vindo(a), {user?.name || 'Atendente'}</p>
            {sheetsStatus && (
              <Badge 
                variant="outline" 
                className={sheetsStatus.initialized 
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800" 
                  : "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-400 dark:border-red-800"
                }
                data-testid="sheets-status-badge"
              >
                {sheetsStatus.initialized ? (
                  <><Cloud className="h-3 w-3 mr-1" /> Google Sheets Conectado</>
                ) : (
                  <><CloudOff className="h-3 w-3 mr-1" /> Sheets Desconectado</>
                )}
              </Badge>
            )}
          </div>
        </div>
        <Button onClick={() => navigate('/chamados/novo')} data-testid="btn-novo">
          <Plus className="h-4 w-4 mr-2" />
          Novo Atendimento
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => navigate('/chamados?pendente=true')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.total_pendentes || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">atendimentos em aberto</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => navigate('/chamados?pendente=false')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Resolvidos</CardTitle>
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.total_resolvidos || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">atendimentos finalizados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tempo Médio</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.media_tempo_resolucao_dias || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">dias para resolver</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => navigate('/importar')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Base Emergent</CardTitle>
            <Database className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.total_pedidos_base?.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">pedidos cadastrados</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart and Stats Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Últimos 7 Dias</CardTitle>
            <CardDescription>Atendimentos abertos vs resolvidos</CardDescription>
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

        {/* Por Categoria */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Por Categoria</CardTitle>
            <CardDescription>Pendentes por tipo</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(stats?.por_categoria || {}).length > 0 ? (
              Object.entries(stats?.por_categoria || {}).map(([categoria, count]) => (
                <div key={categoria} className="flex items-center justify-between">
                  <span className="text-sm truncate max-w-40">{categoria}</span>
                  <Badge className={getCategoryBadgeColor(categoria)}>{count}</Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum atendimento pendente</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Por Atendente e Parceiro */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <User className="h-5 w-5" />
              Por Atendente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(stats?.por_atendente || {}).length > 0 ? (
              Object.entries(stats?.por_atendente || {}).map(([atendente, count]) => (
                <div key={atendente} className="flex items-center justify-between">
                  <span className="text-sm">{atendente || 'Não atribuído'}</span>
                  <Badge variant="secondary">{count}</Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum atendimento pendente</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Package className="h-5 w-5" />
              Por Parceiro/Canal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(stats?.por_parceiro || {}).length > 0 ? (
              Object.entries(stats?.por_parceiro || {}).map(([parceiro, count]) => (
                <div key={parceiro} className="flex items-center justify-between">
                  <span className="text-sm">{parceiro || 'Não informado'}</span>
                  <Badge variant="secondary">{count}</Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum atendimento pendente</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Atendimentos que precisam de atenção */}
      {stats?.chamados_atencao?.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-amber-700 dark:text-amber-400">
              ⚠️ Atendimentos que Precisam de Atenção
            </CardTitle>
            <CardDescription>Pendentes há mais de 3 dias</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.chamados_atencao.map((atd) => (
                <div 
                  key={atd.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/chamados/${atd.id}`)}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium">{atd.id_atendimento}</span>
                      <Badge className={getCategoryBadgeColor(atd.categoria)}>{atd.categoria}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      #{atd.numero_pedido} • {atd.nome_cliente || 'Cliente'} • {atd.dias_aberto} dias
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Dashboard;

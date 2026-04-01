import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, 
  LineChart, Line, PieChart, Pie, Cell
} from 'recharts';
import { 
  Clock, CheckCircle, Package, Database, RefreshCw, FileText, AlertTriangle, 
  Calendar, TrendingUp, LayoutGrid, Tag, Gauge, ListChecks, RotateCcw, Users,
  BarChart3
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('visao-geral');
  const [periodoDias, setPeriodoDias] = useState(30);
  const [canalFiltro, setCanalFiltro] = useState('');
  const [fornecedorFiltro, setFornecedorFiltro] = useState('');
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  
  // Data states
  const [visaoGeral, setVisaoGeral] = useState(null);
  const [volumeCanal, setVolumeCanal] = useState(null);
  const [classificacao, setClassificacao] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [pendencias, setPendencias] = useState(null);
  const [estornos, setEstornos] = useState(null);
  const [reincidencia, setReincidencia] = useState(null);
  const [filtros, setFiltros] = useState({ canais: [], fornecedores: [] });
  
  const navigate = useNavigate();
  const { getAuthHeader, user } = useAuth();

  const fetchFiltros = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/dashboard/v2/filtros`, { headers: getAuthHeader() });
      setFiltros(res.data);
    } catch (e) { console.error(e); }
  }, [getAuthHeader]);

  const fetchTabData = useCallback(async (tab) => {
    setLoading(true);
    const params = new URLSearchParams();
    params.append('periodo_dias', periodoDias);
    if (canalFiltro) params.append('canal', canalFiltro);
    if (fornecedorFiltro) params.append('fornecedor', fornecedorFiltro);
    
    try {
      const endpoint = `${API_URL}/api/dashboard/v2/${tab}?${params.toString()}`;
      const res = await axios.get(endpoint, { headers: getAuthHeader() });
      
      switch (tab) {
        case 'visao-geral': setVisaoGeral(res.data); break;
        case 'volume-canal': setVolumeCanal(res.data); break;
        case 'classificacao': setClassificacao(res.data); break;
        case 'performance': setPerformance(res.data); break;
        case 'pendencias': setPendencias(res.data); break;
        case 'estornos': setEstornos(res.data); break;
        case 'reincidencia': setReincidencia(res.data); break;
      }
      setLastUpdated(new Date());
    } catch (e) {
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [periodoDias, canalFiltro, fornecedorFiltro, getAuthHeader]);

  useEffect(() => { fetchFiltros(); }, [fetchFiltros]);
  useEffect(() => { fetchTabData(activeTab); }, [activeTab, periodoDias, canalFiltro, fornecedorFiltro, fetchTabData]);

  const StatCard = ({ title, value, subtitle, icon: Icon, color = 'slate', onClick }) => (
    <Card className={`${onClick ? 'cursor-pointer hover:bg-accent/50 transition-colors' : ''}`} onClick={onClick}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {Icon && <Icon className={`h-4 w-4 text-${color}-500`} />}
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );

  // ABA 1 - VISÃO GERAL
  const getTaxaColor = (taxa) => {
    if (taxa <= 0) return 'text-muted-foreground';
    if (taxa < 5) return 'text-emerald-600';
    if (taxa < 10) return 'text-amber-600';
    return 'text-red-600';
  };

  const TabVisaoGeral = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Total + Taxa de Contato */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
            <FileText className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{visaoGeral?.total || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">no período</p>
            {visaoGeral?.total_pedidos > 0 && (
              <p className={`text-xs font-medium mt-1 ${getTaxaColor(visaoGeral?.taxa_contato)}`}>
                {visaoGeral?.taxa_contato}% dos pedidos
              </p>
            )}
          </CardContent>
        </Card>

        {/* Pendentes + % sobre pedidos */}
        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => navigate('/chamados?pendente=true')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{visaoGeral?.pendentes || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">em aberto</p>
            {visaoGeral?.total_pedidos > 0 && (
              <p className={`text-xs font-medium mt-1 ${getTaxaColor(visaoGeral?.taxa_pendencia)}`}>
                {visaoGeral?.taxa_pendencia}% dos pedidos
              </p>
            )}
          </CardContent>
        </Card>

        <StatCard title="Resolvidos" value={visaoGeral?.resolvidos || 0} subtitle="finalizados" icon={CheckCircle} color="emerald" />
        <StatCard title="Tempo Médio" value={`${visaoGeral?.tempo_medio || 0}d`} subtitle="para resolver" icon={TrendingUp} color="blue" />
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Mais Antigo</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{visaoGeral?.dias_mais_antigo || 0}d</div>
            <p className="text-xs text-muted-foreground mt-1">em aberto</p>
          </CardContent>
        </Card>
        <StatCard title="Base ELO" value={visaoGeral?.total_pedidos?.toLocaleString() || 0} subtitle="pedidos" icon={Database} color="purple" />
      </div>

      {/* Segunda linha: indicadores proporcionais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Taxa de Resolução</CardTitle>
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${visaoGeral?.taxa_resolucao >= 70 ? 'text-emerald-600' : visaoGeral?.taxa_resolucao >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
              {visaoGeral?.taxa_resolucao || 0}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">dos atendimentos resolvidos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">SLA ≤ 1 dia</CardTitle>
            <Gauge className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${visaoGeral?.sla_data?.em_1d >= 60 ? 'text-emerald-600' : visaoGeral?.sla_data?.em_1d >= 30 ? 'text-amber-600' : 'text-red-600'}`}>
              {visaoGeral?.sla_data?.em_1d || 0}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">resolvidos em até 1 dia</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">SLA ≤ 3 dias</CardTitle>
            <Gauge className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${visaoGeral?.sla_data?.em_3d >= 70 ? 'text-emerald-600' : visaoGeral?.sla_data?.em_3d >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
              {visaoGeral?.sla_data?.em_3d || 0}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">resolvidos em até 3 dias</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">SLA ≤ 7 dias</CardTitle>
            <Gauge className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${visaoGeral?.sla_data?.em_7d >= 80 ? 'text-emerald-600' : visaoGeral?.sla_data?.em_7d >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
              {visaoGeral?.sla_data?.em_7d || 0}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">resolvidos em até 7 dias</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Atendimentos por Mês</CardTitle>
            <CardDescription>Volume e % sobre pedidos (últimos 6 meses)</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={visaoGeral?.por_mes || []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} unit="%" domain={[0, 'auto']} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="total" name="Atendimentos" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6' }} />
                <Line yAxisId="right" type="monotone" dataKey="taxa_contato" name="% Pedidos" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981' }} strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Abertos vs Resolvidos</CardTitle>
            <CardDescription>Período selecionado</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={visaoGeral?.por_dia || []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="data" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                <Legend />
                <Line type="monotone" dataKey="abertos" name="Abertos" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 3 }} />
                <Line type="monotone" dataKey="resolvidos" name="Resolvidos" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      
      {/* Tabela de Atendimentos por Canal e Dia */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Atendimentos por Canal - Março 2026
          </CardTitle>
          <CardDescription>
            AR = Aguardando Resposta | A = Aberto | F = Fechado
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table className="min-w-[1200px]">
              <TableHeader>
                {/* Linha com os dias */}
                <TableRow>
                  <TableHead rowSpan={2} className="font-semibold min-w-[150px] align-bottom border-r">Canal</TableHead>
                  {visaoGeral?.dias_headers?.map((dia, idx) => (
                    <TableHead 
                      key={dia.data} 
                      colSpan={3} 
                      className={`text-center border-r ${idx % 2 === 0 ? 'bg-slate-50 dark:bg-slate-900/30' : 'bg-slate-100 dark:bg-slate-800/30'}`}
                    >
                      <div className="flex flex-col items-center py-1">
                        <span className="font-semibold text-sm">{dia.data}</span>
                      </div>
                    </TableHead>
                  ))}
                  <TableHead colSpan={1} className="text-center border-r bg-indigo-50 dark:bg-indigo-900/30">
                    <div className="flex flex-col items-center py-1">
                      <span className="font-semibold text-sm">{(() => {
                        const hoje = new Date();
                        const proximoDia = new Date(hoje);
                        proximoDia.setDate(proximoDia.getDate() + 1);
                        if (proximoDia.getDay() === 6) proximoDia.setDate(proximoDia.getDate() + 2);
                        else if (proximoDia.getDay() === 0) proximoDia.setDate(proximoDia.getDate() + 1);
                        return proximoDia.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                      })()}</span>
                    </div>
                  </TableHead>
                </TableRow>
                {/* Linha com AR/A/F */}
                <TableRow>
                  {visaoGeral?.dias_headers?.map((dia, idx) => (
                    <React.Fragment key={`header-${dia.data}`}>
                      <TableHead className={`text-center w-10 text-xs px-1 ${idx % 2 === 0 ? 'bg-yellow-50 dark:bg-yellow-950/30' : 'bg-yellow-100 dark:bg-yellow-900/30'}`}>
                        <span className="text-yellow-700 dark:text-yellow-400 font-semibold">AR</span>
                      </TableHead>
                      <TableHead className={`text-center w-10 text-xs px-1 ${idx % 2 === 0 ? 'bg-orange-50 dark:bg-orange-950/30' : 'bg-orange-100 dark:bg-orange-900/30'}`}>
                        <span className="text-orange-700 dark:text-orange-400 font-semibold">A</span>
                      </TableHead>
                      <TableHead className={`text-center w-10 text-xs px-1 border-r ${idx % 2 === 0 ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-emerald-100 dark:bg-emerald-900/30'}`}>
                        <span className="text-emerald-700 dark:text-emerald-400 font-semibold">F</span>
                      </TableHead>
                    </React.Fragment>
                  ))}
                  {/* Próximo dia útil - apenas A (Aberto) */}
                  <TableHead className="text-center w-10 text-xs px-1 bg-indigo-100 border-r">
                    <span className="text-indigo-700 font-semibold">A</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Linha de Total Geral (Atendimento ao cliente) */}
                <TableRow className="bg-blue-50/50 dark:bg-blue-950/30 font-semibold">
                  <TableCell className="font-semibold border-r">Atendimento ao cliente</TableCell>
                  {visaoGeral?.dias_headers?.map((dia, idx) => (
                    <React.Fragment key={`total-cliente-${dia.data}`}>
                      <TableCell className={`text-center px-1 ${idx % 2 === 0 ? 'bg-yellow-50/30' : 'bg-yellow-50/50'}`}>
                        <span className={`text-sm ${visaoGeral?.totais_por_dia?.[dia.data]?.ar > 0 ? 'font-semibold text-yellow-700' : 'text-muted-foreground'}`}>
                          {visaoGeral?.totais_por_dia?.[dia.data]?.ar || 0}
                        </span>
                      </TableCell>
                      <TableCell className={`text-center px-1 ${idx % 2 === 0 ? 'bg-orange-50/30' : 'bg-orange-50/50'}`}>
                        <span className="text-sm font-semibold text-orange-700">
                          {visaoGeral?.totais_por_dia?.[dia.data]?.a || 0}
                        </span>
                      </TableCell>
                      <TableCell className={`text-center px-1 border-r ${idx % 2 === 0 ? 'bg-emerald-50/30' : 'bg-emerald-50/50'}`}>
                        <span className={`text-sm ${visaoGeral?.totais_por_dia?.[dia.data]?.f > 0 ? 'font-semibold text-emerald-700' : 'text-muted-foreground'}`}>
                          {visaoGeral?.totais_por_dia?.[dia.data]?.f || 0}
                        </span>
                      </TableCell>
                    </React.Fragment>
                  ))}
                  {/* Próximo dia útil - apenas A (cálculo: último A do último dia) */}
                  <TableCell className="text-center px-1 bg-indigo-100/50 border-r">
                    <span className="font-bold text-indigo-700">{visaoGeral?.pendentes || 0}</span>
                  </TableCell>
                </TableRow>
                {/* Canais individuais */}
                {visaoGeral?.por_canal_dia?.map((item) => (
                  <TableRow key={item.canal} className="hover:bg-muted/50">
                    <TableCell className="font-medium border-r text-sm">{item.canal}</TableCell>
                    {visaoGeral?.dias_headers?.map((dia, idx) => (
                      <React.Fragment key={`${item.canal}-${dia.data}`}>
                        <TableCell className={`text-center px-1 ${idx % 2 === 0 ? 'bg-yellow-50/30' : 'bg-yellow-50/50'}`}>
                          <span className={`text-sm ${item.dias[dia.data]?.ar > 0 ? 'font-semibold text-yellow-700' : 'text-muted-foreground'}`}>
                            {item.dias[dia.data]?.ar || 0}
                          </span>
                        </TableCell>
                        <TableCell className={`text-center px-1 ${idx % 2 === 0 ? 'bg-orange-50/30' : 'bg-orange-50/50'}`}>
                          <span className={`text-sm ${item.dias[dia.data]?.a > 0 ? 'font-semibold text-orange-700' : 'text-muted-foreground'}`}>
                            {item.dias[dia.data]?.a || 0}
                          </span>
                        </TableCell>
                        <TableCell className={`text-center px-1 border-r ${idx % 2 === 0 ? 'bg-emerald-50/30' : 'bg-emerald-50/50'}`}>
                          <span className={`text-sm ${item.dias[dia.data]?.f > 0 ? 'font-semibold text-emerald-700' : 'text-muted-foreground'}`}>
                            {item.dias[dia.data]?.f || 0}
                          </span>
                        </TableCell>
                      </React.Fragment>
                    ))}
                    {/* Próximo dia útil - apenas A (pendentes do canal) */}
                    <TableCell className="text-center px-1 bg-indigo-100/30 border-r">
                      <span className={`text-sm ${item.total?.a > 0 ? 'font-semibold text-indigo-700' : 'text-muted-foreground'}`}>
                        {item.total?.a || 0}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
                {(!visaoGeral?.por_canal_dia || visaoGeral.por_canal_dia.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={(visaoGeral?.dias_headers?.length || 5) * 3 + 2} className="text-center text-muted-foreground py-8">
                      Nenhum dado disponível
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ABA 2 - VOLUME POR CANAL
  const TabVolumeCanal = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ranking por Canal</CardTitle>
            <CardDescription>Total: {volumeCanal?.total || 0} atendimentos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 max-h-96 overflow-y-auto">
            {volumeCanal?.ranking?.map((item, idx) => (
              <div key={item.canal} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <span className="font-medium">{item.canal}</span>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{item.total}</Badge>
                    <span className="text-sm text-muted-foreground w-16 text-right">{item.percentual}% atend.</span>
                  </div>
                  {item.n_pedidos > 0 && (
                    <span className="text-xs text-blue-600 font-medium">
                      {item.pct_vendas}% vendas ({item.n_pedidos.toLocaleString()})
                    </span>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Distribuição por Canal</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={volumeCanal?.ranking?.slice(0, 8) || []}
                  dataKey="total"
                  nameKey="canal"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ canal, percentual }) => `${canal}: ${percentual}%`}
                  labelLine={false}
                >
                  {volumeCanal?.ranking?.slice(0, 8).map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  // ABA 3 - CLASSIFICAÇÃO
  const TabClassificacao = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Por Categoria</CardTitle>
            {classificacao?.total_pedidos > 0 && (
              <CardDescription>% relativo a {classificacao.total_pedidos.toLocaleString()} pedidos</CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-2 max-h-80 overflow-y-auto">
            {classificacao?.por_categoria?.map((item) => (
              <div key={item.categoria} className="flex justify-between items-center p-2 rounded bg-muted/30">
                <span className="text-sm">{item.categoria}</span>
                <div className="flex items-center gap-2">
                  <Badge>{item.total}</Badge>
                  {classificacao?.total_pedidos > 0 && (
                    <span className="text-xs text-muted-foreground w-12 text-right">{item.pct_pedidos}%</span>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pendentes por Categoria</CardTitle>
            <CardDescription>% do total de pendentes | % da categoria</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 max-h-80 overflow-y-auto">
            {classificacao?.pend_categoria?.map((item) => (
              <div key={item.categoria} className="space-y-1">
                <div className="flex justify-between items-center p-2 rounded bg-amber-50 dark:bg-amber-950/30">
                  <span className="text-sm">{item.categoria}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="bg-amber-100 text-amber-800">{item.total}</Badge>
                    <span className="text-xs text-amber-700 font-medium w-10 text-right">{item.pct_pendentes}%</span>
                    <span className="text-xs text-red-600 font-medium w-14 text-right">{item.pct_categoria}% cat.</span>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Por Motivo da Pendência</CardTitle>
            {classificacao?.total_pedidos > 0 && (
              <CardDescription>% relativo a {classificacao.total_pedidos.toLocaleString()} pedidos</CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-2 max-h-80 overflow-y-auto">
            {classificacao?.pend_motivo?.map((item) => (
              <div key={item.motivo} className="flex justify-between items-center p-2 rounded bg-muted/30">
                <span className="text-sm truncate mr-2">{item.motivo}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{item.total}</Badge>
                  {classificacao?.total_pedidos > 0 && item.pct_pedidos !== undefined && (
                    <span className={`text-xs font-medium w-14 text-right ${item.pct_pedidos >= 1 ? 'text-red-600' : item.pct_pedidos >= 0.5 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {item.pct_pedidos}%
                    </span>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle className="text-lg">Top 10 Produtos (Falha Fornecedor)</CardTitle>
              <CardDescription>Ordenado por proporção chamados/vendidos</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 max-h-80 overflow-y-auto">
            {classificacao?.top_produtos?.map((item, idx) => (
              <div key={item.produto} className="flex justify-between items-center p-2 rounded bg-muted/30">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center">{idx + 1}</span>
                  <span className="text-sm truncate max-w-xs">{item.produto}</span>
                </div>
                <Badge>{item.total}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Por Fornecedor</CardTitle>
            <CardDescription>Proporção chamados/vendidos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 max-h-80 overflow-y-auto">
            {classificacao?.por_fornecedor?.slice(0, 10).map((item) => (
              <div key={item.fornecedor} className="flex justify-between items-center p-2 rounded bg-muted/30">
                <span className="text-sm font-mono">{item.fornecedor}</span>
                <Badge variant="secondary">{item.total}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );

  // ABA 4 - PERFORMANCE
  const TabPerformance = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tempo Médio por Canal</CardTitle>
            <CardDescription>Em dias (apenas finalizados)</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performance?.tempo_por_canal?.slice(0, 10) || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="canal" type="category" width={100} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(value) => [`${value} dias`, 'Tempo Médio']} />
                <Bar dataKey="dias" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tempo Médio por Fornecedor</CardTitle>
            <CardDescription>Em dias (apenas finalizados)</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performance?.tempo_por_fornecedor?.slice(0, 10) || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="fornecedor" type="category" width={100} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(value) => [`${value} dias`, 'Tempo Médio']} />
                <Bar dataKey="dias" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  // ABA 5 - PENDÊNCIAS
  const TabPendencias = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{pendencias?.total || 0}</div>
            {pendencias?.total_pedidos > 0 && (
              <p className={`text-xs font-medium mt-1 ${getTaxaColor(pendencias?.taxa_pendencia)}`}>
                {pendencias?.taxa_pendencia}% do total de pedidos
              </p>
            )}
          </CardContent>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-lg">Por Categoria</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-60 overflow-y-auto">
            {pendencias?.por_categoria?.map((item) => (
              <div key={item.categoria} className="flex justify-between items-center p-2 rounded bg-muted/30">
                <span className="text-sm">{item.categoria}</span>
                <Badge>{item.total}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Por Motivo</CardTitle>
            {pendencias?.total_pedidos > 0 && (
              <CardDescription>% sobre {pendencias.total_pedidos.toLocaleString()} pedidos</CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-3 max-h-60 overflow-y-auto">
            {pendencias?.por_motivo?.map((item) => (
              <div key={item.motivo} className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-sm truncate mr-2">{item.motivo}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="secondary">{item.total}</Badge>
                    {pendencias?.total_pedidos > 0 && item.pct_pedidos !== undefined && (
                      <span className={`text-xs font-medium w-14 text-right ${item.pct_pedidos >= 1 ? 'text-red-600' : item.pct_pedidos >= 0.5 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {item.pct_pedidos}%
                      </span>
                    )}
                  </div>
                </div>
                {pendencias?.total_pedidos > 0 && (
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${item.pct_pedidos >= 1 ? 'bg-red-500' : item.pct_pedidos >= 0.5 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min(item.pct_pedidos * 20, 100)}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader><CardTitle className="text-lg">Por Canal</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-60 overflow-y-auto">
            {pendencias?.por_canal?.map((item) => (
              <div key={item.canal} className="flex justify-between items-center p-2 rounded bg-muted/30">
                <span className="text-sm">{item.canal}</span>
                <Badge variant="outline">{item.total}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Detalhamento</CardTitle>
          <CardDescription>Lista de pendências</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Dias</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendencias?.detalhes?.slice(0, 20).map((item) => (
                  <TableRow 
                    key={item.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/chamados/editar/${item.id}`)}
                  >
                    <TableCell className="font-mono text-xs">{item.id_atendimento}</TableCell>
                    <TableCell className="text-sm">{new Date(item.data_abertura).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell className="text-sm truncate max-w-32">{item.nome_cliente || '-'}</TableCell>
                    <TableCell className="text-sm">{item.parceiro || item.canal_vendas || '-'}</TableCell>
                    <TableCell><Badge variant="outline">{item.categoria}</Badge></TableCell>
                    <TableCell className="text-sm truncate max-w-32">{item.motivo_pendencia || '-'}</TableCell>
                    <TableCell className={item.dias_aberto > 3 ? 'text-red-600 font-medium' : ''}>{item.dias_aberto}d</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ABA 6 - ESTORNOS
  const TabEstornos = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard title="Total Estornos" value={estornos?.total || 0} icon={RotateCcw} color="red" />
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">% Geral</CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{estornos?.percentual_geral || 0}%</div>
            <p className="text-xs text-muted-foreground mt-1">do total</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Valor Total</CardTitle>
            <span className="text-red-500 font-bold">$</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {estornos?.valor_total
                ? `R$ ${estornos.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : 'R$ 0,00'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">preço + frete</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">% Estornos por Mês</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={estornos?.por_mes || []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value, name) => [name === 'percentual' ? `${value}%` : value, name === 'percentual' ? '% Estorno' : 'Estornos']} />
                <Bar dataKey="percentual" name="% Estorno" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Valor dos Estornos por Mês</CardTitle>
            <CardDescription>Preço final + frete (R$)</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={estornos?.valor_por_mes || []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(value) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Valor']} />
                <Line type="monotone" dataKey="valor" name="Valor" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ranking % por Canal</CardTitle>
          <CardDescription>Maior taxa de estorno — clique para ver chamados</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 max-h-72 overflow-y-auto">
          {estornos?.por_canal?.map((item, idx) => (
            <div key={item.canal} className="flex items-center justify-between p-2 rounded bg-muted/30 cursor-pointer hover:bg-muted/60"
              onClick={() => navigate(`/chamados?canal=${encodeURIComponent(item.canal)}&categoria=Arrependimento`)}>
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-red-100 text-red-800 text-xs flex items-center justify-center">{idx + 1}</span>
                <span className="text-sm">{item.canal}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{item.estornos}</Badge>
                <span className="text-sm font-medium text-red-600">{item.percentual}%</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );

  // ABA 7 - REINCIDÊNCIA
  const TabReincidencia = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard title="Taxa Geral" value={`${reincidencia?.taxa_geral || 0}%`} icon={Users} color="purple" />
        <StatCard title="Clientes Reincidentes" value={reincidencia?.total_reincidentes || 0} icon={RotateCcw} color="orange" />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Reincidência por Canal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-80 overflow-y-auto">
            {reincidencia?.por_canal?.map((item) => (
              <div key={item.canal} className="flex justify-between items-center p-2 rounded bg-muted/30">
                <span className="text-sm">{item.canal}</span>
                <Badge variant="secondary">{item.reincidentes}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Reincidência por Produto</CardTitle>
            <CardDescription>Top 10 produtos com mais reincidências</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 max-h-80 overflow-y-auto">
            {reincidencia?.por_produto?.map((item, idx) => (
              <div key={item.produto} className="flex justify-between items-center p-2 rounded bg-muted/30">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-800 text-xs flex items-center justify-center">{idx + 1}</span>
                  <span className="text-sm truncate max-w-xs">{item.produto}</span>
                </div>
                <Badge>{item.reincidentes}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );

  if (loading && !visaoGeral) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2"><Skeleton className="h-4 w-20" /></CardHeader>
              <CardContent><Skeleton className="h-8 w-16" /></CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="dashboard">
      {/* Header com Filtros Globais */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-['Plus_Jakarta_Sans']">Dashboard ELO</h1>
          <p className="text-sm text-muted-foreground">
            {lastUpdated && `Atualizado: ${lastUpdated.toLocaleTimeString('pt-BR')}`}
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={String(periodoDias)} onValueChange={(v) => setPeriodoDias(Number(v))}>
            <SelectTrigger className="w-28">
              <Calendar className="h-4 w-4 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 dias</SelectItem>
              <SelectItem value="30">30 dias</SelectItem>
              <SelectItem value="90">90 dias</SelectItem>
              <SelectItem value="365">1 ano</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={canalFiltro || "all"} onValueChange={(v) => setCanalFiltro(v === "all" ? "" : v)}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Canal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Canais</SelectItem>
              {filtros.canais.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          
          <Select value={fornecedorFiltro || "all"} onValueChange={(v) => setFornecedorFiltro(v === "all" ? "" : v)}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Fornecedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Fornec.</SelectItem>
              {filtros.fornecedores.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
            </SelectContent>
          </Select>
          
          <Button variant="outline" size="icon" onClick={() => fetchTabData(activeTab)}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-4 lg:grid-cols-7 w-full">
          <TabsTrigger value="visao-geral" className="gap-1">
            <LayoutGrid className="h-4 w-4 hidden sm:block" /> Visão Geral
          </TabsTrigger>
          <TabsTrigger value="volume-canal" className="gap-1">
            <BarChart3 className="h-4 w-4 hidden sm:block" /> Volume
          </TabsTrigger>
          <TabsTrigger value="classificacao" className="gap-1">
            <Tag className="h-4 w-4 hidden sm:block" /> Classificação
          </TabsTrigger>
          <TabsTrigger value="performance" className="gap-1">
            <Gauge className="h-4 w-4 hidden sm:block" /> Performance
          </TabsTrigger>
          <TabsTrigger value="pendencias" className="gap-1">
            <ListChecks className="h-4 w-4 hidden sm:block" /> Pendências
          </TabsTrigger>
          <TabsTrigger value="estornos" className="gap-1">
            <RotateCcw className="h-4 w-4 hidden sm:block" /> Estornos
          </TabsTrigger>
          <TabsTrigger value="reincidencia" className="gap-1">
            <Users className="h-4 w-4 hidden sm:block" /> Reincidência
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="visao-geral" className="mt-6"><TabVisaoGeral /></TabsContent>
        <TabsContent value="volume-canal" className="mt-6"><TabVolumeCanal /></TabsContent>
        <TabsContent value="classificacao" className="mt-6"><TabClassificacao /></TabsContent>
        <TabsContent value="performance" className="mt-6"><TabPerformance /></TabsContent>
        <TabsContent value="pendencias" className="mt-6"><TabPendencias /></TabsContent>
        <TabsContent value="estornos" className="mt-6"><TabEstornos /></TabsContent>
        <TabsContent value="reincidencia" className="mt-6"><TabReincidencia /></TabsContent>
      </Tabs>
    </div>
  );
};

export default Dashboard;

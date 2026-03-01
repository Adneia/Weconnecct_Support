import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { toast } from 'sonner';
import { Search, Plus, Filter, X, Clock, CheckCircle, AlertCircle } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const CATEGORIAS = [
  "Falha Produção", "Falha de Compras", "Falha Transporte",
  "Produto com Avaria", "Divergência de Produto", "Arrependimento",
  "Dúvida", "Reclamação", "Assistência Técnica"
];

const ATENDENTES = ["Letícia Martelo", "Adnéia Campos"];

const ListaAtendimentos = () => {
  const [atendimentos, setAtendimentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [globalFilter, setGlobalFilter] = useState('');
  const [searchType, setSearchType] = useState('todos'); // 'todos', 'solicitacao', 'entrega', 'cpf', 'nome'
  const [filters, setFilters] = useState({
    pendente: '',
    categoria: '',
    atendente: ''
  });
  const [showFilters, setShowFilters] = useState(false);

  const navigate = useNavigate();
  const { getAuthHeader } = useAuth();

  useEffect(() => {
    fetchData();
  }, [filters]);

  const fetchData = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.pendente !== '') params.append('pendente', filters.pendente);
      if (filters.categoria) params.append('categoria', filters.categoria);
      if (filters.atendente) params.append('atendente', filters.atendente);
      if (globalFilter) {
        params.append('search', globalFilter);
        params.append('search_type', searchType);
      }

      const response = await axios.get(
        `${API_URL}/api/chamados?${params.toString()}`,
        { headers: getAuthHeader() }
      );
      setAtendimentos(response.data);
    } catch (error) {
      toast.error('Erro ao carregar atendimentos');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setLoading(true);
    fetchData();
  };

  const clearFilters = () => {
    setFilters({ pendente: '', categoria: '', atendente: '' });
    setGlobalFilter('');
  };

  const hasActiveFilters = Object.values(filters).some(v => v !== '') || globalFilter;

  const getCategoryBadgeColor = (categoria) => {
    const colors = {
      'Falha Produção': 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400',
      'Falha de Compras': 'bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400',
      'Falha Transporte': 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400',
      'Produto com Avaria': 'bg-pink-50 text-pink-700 dark:bg-pink-950/50 dark:text-pink-400',
      'Divergência de Produto': 'bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400',
      'Arrependimento': 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400',
      'Dúvida': 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-400',
      'Reclamação': 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400',
      'Assistência Técnica': 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-400',
    };
    return colors[categoria] || 'bg-slate-100 text-slate-700';
  };

  // Stats
  const totalPendentes = atendimentos.filter(a => a.pendente).length;
  const totalResolvidos = atendimentos.filter(a => !a.pendente).length;

  if (loading) {
    return (
      <div className="space-y-6" data-testid="loading">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="lista-atendimentos-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-['Plus_Jakarta_Sans']">Atendimentos</h1>
          <p className="text-muted-foreground text-sm">{atendimentos.length} atendimentos encontrados</p>
        </div>
        <Button onClick={() => navigate('/chamados/novo')} data-testid="btn-novo">
          <Plus className="h-4 w-4 mr-2" />
          Novo Atendimento
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setFilters(f => ({ ...f, pendente: 'true' }))}>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 rounded-md bg-amber-100 dark:bg-amber-900/30">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalPendentes}</p>
              <p className="text-sm text-muted-foreground">Pendentes</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setFilters(f => ({ ...f, pendente: 'false' }))}>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 rounded-md bg-emerald-100 dark:bg-emerald-900/30">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalResolvidos}</p>
              <p className="text-sm text-muted-foreground">Resolvidos</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 rounded-md bg-blue-100 dark:bg-blue-900/30">
              <AlertCircle className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{atendimentos.length}</p>
              <p className="text-sm text-muted-foreground">Total</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por entrega, CPF, nome ou ID..."
                  value={globalFilter}
                  onChange={(e) => setGlobalFilter(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-9"
                  data-testid="input-search"
                />
              </div>
              <Button variant="secondary" onClick={handleSearch} data-testid="btn-buscar">
                <Search className="h-4 w-4 mr-2" />
                Buscar
              </Button>
              <Button
                variant={showFilters ? 'secondary' : 'outline'}
                onClick={() => setShowFilters(!showFilters)}
                data-testid="btn-filtros"
              >
                <Filter className="h-4 w-4 mr-2" />
                Filtros
              </Button>
              {hasActiveFilters && (
                <Button variant="ghost" onClick={clearFilters} data-testid="btn-limpar">
                  <X className="h-4 w-4 mr-2" />
                  Limpar
                </Button>
              )}
            </div>

            {showFilters && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t">
                <Select value={filters.pendente} onValueChange={(v) => setFilters(f => ({ ...f, pendente: v }))}>
                  <SelectTrigger data-testid="filter-pendente">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="true">Pendentes</SelectItem>
                    <SelectItem value="false">Resolvidos</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filters.categoria} onValueChange={(v) => setFilters(f => ({ ...f, categoria: v === 'all' ? '' : v }))}>
                  <SelectTrigger data-testid="filter-categoria">
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {CATEGORIAS.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filters.atendente} onValueChange={(v) => setFilters(f => ({ ...f, atendente: v === 'all' ? '' : v }))}>
                  <SelectTrigger data-testid="filter-atendente">
                    <SelectValue placeholder="Atendente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {ATENDENTES.map(a => (
                      <SelectItem key={a} value={a}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs uppercase tracking-wider font-medium bg-muted/50">ID</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider font-medium bg-muted/50">Entrega</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider font-medium bg-muted/50">Cliente</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider font-medium bg-muted/50">Parceiro</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider font-medium bg-muted/50">Categoria</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider font-medium bg-muted/50">Atendente</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider font-medium bg-muted/50">Status</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider font-medium bg-muted/50">Dias</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {atendimentos.length > 0 ? (
                  atendimentos.map((atd) => (
                    <TableRow
                      key={atd.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => navigate(`/chamados/editar/${atd.id}`)}
                      data-testid={`row-${atd.id}`}
                    >
                      <TableCell className="font-mono text-sm font-medium">
                        {atd.id_atendimento || '-'}
                      </TableCell>
                      <TableCell className="font-medium">
                        #{atd.numero_pedido}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>
                          <p className="font-medium truncate max-w-32">{atd.nome_cliente || '-'}</p>
                          {atd.cpf_cliente && (
                            <p className="text-xs text-muted-foreground">{atd.cpf_cliente}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {atd.parceiro || atd.canal_vendas || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge className={getCategoryBadgeColor(atd.categoria)}>
                          {atd.categoria}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {atd.atendente || '-'}
                      </TableCell>
                      <TableCell>
                        {atd.pendente ? (
                          <Badge className="bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
                            Pendente
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                            Resolvido
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className={`text-sm ${atd.dias_aberto > 3 ? 'text-orange-600 font-medium' : ''}`}>
                        {atd.dias_aberto}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                      Nenhum atendimento encontrado
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
};

export default ListaAtendimentos;

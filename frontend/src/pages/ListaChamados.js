import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
} from '@tanstack/react-table';
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
import { Search, Plus, ArrowUpDown, Filter, X } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const CANAIS = ['Email', 'WhatsApp', 'Conecta-lá', 'Bravium', 'Zendesk'];
const CATEGORIAS = ['Acompanhamento', 'Falha de Compras', 'Falha de Produção', 'Falha de Transporte', 'Reversa', 'Outro'];
const PRIORIDADES = ['Baixa', 'Media', 'Alta', 'Urgente'];
const STATUS_ATENDIMENTO = ['Aberto', 'Fechado'];

const ListaChamados = () => {
  const [chamados, setChamados] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState([{ id: 'data_abertura', desc: true }]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [filters, setFilters] = useState({
    status_atendimento: '',
    categoria: '',
    canal: '',
    responsavel_id: '',
    prioridade: ''
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
      if (filters.status_atendimento) params.append('status_atendimento', filters.status_atendimento);
      if (filters.categoria) params.append('categoria', filters.categoria);
      if (filters.canal) params.append('canal', filters.canal);
      if (filters.responsavel_id) params.append('responsavel_id', filters.responsavel_id);
      if (filters.prioridade) params.append('prioridade', filters.prioridade);
      if (globalFilter) params.append('search', globalFilter);

      const [chamadosRes, usersRes] = await Promise.all([
        axios.get(`${API_URL}/api/chamados?${params.toString()}`, { headers: getAuthHeader() }),
        axios.get(`${API_URL}/api/users`, { headers: getAuthHeader() })
      ]);
      
      setChamados(chamadosRes.data);
      setUsers(usersRes.data);
    } catch (error) {
      toast.error('Erro ao carregar chamados');
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

  const columns = useMemo(() => [
    {
      accessorKey: 'numero_pedido',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className="h-8 px-2">
          Pedido
          <ArrowUpDown className="ml-2 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => <span className="font-medium">#{row.getValue('numero_pedido')}</span>
    },
    {
      accessorKey: 'canal_origem',
      header: 'Canal',
      cell: ({ row }) => <span className="text-sm">{row.getValue('canal_origem')}</span>
    },
    {
      accessorKey: 'categoria',
      header: 'Categoria',
      cell: ({ row }) => <span className="text-sm">{row.getValue('categoria')}</span>
    },
    {
      accessorKey: 'prioridade',
      header: 'Prioridade',
      cell: ({ row }) => (
        <Badge className={getPriorityBadge(row.getValue('prioridade'))}>
          {row.getValue('prioridade')}
        </Badge>
      )
    },
    {
      accessorKey: 'status_atendimento',
      header: 'Status',
      cell: ({ row }) => (
        <Badge className={getStatusBadge(row.getValue('status_atendimento'))}>
          {row.getValue('status_atendimento')}
        </Badge>
      )
    },
    {
      accessorKey: 'responsavel_nome',
      header: 'Responsável',
      cell: ({ row }) => <span className="text-sm">{row.getValue('responsavel_nome') || '-'}</span>
    },
    {
      accessorKey: 'data_abertura',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className="h-8 px-2">
          Abertura
          <ArrowUpDown className="ml-2 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => {
        const date = new Date(row.getValue('data_abertura'));
        return <span className="text-sm">{date.toLocaleDateString('pt-BR')}</span>;
      }
    },
    {
      accessorKey: 'dias_aberto',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className="h-8 px-2">
          Dias
          <ArrowUpDown className="ml-2 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => {
        const dias = row.getValue('dias_aberto');
        return (
          <span className={`text-sm ${dias > 3 ? 'text-orange-600 font-medium' : ''}`}>
            {dias}
          </span>
        );
      }
    }
  ], []);

  const table = useReactTable({
    data: chamados,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
      globalFilter
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter
  });

  const clearFilters = () => {
    setFilters({
      status_atendimento: '',
      categoria: '',
      canal: '',
      responsavel_id: '',
      prioridade: ''
    });
    setGlobalFilter('');
  };

  const hasActiveFilters = Object.values(filters).some(v => v) || globalFilter;

  if (loading) {
    return (
      <div className="space-y-6" data-testid="lista-chamados-loading">
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
    <div className="space-y-6" data-testid="lista-chamados-page">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-['Plus_Jakarta_Sans']">Chamados</h1>
          <p className="text-muted-foreground text-sm">{chamados.length} chamados encontrados</p>
        </div>
        <Button onClick={() => navigate('/chamados/novo')} data-testid="btn-novo-chamado">
          <Plus className="h-4 w-4 mr-2" />
          Novo Chamado
        </Button>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por número do pedido..."
                  value={globalFilter}
                  onChange={(e) => setGlobalFilter(e.target.value)}
                  className="pl-9"
                  data-testid="input-search"
                />
              </div>
              <Button
                variant={showFilters ? 'secondary' : 'outline'}
                onClick={() => setShowFilters(!showFilters)}
                data-testid="btn-toggle-filters"
              >
                <Filter className="h-4 w-4 mr-2" />
                Filtros
                {hasActiveFilters && (
                  <Badge className="ml-2 bg-primary text-primary-foreground">!</Badge>
                )}
              </Button>
              {hasActiveFilters && (
                <Button variant="ghost" onClick={clearFilters} data-testid="btn-clear-filters">
                  <X className="h-4 w-4 mr-2" />
                  Limpar
                </Button>
              )}
            </div>

            {showFilters && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-4 border-t">
                <Select value={filters.status_atendimento} onValueChange={(v) => setFilters(f => ({ ...f, status_atendimento: v }))}>
                  <SelectTrigger data-testid="filter-status">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos</SelectItem>
                    {STATUS_ATENDIMENTO.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filters.categoria} onValueChange={(v) => setFilters(f => ({ ...f, categoria: v }))}>
                  <SelectTrigger data-testid="filter-categoria">
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todas</SelectItem>
                    {CATEGORIAS.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filters.canal} onValueChange={(v) => setFilters(f => ({ ...f, canal: v }))}>
                  <SelectTrigger data-testid="filter-canal">
                    <SelectValue placeholder="Canal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos</SelectItem>
                    {CANAIS.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filters.prioridade} onValueChange={(v) => setFilters(f => ({ ...f, prioridade: v }))}>
                  <SelectTrigger data-testid="filter-prioridade">
                    <SelectValue placeholder="Prioridade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todas</SelectItem>
                    {PRIORIDADES.map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filters.responsavel_id} onValueChange={(v) => setFilters(f => ({ ...f, responsavel_id: v }))}>
                  <SelectTrigger data-testid="filter-responsavel">
                    <SelectValue placeholder="Responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos</SelectItem>
                    {users.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
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
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id} className="text-xs uppercase tracking-wider text-muted-foreground font-medium bg-muted/50">
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => navigate(`/chamados/${row.original.id}`)}
                      data-testid={`chamado-row-${row.original.id}`}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="py-3">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-32 text-center text-muted-foreground">
                      Nenhum chamado encontrado
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

export default ListaChamados;

import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { toast } from 'sonner';
import { Search, Plus, Filter, X, Clock, CheckCircle, AlertCircle, FileText, RotateCcw, Download, FileSpreadsheet, CheckSquare, ExternalLink, Copy } from 'lucide-react';
import * as XLSX from 'xlsx';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const CATEGORIAS = [
  "Falha Produção", "Falha de Compras", "Falha Transporte",
  "Produto com Avaria", "Divergência de Produto", "Arrependimento",
  "Dúvida", "Reclamação", "Assistência Técnica", "Falha de Integração"
];

const MOTIVOS_PENDENCIA = [
  "Ag. Compras",
  "Ag. Logística", 
  "Enviado",
  "Ag. Bseller",
  "Ag. Barrar",
  "Aguardando",
  "Em devolução",
  "Ag. Confirmação de Entrega",
  "Ag. Parceiro",
  "Ag. Transportadora - Asap",
  "Ag. Transportadora - J&T",
  "Ag. Transportadora - Total",
  "Ag. Transportadora - (verificar)",
  "Entregue",
  "Estornado",
  "Atendido"
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
    retornar_chamado: '',
    verificar_adneia: '',
    motivo_pendencia: '',
    parceiro: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const [parceiros, setParceiros] = useState([]);
  
  // Estados para finalização de atendimentos
  const [showFinalizarDialog, setShowFinalizarDialog] = useState(false);
  const [canaisSemAtividade, setCanaisSemAtividade] = useState([]);
  const [canaisComAtividade, setCanaisComAtividade] = useState([]);
  const [verificandoCanais, setVerificandoCanais] = useState(false);
  const [finalizando, setFinalizando] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { getAuthHeader } = useAuth();
  
  // Chave para localStorage dos filtros
  const FILTERS_STORAGE_KEY = 'elo_atendimentos_filters';
  
  // Flag para indicar se já carregou os filtros do localStorage
  const [filtersLoaded, setFiltersLoaded] = useState(false);
  
  // Restaurar filtros do localStorage ao carregar
  useEffect(() => {
    const savedFilters = localStorage.getItem(FILTERS_STORAGE_KEY);
    if (savedFilters) {
      try {
        const parsed = JSON.parse(savedFilters);
        setFilters(parsed.filters || {
          pendente: '',
          categoria: '',
          retornar_chamado: '',
          verificar_adneia: '',
          motivo_pendencia: '',
          parceiro: ''
        });
        setGlobalFilter(parsed.globalFilter || '');
        setSearchType(parsed.searchType || 'todos');
      } catch (e) {
        console.error('Erro ao restaurar filtros:', e);
      }
    }
    setFiltersLoaded(true);
  }, []);
  
  // Salvar filtros no localStorage quando mudarem (após carregamento inicial)
  useEffect(() => {
    if (!filtersLoaded) return;
    const filtersToSave = {
      filters,
      globalFilter,
      searchType
    };
    localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filtersToSave));
  }, [filters, globalFilter, searchType, filtersLoaded]);
  
  // Ler filtro da URL ao carregar (tem prioridade sobre localStorage)
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const filterParam = searchParams.get('filter');
    if (filterParam === 'retornar') {
      setFilters(f => ({ ...f, retornar_chamado: 'true', pendente: '', verificar_adneia: '' }));
    } else if (filterParam === 'verificar') {
      setFilters(f => ({ ...f, verificar_adneia: 'true', pendente: '', retornar_chamado: '' }));
    }
  }, [location.search]);

  // Buscar dados apenas quando filtros carregados
  useEffect(() => {
    if (filtersLoaded) {
      fetchData();
    }
  }, [filters, globalFilter, searchType, filtersLoaded]);

  const fetchData = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.pendente !== '') params.append('pendente', filters.pendente);
      if (filters.categoria) params.append('categoria', filters.categoria);
      if (filters.retornar_chamado !== '') params.append('retornar_chamado', filters.retornar_chamado);
      if (filters.verificar_adneia !== '') params.append('verificar_adneia', filters.verificar_adneia);
      if (filters.motivo_pendencia) params.append('motivo_pendencia', filters.motivo_pendencia);
      if (filters.parceiro) params.append('parceiro', filters.parceiro);
      if (globalFilter) {
        params.append('search', globalFilter);
        params.append('search_type', searchType);
      }

      const response = await axios.get(
        `${API_URL}/api/chamados?${params.toString()}`,
        { headers: getAuthHeader() }
      );
      setAtendimentos(response.data);
      
      // Extrair lista de parceiros únicos
      const parceirosUnicos = [...new Set(response.data.map(a => a.parceiro).filter(p => p))].sort();
      setParceiros(parceirosUnicos);
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
    setFilters({ pendente: '', categoria: '', retornar_chamado: '', verificar_adneia: '', motivo_pendencia: '', parceiro: '' });
    setGlobalFilter('');
  };

  const hasActiveFilters = Object.values(filters).some(v => v !== '') || globalFilter;

  // Função para exportar para Excel
  const exportToExcel = () => {
    if (atendimentos.length === 0) {
      toast.error('Nenhum atendimento para exportar');
      return;
    }

    try {
      // Preparar dados para exportação
      const dataToExport = atendimentos.map(atd => ({
        'Entrega': atd.numero_pedido || '',
        'Cliente': atd.nome_cliente || '',
        'CPF': atd.cpf_cliente || '',
        'Parceiro': atd.parceiro || atd.canal_vendas || '',
        'Categoria': atd.categoria || '',
        'Motivo Pendência': atd.motivo_pendencia || '',
        'Status Pedido': atd.status_pedido || '',
        'Motivo': atd.motivo || '',
        'Reversa': atd.codigo_reversa || '',
        'Atendente': atd.atendente || '',
        'Status': atd.pendente ? 'Pendente' : 'Resolvido',
        'Retornar': atd.retornar_chamado ? 'Sim' : '',
        'Verificar': atd.verificar_adneia ? 'Sim' : '',
        'Data': atd.data_abertura ? new Date(atd.data_abertura).toLocaleDateString('pt-BR') : '',
        'Solicitação': atd.solicitacao || '',
        'Anotações': atd.anotacoes || ''
      }));

      // Criar workbook e worksheet
      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Atendimentos');

      // Ajustar largura das colunas
      ws['!cols'] = [
        { wch: 12 }, // Entrega
        { wch: 25 }, // Cliente
        { wch: 15 }, // CPF
        { wch: 15 }, // Parceiro
        { wch: 18 }, // Categoria
        { wch: 15 }, // Motivo Pendência
        { wch: 20 }, // Status Pedido
        { wch: 30 }, // Motivo
        { wch: 15 }, // Reversa
        { wch: 18 }, // Atendente
        { wch: 10 }, // Status
        { wch: 10 }, // Retornar
        { wch: 10 }, // Verificar
        { wch: 12 }, // Data
        { wch: 15 }, // Solicitação
        { wch: 50 }, // Anotações
      ];

      // Nome do arquivo com data atual
      const dataAtual = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
      const fileName = `atendimentos_${dataAtual}.xlsx`;

      // Download
      XLSX.writeFile(wb, fileName);
      toast.success(`Exportado ${atendimentos.length} atendimentos para ${fileName}`);
    } catch (error) {
      console.error('Erro ao exportar:', error);
      toast.error('Erro ao exportar para Excel');
    }
  };

  // Função para verificar canais sem atividade
  const verificarCanais = async () => {
    setVerificandoCanais(true);
    try {
      const response = await axios.get(
        `${API_URL}/api/atendimentos/verificar-canais`,
        { headers: getAuthHeader() }
      );
      
      setCanaisSemAtividade(response.data.canais_sem_atividade || []);
      setCanaisComAtividade(response.data.canais_com_atividade || []);
      setShowFinalizarDialog(true);
    } catch (error) {
      console.error('Erro ao verificar canais:', error);
      toast.error('Erro ao verificar canais');
    } finally {
      setVerificandoCanais(false);
    }
  };

  // Função para finalizar atendimentos do dia
  const finalizarAtendimentos = async () => {
    setFinalizando(true);
    try {
      const response = await axios.post(
        `${API_URL}/api/atendimentos/finalizar-dia`,
        {},
        { headers: getAuthHeader() }
      );
      
      if (response.data.success) {
        toast.success('Atendimentos do dia finalizados com sucesso!');
        setShowFinalizarDialog(false);
      }
    } catch (error) {
      console.error('Erro ao finalizar:', error);
      toast.error('Erro ao finalizar atendimentos');
    } finally {
      setFinalizando(false);
    }
  };

  // Função para exportar relatório Ag. Compras
  const exportRelatorioCompras = async () => {
    try {
      toast.info('Gerando relatório Ag. Compras...');
      const response = await axios.get(
        `${API_URL}/api/relatorios/ag-compras`,
        { headers: getAuthHeader() }
      );
      
      const data = response.data;
      if (data.length === 0) {
        toast.warning('Nenhum atendimento com Ag. Compras encontrado');
        return;
      }

      // Preparar dados para exportação - ordem conforme imagem
      const dataToExport = data.map(item => {
        // Determinar se é crítico (Verificar ou Retornar)
        let statusAtendimento = item.status_atendimento || '';
        if (statusAtendimento === 'Verificar' || statusAtendimento === 'Retornar') {
          statusAtendimento = 'Crítico';
        }
        
        return {
          'Fornecedor': item.fornecedor || '',
          'Produto': item.produto || '',
          'Cód. Fornecedor': item.codigo_fornecedor || '',
          'ID': item.id_produto || '',
          'SKU': item.sku || '',
          'Estoque Disp.': item.estoque_disponivel !== null ? item.estoque_disponivel : '-',
          'Qtd. Pedido': item.quantidade || '',
          'Entrega': item.entrega || '',
          'Parceiro/Canal': item.parceiro_canal || '',
          'Cidade': item.cidade || '',
          'UF': item.uf || '',
          'Status Atendimento': statusAtendimento,
          'Status Entrega': item.status_entrega || '',
          'Data Último Ponto': item.data_ultimo_ponto || ''
        };
      });

      // Criar workbook
      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Ag Compras');

      // Ajustar largura das colunas
      ws['!cols'] = [
        { wch: 20 }, // Fornecedor
        { wch: 35 }, // Produto
        { wch: 15 }, // Cód Fornecedor
        { wch: 12 }, // ID
        { wch: 12 }, // SKU
        { wch: 12 }, // Estoque Disp.
        { wch: 10 }, // Qtd
        { wch: 12 }, // Entrega
        { wch: 15 }, // Parceiro/Canal
        { wch: 15 }, // Cidade
        { wch: 5 },  // UF
        { wch: 15 }, // Status Atendimento
        { wch: 18 }, // Status Entrega
        { wch: 18 }, // Data
      ];

      const dataAtual = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
      XLSX.writeFile(wb, `relatorio_ag_compras_${dataAtual}.xlsx`);
      toast.success(`Relatório Ag. Compras exportado (${data.length} registros)`);
    } catch (error) {
      console.error('Erro ao exportar relatório:', error);
      toast.error('Erro ao gerar relatório Ag. Compras');
    }
  };

  // Função para exportar relatório Ag. Logística
  const exportRelatorioLogistica = async () => {
    try {
      toast.info('Gerando relatório Ag. Logística...');
      const response = await axios.get(
        `${API_URL}/api/relatorios/ag-logistica`,
        { headers: getAuthHeader() }
      );
      
      const data = response.data;
      if (data.length === 0) {
        toast.warning('Nenhum atendimento com Ag. Logística encontrado');
        return;
      }

      // Preparar dados para exportação
      const dataToExport = data.map(item => {
        // Determinar se é crítico (Verificar ou Retornar)
        let statusAtendimento = item.status_atendimento || '';
        if (statusAtendimento === 'Verificar' || statusAtendimento === 'Retornar') {
          statusAtendimento = 'Crítico';
        }
        
        return {
          'Entrega': item.entrega || '',
          'Nota': item.nota || '',
          'Galpão': item.galpao || '',
          'Status Entrega': item.status_entrega || '',
          'Data Último Ponto': item.data_ultimo_ponto || '',
          'Status Atendimento': statusAtendimento
        };
      });

      // Criar workbook
      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Ag Logistica');

      // Ajustar largura das colunas
      ws['!cols'] = [
        { wch: 15 }, // Entrega
        { wch: 15 }, // Nota
        { wch: 15 }, // Galpão
        { wch: 18 }, // Status Entrega
        { wch: 18 }, // Data
        { wch: 18 }, // Status Atendimento
      ];

      const dataAtual = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
      XLSX.writeFile(wb, `relatorio_ag_logistica_${dataAtual}.xlsx`);
      toast.success(`Relatório Ag. Logística exportado (${data.length} registros)`);
    } catch (error) {
      console.error('Erro ao exportar relatório:', error);
      toast.error('Erro ao gerar relatório Ag. Logística');
    }
  };

  // Função para copiar dados da linha
  const copyRowData = (atd, e) => {
    e.stopPropagation(); // Não navegar ao clicar no botão
    
    const dadosParaCopiar = [
      `Entrega: ${atd.numero_pedido || '-'}`,
      `Cliente: ${atd.nome_cliente || '-'}`,
      `CPF: ${atd.cpf_cliente || '-'}`,
      `Parceiro: ${atd.parceiro || atd.canal_vendas || '-'}`,
      `Solicitação: ${atd.solicitacao || '-'}`,
      `Motivo Pendência: ${atd.motivo_pendencia || '-'}`,
      `Status Pedido: ${atd.status_pedido || '-'}`,
      `Reversa: ${atd.codigo_reversa || '-'}`,
      `Categoria: ${atd.categoria || '-'}`,
    ].join('\n');
    
    navigator.clipboard.writeText(dadosParaCopiar).then(() => {
      toast.success('Dados copiados!');
    }).catch(() => {
      toast.error('Erro ao copiar dados');
    });
  };

  // Função para copiar um texto específico
  const copyText = (text, label, e) => {
    if (e) e.stopPropagation();
    if (!text || text === '-') {
      toast.info('Nada para copiar');
      return;
    }
    navigator.clipboard.writeText(text).then(() => {
      toast.success(`${label} copiado!`);
    }).catch(() => {
      toast.error('Erro ao copiar');
    });
  };

  // Função para copiar todas as reversas dos atendimentos filtrados
  const copyTodasReversas = () => {
    const reversas = atendimentos
      .map(atd => atd.codigo_reversa || atd.reversa_codigo)
      .filter(r => r && r !== '-' && r.trim() !== '');
    
    if (reversas.length === 0) {
      toast.info('Nenhuma reversa encontrada nos atendimentos filtrados');
      return;
    }
    
    const textoReversas = reversas.join('\n');
    navigator.clipboard.writeText(textoReversas).then(() => {
      toast.success(`${reversas.length} reversa(s) copiada(s)!`);
    }).catch(() => {
      toast.error('Erro ao copiar reversas');
    });
  };

  const getCategoryBadgeColor = (categoria) => {
    const colors = {
      'Falha Produção': 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400',
      'Falha de Compras': 'bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400',
      'Falha Transporte': 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400',
      'Produto com Avaria': 'bg-pink-50 text-pink-700 dark:bg-pink-950/50 dark:text-pink-400',
      'Arrependimento': 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400',
      'Acompanhamento': 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-400',
      'Reclame Aqui': 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400',
      'Assistência Técnica': 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-400',
      'Falha de Integração': 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300',
    };
    return colors[categoria] || 'bg-slate-100 text-slate-700';
  };

  // Função para calcular o próximo dia útil
  const getProximoDiaUtil = () => {
    const hoje = new Date();
    const proximoDia = new Date(hoje);
    proximoDia.setDate(proximoDia.getDate() + 1);
    
    // Se cair no sábado (6), pula para segunda
    if (proximoDia.getDay() === 6) {
      proximoDia.setDate(proximoDia.getDate() + 2);
    }
    // Se cair no domingo (0), pula para segunda
    else if (proximoDia.getDay() === 0) {
      proximoDia.setDate(proximoDia.getDate() + 1);
    }
    
    return proximoDia.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  // Stats
  const totalPendentes = atendimentos.filter(a => a.pendente).length;
  const totalResolvidos = atendimentos.filter(a => !a.pendente).length;
  const totalRetornar = atendimentos.filter(a => a.retornar_chamado).length;
  const totalVerificarAdneia = atendimentos.filter(a => a.verificar_adneia).length;
  
  // Calcular criados e fechados hoje
  const hoje = new Date();
  const hojeStr = hoje.toISOString().split('T')[0]; // YYYY-MM-DD
  
  const criadosHoje = atendimentos.filter(a => {
    if (!a.data_abertura) return false;
    const dataAbertura = a.data_abertura.split('T')[0];
    return dataAbertura === hojeStr;
  }).length;
  
  const fechadosHoje = atendimentos.filter(a => {
    if (!a.data_fechamento || a.pendente) return false;
    const dataFechamento = a.data_fechamento.split('T')[0];
    return dataFechamento === hojeStr;
  }).length;
  
  // Aberto para amanhã = Pendentes + Criados Hoje - Fechados Hoje
  // Na verdade, é só o total de pendentes pois já reflete o saldo
  const abertoParaAmanha = totalPendentes;
  const proximoDiaUtil = getProximoDiaUtil();

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
        <div className="flex flex-wrap gap-2">
          {/* Botão para copiar todas as reversas */}
          <Button 
            variant="outline" 
            onClick={copyTodasReversas}
            className="bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200"
            data-testid="btn-copiar-reversas"
          >
            <Copy className="h-4 w-4 mr-2" />
            Copiar Reversas
          </Button>
          {/* Relatórios Especiais */}
          <Button variant="outline" onClick={exportRelatorioCompras} className="bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200" data-testid="btn-relatorio-compras">
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Relatório Ag. Compras
          </Button>
          <Button variant="outline" onClick={exportRelatorioLogistica} className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200" data-testid="btn-relatorio-logistica">
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Relatório Ag. Logística
          </Button>
          <Button variant="outline" onClick={exportToExcel} data-testid="btn-exportar">
            <Download className="h-4 w-4 mr-2" />
            Exportar Excel
          </Button>
          <Button 
            variant="outline" 
            onClick={verificarCanais} 
            disabled={verificandoCanais}
            className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
            data-testid="btn-finalizar-dia"
          >
            <CheckSquare className="h-4 w-4 mr-2" />
            {verificandoCanais ? 'Verificando...' : 'Finalizar Dia'}
          </Button>
          <Button onClick={() => navigate('/chamados/novo')} data-testid="btn-novo">
            <Plus className="h-4 w-4 mr-2" />
            Novo Atendimento
          </Button>
        </div>
      </div>

      {/* Dialog de Finalização de Atendimentos */}
      <Dialog open={showFinalizarDialog} onOpenChange={setShowFinalizarDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Finalizar Atendimentos do Dia</DialogTitle>
            <DialogDescription>
              Verificação de atividade nos canais diários
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {canaisSemAtividade.length > 0 ? (
              <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <p className="font-semibold text-amber-800 dark:text-amber-200 mb-2">
                  ⚠️ Canais sem atividade hoje:
                </p>
                <ul className="list-disc list-inside space-y-1">
                  {canaisSemAtividade.map((canal, idx) => (
                    <li key={idx} className="text-amber-700 dark:text-amber-300">{canal}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                <p className="font-semibold text-green-800 dark:text-green-200">
                  ✅ Todos os canais tiveram atividade hoje!
                </p>
              </div>
            )}
            
            {canaisComAtividade.length > 0 && (
              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900/30 border">
                <p className="font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Canais com atividade ({canaisComAtividade.length}):
                </p>
                <p className="text-sm text-muted-foreground">
                  {canaisComAtividade.join(', ')}
                </p>
              </div>
            )}
            
            <p className="text-sm text-muted-foreground">
              {canaisSemAtividade.length > 0 
                ? 'Deseja finalizar mesmo assim? Os canais sem atividade serão registrados.'
                : 'Deseja confirmar a finalização dos atendimentos do dia?'
              }
            </p>
          </div>
          
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowFinalizarDialog(false)}>
              Revisar
            </Button>
            <Button 
              onClick={finalizarAtendimentos} 
              disabled={finalizando}
              className="bg-green-600 hover:bg-green-700"
            >
              {finalizando ? 'Finalizando...' : 'Confirmar Finalização'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setFilters(f => ({ ...f, pendente: 'true', retornar_chamado: '', verificar_adneia: '' }))}>
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
        
        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setFilters(f => ({ ...f, retornar_chamado: 'true', pendente: '', verificar_adneia: '' }))}>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 rounded-md bg-rose-100 dark:bg-rose-900/30">
              <AlertCircle className="h-5 w-5 text-rose-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalRetornar}</p>
              <p className="text-sm text-muted-foreground">Retornar</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setFilters(f => ({ ...f, verificar_adneia: 'true', pendente: '', retornar_chamado: '' }))}>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 rounded-md bg-purple-100 dark:bg-purple-900/30">
              <AlertCircle className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalVerificarAdneia}</p>
              <p className="text-sm text-muted-foreground">Verificar</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setFilters(f => ({ ...f, pendente: 'false', retornar_chamado: '', verificar_adneia: '' }))}>
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
        
        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setFilters(f => ({ ...f, pendente: 'true', retornar_chamado: '', verificar_adneia: '' }))}>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 rounded-md bg-indigo-100 dark:bg-indigo-900/30">
              <Clock className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{abertoParaAmanha}</p>
              <p className="text-sm text-muted-foreground">Aberto p/ {proximoDiaUtil}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <Select value={searchType} onValueChange={setSearchType}>
                <SelectTrigger className="w-40" data-testid="select-search-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="solicitacao">Solicitação</SelectItem>
                  <SelectItem value="entrega">Entrega</SelectItem>
                  <SelectItem value="cpf">CPF</SelectItem>
                  <SelectItem value="nome">Nome</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={
                    searchType === 'solicitacao' ? 'Buscar por nº da solicitação...' :
                    searchType === 'entrega' ? 'Buscar por nº da entrega...' :
                    searchType === 'cpf' ? 'Buscar por CPF do cliente...' :
                    searchType === 'nome' ? 'Buscar por nome do cliente...' :
                    'Buscar por entrega, CPF, nome, solicitação...'
                  }
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
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-4 border-t">
                <Select 
                  value={
                    filters.retornar_chamado === 'true' ? 'retornar' :
                    filters.verificar_adneia === 'true' ? 'verificar' :
                    filters.pendente === 'true' ? 'pendente' :
                    filters.pendente === 'false' ? 'resolvido' : 'all'
                  } 
                  onValueChange={(v) => {
                    if (v === 'retornar') {
                      setFilters(f => ({ ...f, pendente: '', retornar_chamado: 'true', verificar_adneia: '' }));
                    } else if (v === 'verificar') {
                      setFilters(f => ({ ...f, pendente: '', retornar_chamado: '', verificar_adneia: 'true' }));
                    } else if (v === 'pendente') {
                      setFilters(f => ({ ...f, pendente: 'true', retornar_chamado: '', verificar_adneia: '' }));
                    } else if (v === 'resolvido') {
                      setFilters(f => ({ ...f, pendente: 'false', retornar_chamado: '', verificar_adneia: '' }));
                    } else {
                      setFilters(f => ({ ...f, pendente: '', retornar_chamado: '', verificar_adneia: '' }));
                    }
                  }}
                >
                  <SelectTrigger data-testid="filter-pendente">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pendente">Pendentes</SelectItem>
                    <SelectItem value="retornar">Retornar</SelectItem>
                    <SelectItem value="verificar">Verificar</SelectItem>
                    <SelectItem value="resolvido">Resolvidos</SelectItem>
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

                <Select value={filters.motivo_pendencia} onValueChange={(v) => setFilters(f => ({ ...f, motivo_pendencia: v === 'all' ? '' : v }))}>
                  <SelectTrigger data-testid="filter-motivo-pendencia">
                    <SelectValue placeholder="Motivo Pendência" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos Motivos</SelectItem>
                    {MOTIVOS_PENDENCIA.map(m => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filters.parceiro} onValueChange={(v) => setFilters(f => ({ ...f, parceiro: v === 'all' ? '' : v }))}>
                  <SelectTrigger data-testid="filter-parceiro">
                    <SelectValue placeholder="Parceiro/Canal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos Parceiros</SelectItem>
                    {parceiros.map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
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
                  <TableHead className="text-xs uppercase tracking-wider font-medium bg-muted/50 w-8"></TableHead>
                  <TableHead className="text-xs uppercase tracking-wider font-medium bg-muted/50">Entrega</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider font-medium bg-muted/50">Cliente</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider font-medium bg-muted/50">Parceiro / Solicitação</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider font-medium bg-muted/50">Motivo Pend.</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider font-medium bg-muted/50 min-w-[180px]">Última Anotação</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider font-medium bg-muted/50">Reversa</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider font-medium bg-muted/50">Status Pedido</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider font-medium bg-muted/50">Status</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider font-medium bg-muted/50">Dias</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {atendimentos.length > 0 ? (
                  atendimentos.map((atd) => {
                    // Determinar qual filtro está ativo para passar na navegação
                    const activeFilter = filters.retornar_chamado === 'true' ? 'retornar' : 
                                        filters.verificar_adneia === 'true' ? 'verificar' : '';
                    const editUrl = activeFilter 
                      ? `/chamados/editar/${atd.id}?filter=${activeFilter}`
                      : `/chamados/editar/${atd.id}`;
                    
                    // Extrair última anotação (primeira linha do campo anotacoes)
                    const ultimaAnotacao = atd.anotacoes ? atd.anotacoes.split('\n')[0] : '-';
                    // Extrair data da anotação - suporta formatos:
                    // [DD/MM/YYYY] texto, [DD/MM] texto, DD/MM - texto, DD/MM/YYYY - texto
                    let dataAnotacao = '';
                    let textoAnotacao = ultimaAnotacao;
                    
                    // Formato com colchetes: [09/03/2026] ou [9/3]
                    const matchColchetes = ultimaAnotacao.match(/^\[(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\]\s*(.*)$/);
                    // Formato sem colchetes: 09/03 - texto ou 9/3 - texto
                    const matchSemColchetes = ultimaAnotacao.match(/^(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s*[-–]\s*(.*)$/);
                    
                    if (matchColchetes) {
                      dataAnotacao = matchColchetes[1];
                      textoAnotacao = matchColchetes[2] || '';
                    } else if (matchSemColchetes) {
                      dataAnotacao = matchSemColchetes[1];
                      textoAnotacao = matchSemColchetes[2] || '';
                    }
                    
                    return (
                    <TableRow
                      key={atd.id}
                      className="hover:bg-muted/50 transition-colors"
                      data-testid={`row-${atd.id}`}
                    >
                      {/* Coluna Abrir - botão para abrir atendimento */}
                      <TableCell className="p-1">
                        <a 
                          href={editUrl}
                          onClick={(e) => {
                            if (!e.ctrlKey && !e.metaKey && e.button === 0) {
                              e.preventDefault();
                              navigate(editUrl);
                            }
                          }}
                          className="p-1.5 rounded hover:bg-primary/10 inline-flex items-center justify-center"
                          title="Abrir atendimento (Ctrl+Click abre em nova aba)"
                        >
                          <ExternalLink className="h-4 w-4 text-primary" />
                        </a>
                      </TableCell>
                      {/* Coluna Entrega - copiável ao clicar */}
                      <TableCell 
                        className="font-medium cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/30"
                        onClick={(e) => copyText(atd.numero_pedido, 'Entrega', e)}
                        title="Clique para copiar"
                      >
                        {atd.numero_pedido}
                      </TableCell>
                      {/* Coluna Cliente - copiável ao clicar */}
                      <TableCell 
                        className="text-sm cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/30"
                        onClick={(e) => copyText(`${atd.nome_cliente || ''}\n${atd.cpf_cliente || ''}`.trim(), 'Cliente', e)}
                        title="Clique para copiar"
                      >
                        <div>
                          <p className="font-medium truncate max-w-32">{atd.nome_cliente || '-'}</p>
                          {atd.cpf_cliente && (
                            <p className="text-xs text-muted-foreground">{atd.cpf_cliente}</p>
                          )}
                        </div>
                      </TableCell>
                      {/* Coluna Parceiro/Solicitação - ambos copiáveis */}
                      <TableCell className="text-sm">
                        <div className="space-y-1">
                          <p 
                            className="cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/30 px-1 -mx-1 rounded"
                            onClick={(e) => copyText(atd.parceiro || atd.canal_vendas, 'Parceiro', e)}
                            title="Clique para copiar parceiro"
                          >
                            {atd.parceiro || atd.canal_vendas || '-'}
                          </p>
                          {atd.solicitacao && (
                            <p 
                              className="text-xs text-primary cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/30 px-1 -mx-1 rounded"
                              onClick={(e) => copyText(atd.solicitacao, 'Solicitação', e)}
                              title="Clique para copiar solicitação"
                            >
                              {atd.solicitacao}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      {/* Coluna Motivo Pendência - copiável */}
                      <TableCell 
                        className="text-sm cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/30"
                        onClick={(e) => copyText(atd.motivo_pendencia, 'Motivo', e)}
                        title="Clique para copiar"
                      >
                        {atd.motivo_pendencia || '-'}
                      </TableCell>
                      {/* Coluna Última Anotação - copiável */}
                      <TableCell 
                        className="text-sm max-w-[200px] cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/30"
                        onClick={(e) => copyText(atd.anotacoes ? atd.anotacoes.split('\n')[0] : '', 'Anotação', e)}
                        title="Clique para copiar última anotação"
                      >
                        <div className="flex flex-col">
                          {dataAnotacao && (
                            <span className="font-semibold text-blue-600 dark:text-blue-400 text-xs">{dataAnotacao}</span>
                          )}
                          {textoAnotacao ? (
                            <span className="text-muted-foreground text-xs truncate" title={textoAnotacao}>
                              {textoAnotacao}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </div>
                      </TableCell>
                      {/* Coluna Reversa - copiável */}
                      <TableCell 
                        className="text-sm font-mono cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/30"
                        onClick={(e) => copyText(atd.codigo_reversa, 'Reversa', e)}
                        title="Clique para copiar"
                      >
                        {atd.codigo_reversa || '-'}
                      </TableCell>
                      {/* Coluna Status Pedido - copiável */}
                      <TableCell 
                        className="text-sm cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/30"
                        onClick={(e) => copyText(atd.status_pedido, 'Status', e)}
                        title="Clique para copiar"
                      >
                        {atd.status_pedido || '-'}
                      </TableCell>
                      {/* Coluna Status do Atendimento */}
                      <TableCell>
                        {atd.retornar_chamado && (
                          <Badge className="bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400 mr-1">
                            <RotateCcw className="h-3 w-3 mr-1" />
                            Retornar
                          </Badge>
                        )}
                        {atd.verificar_adneia && (
                          <Badge className="bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400 mr-1">
                            Verificar
                          </Badge>
                        )}
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
                      {/* Coluna Dias */}
                      <TableCell className={`text-sm ${atd.dias_aberto > 3 ? 'text-orange-600 font-medium' : ''}`}>
                        {atd.dias_aberto}
                      </TableCell>
                    </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={11} className="h-32 text-center text-muted-foreground">
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

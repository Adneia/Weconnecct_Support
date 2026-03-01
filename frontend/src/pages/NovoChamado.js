import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { toast } from 'sonner';
import { 
  Loader2, Search, Package, Truck, User, MapPin, 
  Phone, Mail, Calendar, ShoppingBag, Copy,
  FileText, Hash, Building, AlertCircle, CheckCircle,
  MessageSquare, RotateCcw, Warehouse
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const CATEGORIAS = [
  "Falha Produção",
  "Falha de Compras", 
  "Falha Transporte",
  "Produto com Avaria",
  "Divergência de Produto",
  "Arrependimento",
  "Dúvida",
  "Reclamação",
  "Assistência Técnica"
];

const ATENDENTES = ["Letícia Martelo", "Adnéia Campos"];

const NovoAtendimento = () => {
  const [loading, setLoading] = useState(false);
  const [searchingPedido, setSearchingPedido] = useState(false);
  const [pedidoNotFound, setPedidoNotFound] = useState(false);
  const [pedidoErp, setPedidoErp] = useState(null);
  const [pedidosList, setPedidosList] = useState([]);
  const [showPedidosDialog, setShowPedidosDialog] = useState(false);
  const [showTextoDialog, setShowTextoDialog] = useState(false);
  const [textoPadrao, setTextoPadrao] = useState('');
  const [codigoReversa, setCodigoReversa] = useState('');
  
  const [searchType, setSearchType] = useState('entrega'); // 'entrega', 'cpf' ou 'nome'
  const [searchValue, setSearchValue] = useState('');
  
  const [formData, setFormData] = useState({
    numero_pedido: '',
    solicitacao: '',
    parceiro: '',
    categoria: '',
    motivo: '',
    anotacoes: '',
    atendente: 'Letícia Martelo'
  });

  const navigate = useNavigate();
  const { getAuthHeader } = useAuth();

  // Busca automática com debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchValue.trim().length >= 3) {
        if (searchType === 'entrega') {
          searchByEntrega(searchValue.trim());
        } else if (searchType === 'cpf') {
          searchByCpf(searchValue.trim());
        } else if (searchType === 'nome') {
          searchByNome(searchValue.trim());
        }
      } else {
        setPedidoErp(null);
        setPedidosList([]);
        setPedidoNotFound(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchValue, searchType]);

  const searchByEntrega = async (entrega) => {
    setSearchingPedido(true);
    setPedidoErp(null);
    setPedidoNotFound(false);
    
    try {
      const response = await axios.get(
        `${API_URL}/api/pedidos-erp/${entrega}`,
        { headers: getAuthHeader() }
      );
      setPedidoErp(response.data);
      setFormData(prev => ({ 
        ...prev, 
        numero_pedido: response.data.numero_pedido,
        parceiro: response.data.canal_vendas || ''
      }));
      setPedidoNotFound(false);
    } catch (error) {
      if (error.response?.status === 404) {
        setPedidoNotFound(true);
      } else {
        toast.error('Erro ao buscar pedido');
      }
    } finally {
      setSearchingPedido(false);
    }
  };

  const searchByCpf = async (cpf) => {
    setSearchingPedido(true);
    setPedidoErp(null);
    setPedidosList([]);
    setPedidoNotFound(false);
    
    try {
      const response = await axios.get(
        `${API_URL}/api/pedidos-erp/buscar/cpf/${cpf}`,
        { headers: getAuthHeader() }
      );
      
      if (response.data.length === 0) {
        setPedidoNotFound(true);
      } else if (response.data.length === 1) {
        setPedidoErp(response.data[0]);
        setFormData(prev => ({ 
          ...prev, 
          numero_pedido: response.data[0].numero_pedido,
          parceiro: response.data[0].canal_vendas || ''
        }));
      } else {
        setPedidosList(response.data);
        setShowPedidosDialog(true);
      }
    } catch (error) {
      toast.error('Erro ao buscar por CPF');
    } finally {
      setSearchingPedido(false);
    }
  };

  const selectPedido = (pedido) => {
    setPedidoErp(pedido);
    setFormData(prev => ({ 
      ...prev, 
      numero_pedido: pedido.numero_pedido,
      parceiro: pedido.canal_vendas || ''
    }));
    setShowPedidosDialog(false);
  };

  const loadTextoPadrao = async (categoria) => {
    try {
      const response = await axios.get(
        `${API_URL}/api/textos-padroes/${encodeURIComponent(categoria)}`,
        { headers: getAuthHeader() }
      );
      setTextoPadrao(response.data.texto);
      setShowTextoDialog(true);
    } catch (error) {
      toast.error('Erro ao carregar texto padrão');
    }
  };

  const gerarCodigoReversa = async () => {
    if (!formData.numero_pedido) {
      toast.error('Selecione um pedido primeiro');
      return;
    }
    
    try {
      const response = await axios.post(
        `${API_URL}/api/gerar-reversa/${formData.numero_pedido}`,
        {},
        { headers: getAuthHeader() }
      );
      setCodigoReversa(response.data.codigo_reversa);
      toast.success(`Código gerado: ${response.data.codigo_reversa}`);
    } catch (error) {
      toast.error('Erro ao gerar código de reversa');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado para a área de transferência!');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.numero_pedido.trim()) {
      toast.error('Busque e selecione um pedido');
      return;
    }
    if (!formData.categoria) {
      toast.error('Selecione a categoria');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        reversa_codigo: codigoReversa || null
      };
      
      const response = await axios.post(
        `${API_URL}/api/chamados`,
        payload,
        { headers: getAuthHeader() }
      );
      
      toast.success(
        <div className="flex flex-col gap-1">
          <span className="font-semibold">{response.data.id_atendimento} criado com sucesso!</span>
          <span className="text-xs opacity-80">Sincronizando com Google Sheets...</span>
        </div>
      );
      navigate(`/chamados/${response.data.id}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao criar atendimento');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const getStatusBadgeColor = (status) => {
    if (!status) return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
    const statusLower = status.toLowerCase();
    if (statusLower.includes('entreg')) return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400';
    if (statusLower.includes('trânsito') || statusLower.includes('transito')) return 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400';
    if (statusLower.includes('aguardando') || statusLower.includes('pendente')) return 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400';
    return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6" data-testid="novo-atendimento-page">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-['Plus_Jakarta_Sans']">Novo Atendimento</h1>
        <p className="text-muted-foreground text-sm">Registre um novo atendimento no sistema Emergent</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Buscar Pedido */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Search className="h-5 w-5" />
              1. Buscar Pedido
            </CardTitle>
            <CardDescription>Busque por número de Entrega ou CPF do cliente</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Select value={searchType} onValueChange={setSearchType}>
                <SelectTrigger className="w-40" data-testid="select-search-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrega">Entrega</SelectItem>
                  <SelectItem value="cpf">CPF</SelectItem>
                </SelectContent>
              </Select>
              
              <div className="flex-1 relative">
                <Input
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  placeholder={searchType === 'entrega' ? 'Digite o número da Entrega' : 'Digite o CPF do cliente'}
                  className="text-lg h-12 pr-12"
                  data-testid="input-search"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {searchingPedido && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
                  {!searchingPedido && pedidoErp && <CheckCircle className="h-5 w-5 text-emerald-500" />}
                  {!searchingPedido && pedidoNotFound && <AlertCircle className="h-5 w-5 text-amber-500" />}
                </div>
              </div>
            </div>
            
            {pedidoNotFound && (
              <p className="text-sm text-amber-600">
                Nenhum pedido encontrado. Verifique o número e tente novamente.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Dados do Pedido */}
        {pedidoErp && (
          <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/20" data-testid="pedido-info">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="h-5 w-5 text-emerald-600" />
                  Pedido #{pedidoErp.numero_pedido}
                </CardTitle>
                <Badge className={getStatusBadgeColor(pedidoErp.status_pedido)}>
                  {pedidoErp.status_pedido || 'Sem status'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Cliente */}
                <div className="space-y-2">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <User className="h-4 w-4" /> Cliente
                  </h4>
                  <div className="pl-6 space-y-1 text-sm">
                    <p className="font-medium">{pedidoErp.nome_cliente || '-'}</p>
                    {pedidoErp.cpf_cliente && <p className="text-muted-foreground">CPF: {pedidoErp.cpf_cliente}</p>}
                    {pedidoErp.email_cliente && (
                      <p className="text-muted-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3" /> {pedidoErp.email_cliente}
                      </p>
                    )}
                    {pedidoErp.fone_cliente && (
                      <p className="text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {pedidoErp.fone_cliente}
                      </p>
                    )}
                  </div>
                </div>

                {/* Endereço */}
                <div className="space-y-2">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <MapPin className="h-4 w-4" /> Endereço
                  </h4>
                  <div className="pl-6 space-y-1 text-sm">
                    {pedidoErp.cidade && pedidoErp.uf ? (
                      <p className="font-medium">{pedidoErp.cidade} - {pedidoErp.uf}</p>
                    ) : (
                      <p className="text-muted-foreground">-</p>
                    )}
                    {pedidoErp.cep && <p className="text-muted-foreground">CEP: {pedidoErp.cep}</p>}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Produto */}
                <div className="space-y-2">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4" /> Produto
                  </h4>
                  <div className="pl-6 space-y-1 text-sm">
                    <p className="font-medium">{pedidoErp.produto || '-'}</p>
                    {pedidoErp.departamento && <p className="text-muted-foreground">Marca: {pedidoErp.departamento}</p>}
                    {pedidoErp.quantidade && <p className="text-muted-foreground">Qtde: {pedidoErp.quantidade}</p>}
                    {pedidoErp.preco_final && (
                      <p className="text-muted-foreground">
                        Valor: R$ {parseFloat(pedidoErp.preco_final).toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Entrega */}
                <div className="space-y-2">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <Truck className="h-4 w-4" /> Entrega
                  </h4>
                  <div className="pl-6 space-y-1 text-sm">
                    <p className="font-medium">{pedidoErp.transportadora || '-'}</p>
                    {pedidoErp.canal_vendas && <p className="text-muted-foreground">Canal: {pedidoErp.canal_vendas}</p>}
                    {pedidoErp.data_status && <p className="text-muted-foreground">Atualização: {pedidoErp.data_status}</p>}
                  </div>
                </div>
              </div>

              {pedidoErp.nota_fiscal && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <FileText className="h-4 w-4" /> Nota Fiscal
                    </h4>
                    <div className="pl-6 space-y-1 text-sm">
                      <p><span className="text-muted-foreground">NF:</span> {pedidoErp.nota_fiscal}</p>
                      {pedidoErp.chave_nota && (
                        <p className="text-xs text-muted-foreground break-all">Chave: {pedidoErp.chave_nota}</p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Classificação */}
        {pedidoErp && (
          <>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  2. Classificação
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <Label>Solicitação (Parceiro)</Label>
                    <Input
                      value={formData.solicitacao}
                      onChange={(e) => handleChange('solicitacao', e.target.value)}
                      placeholder="Nº da solicitação"
                      data-testid="input-solicitacao"
                    />
                  </div>

                  <div>
                    <Label>Parceiro/Canal</Label>
                    <Input
                      value={formData.parceiro}
                      onChange={(e) => handleChange('parceiro', e.target.value)}
                      placeholder="Ex: CSU, Livelo"
                      data-testid="input-parceiro"
                    />
                  </div>

                  <div>
                    <Label>Atendente</Label>
                    <Select value={formData.atendente} onValueChange={(v) => handleChange('atendente', v)}>
                      <SelectTrigger data-testid="select-atendente">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ATENDENTES.map(a => (
                          <SelectItem key={a} value={a}>{a}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="sm:col-span-2 lg:col-span-3">
                    <Label>Categoria *</Label>
                    <Select value={formData.categoria} onValueChange={(v) => handleChange('categoria', v)}>
                      <SelectTrigger data-testid="select-categoria">
                        <SelectValue placeholder="Selecione a categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIAS.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="sm:col-span-2 lg:col-span-3">
                    <Label>Motivo</Label>
                    <Input
                      value={formData.motivo}
                      onChange={(e) => handleChange('motivo', e.target.value)}
                      placeholder="Motivo específico do atendimento"
                      data-testid="input-motivo"
                    />
                  </div>
                </div>

                {/* Ações rápidas */}
                {formData.categoria && (
                  <div className="flex gap-2 pt-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={() => loadTextoPadrao(formData.categoria)}
                      data-testid="btn-texto-padrao"
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Ver Texto Padrão
                    </Button>
                    
                    {formData.categoria === 'Arrependimento' && (
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        onClick={gerarCodigoReversa}
                        data-testid="btn-gerar-reversa"
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Gerar Código Reversa
                      </Button>
                    )}
                  </div>
                )}

                {codigoReversa && (
                  <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-blue-700 dark:text-blue-400">Código de Reversa Gerado</p>
                        <p className="font-mono text-lg">{codigoReversa}</p>
                      </div>
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm"
                        onClick={() => copyToClipboard(codigoReversa)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Anotações */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">3. Anotações</CardTitle>
                <CardDescription>Registre o histórico e observações do atendimento</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={formData.anotacoes}
                  onChange={(e) => handleChange('anotacoes', e.target.value)}
                  placeholder="Descreva o histórico do atendimento..."
                  rows={5}
                  data-testid="textarea-anotacoes"
                />
              </CardContent>
            </Card>

            {/* Ações */}
            <div className="flex justify-end gap-3 pb-6">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => navigate('/chamados')}
                data-testid="btn-cancelar"
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading} size="lg" data-testid="btn-criar">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Criando...
                  </>
                ) : (
                  'Criar Atendimento'
                )}
              </Button>
            </div>
          </>
        )}
      </form>

      {/* Dialog: Lista de Pedidos (quando CPF retorna múltiplos) */}
      <Dialog open={showPedidosDialog} onOpenChange={setShowPedidosDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Selecione o Pedido</DialogTitle>
            <DialogDescription>
              Foram encontrados {pedidosList.length} pedidos para este CPF
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto space-y-2">
            {pedidosList.map(pedido => (
              <div 
                key={pedido.numero_pedido}
                className="p-3 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                onClick={() => selectPedido(pedido)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Entrega #{pedido.numero_pedido}</p>
                    <p className="text-sm text-muted-foreground">{pedido.produto}</p>
                    <p className="text-xs text-muted-foreground">{pedido.data_status}</p>
                  </div>
                  <Badge className={getStatusBadgeColor(pedido.status_pedido)}>
                    {pedido.status_pedido}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Texto Padrão */}
      <Dialog open={showTextoDialog} onOpenChange={setShowTextoDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Texto Padrão - {formData.categoria}</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Textarea
              value={textoPadrao}
              readOnly
              rows={12}
              className="font-mono text-sm"
            />
            <Button 
              variant="outline" 
              size="sm"
              className="absolute top-2 right-2"
              onClick={() => copyToClipboard(textoPadrao)}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copiar
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTextoDialog(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NovoAtendimento;

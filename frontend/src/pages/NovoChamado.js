import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Switch } from '../components/ui/switch';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { toast } from 'sonner';
import { 
  Loader2, Search, Package, Truck, User, MapPin, 
  Phone, Mail, Calendar, CreditCard, ShoppingBag, 
  FileText, Hash, Building, AlertCircle, CheckCircle
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const CANAIS = ['Email', 'WhatsApp', 'Conecta-lá', 'Bravium', 'Zendesk'];
const CATEGORIAS = ['Acompanhamento', 'Falha de Compras', 'Falha de Produção', 'Falha de Transporte', 'Reversa', 'Outro'];
const PRIORIDADES = ['Baixa', 'Media', 'Alta', 'Urgente'];
const STATUS_CHAMADO = [
  'Ag. Compras', 'Ag logística', 'Aguardando', 'Em devolução', 
  'Enviado', 'Entregue', 'Estornado', 'Atendido', 
  'Aguardando transportadora', 'Ag devolução', 'Aguardando Parceiro'
];

const NovoChamado = () => {
  const [loading, setLoading] = useState(false);
  const [searchingPedido, setSearchingPedido] = useState(false);
  const [pedidoNotFound, setPedidoNotFound] = useState(false);
  const [users, setUsers] = useState([]);
  const [pedidoErp, setPedidoErp] = useState(null);
  
  const [formData, setFormData] = useState({
    numero_pedido: '',
    canal_origem: '',
    categoria: '',
    sintese_problema: '',
    prioridade: 'Media',
    status_chamado: 'Aguardando',
    responsavel_id: '',
    responsavel_nome: '',
    precisa_reversa: false,
    reversa_codigo: '',
    reversa_validade: '',
    id_externo: ''
  });

  const navigate = useNavigate();
  const { getAuthHeader } = useAuth();

  useEffect(() => {
    fetchUsers();
  }, []);

  // Debounced search for pedido
  useEffect(() => {
    const timer = setTimeout(() => {
      if (formData.numero_pedido.trim().length >= 3) {
        searchPedido(formData.numero_pedido.trim());
      } else {
        setPedidoErp(null);
        setPedidoNotFound(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [formData.numero_pedido]);

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/users`, { headers: getAuthHeader() });
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const searchPedido = async (numeroPedido) => {
    setSearchingPedido(true);
    setPedidoErp(null);
    setPedidoNotFound(false);
    
    try {
      const response = await axios.get(
        `${API_URL}/api/pedidos-erp/${numeroPedido}`,
        { headers: getAuthHeader() }
      );
      setPedidoErp(response.data);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.numero_pedido.trim()) {
      toast.error('Número do pedido é obrigatório');
      return;
    }
    if (!formData.canal_origem) {
      toast.error('Selecione o canal de origem');
      return;
    }
    if (!formData.categoria) {
      toast.error('Selecione a categoria');
      return;
    }
    if (!formData.sintese_problema.trim()) {
      toast.error('Descreva o problema');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        responsavel_nome: formData.responsavel_id 
          ? users.find(u => u.id === formData.responsavel_id)?.name || ''
          : ''
      };
      
      const response = await axios.post(
        `${API_URL}/api/chamados`,
        payload,
        { headers: getAuthHeader() }
      );
      
      toast.success('Chamado criado com sucesso!');
      navigate(`/chamados/${response.data.id}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao criar chamado');
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
    if (statusLower.includes('trânsito') || statusLower.includes('transito') || statusLower.includes('enviado')) return 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400';
    if (statusLower.includes('aguardando') || statusLower.includes('pendente')) return 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400';
    if (statusLower.includes('cancel') || statusLower.includes('devol')) return 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400';
    return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6" data-testid="novo-chamado-page">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-['Plus_Jakarta_Sans']">Novo Chamado</h1>
        <p className="text-muted-foreground text-sm">Registre um novo chamado de atendimento</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Buscar Pedido */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Hash className="h-5 w-5" />
              1. Identificar o Pedido
            </CardTitle>
            <CardDescription>Digite o número do pedido para carregar as informações automaticamente</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  id="numero_pedido"
                  value={formData.numero_pedido}
                  onChange={(e) => handleChange('numero_pedido', e.target.value)}
                  placeholder="Digite o número do pedido (ex: 761005)"
                  className="text-lg h-12"
                  data-testid="input-numero-pedido"
                />
              </div>
              <div className="flex items-center">
                {searchingPedido && (
                  <div className="h-12 w-12 flex items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                )}
                {!searchingPedido && pedidoErp && (
                  <div className="h-12 w-12 flex items-center justify-center">
                    <CheckCircle className="h-5 w-5 text-emerald-500" />
                  </div>
                )}
                {!searchingPedido && pedidoNotFound && (
                  <div className="h-12 w-12 flex items-center justify-center">
                    <AlertCircle className="h-5 w-5 text-amber-500" />
                  </div>
                )}
              </div>
            </div>
            
            {pedidoNotFound && (
              <p className="text-sm text-amber-600 mt-2">
                Pedido não encontrado no ERP. Você pode continuar criando o chamado manualmente.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Dados do Pedido - Exibidos quando encontrado */}
        {pedidoErp && (
          <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/20" data-testid="pedido-erp-info">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="h-5 w-5 text-emerald-600" />
                  Dados do Pedido #{pedidoErp.numero_pedido}
                </CardTitle>
                <Badge className={getStatusBadgeColor(pedidoErp.status_pedido)}>
                  {pedidoErp.status_pedido || 'Sem status'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Cliente */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <User className="h-4 w-4" /> Cliente
                  </h4>
                  <div className="pl-6 space-y-1 text-sm">
                    <p className="font-medium">{pedidoErp.nome_cliente || '-'}</p>
                    {pedidoErp.cpf_cliente && (
                      <p className="text-muted-foreground">CPF: {pedidoErp.cpf_cliente}</p>
                    )}
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

                <div className="space-y-3">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <MapPin className="h-4 w-4" /> Endereço de Entrega
                  </h4>
                  <div className="pl-6 space-y-1 text-sm">
                    {pedidoErp.cidade && pedidoErp.uf ? (
                      <p className="font-medium">{pedidoErp.cidade} - {pedidoErp.uf}</p>
                    ) : (
                      <p className="text-muted-foreground">-</p>
                    )}
                    {pedidoErp.cep && (
                      <p className="text-muted-foreground">CEP: {pedidoErp.cep}</p>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Produto e Pedido */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4" /> Produto
                  </h4>
                  <div className="pl-6 space-y-1 text-sm">
                    <p className="font-medium">{pedidoErp.produto || '-'}</p>
                    {pedidoErp.codigo_produto && (
                      <p className="text-muted-foreground">Código: {pedidoErp.codigo_produto}</p>
                    )}
                    {pedidoErp.quantidade && (
                      <p className="text-muted-foreground">Quantidade: {pedidoErp.quantidade}</p>
                    )}
                    {pedidoErp.preco_final && (
                      <p className="text-muted-foreground">
                        Valor: R$ {parseFloat(pedidoErp.preco_final).toFixed(2)}
                        {pedidoErp.frete && ` + R$ ${parseFloat(pedidoErp.frete).toFixed(2)} frete`}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <Calendar className="h-4 w-4" /> Informações do Pedido
                  </h4>
                  <div className="pl-6 space-y-1 text-sm">
                    {pedidoErp.data_emissao && (
                      <p><span className="text-muted-foreground">Emissão:</span> {pedidoErp.data_emissao}</p>
                    )}
                    {pedidoErp.data_status && (
                      <p><span className="text-muted-foreground">Última atualização:</span> {pedidoErp.data_status}</p>
                    )}
                    {pedidoErp.situacao && (
                      <p><span className="text-muted-foreground">Situação:</span> {pedidoErp.situacao}</p>
                    )}
                    {pedidoErp.canal_vendas && (
                      <p><span className="text-muted-foreground">Canal:</span> {pedidoErp.canal_vendas}</p>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Entrega */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <Truck className="h-4 w-4" /> Entrega
                  </h4>
                  <div className="pl-6 space-y-1 text-sm">
                    <p className="font-medium">{pedidoErp.transportadora || '-'}</p>
                    {pedidoErp.codigo_rastreio && (
                      <p className="text-muted-foreground">Rastreio: <span className="font-mono">{pedidoErp.codigo_rastreio}</span></p>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4" /> Nota Fiscal
                  </h4>
                  <div className="pl-6 space-y-1 text-sm">
                    {pedidoErp.nota_fiscal && (
                      <p><span className="text-muted-foreground">NF:</span> {pedidoErp.nota_fiscal}</p>
                    )}
                    {pedidoErp.chave_nota && (
                      <p className="text-muted-foreground text-xs break-all">
                        Chave: {pedidoErp.chave_nota}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Classificação - só aparece se pedido foi buscado ou digitou algo */}
        {(pedidoErp || pedidoNotFound || formData.numero_pedido.length >= 3) && (
          <>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  2. Classificação do Chamado
                </CardTitle>
                <CardDescription>Categorize o chamado para direcionamento correto</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <Label>Canal de Origem *</Label>
                    <Select value={formData.canal_origem} onValueChange={(v) => handleChange('canal_origem', v)}>
                      <SelectTrigger data-testid="select-canal">
                        <SelectValue placeholder="Selecione o canal" />
                      </SelectTrigger>
                      <SelectContent>
                        {CANAIS.map(canal => (
                          <SelectItem key={canal} value={canal}>{canal}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
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

                  <div>
                    <Label>Prioridade</Label>
                    <Select value={formData.prioridade} onValueChange={(v) => handleChange('prioridade', v)}>
                      <SelectTrigger data-testid="select-prioridade">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORIDADES.map(prio => (
                          <SelectItem key={prio} value={prio}>{prio}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Status do Chamado</Label>
                    <Select value={formData.status_chamado} onValueChange={(v) => handleChange('status_chamado', v)}>
                      <SelectTrigger data-testid="select-status-chamado">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_CHAMADO.map(status => (
                          <SelectItem key={status} value={status}>{status}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Responsável</Label>
                    <Select value={formData.responsavel_id || "none"} onValueChange={(v) => handleChange('responsavel_id', v === "none" ? "" : v)}>
                      <SelectTrigger data-testid="select-responsavel">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem responsável</SelectItem>
                        {users.map(user => (
                          <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>ID Externo</Label>
                    <Input
                      value={formData.id_externo}
                      onChange={(e) => handleChange('id_externo', e.target.value)}
                      placeholder="ID do ticket de origem"
                      data-testid="input-id-externo"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Step 3: Descrição */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">3. Descrição do Problema</CardTitle>
                <CardDescription>Descreva detalhadamente o problema relatado pelo cliente</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={formData.sintese_problema}
                  onChange={(e) => handleChange('sintese_problema', e.target.value)}
                  placeholder="Ex: Cliente relata que o produto chegou com defeito na embalagem..."
                  rows={4}
                  data-testid="textarea-sintese"
                />
              </CardContent>
            </Card>

            {/* Step 4: Reversa */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  4. Reversa (Devolução)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="precisa_reversa">Precisa de reversa?</Label>
                    <p className="text-sm text-muted-foreground">Marque se o cliente precisa devolver o produto</p>
                  </div>
                  <Switch
                    id="precisa_reversa"
                    checked={formData.precisa_reversa}
                    onCheckedChange={(v) => handleChange('precisa_reversa', v)}
                    data-testid="switch-reversa"
                  />
                </div>

                {formData.precisa_reversa && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t">
                    <div>
                      <Label htmlFor="reversa_codigo">Código da Reversa</Label>
                      <Input
                        id="reversa_codigo"
                        value={formData.reversa_codigo}
                        onChange={(e) => handleChange('reversa_codigo', e.target.value)}
                        placeholder="Código de autorização"
                        data-testid="input-reversa-codigo"
                      />
                    </div>
                    <div>
                      <Label htmlFor="reversa_validade">Validade da Reversa</Label>
                      <Input
                        id="reversa_validade"
                        value={formData.reversa_validade}
                        onChange={(e) => handleChange('reversa_validade', e.target.value)}
                        placeholder="Ex: 30 dias"
                        data-testid="input-reversa-validade"
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex justify-end gap-3 pb-6">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => navigate('/chamados')}
                data-testid="btn-cancelar"
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading} size="lg" data-testid="btn-salvar">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Criar Chamado'
                )}
              </Button>
            </div>
          </>
        )}
      </form>
    </div>
  );
};

export default NovoChamado;

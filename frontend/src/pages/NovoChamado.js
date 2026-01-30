import { useState, useEffect } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { toast } from 'sonner';
import { Loader2, Search, Package, FileText, Truck, AlertCircle } from 'lucide-react';

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

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/users`, { headers: getAuthHeader() });
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const searchPedido = async () => {
    if (!formData.numero_pedido.trim()) return;
    
    setSearchingPedido(true);
    setPedidoErp(null);
    
    try {
      const response = await axios.get(
        `${API_URL}/api/pedidos-erp/${formData.numero_pedido}`,
        { headers: getAuthHeader() }
      );
      setPedidoErp(response.data);
    } catch (error) {
      if (error.response?.status !== 404) {
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

  return (
    <div className="max-w-3xl mx-auto space-y-6" data-testid="novo-chamado-page">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-['Plus_Jakarta_Sans']">Novo Chamado</h1>
        <p className="text-muted-foreground text-sm">Registre um novo chamado de atendimento</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Pedido Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Informações do Pedido</CardTitle>
            <CardDescription>Vincule o chamado ao número do pedido</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="numero_pedido">Número do Pedido *</Label>
                <Input
                  id="numero_pedido"
                  value={formData.numero_pedido}
                  onChange={(e) => handleChange('numero_pedido', e.target.value)}
                  placeholder="Ex: 12345"
                  data-testid="input-numero-pedido"
                />
              </div>
              <div className="flex items-end">
                <Button 
                  type="button" 
                  variant="secondary"
                  onClick={searchPedido}
                  disabled={searchingPedido || !formData.numero_pedido.trim()}
                  data-testid="btn-buscar-pedido"
                >
                  {searchingPedido ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {pedidoErp && (
              <div className="p-4 rounded-lg bg-muted/50 border space-y-3" data-testid="pedido-erp-info">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Package className="h-4 w-4" />
                  Dados do ERP
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Status:</span>
                    <span className="ml-2 font-medium">{pedidoErp.status_pedido || '-'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Nota Fiscal:</span>
                    <span className="ml-2 font-medium">{pedidoErp.nota_fiscal || '-'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Rastreio:</span>
                    <span className="ml-2 font-medium">{pedidoErp.codigo_rastreio || '-'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Transportadora:</span>
                    <span className="ml-2 font-medium">{pedidoErp.transportadora || '-'}</span>
                  </div>
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="id_externo">ID Externo (opcional)</Label>
              <Input
                id="id_externo"
                value={formData.id_externo}
                onChange={(e) => handleChange('id_externo', e.target.value)}
                placeholder="ID do ticket no sistema de origem"
                data-testid="input-id-externo"
              />
            </div>
          </CardContent>
        </Card>

        {/* Classificação */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Classificação</CardTitle>
            <CardDescription>Categorize o chamado</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    <SelectValue placeholder="Selecione a prioridade" />
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
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_CHAMADO.map(status => (
                      <SelectItem key={status} value={status}>{status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:col-span-2">
                <Label>Responsável</Label>
                <Select value={formData.responsavel_id || "none"} onValueChange={(v) => handleChange('responsavel_id', v === "none" ? "" : v)}>
                  <SelectTrigger data-testid="select-responsavel">
                    <SelectValue placeholder="Selecione o responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem responsável</SelectItem>
                    {users.map(user => (
                      <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Descrição */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Descrição do Problema</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={formData.sintese_problema}
              onChange={(e) => handleChange('sintese_problema', e.target.value)}
              placeholder="Descreva detalhadamente o problema relatado pelo cliente..."
              rows={5}
              data-testid="textarea-sintese"
            />
          </CardContent>
        </Card>

        {/* Reversa */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Reversa (Devolução)
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
        <div className="flex justify-end gap-3">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => navigate('/chamados')}
            data-testid="btn-cancelar"
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={loading} data-testid="btn-salvar">
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
      </form>
    </div>
  );
};

export default NovoChamado;

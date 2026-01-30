import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Skeleton } from '../components/ui/skeleton';
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
  DialogTrigger,
} from '../components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../components/ui/alert-dialog';
import { toast } from 'sonner';
import { 
  Loader2, ArrowLeft, Save, CheckCircle, Trash2, Plus,
  Package, FileText, Truck, Clock, User, MessageSquare, AlertCircle
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
const STATUS_ATENDIMENTO = ['Aberto', 'Fechado'];
const TIPOS_ACAO = ['Atualização de Status', 'Contato com Cliente', 'Nota Interna', 'Escalação'];

const DetalhesChamado = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getAuthHeader } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [chamado, setChamado] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [users, setUsers] = useState([]);
  const [novaAcao, setNovaAcao] = useState({ tipo_acao: '', descricao: '' });
  const [showNovaAcaoDialog, setShowNovaAcaoDialog] = useState(false);
  const [showReversaDialog, setShowReversaDialog] = useState(false);
  const [novaReversa, setNovaReversa] = useState({ codigo_rastreio: '', observacoes: '' });

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const [chamadoRes, historicoRes, usersRes] = await Promise.all([
        axios.get(`${API_URL}/api/chamados/${id}`, { headers: getAuthHeader() }),
        axios.get(`${API_URL}/api/historico/${id}`, { headers: getAuthHeader() }),
        axios.get(`${API_URL}/api/users`, { headers: getAuthHeader() })
      ]);
      setChamado(chamadoRes.data);
      setHistorico(historicoRes.data);
      setUsers(usersRes.data);
    } catch (error) {
      toast.error('Erro ao carregar chamado');
      navigate('/chamados');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        numero_pedido: chamado.numero_pedido,
        canal_origem: chamado.canal_origem,
        categoria: chamado.categoria,
        sintese_problema: chamado.sintese_problema,
        status_atendimento: chamado.status_atendimento,
        status_chamado: chamado.status_chamado,
        responsavel_id: chamado.responsavel_id || null,
        responsavel_nome: chamado.responsavel_id 
          ? users.find(u => u.id === chamado.responsavel_id)?.name || ''
          : '',
        prioridade: chamado.prioridade,
        precisa_reversa: chamado.precisa_reversa,
        reversa_codigo: chamado.reversa_codigo,
        reversa_validade: chamado.reversa_validade,
        id_externo: chamado.id_externo
      };
      
      await axios.put(`${API_URL}/api/chamados/${id}`, payload, { headers: getAuthHeader() });
      toast.success('Chamado atualizado com sucesso!');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`${API_URL}/api/chamados/${id}`, { headers: getAuthHeader() });
      toast.success('Chamado excluído');
      navigate('/chamados');
    } catch (error) {
      toast.error('Erro ao excluir chamado');
    }
  };

  const handleResolve = async () => {
    setSaving(true);
    try {
      await axios.put(
        `${API_URL}/api/chamados/${id}`,
        { status_atendimento: 'Fechado', status_chamado: 'Atendido' },
        { headers: getAuthHeader() }
      );
      toast.success('Chamado marcado como resolvido!');
      fetchData();
    } catch (error) {
      toast.error('Erro ao resolver chamado');
    } finally {
      setSaving(false);
    }
  };

  const handleAddHistorico = async () => {
    if (!novaAcao.tipo_acao || !novaAcao.descricao.trim()) {
      toast.error('Preencha todos os campos');
      return;
    }
    
    try {
      await axios.post(
        `${API_URL}/api/historico`,
        { chamado_id: id, ...novaAcao },
        { headers: getAuthHeader() }
      );
      toast.success('Histórico adicionado!');
      setNovaAcao({ tipo_acao: '', descricao: '' });
      setShowNovaAcaoDialog(false);
      fetchData();
    } catch (error) {
      toast.error('Erro ao adicionar histórico');
    }
  };

  const handleCreateReversa = async () => {
    try {
      await axios.post(
        `${API_URL}/api/reversas`,
        { chamado_id: id, ...novaReversa },
        { headers: getAuthHeader() }
      );
      toast.success('Reversa criada!');
      setNovaReversa({ codigo_rastreio: '', observacoes: '' });
      setShowReversaDialog(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao criar reversa');
    }
  };

  const handleChange = (field, value) => {
    setChamado(prev => ({ ...prev, [field]: value }));
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

  if (loading) {
    return (
      <div className="space-y-6" data-testid="detalhes-chamado-loading">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card><CardContent className="p-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
          </div>
          <Card><CardContent className="p-6"><Skeleton className="h-96 w-full" /></CardContent></Card>
        </div>
      </div>
    );
  }

  if (!chamado) {
    return <div>Chamado não encontrado</div>;
  }

  return (
    <div className="space-y-6" data-testid="detalhes-chamado-page">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/chamados')} data-testid="btn-voltar">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight font-['Plus_Jakarta_Sans']">
                Pedido #{chamado.numero_pedido}
              </h1>
              <Badge className={getStatusBadge(chamado.status_atendimento)}>
                {chamado.status_atendimento}
              </Badge>
              <Badge className={getPriorityBadge(chamado.prioridade)}>
                {chamado.prioridade}
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm">
              Aberto em {new Date(chamado.data_abertura).toLocaleDateString('pt-BR')} • {chamado.dias_aberto} dias
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {chamado.status_atendimento === 'Aberto' && (
            <Button variant="outline" onClick={handleResolve} disabled={saving} data-testid="btn-resolver">
              <CheckCircle className="h-4 w-4 mr-2" />
              Marcar Resolvido
            </Button>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="icon" data-testid="btn-excluir">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir chamado?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. O chamado e todo seu histórico serão removidos permanentemente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} data-testid="btn-confirmar-excluir">
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Dados do Chamado */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Dados do Chamado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Número do Pedido</Label>
                  <Input
                    value={chamado.numero_pedido}
                    onChange={(e) => handleChange('numero_pedido', e.target.value)}
                    data-testid="input-numero-pedido"
                  />
                </div>
                <div>
                  <Label>ID Externo</Label>
                  <Input
                    value={chamado.id_externo || ''}
                    onChange={(e) => handleChange('id_externo', e.target.value)}
                    placeholder="ID no sistema de origem"
                    data-testid="input-id-externo"
                  />
                </div>
                <div>
                  <Label>Canal de Origem</Label>
                  <Select value={chamado.canal_origem} onValueChange={(v) => handleChange('canal_origem', v)}>
                    <SelectTrigger data-testid="select-canal">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CANAIS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Categoria</Label>
                  <Select value={chamado.categoria} onValueChange={(v) => handleChange('categoria', v)}>
                    <SelectTrigger data-testid="select-categoria">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Prioridade</Label>
                  <Select value={chamado.prioridade} onValueChange={(v) => handleChange('prioridade', v)}>
                    <SelectTrigger data-testid="select-prioridade">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORIDADES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status do Atendimento</Label>
                  <Select value={chamado.status_atendimento} onValueChange={(v) => handleChange('status_atendimento', v)}>
                    <SelectTrigger data-testid="select-status-atendimento">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_ATENDIMENTO.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status do Chamado</Label>
                  <Select value={chamado.status_chamado} onValueChange={(v) => handleChange('status_chamado', v)}>
                    <SelectTrigger data-testid="select-status-chamado">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_CHAMADO.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Responsável</Label>
                  <Select value={chamado.responsavel_id || "none"} onValueChange={(v) => handleChange('responsavel_id', v === "none" ? "" : v)}>
                    <SelectTrigger data-testid="select-responsavel">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem responsável</SelectItem>
                      {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Síntese do Problema</Label>
                <Textarea
                  value={chamado.sintese_problema}
                  onChange={(e) => handleChange('sintese_problema', e.target.value)}
                  rows={4}
                  data-testid="textarea-sintese"
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving} data-testid="btn-salvar">
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Salvar Alterações
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Dados do Pedido ERP */}
          {chamado.pedido_erp && (
            <Card data-testid="card-pedido-erp">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Dados do ERP
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Status:</span>
                    <p className="font-medium">{chamado.pedido_erp.status_pedido || '-'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Data Status:</span>
                    <p className="font-medium">{chamado.pedido_erp.data_status || '-'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Cliente:</span>
                    <p className="font-medium">{chamado.pedido_erp.nome_cliente || '-'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Cidade/UF:</span>
                    <p className="font-medium">{chamado.pedido_erp.cidade || ''} {chamado.pedido_erp.uf ? `- ${chamado.pedido_erp.uf}` : ''}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Transportadora:</span>
                    <p className="font-medium">{chamado.pedido_erp.transportadora || '-'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Rastreio:</span>
                    <p className="font-medium">{chamado.pedido_erp.codigo_rastreio || '-'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Nota Fiscal:</span>
                    <p className="font-medium">{chamado.pedido_erp.nota_fiscal || '-'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Canal:</span>
                    <p className="font-medium">{chamado.pedido_erp.canal_vendas || '-'}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Produto:</span>
                    <p className="font-medium">{chamado.pedido_erp.produto || '-'}</p>
                  </div>
                  {chamado.pedido_erp.chave_nota && (
                    <div className="col-span-2 lg:col-span-4">
                      <span className="text-muted-foreground">Chave NF:</span>
                      <p className="font-medium text-xs break-all">{chamado.pedido_erp.chave_nota}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Reversa */}
          <Card data-testid="card-reversa">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Reversa (Devolução)
                </CardTitle>
                {!chamado.reversa && (
                  <Dialog open={showReversaDialog} onOpenChange={setShowReversaDialog}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" data-testid="btn-criar-reversa">
                        <Plus className="h-4 w-4 mr-2" />
                        Criar Reversa
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Criar Reversa</DialogTitle>
                        <DialogDescription>Crie uma reversa para este chamado</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>Código de Rastreio</Label>
                          <Input
                            value={novaReversa.codigo_rastreio}
                            onChange={(e) => setNovaReversa(prev => ({ ...prev, codigo_rastreio: e.target.value }))}
                            placeholder="Código dos Correios"
                            data-testid="input-reversa-rastreio"
                          />
                        </div>
                        <div>
                          <Label>Observações</Label>
                          <Textarea
                            value={novaReversa.observacoes}
                            onChange={(e) => setNovaReversa(prev => ({ ...prev, observacoes: e.target.value }))}
                            placeholder="Observações sobre a reversa..."
                            data-testid="textarea-reversa-obs"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowReversaDialog(false)}>Cancelar</Button>
                        <Button onClick={handleCreateReversa} data-testid="btn-salvar-reversa">Criar Reversa</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {chamado.reversa ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Código de Rastreio:</span>
                      <p className="font-medium">{chamado.reversa.codigo_rastreio || '-'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Status:</span>
                      <p className="font-medium">{chamado.reversa.status_reversa}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Criada em:</span>
                      <p className="font-medium">
                        {new Date(chamado.reversa.data_criacao).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Última Atualização:</span>
                      <p className="font-medium">
                        {new Date(chamado.reversa.ultima_atualizacao).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  {chamado.reversa.observacoes && (
                    <div>
                      <span className="text-muted-foreground text-sm">Observações:</span>
                      <p className="text-sm mt-1">{chamado.reversa.observacoes}</p>
                    </div>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => navigate('/reversas')}
                    data-testid="btn-ver-reversa"
                  >
                    Gerenciar Reversa
                  </Button>
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <Truck className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma reversa vinculada a este chamado</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Histórico */}
        <div className="space-y-6">
          <Card data-testid="card-historico">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Histórico</CardTitle>
                <Dialog open={showNovaAcaoDialog} onOpenChange={setShowNovaAcaoDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" data-testid="btn-add-historico">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Adicionar ao Histórico</DialogTitle>
                      <DialogDescription>Registre uma nova ação ou observação</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Tipo de Ação</Label>
                        <Select value={novaAcao.tipo_acao} onValueChange={(v) => setNovaAcao(prev => ({ ...prev, tipo_acao: v }))}>
                          <SelectTrigger data-testid="select-tipo-acao">
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                          <SelectContent>
                            {TIPOS_ACAO.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Descrição</Label>
                        <Textarea
                          value={novaAcao.descricao}
                          onChange={(e) => setNovaAcao(prev => ({ ...prev, descricao: e.target.value }))}
                          placeholder="Descreva a ação..."
                          data-testid="textarea-descricao-acao"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowNovaAcaoDialog(false)}>Cancelar</Button>
                      <Button onClick={handleAddHistorico} data-testid="btn-salvar-historico">Adicionar</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {historico.length > 0 ? (
                <div className="relative">
                  <div className="absolute left-3 top-0 bottom-0 w-px bg-border" />
                  <div className="space-y-4">
                    {historico.map((item, index) => (
                      <div key={item.id} className="relative pl-8" data-testid={`historico-item-${index}`}>
                        <div className="absolute left-0 top-1.5 w-6 h-6 rounded-full bg-background border-2 border-border flex items-center justify-center">
                          {item.tipo_acao === 'Contato com Cliente' ? (
                            <MessageSquare className="h-3 w-3 text-blue-500" />
                          ) : item.tipo_acao === 'Escalação' ? (
                            <AlertCircle className="h-3 w-3 text-orange-500" />
                          ) : (
                            <Clock className="h-3 w-3 text-muted-foreground" />
                          )}
                        </div>
                        <div className="bg-muted/30 rounded-lg p-3">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                            <span className="font-medium">{item.tipo_acao}</span>
                            <span>•</span>
                            <span>{new Date(item.data_hora).toLocaleString('pt-BR')}</span>
                          </div>
                          <p className="text-sm">{item.descricao}</p>
                          {item.usuario_nome && (
                            <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                              <User className="h-3 w-3" />
                              {item.usuario_nome}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <Clock className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>Nenhum histórico registrado</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Informações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Criado por</span>
                <span className="font-medium">{chamado.criado_por_nome || '-'}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Data de abertura</span>
                <span className="font-medium">{new Date(chamado.data_abertura).toLocaleDateString('pt-BR')}</span>
              </div>
              {chamado.data_resolucao && (
                <>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Data de resolução</span>
                    <span className="font-medium">{new Date(chamado.data_resolucao).toLocaleDateString('pt-BR')}</span>
                  </div>
                </>
              )}
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Dias em aberto</span>
                <span className="font-medium">{chamado.dias_aberto}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DetalhesChamado;

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
import { Skeleton } from '../components/ui/skeleton';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { toast } from 'sonner';
import { Truck, AlertTriangle, Clock, ExternalLink, Loader2 } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const STATUS_REVERSA = ['Aguardando Postagem', 'Em Trânsito', 'Entregue'];

const Reversas = () => {
  const [reversas, setReversas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReversa, setSelectedReversa] = useState(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    codigo_rastreio: '',
    status_reversa: '',
    observacoes: ''
  });

  const navigate = useNavigate();
  const { getAuthHeader } = useAuth();

  useEffect(() => {
    fetchReversas();
  }, []);

  const fetchReversas = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/reversas`, { headers: getAuthHeader() });
      setReversas(response.data);
    } catch (error) {
      toast.error('Erro ao carregar reversas');
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = (reversa) => {
    setSelectedReversa(reversa);
    setEditForm({
      codigo_rastreio: reversa.codigo_rastreio || '',
      status_reversa: reversa.status_reversa,
      observacoes: reversa.observacoes || ''
    });
    setShowEditDialog(true);
  };

  const handleSave = async () => {
    if (!selectedReversa) return;
    
    setSaving(true);
    try {
      await axios.put(
        `${API_URL}/api/reversas/${selectedReversa.id}`,
        editForm,
        { headers: getAuthHeader() }
      );
      toast.success('Reversa atualizada!');
      setShowEditDialog(false);
      fetchReversas();
    } catch (error) {
      toast.error('Erro ao atualizar reversa');
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      'Aguardando Postagem': 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400',
      'Em Trânsito': 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400',
      'Entregue': 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
    };
    return styles[status] || styles['Aguardando Postagem'];
  };

  // Calculate stats
  const stats = {
    total: reversas.length,
    aguardando: reversas.filter(r => r.status_reversa === 'Aguardando Postagem').length,
    emTransito: reversas.filter(r => r.status_reversa === 'Em Trânsito').length,
    entregue: reversas.filter(r => r.status_reversa === 'Entregue').length,
    semAtualizacao: reversas.filter(r => r.dias_sem_atualizacao > 7).length
  };

  // Calculate average time
  const temposResolucao = reversas
    .filter(r => r.status_reversa === 'Entregue')
    .map(r => r.dias_desde_criacao);
  const mediaTempoResolucao = temposResolucao.length > 0
    ? Math.round(temposResolucao.reduce((a, b) => a + b, 0) / temposResolucao.length)
    : 0;

  if (loading) {
    return (
      <div className="space-y-6" data-testid="reversas-loading">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))}
        </div>
        <Card><CardContent className="p-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="reversas-page">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-['Plus_Jakarta_Sans']">Gestão de Reversas</h1>
        <p className="text-muted-foreground text-sm">Acompanhamento de devoluções via Correios</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <Card data-testid="card-total">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-slate-100 dark:bg-slate-800">
                <Truck className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-aguardando">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-amber-100 dark:bg-amber-900/30">
                <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.aguardando}</p>
                <p className="text-xs text-muted-foreground">Aguardando</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-transito">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-blue-100 dark:bg-blue-900/30">
                <Truck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.emTransito}</p>
                <p className="text-xs text-muted-foreground">Em Trânsito</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-entregue">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-emerald-100 dark:bg-emerald-900/30">
                <Truck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.entregue}</p>
                <p className="text-xs text-muted-foreground">Entregues</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-media-tempo">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-purple-100 dark:bg-purple-900/30">
                <Clock className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{mediaTempoResolucao}</p>
                <p className="text-xs text-muted-foreground">Média (dias)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alert for old reversas */}
      {stats.semAtualizacao > 0 && (
        <Card className="border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20" data-testid="alert-sem-atualizacao">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            <span className="text-sm">
              <strong>{stats.semAtualizacao}</strong> reversa(s) sem atualização há mais de 7 dias
            </span>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-medium bg-muted/50">Código Rastreio</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-medium bg-muted/50">Pedido</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-medium bg-muted/50">Status</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-medium bg-muted/50">Criada</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-medium bg-muted/50">Dias</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-medium bg-muted/50">Última Atualização</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-medium bg-muted/50">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reversas.length > 0 ? (
                  reversas.map((reversa) => (
                    <TableRow 
                      key={reversa.id}
                      className={reversa.dias_sem_atualizacao > 7 ? 'bg-orange-50/50 dark:bg-orange-950/20' : ''}
                      data-testid={`reversa-row-${reversa.id}`}
                    >
                      <TableCell className="font-mono text-sm">
                        {reversa.codigo_rastreio || '-'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="link"
                          className="p-0 h-auto font-medium"
                          onClick={() => navigate(`/chamados/${reversa.chamado_id}`)}
                          data-testid={`link-chamado-${reversa.chamado_id}`}
                        >
                          #{reversa.numero_pedido}
                          <ExternalLink className="h-3 w-3 ml-1" />
                        </Button>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusBadge(reversa.status_reversa)}>
                          {reversa.status_reversa}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(reversa.data_criacao).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-sm">
                        {reversa.dias_desde_criacao}
                      </TableCell>
                      <TableCell className={`text-sm ${reversa.dias_sem_atualizacao > 7 ? 'text-orange-600 font-medium' : ''}`}>
                        {reversa.dias_sem_atualizacao} dias atrás
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(reversa)}
                          data-testid={`btn-editar-${reversa.id}`}
                        >
                          Atualizar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      Nenhuma reversa cadastrada
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atualizar Reversa</DialogTitle>
            <DialogDescription>
              Pedido #{selectedReversa?.numero_pedido}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Código de Rastreio</Label>
              <Input
                value={editForm.codigo_rastreio}
                onChange={(e) => setEditForm(prev => ({ ...prev, codigo_rastreio: e.target.value }))}
                placeholder="Código dos Correios"
                data-testid="input-edit-rastreio"
              />
            </div>
            <div>
              <Label>Status da Reversa</Label>
              <Select value={editForm.status_reversa} onValueChange={(v) => setEditForm(prev => ({ ...prev, status_reversa: v }))}>
                <SelectTrigger data-testid="select-edit-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_REVERSA.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea
                value={editForm.observacoes}
                onChange={(e) => setEditForm(prev => ({ ...prev, observacoes: e.target.value }))}
                placeholder="Observações sobre a reversa..."
                data-testid="textarea-edit-obs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} data-testid="btn-salvar-reversa">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Reversas;

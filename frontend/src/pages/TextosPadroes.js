import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Plus, Edit, Trash2, FileText, Copy, Check, Bell, History, Eye } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const MOTIVOS_PENDENCIA = [
  "Ag. Compras",
  "Ag. Logística",
  "Ag. Transportadora",
  "Ag. Parceiro",
  "Ag. Devolução",
  "Enviado",
  "Aguardando",
  "Ag. Confirmação da Entrega",
];

const TextosPadroes = () => {
  const [textos, setTextos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentTexto, setCurrentTexto] = useState({ categoria: '', texto: '' });
  const [copiedId, setCopiedId] = useState(null);
  const [logAlteracoes, setLogAlteracoes] = useState([]);
  const [logCount, setLogCount] = useState(0);
  const [showLogDialog, setShowLogDialog] = useState(false);
  const [filtroMotivo, setFiltroMotivo] = useState('Ag. Compras');

  const { getAuthHeader, user } = useAuth();
  
  const isAdmin = user?.email === 'adneia@weconnect360.com.br';

  useEffect(() => {
    fetchTextos();
    if (isAdmin) {
      fetchLogCount();
    }
  }, []);

  const fetchTextos = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/textos-padroes-lista`,
        { headers: getAuthHeader() }
      );
      setTextos(response.data);
    } catch (error) {
      toast.error('Erro ao carregar textos padrões');
    } finally {
      setLoading(false);
    }
  };

  const fetchLogCount = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/textos-padroes-log/nao-visualizados`,
        { headers: getAuthHeader() }
      );
      setLogCount(response.data.count);
    } catch (error) {
      console.error('Erro ao buscar contagem de logs');
    }
  };

  const fetchLogs = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/textos-padroes-log`,
        { headers: getAuthHeader() }
      );
      setLogAlteracoes(response.data);
    } catch (error) {
      toast.error('Erro ao carregar histórico');
    }
  };

  const openLogDialog = async () => {
    await fetchLogs();
    setShowLogDialog(true);
    
    // Marcar como visualizados
    try {
      await axios.post(
        `${API_URL}/api/textos-padroes-log/marcar-visualizados`,
        {},
        { headers: getAuthHeader() }
      );
      setLogCount(0);
    } catch (error) {
      console.error('Erro ao marcar logs como visualizados');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getAcaoBadge = (acao) => {
    switch (acao) {
      case 'criado':
        return <Badge className="bg-green-100 text-green-700">Criado</Badge>;
      case 'atualizado':
        return <Badge className="bg-blue-100 text-blue-700">Atualizado</Badge>;
      case 'excluido':
        return <Badge className="bg-red-100 text-red-700">Excluído</Badge>;
      default:
        return <Badge variant="outline">{acao}</Badge>;
    }
  };

  const handleSave = async () => {
    if (!currentTexto.categoria.trim() || !currentTexto.texto.trim()) {
      toast.error('Preencha todos os campos');
      return;
    }

    try {
      if (editMode) {
        await axios.put(
          `${API_URL}/api/textos-padroes/${encodeURIComponent(currentTexto.categoria)}`,
          { texto: currentTexto.texto },
          { headers: getAuthHeader() }
        );
        toast.success('Texto padrão atualizado!');
      } else {
        await axios.post(
          `${API_URL}/api/textos-padroes`,
          currentTexto,
          { headers: getAuthHeader() }
        );
        toast.success('Texto padrão criado!');
      }
      setShowDialog(false);
      setCurrentTexto({ categoria: '', texto: '' });
      fetchTextos();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao salvar texto padrão');
    }
  };

  const handleEdit = (texto) => {
    setCurrentTexto({ categoria: texto.categoria, texto: texto.texto });
    setEditMode(true);
    setShowDialog(true);
  };

  const handleDelete = async (categoria) => {
    if (!window.confirm('Tem certeza que deseja excluir este texto padrão?')) {
      return;
    }

    try {
      await axios.delete(
        `${API_URL}/api/textos-padroes/${encodeURIComponent(categoria)}`,
        { headers: getAuthHeader() }
      );
      toast.success('Texto padrão excluído!');
      fetchTextos();
    } catch (error) {
      toast.error('Erro ao excluir texto padrão');
    }
  };

  const handleCopy = (texto) => {
    navigator.clipboard.writeText(texto.texto);
    setCopiedId(texto.categoria);
    toast.success('Texto copiado!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const openNewDialog = () => {
    setCurrentTexto({ categoria: '', texto: '' });
    setEditMode(false);
    setShowDialog(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const textosFiltrados = filtroMotivo
    ? textos.filter(t => t.motivo_pendencia === filtroMotivo)
    : textos;

  return (
    <div className="space-y-6" data-testid="textos-padroes-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-['Plus_Jakarta_Sans']">Textos Padrões</h1>
          <p className="text-muted-foreground text-sm">{textosFiltrados.length} textos{filtroMotivo ? ` para ${filtroMotivo}` : ' cadastrados'}</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Button 
              variant="outline" 
              onClick={openLogDialog}
              className="relative"
              data-testid="btn-historico"
            >
              <History className="h-4 w-4 mr-2" />
              Histórico
              {logCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {logCount}
                </span>
              )}
            </Button>
          )}
          <Button onClick={openNewDialog} data-testid="btn-novo-texto">
            <Plus className="h-4 w-4 mr-2" />
            Novo Texto Padrão
          </Button>
        </div>
      </div>

      {/* Filtro por Motivo de Pendência */}
      <div className="flex gap-2 flex-wrap">
        {MOTIVOS_PENDENCIA.map(motivo => (
          <button
            key={motivo}
            onClick={() => setFiltroMotivo(motivo)}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
              filtroMotivo === motivo
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background border-border hover:bg-muted'
            }`}
          >
            {motivo}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs uppercase tracking-wider font-medium bg-muted/50 w-40">Motivo</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider font-medium bg-muted/50 w-48">Categoria</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider font-medium bg-muted/50">Texto</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider font-medium bg-muted/50 w-32 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {textosFiltrados.map((texto) => (
                  <TableRow key={texto.categoria} data-testid={`row-${texto.categoria}`}>
                    <TableCell>
                      {texto.motivo_pendencia ? (
                        <Badge className="bg-blue-100 text-blue-800 text-xs">{texto.motivo_pendencia}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      <Badge variant="outline">{texto.categoria}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      <p className="line-clamp-2 text-muted-foreground">{texto.texto.substring(0, 150)}...</p>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleCopy(texto)}
                          data-testid={`btn-copy-${texto.categoria}`}
                        >
                          {copiedId === texto.categoria ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleEdit(texto)}
                          data-testid={`btn-edit-${texto.categoria}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleDelete(texto.categoria)}
                          className="text-destructive hover:text-destructive"
                          data-testid={`btn-delete-${texto.categoria}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog: Criar/Editar Texto */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              <FileText className="h-5 w-5 inline mr-2" />
              {editMode ? 'Editar Texto Padrão' : 'Novo Texto Padrão'}
            </DialogTitle>
            <DialogDescription>
              {editMode 
                ? 'Edite o texto padrão abaixo' 
                : 'Crie um novo texto padrão para usar nos atendimentos'
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Categoria / Nome</Label>
              <Input
                value={currentTexto.categoria}
                onChange={(e) => setCurrentTexto(prev => ({ ...prev, categoria: e.target.value }))}
                placeholder="Ex: Falha de Compras - Reenvio"
                disabled={editMode}
                data-testid="input-categoria"
              />
            </div>
            
            <div>
              <Label>Texto</Label>
              <Textarea
                value={currentTexto.texto}
                onChange={(e) => setCurrentTexto(prev => ({ ...prev, texto: e.target.value }))}
                placeholder="Digite o texto padrão aqui..."
                rows={10}
                className="font-mono text-sm"
                data-testid="input-texto"
              />
            </div>

            {/* Placeholders disponíveis */}
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">
                Placeholders disponíveis (serão substituídos automaticamente):
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><code className="bg-white dark:bg-slate-800 px-1 rounded">[ASSINATURA]</code> → Nome do atendente logado</div>
                <div><code className="bg-white dark:bg-slate-800 px-1 rounded">[NOME_CLIENTE]</code> → Nome do cliente</div>
                <div><code className="bg-white dark:bg-slate-800 px-1 rounded">[PRIMEIRO_NOME]</code> → Primeiro nome do cliente</div>
                <div><code className="bg-white dark:bg-slate-800 px-1 rounded">[ENTREGA]</code> → Número do pedido</div>
                <div><code className="bg-white dark:bg-slate-800 px-1 rounded">[PRODUTO]</code> → Nome do produto</div>
                <div><code className="bg-white dark:bg-slate-800 px-1 rounded">[DATA_ULTIMO_PONTO]</code> → Data da última movimentação</div>
                <div><code className="bg-white dark:bg-slate-800 px-1 rounded">[CÓDIGO_REVERSA]</code> → Código de reversa</div>
                <div><code className="bg-white dark:bg-slate-800 px-1 rounded">[DATA_EMISSAO]</code> → Data de emissão da reversa</div>
                <div><code className="bg-white dark:bg-slate-800 px-1 rounded">[DATA_VALIDADE]</code> → Data de validade da reversa</div>
                <div><code className="bg-white dark:bg-slate-800 px-1 rounded">[NOTA_FISCAL]</code> → Número da nota fiscal</div>
                <div><code className="bg-white dark:bg-slate-800 px-1 rounded">[CHAVE_ACESSO]</code> → Chave de acesso da NF</div>
                <div><code className="bg-white dark:bg-slate-800 px-1 rounded">[PARCEIRO]</code> → Nome do canal/parceiro</div>
              </div>
            </div>
          </div>

          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} data-testid="btn-salvar">
              {editMode ? 'Atualizar' : 'Criar'} Texto Padrão
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Histórico de Alterações */}
      {isAdmin && (
        <Dialog open={showLogDialog} onOpenChange={setShowLogDialog}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                <History className="h-5 w-5 inline mr-2" />
                Histórico de Alterações
              </DialogTitle>
              <DialogDescription>
                Todas as alterações feitas nos textos padrões
              </DialogDescription>
            </DialogHeader>
            
            {logAlteracoes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma alteração registrada
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Usuário</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logAlteracoes.map((log, index) => (
                    <TableRow key={index} className={!log.visualizado ? 'bg-yellow-50' : ''}>
                      <TableCell className="text-sm">{formatDate(log.data)}</TableCell>
                      <TableCell>{getAcaoBadge(log.acao)}</TableCell>
                      <TableCell className="font-medium">{log.categoria}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{log.usuario}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default TextosPadroes;

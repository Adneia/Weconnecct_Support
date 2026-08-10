import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '../components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../components/ui/table';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, FileText, Copy, Check, History, Lock } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const PLACEHOLDERS = [
  ['[ASSINATURA]', 'Nome do atendente logado'],
  ['[NOME_CLIENTE]', 'Nome do cliente'],
  ['[PRIMEIRO_NOME]', 'Primeiro nome do cliente'],
  ['[ENTREGA]', 'Número do pedido'],
  ['[PRODUTO]', 'Nome do produto'],
  ['[DATA_ENTREGA]', 'Data da entrega / último ponto'],
  ['[CÓDIGO_REVERSA]', 'Código de reversa'],
  ['[DATA_EMISSAO]', 'Data de emissão da reversa'],
  ['[DATA_VALIDADE]', 'Data de validade da reversa'],
  ['[NOTA_FISCAL]', 'Número da nota fiscal'],
  ['[CHAVE_ACESSO]', 'Chave de acesso da NF'],
  ['[PARCEIRO]', 'Nome do canal/parceiro'],
];

const VAZIO = { id: '', motivo: '', causa: '', titulo: '', texto: '', parceiro: '' };

export default function TextosAtendimento() {
  const { getAuthHeader, user } = useAuth();
  const isAdmin = user?.email === 'adneia@weconnect360.com.br';

  // Visão: 'atendimento' (editável) | 'sistema' (referência, só leitura)
  const [view, setView] = useState('atendimento');
  const [textos, setTextos] = useState([]);       // atendimento (textos_por_motivo)
  const [sistema, setSistema] = useState(null);   // referência do sistema (TEXTOS_PADROES + custom)
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [atual, setAtual] = useState(VAZIO);
  const [copiedId, setCopiedId] = useState(null);
  const [filtroMotivo, setFiltroMotivo] = useState('');
  // Histórico
  const [logAberto, setLogAberto] = useState(false);
  const [logs, setLogs] = useState([]);
  const [logCount, setLogCount] = useState(0);

  const fetchTextos = useCallback(async () => {
    try {
      const r = await axios.get(`${API_URL}/api/textos-motivo-editor`, { headers: getAuthHeader() });
      setTextos(r.data || []);
      if (!filtroMotivo && r.data?.length) {
        const ms = [...new Set(r.data.map(t => t.motivo).filter(Boolean))];
        setFiltroMotivo(ms.includes('Ag. Parceiro') ? 'Ag. Parceiro' : (ms[0] || ''));
      }
    } catch {
      toast.error('Erro ao carregar textos do atendimento');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeader]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchTextos(); }, [fetchTextos]);

  // Carrega a referência do sistema só quando a visão "Sistema" é aberta
  useEffect(() => {
    if (view === 'sistema' && sistema === null) {
      axios.get(`${API_URL}/api/textos-padroes-lista`, { headers: getAuthHeader() })
        .then(r => setSistema(r.data || []))
        .catch(() => { setSistema([]); toast.error('Erro ao carregar textos do sistema'); });
    }
  }, [view, sistema, getAuthHeader]);

  useEffect(() => {
    if (!isAdmin) return;
    axios.get(`${API_URL}/api/textos-padroes-log/nao-visualizados`, { headers: getAuthHeader() })
      .then(r => setLogCount(r.data?.count || 0)).catch(() => {});
  }, [isAdmin, getAuthHeader]);

  // ---- dados da visão ativa ----
  const ehSistema = view === 'sistema';
  const baseMotivos = ehSistema
    ? [...new Set((sistema || []).map(t => t.motivo_pendencia).filter(Boolean))].sort()
    : [...new Set(textos.map(t => t.motivo).filter(Boolean))].sort();
  const filtrados = ehSistema
    ? (sistema || []).filter(t => !filtroMotivo || t.motivo_pendencia === filtroMotivo)
    : (filtroMotivo ? textos.filter(t => t.motivo === filtroMotivo) : textos);

  // ---- ações (só na visão Atendimento) ----
  const salvar = async () => {
    if (!atual.motivo.trim() || !atual.titulo.trim() || !atual.texto.trim()) {
      toast.error('Preencha Motivo, Título e Texto'); return;
    }
    try {
      if (editMode) {
        await axios.put(`${API_URL}/api/textos-motivo-editor/${atual.id}`,
          { motivo: atual.motivo, causa: atual.causa, titulo: atual.titulo, texto: atual.texto, parceiro: atual.parceiro },
          { headers: getAuthHeader() });
        toast.success('Texto atualizado!');
      } else {
        await axios.post(`${API_URL}/api/textos-motivo-editor`,
          { motivo: atual.motivo, causa: atual.causa, titulo: atual.titulo, texto: atual.texto, parceiro: atual.parceiro },
          { headers: getAuthHeader() });
        toast.success('Texto criado!');
      }
      setShowDialog(false); setAtual(VAZIO); fetchTextos();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erro ao salvar');
    }
  };
  const editar = (t) => { setAtual({ ...t }); setEditMode(true); setShowDialog(true); };
  const novo = () => { setAtual({ ...VAZIO, motivo: filtroMotivo || '' }); setEditMode(false); setShowDialog(true); };
  const excluir = async (t) => {
    if (!window.confirm(`Excluir o texto "${t.titulo}" (${t.motivo})?`)) return;
    try {
      await axios.delete(`${API_URL}/api/textos-motivo-editor/${t.id}`, { headers: getAuthHeader() });
      toast.success('Texto excluído!'); fetchTextos();
    } catch { toast.error('Erro ao excluir'); }
  };
  const copiar = (id, texto) => {
    navigator.clipboard.writeText(texto || '');
    setCopiedId(id); toast.success('Texto copiado!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const abrirHistorico = async () => {
    setLogAberto(true);
    try {
      const r = await axios.get(`${API_URL}/api/textos-padroes-log`, { headers: getAuthHeader() });
      setLogs(r.data || []);
      await axios.post(`${API_URL}/api/textos-padroes-log/marcar-visualizados`, {}, { headers: getAuthHeader() });
      setLogCount(0);
    } catch { toast.error('Erro ao carregar histórico'); }
  };

  const pill = (v, label) => (
    <button onClick={() => setView(v)}
      className={`px-3 py-1 text-sm rounded-md transition-colors ${
        view === v ? 'bg-white dark:bg-slate-700 shadow-sm font-medium text-slate-800 dark:text-slate-100'
                   : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
      {label}
    </button>
  );

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-5" data-testid="textos-page">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Textos</h1>
          <p className="text-muted-foreground text-sm">
            {ehSistema
              ? 'Referência do sistema — molde de fábrica, somente leitura.'
              : 'Textos que aparecem nos botões do atendimento — edite aqui.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Seletor sutil de visão */}
          <div className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
            {pill('atendimento', 'Atendimento')}
            {pill('sistema', 'Sistema')}
          </div>
          {isAdmin && (
            <Button variant="outline" onClick={abrirHistorico} className="relative">
              <History className="h-4 w-4 mr-2" /> Histórico
              {logCount > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">{logCount}</span>}
            </Button>
          )}
          {!ehSistema && (
            <Button onClick={novo}><Plus className="h-4 w-4 mr-2" /> Novo Texto</Button>
          )}
        </div>
      </div>

      {ehSistema && (
        <div className="text-xs text-slate-500 flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/40 border rounded-lg px-3 py-2">
          <Lock className="h-3.5 w-3.5" /> Estes são os textos embutidos no sistema (referência). Para editar o que o atendente usa, volte à visão <strong>Atendimento</strong>.
        </div>
      )}

      {/* Filtro por Motivo */}
      <div className="flex gap-2 flex-wrap">
        {baseMotivos.map(m => (
          <button key={m} onClick={() => setFiltroMotivo(m)}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
              filtroMotivo === m ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border hover:bg-muted'}`}>
            {m}
          </button>
        ))}
        {filtroMotivo && (
          <button onClick={() => setFiltroMotivo('')} className="px-2 py-1 text-xs text-slate-500 hover:text-slate-700">✕ todos</button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {ehSistema ? (
                    <>
                      <TableHead className="text-xs uppercase tracking-wider font-medium bg-muted/50 w-40">Motivo</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider font-medium bg-muted/50 w-56">Categoria</TableHead>
                    </>
                  ) : (
                    <>
                      <TableHead className="text-xs uppercase tracking-wider font-medium bg-muted/50 w-40">Causa</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider font-medium bg-muted/50 w-56">Título</TableHead>
                    </>
                  )}
                  <TableHead className="text-xs uppercase tracking-wider font-medium bg-muted/50">Texto</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider font-medium bg-muted/50 w-32 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ehSistema ? filtrados.map((t, i) => (
                  <TableRow key={t.categoria + i}>
                    <TableCell className="text-sm text-muted-foreground">{t.motivo_pendencia || '—'}</TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="outline">{t.categoria}</Badge>
                        {t.tipo === 'customizado' && <Badge className="bg-amber-100 text-amber-700 text-[10px]">customizado</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm"><p className="line-clamp-2 text-muted-foreground">{(t.texto || '').substring(0, 150)}…</p></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => copiar(t.categoria, t.texto)}>
                        {copiedId === t.categoria ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </TableCell>
                  </TableRow>
                )) : filtrados.map(t => (
                  <TableRow key={t.id} data-testid={`row-atd-${t.id}`}>
                    <TableCell className="text-sm text-muted-foreground">{t.causa || '—'}</TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="outline">{t.titulo}</Badge>
                        {t.parceiro && <Badge className="bg-violet-100 text-violet-700 text-[10px]">{t.parceiro}</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm"><p className="line-clamp-2 text-muted-foreground">{(t.texto || '').substring(0, 150)}…</p></TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => copiar(t.id, t.texto)}>
                          {copiedId === t.id ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => editar(t)} data-testid={`btn-edit-atd-${t.id}`}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => excluir(t)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtrados.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhum texto neste motivo.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog: Criar/Editar (só Atendimento) */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle><FileText className="h-5 w-5 inline mr-2" />{editMode ? 'Editar Texto' : 'Novo Texto'}</DialogTitle>
            <DialogDescription>{editMode ? 'Edite o texto que o atendente usa no fluxo.' : 'Crie um novo texto para os botões do atendimento.'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>Motivo</Label>
                <Input value={atual.motivo} onChange={e => setAtual(p => ({ ...p, motivo: e.target.value }))} placeholder="Ex: Ag. Parceiro" list="motivos-list" />
                <datalist id="motivos-list">{baseMotivos.map(m => <option key={m} value={m} />)}</datalist>
              </div>
              <div>
                <Label>Causa</Label>
                <Input value={atual.causa} onChange={e => setAtual(p => ({ ...p, causa: e.target.value }))} placeholder="Ex: Cancelamento" />
              </div>
              <div>
                <Label>Parceiro (opcional)</Label>
                <Input value={atual.parceiro} onChange={e => setAtual(p => ({ ...p, parceiro: e.target.value }))} placeholder="Ex: Livelo" />
              </div>
            </div>
            <div>
              <Label>Título (nome do botão)</Label>
              <Input value={atual.titulo} onChange={e => setAtual(p => ({ ...p, titulo: e.target.value }))} placeholder="Ex: Estorno + descarte" />
            </div>
            <div>
              <Label>Texto</Label>
              <Textarea value={atual.texto} onChange={e => setAtual(p => ({ ...p, texto: e.target.value }))} rows={10} className="font-mono text-sm" placeholder="Digite o texto aqui..." />
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">Placeholders (substituídos automaticamente):</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {PLACEHOLDERS.map(([code, desc]) => (
                  <div key={code}><code className="bg-white dark:bg-slate-800 px-1 rounded">{code}</code> → {desc}</div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={salvar}>{editMode ? 'Atualizar' : 'Criar'} Texto</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Histórico */}
      {isAdmin && (
        <Dialog open={logAberto} onOpenChange={setLogAberto}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle><History className="h-5 w-5 inline mr-2" />Histórico de Alterações</DialogTitle>
              <DialogDescription>Alterações feitas nos textos</DialogDescription>
            </DialogHeader>
            {logs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">Nenhuma alteração registrada</div>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Ação</TableHead><TableHead>Categoria</TableHead><TableHead>Usuário</TableHead></TableRow></TableHeader>
                <TableBody>
                  {logs.map((l, i) => (
                    <TableRow key={i} className={!l.visualizado ? 'bg-yellow-50 dark:bg-yellow-950/20' : ''}>
                      <TableCell className="text-sm">{l.data ? new Date(l.data).toLocaleString('pt-BR') : '—'}</TableCell>
                      <TableCell><Badge variant="outline">{l.acao}</Badge></TableCell>
                      <TableCell className="font-medium text-sm">{l.categoria}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{l.usuario}</TableCell>
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
}

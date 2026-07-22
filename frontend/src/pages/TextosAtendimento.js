import React, { useState, useEffect } from 'react';
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
import { Plus, Edit, Trash2, FileText, Copy, Check } from 'lucide-react';

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
  const [textos, setTextos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [atual, setAtual] = useState(VAZIO);
  const [copiedId, setCopiedId] = useState(null);
  const [filtroMotivo, setFiltroMotivo] = useState('');
  const { getAuthHeader } = useAuth();

  useEffect(() => { fetchTextos(); }, []);

  const fetchTextos = async () => {
    try {
      const r = await axios.get(`${API_URL}/api/textos-motivo-editor`, { headers: getAuthHeader() });
      setTextos(r.data || []);
      // Primeiro motivo como filtro inicial (se ainda não escolhido)
      if (!filtroMotivo && r.data?.length) {
        const motivos = [...new Set(r.data.map(t => t.motivo).filter(Boolean))];
        if (motivos.includes('Ag. Parceiro')) setFiltroMotivo('Ag. Parceiro');
        else if (motivos.length) setFiltroMotivo(motivos[0]);
      }
    } catch {
      toast.error('Erro ao carregar textos do atendimento');
    } finally {
      setLoading(false);
    }
  };

  const motivos = [...new Set(textos.map(t => t.motivo).filter(Boolean))].sort();
  const filtrados = filtroMotivo ? textos.filter(t => t.motivo === filtroMotivo) : textos;

  const salvar = async () => {
    if (!atual.motivo.trim() || !atual.titulo.trim() || !atual.texto.trim()) {
      toast.error('Preencha Motivo, Título e Texto');
      return;
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
      setShowDialog(false);
      setAtual(VAZIO);
      fetchTextos();
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
      toast.success('Texto excluído!');
      fetchTextos();
    } catch {
      toast.error('Erro ao excluir');
    }
  };

  const copiar = (t) => {
    navigator.clipboard.writeText(t.texto);
    setCopiedId(t.id);
    toast.success('Texto copiado!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="textos-atendimento-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Textos do Atendimento</h1>
          <p className="text-muted-foreground text-sm">
            {filtrados.length} texto(s){filtroMotivo ? ` em ${filtroMotivo}` : ''} — estes são os textos que aparecem nos botões do atendimento e podem ser editados.
          </p>
        </div>
        <Button onClick={novo} data-testid="btn-novo-texto-atd">
          <Plus className="h-4 w-4 mr-2" /> Novo Texto
        </Button>
      </div>

      {/* Filtro por Motivo */}
      <div className="flex gap-2 flex-wrap">
        {motivos.map(m => (
          <button key={m} onClick={() => setFiltroMotivo(m)}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
              filtroMotivo === m ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border hover:bg-muted'}`}>
            {m}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs uppercase tracking-wider font-medium bg-muted/50 w-40">Causa</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider font-medium bg-muted/50 w-56">Título</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider font-medium bg-muted/50">Texto</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider font-medium bg-muted/50 w-32 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map(t => (
                  <TableRow key={t.id} data-testid={`row-atd-${t.id}`}>
                    <TableCell className="text-sm text-muted-foreground">{t.causa || '—'}</TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="outline">{t.titulo}</Badge>
                        {t.parceiro && <Badge className="bg-violet-100 text-violet-700 text-[10px]">{t.parceiro}</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <p className="line-clamp-2 text-muted-foreground">{(t.texto || '').substring(0, 150)}…</p>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => copiar(t)}>
                          {copiedId === t.id ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => editar(t)} data-testid={`btn-edit-atd-${t.id}`}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => excluir(t)} className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
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

      {/* Dialog: Criar/Editar */}
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
                <datalist id="motivos-list">{motivos.map(m => <option key={m} value={m} />)}</datalist>
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
    </div>
  );
}

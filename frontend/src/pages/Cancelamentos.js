import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../components/ui/dialog';
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from '../components/ui/tabs';
import {
  AlertTriangle, CheckCircle, RefreshCw, Copy, ShoppingCart, Factory, FileWarning,
  Plus, Search, X, Save, ChevronDown, ChevronRight, BarChart3,
} from 'lucide-react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// =================== HELPERS ===================
function copiar(texto, msg = 'Copiado!') {
  const str = String(texto || '');
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(str)
      .then(() => toast.success(msg))
      .catch(() => toast.error('Erro ao copiar'));
    return;
  }
  const el = document.createElement('textarea');
  el.value = str;
  el.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;z-index:9999';
  document.body.appendChild(el);
  el.focus(); el.select(); el.setSelectionRange(0, str.length);
  try {
    if (document.execCommand('copy')) toast.success(msg);
    else toast.error('Erro ao copiar');
  } catch { toast.error('Erro ao copiar'); }
  document.body.removeChild(el);
}

// Abre a imagem do produto (via VTEX) numa nova aba ao clicar no nome
async function abrirImagemProduto(sku, getAuthHeader) {
  if (!sku) { toast.info('Produto sem SKU'); return; }
  const win = window.open('', '_blank');  // abre já (evita bloqueio de popup)
  try {
    const r = await axios.get(`${API_URL}/api/produtos/imagem/${encodeURIComponent(sku)}`, { headers: getAuthHeader() });
    if (r.data?.image_url) {
      if (win) win.location.href = r.data.image_url;
    } else {
      if (win) win.close();
      toast.info(`Sem imagem cadastrada para ${sku}`);
    }
  } catch {
    if (win) win.close();
    toast.error('Erro ao buscar imagem');
  }
}

function formatMoney(v) {
  const n = Number(String(v || '0').replace(',', '.'));
  if (isNaN(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatCPF(cpf) {
  if (!cpf) return '—';
  return String(cpf).replace(/\D/g, '').padStart(11, '0');
}

// Calcula dias pendentes a partir da data importada (YYYY-MM-DD)
function diasPendentes(item) {
  if (item.status === 'encerrado') return null;
  const dataStr = item.data || '';
  // data formato YYYY-MM-DD
  const m = String(dataStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return item.dias_em_status || 0;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const hoje = new Date();
  const diff = Math.floor((hoje - d) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

function StatusBadge({ item }) {
  if (item.status === 'encerrado') {
    return <span className="text-emerald-600 text-xs font-semibold">✓</span>;
  }
  const dias = diasPendentes(item);
  if (dias >= 7) {
    return <span className="text-red-600 text-xs font-semibold whitespace-nowrap">{dias}d ⚠</span>;
  }
  return <span className="text-amber-600 text-xs font-semibold whitespace-nowrap">{dias || 0}d</span>;
}

// =================== MODAL: NOVO CANCELAMENTO ===================
function NovoCancelamentoDialog({ open, onClose, tipo, onCreated }) {
  const { getAuthHeader } = useAuth();
  const [numeroPedido, setNumeroPedido] = useState('');
  const [dadosPedido, setDadosPedido] = useState(null);
  const [itensEntrega, setItensEntrega] = useState([]);   // todos os itens da entrega
  const [itemSelIdx, setItemSelIdx] = useState(0);          // índice do item escolhido
  const [alerta, setAlerta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // Campos do form
  const [motivo, setMotivo] = useState('');
  const [acao, setAcao] = useState('Cancelar');
  const [motivoRejeicao, setMotivoRejeicao] = useState('');
  const [ticket, setTicket] = useState('');
  const [instancia, setInstancia] = useState('');
  const [zeradoReserva, setZeradoReserva] = useState(null);
  const [observacao, setObservacao] = useState('');

  const limpar = () => {
    setNumeroPedido(''); setDadosPedido(null); setItensEntrega([]); setItemSelIdx(0); setAlerta(null);
    setMotivo(''); setAcao('Cancelar'); setMotivoRejeicao('');
    setTicket(''); setInstancia(''); setZeradoReserva(null); setObservacao('');
  };

  // Item efetivamente selecionado: se a entrega tem >1 item, usa o escolhido;
  // senão usa o item único (do tabelão).
  const itemAtual = (itensEntrega && itensEntrega.length > 0)
    ? itensEntrega[itemSelIdx] || itensEntrega[0]
    : (dadosPedido ? {
        produto: dadosPedido.produto,
        codigo_item_bseller: dadosPedido.codigo_item_bseller,
        codigo_item_vtex: dadosPedido.codigo_item_vtex,
        codigo_fornecedor: dadosPedido.codigo_fornecedor,
        preco_final: dadosPedido.preco_final,
        quantidade: dadosPedido.quantidade,
      } : null);

  useEffect(() => { if (open) limpar(); }, [open]);

  const buscarPedido = async () => {
    if (!numeroPedido.trim()) return;
    setLoading(true);
    setDadosPedido(null);
    setAlerta(null);
    try {
      const res = await axios.get(
        `${API_URL}/api/cancelamentos/lookup/${numeroPedido.trim()}`,
        { headers: getAuthHeader() }
      );
      if (res.data?.encontrado) {
        setDadosPedido(res.data.dados);
        const itens = Array.isArray(res.data.itens) ? res.data.itens : [];
        setItensEntrega(itens);
        // Default: item que casa com o do tabelão; senão o primeiro
        const bsellerTab = res.data.dados?.codigo_item_bseller;
        const idx = itens.findIndex(it => it.codigo_item_bseller === bsellerTab);
        setItemSelIdx(idx >= 0 ? idx : 0);
        setAlerta(res.data.alerta_produto || null);
      } else {
        toast.error('Pedido não encontrado no tabelão');
      }
    } catch (e) {
      toast.error('Erro ao buscar pedido');
    } finally { setLoading(false); }
  };

  const salvar = async () => {
    if (!dadosPedido) { toast.error('Busque o pedido primeiro'); return; }
    setSalvando(true);
    try {
      const payload = {
        tipo,
        numero_pedido: numeroPedido.trim(),
        motivo: motivo || undefined,
        acao,
        motivo_rejeicao: motivoRejeicao || undefined,
        ticket: ticket || undefined,
        instancia: instancia || undefined,
        zerado_reserva: zeradoReserva,
        observacao: observacao || undefined,
      };
      // Item escolhido (entrega com mais de 1 item) — sobrescreve o item do tabelão
      // e marca como PARCIAL (cancelamento/similar de 1 item de vários).
      if (itensEntrega.length > 1 && itemAtual) {
        payload.item_produto = itemAtual.produto || undefined;
        payload.item_codigo_bseller = itemAtual.codigo_item_bseller || undefined;
        payload.item_codigo_vtex = itemAtual.codigo_item_vtex || undefined;
        payload.item_codigo_fornecedor = itemAtual.codigo_fornecedor || undefined;
        payload.item_preco_final = itemAtual.preco_final != null ? String(itemAtual.preco_final) : undefined;
        payload.item_quantidade = itemAtual.quantidade != null ? String(itemAtual.quantidade) : undefined;
        payload.is_parcial = true;
      }
      await axios.post(`${API_URL}/api/cancelamentos`, payload, { headers: getAuthHeader() });
      toast.success('Cancelamento registrado!');
      onCreated?.();
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Erro ao registrar');
    } finally { setSalvando(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {tipo === 'aes' && <><ShoppingCart className="h-5 w-5 text-orange-600" /> Novo Cancelamento AES (Compras)</>}
            {tipo === 'etr' && <><Factory className="h-5 w-5 text-purple-600" /> Novo Cancelamento ETR (Produção)</>}
            {tipo === 'erro_nota' && <><FileWarning className="h-5 w-5 text-red-600" /> Novo Erro na Nota</>}
          </DialogTitle>
          <DialogDescription>
            Digite o número da Entrega — o sistema busca os dados do pedido automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Buscar */}
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Número da Entrega *</label>
            <div className="flex gap-2">
              <Input
                placeholder="Ex.: 122415418"
                value={numeroPedido}
                onChange={e => setNumeroPedido(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); buscarPedido(); } }}
              />
              <Button onClick={buscarPedido} disabled={loading} variant="secondary">
                {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <><Search className="h-4 w-4 mr-1" /> Buscar</>}
              </Button>
            </div>
          </div>

          {/* Alerta de produto recorrente */}
          {alerta && (
            <div className="p-3 rounded-lg bg-red-50 border-2 border-red-300 dark:bg-red-950/30 dark:border-red-800">
              <p className="font-bold text-red-800 dark:text-red-200 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" /> ATENÇÃO — Produto recorrente
              </p>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">{alerta.mensagem}</p>
            </div>
          )}

          {/* Seletor de item — só quando a entrega tem mais de 1 item */}
          {dadosPedido && itensEntrega.length > 1 && (
            <div className="p-3 rounded-lg bg-amber-50 border-2 border-amber-300 dark:bg-amber-950/30 dark:border-amber-800">
              <label className="text-xs font-semibold text-amber-800 dark:text-amber-200 mb-1 flex items-center gap-1">
                <AlertTriangle className="h-4 w-4" /> Esta entrega tem {itensEntrega.length} itens — selecione o item do cancelamento
              </label>
              <select
                value={itemSelIdx}
                onChange={e => setItemSelIdx(Number(e.target.value))}
                className="w-full px-3 py-2 border rounded-md text-sm bg-background"
              >
                {itensEntrega.map((it, i) => (
                  <option key={it.codigo_item_bseller || i} value={i}>
                    {it.produto} — SKU {it.codigo_item_vtex || it.codigo_item_bseller} ({formatMoney(it.preco_final)})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Dados do pedido (preview) */}
          {dadosPedido && (
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/30 border space-y-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-slate-500">Cliente:</span> <strong>{dadosPedido.nome_cliente || '—'}</strong></div>
                <div><span className="text-slate-500">CPF:</span> {formatCPF(dadosPedido.cpf_cliente)}</div>
                <div><span className="text-slate-500">Canal:</span> {dadosPedido.canal_vendas || '—'}</div>
                <div><span className="text-slate-500">Filial:</span> {dadosPedido.filial || '—'}</div>
                <div className="col-span-2"><span className="text-slate-500">Produto:</span> <strong>{itemAtual?.produto || dadosPedido.produto || '—'}</strong></div>
                <div><span className="text-slate-500">SKU:</span> {itemAtual?.codigo_item_vtex || itemAtual?.codigo_item_bseller || '—'}</div>
                <div><span className="text-slate-500">Fornecedor:</span> {itemAtual?.codigo_fornecedor || '—'}</div>
                <div><span className="text-slate-500">Status atual:</span> <Badge variant="outline" className="text-xs">{dadosPedido.status_pedido || '—'}</Badge></div>
                <div><span className="text-slate-500">Valor da venda:</span> <strong className="text-emerald-700">{formatMoney(itemAtual?.preco_final)}</strong></div>
                {dadosPedido.nota_fiscal && <div><span className="text-slate-500">NF:</span> {String(dadosPedido.nota_fiscal).split('.')[0]}</div>}
              </div>
            </div>
          )}

          {/* Campos específicos por tipo */}
          {dadosPedido && (
            <div className="space-y-3">
              {tipo === 'etr' && (
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Motivo *</label>
                  <select
                    value={motivo}
                    onChange={e => setMotivo(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md text-sm bg-background"
                  >
                    <option value="">Selecione...</option>
                    <option value="Falta">Falta no estoque</option>
                    <option value="Perda/Quebra">Perda/Quebra</option>
                    <option value="Falha de cadastro">Falha de cadastro</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>
              )}

              {tipo === 'erro_nota' && (
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Motivo da Rejeição *</label>
                  <select
                    value={motivoRejeicao}
                    onChange={e => setMotivoRejeicao(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md text-sm bg-background"
                  >
                    <option value="">Selecione...</option>
                    <option value="Irregularidade fiscal do destinatário">Irregularidade fiscal do destinatário</option>
                    <option value="CPF/CNPJ inválido">CPF/CNPJ inválido</option>
                    <option value="Endereço inválido">Endereço inválido</option>
                    <option value="CEP inexistente">CEP inexistente</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>
              )}

              {tipo !== 'erro_nota' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Ação</label>
                    <select
                      value={acao}
                      onChange={e => setAcao(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md text-sm bg-background"
                    >
                      <option value="Cancelar">Cancelar</option>
                      <option value="Similar">Similar (oferecer produto substituto)</option>
                      <option value="Reenviar">Reenviar</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Ticket</label>
                    <Input value={ticket} onChange={e => setTicket(e.target.value)} placeholder="Nº do ticket no parceiro" />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Instância (Bseller)</label>
                  <Input value={instancia} onChange={e => setInstancia(e.target.value)} placeholder="Nº instância" />
                </div>
                {tipo === 'aes' && (
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Zerado reserva?</label>
                    <select
                      value={zeradoReserva === null ? '' : zeradoReserva ? 'sim' : 'nao'}
                      onChange={e => {
                        const v = e.target.value;
                        setZeradoReserva(v === '' ? null : v === 'sim');
                      }}
                      className="w-full px-3 py-2 border rounded-md text-sm bg-background"
                    >
                      <option value="">—</option>
                      <option value="sim">Sim</option>
                      <option value="nao">Não</option>
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Observação</label>
                <Textarea
                  value={observacao}
                  onChange={e => setObservacao(e.target.value)}
                  placeholder="Anotações sobre este cancelamento..."
                  rows={3}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={!dadosPedido || salvando}>
            {salvando ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Salvando...</> : <><Save className="h-4 w-4 mr-2" /> Registrar</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =================== LINHA EDITÁVEL (auto-save no blur) ===================
// Hook que envolve um input/textarea: salva no blur se o valor mudou
function useFieldSave(item, field, onSaved) {
  const { getAuthHeader } = useAuth();
  const [val, setVal] = React.useState(item[field] || '');
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => { setVal(item[field] || ''); }, [item[field]]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = React.useCallback(async () => {
    const original = item[field] || '';
    if (val === original) return;
    setSaving(true);
    try {
      await axios.put(`${API_URL}/api/cancelamentos/${item.id}`,
        { [field]: val },
        { headers: getAuthHeader() }
      );
      onSaved?.();
    } catch {
      toast.error('Erro ao salvar');
      setVal(original); // rollback
    } finally { setSaving(false); }
  }, [val, item, field, getAuthHeader, onSaved]);

  return { val, setVal, save, saving };
}

// Input de texto editável que salva automaticamente
function CellInput({ item, field, placeholder, onSaved, className = '' }) {
  const { val, setVal, save, saving } = useFieldSave(item, field, onSaved);
  return (
    <div className="relative">
      <input
        type="text"
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={save}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.target.blur();  // dispara o save
          }
        }}
        placeholder={placeholder}
        className={`w-full px-2 py-1.5 text-sm border rounded bg-background focus:ring-1 focus:ring-blue-300 focus:border-blue-400 ${className}`}
      />
      {saving && <RefreshCw className="absolute right-1 top-1/2 -translate-y-1/2 h-3 w-3 animate-spin text-slate-400" />}
    </div>
  );
}

// Textarea editável que salva automaticamente
function CellTextarea({ item, field, placeholder, onSaved }) {
  const { val, setVal, save, saving } = useFieldSave(item, field, onSaved);
  return (
    <div className="relative">
      <textarea
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={save}
        placeholder={placeholder}
        rows={2}
        className="w-full px-2 py-1.5 text-sm border rounded bg-background focus:ring-1 focus:ring-blue-300 focus:border-blue-400 resize-y min-h-[2.5rem]"
      />
      {saving && <RefreshCw className="absolute right-1 top-1 h-3 w-3 animate-spin text-slate-400" />}
    </div>
  );
}


// Campo de lookup de SKU para item similar — digita o SKU, busca nome+ID automaticamente
function SimilarLookupCell({ item, onSaved }) {
  const { getAuthHeader } = useAuth();
  const [sku, setSku] = React.useState(item.sku_similar || '');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => { setSku(item.sku_similar || ''); }, [item.sku_similar]);

  // Auto-lookup: se tem SKU mas não tem nome, busca automaticamente ao montar
  React.useEffect(() => {
    if (item.sku_similar && !item.nome_similar) {
      const skuClean = item.sku_similar.trim().toUpperCase();
      setLoading(true);
      setError('');
      axios.get(`${API_URL}/api/cancelamentos/lookup-sku/${encodeURIComponent(skuClean)}`, { headers: getAuthHeader() })
        .then(r => axios.put(`${API_URL}/api/cancelamentos/${item.id}`,
          { sku_similar: skuClean, nome_similar: r.data.nome, id_similar: r.data.id_bseller },
          { headers: getAuthHeader() }
        ).then(() => onSaved?.()))
        .catch(err => {
          const msg = err.response?.data?.detail || 'SKU não encontrado no servidor';
          setError(msg);
        })
        .finally(() => setLoading(false));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLookup = React.useCallback(async () => {
    const skuClean = sku.trim().toUpperCase();
    const original = (item.sku_similar || '').trim().toUpperCase();
    if (!skuClean || skuClean === original) return;

    setLoading(true);
    setError('');
    try {
      const r = await axios.get(`${API_URL}/api/cancelamentos/lookup-sku/${encodeURIComponent(skuClean)}`, { headers: getAuthHeader() });
      // Found — save sku_similar, nome_similar, id_similar
      await axios.put(`${API_URL}/api/cancelamentos/${item.id}`,
        { sku_similar: skuClean, nome_similar: r.data.nome, id_similar: r.data.id_bseller },
        { headers: getAuthHeader() }
      );
      onSaved?.();
    } catch (err) {
      const msg = err.response?.data?.detail || 'SKU não encontrado no servidor';
      setError(msg);
      setSku(original);  // rollback
    } finally { setLoading(false); }
  }, [sku, item, getAuthHeader, onSaved]);

  return (
    <div className="flex flex-col gap-1">
      <div className="relative">
        <input
          type="text"
          value={sku}
          onChange={e => { setSku(e.target.value.toUpperCase()); setError(''); }}
          onBlur={handleLookup}
          placeholder="SKU do similar..."
          className={`w-full px-2 py-1.5 text-xs border rounded bg-background focus:ring-1 focus:ring-blue-300 focus:border-blue-400 font-mono ${error ? 'border-red-400 bg-red-50' : item.nome_similar ? 'border-green-400' : ''}`}
        />
        {loading && <RefreshCw className="absolute right-1 top-1/2 -translate-y-1/2 h-3 w-3 animate-spin text-slate-400" />}
      </div>
      {error && <p className="text-xs text-red-600 leading-tight">{error}</p>}
    </div>
  );
}

// Célula de PROPOSTA de similares — mostra SKUs sugeridos para o analista escolher.
// Analista marca 1+ e clica "Propor" (vira Similar) ou "Seguir com cancelamento".
function SimilarPropostaCell({ item, onSaved }) {
  const { getAuthHeader } = useAuth();
  const sugeridos = item.similares_sugeridos || [];
  const [sel, setSel] = React.useState(() => new Set());
  const [saving, setSaving] = React.useState(false);

  const toggle = (sku) => {
    setSel(prev => {
      const n = new Set(prev);
      n.has(sku) ? n.delete(sku) : n.add(sku);
      return n;
    });
  };

  const propor = async () => {
    if (sel.size === 0) { toast.error('Selecione ao menos um similar'); return; }
    setSaving(true);
    try {
      await axios.post(`${API_URL}/api/cancelamentos/${item.id}/propor-similares`,
        { skus: Array.from(sel) }, { headers: getAuthHeader() });
      toast.success('Similar(es) proposto(s)');
      onSaved?.();
    } catch (e) {
      toast.error('Erro: ' + (e?.response?.data?.detail || e?.message));
    } finally { setSaving(false); }
  };

  const seguirCancelamento = async () => {
    setSaving(true);
    try {
      await axios.post(`${API_URL}/api/cancelamentos/${item.id}/seguir-cancelamento`,
        {}, { headers: getAuthHeader() });
      toast.success('Seguindo com cancelamento');
      onSaved?.();
    } catch (e) {
      toast.error('Erro: ' + (e?.response?.data?.detail || e?.message));
    } finally { setSaving(false); }
  };

  return (
    <div className="flex flex-col gap-1 min-w-[200px]">
      <div className="text-[11px] font-semibold text-purple-700 flex items-center gap-1">
        🔎 Similares sugeridos:
      </div>
      <div className="flex flex-col gap-0.5 max-h-[120px] overflow-y-auto">
        {sugeridos.map((s, i) => (
          <label key={s.sku} className="flex items-start gap-1 text-[11px] cursor-pointer hover:bg-slate-50 rounded px-1 py-0.5">
            <input type="checkbox" checked={sel.has(s.sku)} onChange={() => toggle(s.sku)} className="mt-0.5" />
            <span className="leading-tight">
              <span
                className="block text-slate-700 font-medium hover:text-blue-600 hover:underline cursor-pointer"
                title="Clique para ver a imagem do produto"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); abrirImagemProduto(s.sku, getAuthHeader); }}
              >{s.nome}</span>
              <span className="block text-[10px] text-slate-500">
                <span
                  className="font-mono hover:text-blue-600 hover:underline cursor-pointer"
                  title="Clique para copiar o SKU"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); copiar(s.sku, `SKU ${s.sku} copiado!`); }}
                >{s.sku}</span>
                {s.xd > 0 && <span className="text-emerald-600"> · XD {s.xd}</span>}
                {s.ufs?.length > 0 && <span className="text-slate-400"> ({s.ufs.join('/')})</span>}
              </span>
              {s.alerta_filial && <span className="block text-red-600 text-[10px]">⚠️ {s.alerta_filial}</span>}
            </span>
          </label>
        ))}
      </div>
      <div className="flex gap-1 mt-0.5">
        <button onClick={propor} disabled={saving}
          className="flex-1 text-[11px] px-2 py-1 rounded bg-green-100 text-green-700 border border-green-300 hover:bg-green-200 font-semibold disabled:opacity-50">
          Propor ({sel.size})
        </button>
        <button onClick={seguirCancelamento} disabled={saving}
          className="flex-1 text-[11px] px-2 py-1 rounded bg-slate-100 text-slate-600 border border-slate-300 hover:bg-slate-200 disabled:opacity-50"
          title="Não há similar adequado — seguir com o cancelamento normal">
          Cancelar
        </button>
      </div>
    </div>
  );
}

// Checkbox de "encerrado" que registra/limpa a data automaticamente
function CellEncerrado({ item, onSaved }) {
  const { getAuthHeader } = useAuth();
  const [saving, setSaving] = React.useState(false);
  const encerrado = item.status === 'encerrado';

  const toggle = async () => {
    setSaving(true);
    try {
      const payload = encerrado
        ? { status: 'pendente', data_encerramento: '' }
        : { status: 'encerrado' };
      await axios.put(`${API_URL}/api/cancelamentos/${item.id}`, payload, { headers: getAuthHeader() });
      onSaved?.();
    } catch {
      toast.error('Erro ao alternar status');
    } finally { setSaving(false); }
  };

  return (
    <label className="inline-flex items-center gap-1 cursor-pointer">
      <input
        type="checkbox"
        checked={encerrado}
        onChange={toggle}
        disabled={saving}
        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
      />
      {encerrado && item.data_encerramento && (
        <span className="text-[10px] text-slate-500 whitespace-nowrap">{formatData(item.data_encerramento)}</span>
      )}
    </label>
  );
}

// Formata data ISO ou YYYY-MM-DD para DD/MM/YYYY
function formatData(d) {
  if (!d) return '—';
  const s = String(d);
  if (s.includes('T')) {
    const dt = new Date(s);
    if (!isNaN(dt)) return dt.toLocaleDateString('pt-BR');
  }
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return s;
}

// =================== HELPER: CANAL → MÉTODO ===================
function getCanalMetodo(canalVendas) {
  const c = (canalVendas || '').toLowerCase().trim();
  // LL especial — checar antes de "ticket"
  if (c.includes('ll loyalty') || c === 'lll' || /\blll\b/.test(c)) return 'll';
  // Direto no portal
  if (c.includes('livelo')) return 'portal';
  if (c.includes('sicredi') || c === 'scd' || /\bscd\b/.test(c)) return 'portal';
  if (c === 'shb' || /\bshb\b/.test(c)) return 'portal';
  // Chamado
  if (c.includes('coopera')) return 'chamado';
  // Ocorrência
  if (c === 'csu' || /\bcsu\b/.test(c)) return 'ocorrencia';
  // Ticket genérico
  if (c.includes('tudo azul') || c === 'ta' || /\bta\b/.test(c)) return 'ticket';
  // E-mail: camicado, grs, global rewards, ltm, nice, nicequest, senff, e restantes
  return 'email';
}

const METODO_LABEL = {
  email:     'E-mail',
  chamado:   'Chamado',
  ocorrencia:'Ocorrência no Portal',
  ticket:    'Ticket no Portal',
  ll:        'Ticket no Portal (LL)',
  portal:    'Direto no Portal',
};

// =================== MODAL: TEXTO CANCELAMENTO ===================
function TextoModal({ item, onClose }) {
  const { user } = useAuth();
  const canalVendas = item.canal_vendas || item.parceiro_planilha || '';
  const metodo = getCanalMetodo(canalVendas);

  const produto    = item.produto       || '[produto]';
  const entrega    = item.numero_pedido || '[entrega]';
  const cpf        = item.cpf_cliente   ? formatCPF(item.cpf_cliente) : '[CPF]';
  const assinatura = user?.name         || '[nome]';
  const pedidoLL   = item.pedido_externo || item.pedido_bseller || item.numero_pedido || '[número do pedido]';

  // ---- Direto no portal ----
  if (metodo === 'portal') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
        <div
          className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-sm mx-4 p-5 space-y-4"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-base flex items-center gap-2">
              🌐 Acionamento — {canalVendas}
            </h2>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="text-center py-4 space-y-3">
            <div className="text-5xl">🌐</div>
            <p className="font-semibold text-slate-700 dark:text-slate-200">Cancelamento direto no portal</p>
            <p className="text-sm text-slate-500">
              Acesse o portal do parceiro <strong>{canalVendas}</strong> e registre o cancelamento diretamente.
            </p>
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-3 space-y-2 text-left">
              {(() => {
                const pedidoSemPrefixo = (item.pedido_externo || '').replace(/^[A-Za-z]+-/, '');
                return (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-500">Pedido:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-sm text-slate-700 dark:text-slate-200">
                        {pedidoSemPrefixo || <span className="text-slate-400 italic">não informado</span>}
                      </span>
                      {pedidoSemPrefixo && (
                        <button
                          onClick={() => copiar(pedidoSemPrefixo, 'Pedido copiado!')}
                          className="text-slate-400 hover:text-blue-600"
                          title="Copiar pedido"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-500">Entrega:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold text-sm text-slate-700 dark:text-slate-200">{entrega}</span>
                  <button
                    onClick={() => copiar(entrega, 'Entrega copiada!')}
                    className="text-slate-400 hover:text-blue-600"
                    title="Copiar entrega"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-500">CPF cliente:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold text-sm text-slate-700 dark:text-slate-200">{cpf}</span>
                  <button
                    onClick={() => copiar(item.cpf_cliente || '', 'CPF copiado!')}
                    className="text-slate-400 hover:text-blue-600"
                    title="Copiar CPF"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- E-mail / chamado / ocorrência / ticket ----
  const isLL = metodo === 'll';

  // Pedido externo sem prefixo do parceiro (ex.: LLL-7c89 → 7c89, PTM-4773 → 4773)
  const pedidoExternoSemPrefixo = (item.pedido_externo || '').replace(/^[A-Za-z]+-/, '');
  // Identificador a usar no assunto/corpo: pedido externo sem prefixo; se não houver, usa entrega
  const pedidoParaAssunto = pedidoExternoSemPrefixo || entrega;

  // LL usa pedidoLL (mantém prefixo LLL-xxx pra bater com o body); demais usam pedidoParaAssunto (sem prefixo)
  const assunto = `Cancelamento - Pedido: ${isLL ? pedidoLL : pedidoParaAssunto} - CPF: ${cpf}`;

  const corpo = isLL
    ? `Olá,\n\nInfelizmente, durante a preparação do item abaixo, identificamos falha no pedido, o que nos levou a optar pelo cancelamento.\n\nID Pedido: ${pedidoLL}\nCPF cliente: ${cpf}\nProduto(s): ${produto}\n\nPoderia, por gentileza, seguir com o cancelamento e o estorno ao cliente?\n\nAtenciosamente,\n${assinatura}`
    : `Olá,\n\nInfelizmente, durante a preparação do item ${produto} - ${pedidoParaAssunto} identificamos falha no pedido, o que nos levou a optar pelo cancelamento.\n\nPoderia, por gentileza, seguir com o cancelamento e o estorno ao cliente?\n\nAtenciosamente,\n${assinatura}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-xl mx-4 p-5 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-base flex items-center gap-2">
            <span>📋</span> Template de Cancelamento
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Info do canal */}
        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2 text-xs">
          <span className="font-semibold text-slate-700 dark:text-slate-200">{canalVendas || '—'}</span>
          <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">
            {METODO_LABEL[metodo]}
          </span>
        </div>

        <div className="space-y-3">
          {/* Assunto (somente para não-LL) */}
          {assunto && (
            <div className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm">📧 Assunto</span>
                <button
                  onClick={() => copiar(assunto, 'Assunto copiado!')}
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 font-semibold border border-blue-300 transition-colors"
                >
                  <Copy className="h-3 w-3" /> Copiar
                </button>
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 rounded p-2 font-mono break-all">
                {assunto}
              </div>
            </div>
          )}

          {/* Corpo */}
          <div className="border rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm">✉️ Corpo</span>
              <button
                onClick={() => copiar(corpo, 'Texto copiado!')}
                className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 font-semibold border border-blue-300 transition-colors"
              >
                <Copy className="h-3 w-3" /> Copiar
              </button>
            </div>
            <pre className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap bg-slate-50 dark:bg-slate-800 rounded p-2 font-sans leading-relaxed">
              {corpo}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

// =================== MODAL: ZAP SIMILAR ===================
function ZapModal({ item, onClose }) {
  const { getAuthHeader } = useAuth();
  const produto = item.produto || '[produto]';
  const entrega = item.numero_pedido || '[entrega]';
  const skuSimilar = item.sku_similar || '[novo item / SKU]';
  const nomeSimilar = item.nome_similar || skuSimilar;
  const idSimilar = item.id_similar || '';
  const labelSimilar = idSimilar ? `${nomeSimilar} (ID: ${idSimilar})` : nomeSimilar;

  // Controla quais textos estão abertos (default: só a "Mensagem inicial").
  // Em telas menores os textos vinham cortados — agora cada um abre/fecha por botão.
  const [abertos, setAbertos] = React.useState({ 0: true });
  const toggleTexto = (i) => setAbertos(prev => ({ ...prev, [i]: !prev[i] }));

  // Lista de similares propostos (pode ser mais de um). Fallback: o similar único.
  const fmtSim = (s) => {
    const nome = s.nome || s.sku || '[novo item / SKU]';
    return s.id_bseller ? `${nome} (ID: ${s.id_bseller})` : nome;
  };
  const listaSimilares = (item.similares_propostos_detalhe && item.similares_propostos_detalhe.length)
    ? item.similares_propostos_detalhe
    : [{ sku: item.sku_similar || '', nome: item.nome_similar || '', id_bseller: item.id_similar || '' }];
  const multiplosSimilares = listaSimilares.length > 1;

  const skuOriginal = item.codigo_item_vtex || '';

  // Busca lazy de imagens (original + similares) que não vieram salvas
  const [imgMap, setImgMap] = React.useState({});
  React.useEffect(() => {
    const skusBuscar = [];
    listaSimilares.forEach(s => { if (s.sku && !s.image_url) skusBuscar.push(s.sku); });
    if (skuOriginal) skusBuscar.push(skuOriginal);
    skusBuscar.filter(sk => sk && !imgMap[sk]).forEach(sk => {
      axios.get(`${API_URL}/api/produtos/imagem/${encodeURIComponent(sk)}`, { headers: getAuthHeader() })
        .then(r => { if (r.data?.image_url) setImgMap(prev => ({ ...prev, [sk]: r.data.image_url })); })
        .catch(() => {});
    });
  }, []); // eslint-disable-line
  const imgDe = (s) => s.image_url || imgMap[s.sku] || '';
  const linkOriginal = imgMap[skuOriginal] || '';

  // Custo (último preço de compra) do original + similares — pra decidir o envio
  const [custoMap, setCustoMap] = React.useState({});
  React.useEffect(() => {
    const sk = [skuOriginal, ...listaSimilares.map(s => s.sku)].filter(Boolean);
    if (!sk.length) return;
    axios.get(`${API_URL}/api/cancelamentos/custo-skus?skus=${encodeURIComponent(sk.join(','))}`, { headers: getAuthHeader() })
      .then(r => setCustoMap(r.data?.custos || {}))
      .catch(() => {});
  }, []); // eslint-disable-line
  const custoDe = (s) => { const c = custoMap[(s?.sku || '').toUpperCase()]; return (c != null) ? c : null; };
  const custoOriginal = (custoMap[(skuOriginal || '').toUpperCase()] != null) ? custoMap[(skuOriginal || '').toUpperCase()] : null;
  const linkSufixo = (url) => url ? ` - ${url}` : '';
  const fmtSimComLink = (s) => `${fmtSim(s)}${linkSufixo(imgDe(s))}`;

  // Bloco para a mensagem inicial (plural quando há mais de um), com link da imagem
  const blocoInicial = multiplosSimilares
    ? `Temos como alternativa os seguintes itens similares:\n${listaSimilares.map((s, i) => `${i + 1}) ${fmtSimComLink(s)}`).join('\n')}\nPoderia confirmar se aceita a substituição por um deles?`
    : `Temos como alternativa um item similar: ${fmtSimComLink(listaSimilares[0])}. Poderia confirmar se aceita a substituição pelo item similar?`;
  // Bloco para "cliente aceita"
  const blocoAceita = multiplosSimilares
    ? `os novos itens:\n${listaSimilares.map((s, i) => `${i + 1}) ${fmtSimComLink(s)}`).join('\n')}`
    : `o novo item - ${fmtSimComLink(listaSimilares[0])}`;

  // Alerta de incompatibilidade: verifica se produto e similar têm palavras em comum
  const STOPWORDS = new Set(['de','da','do','em','com','para','e','a','o','um','uma','os','as','na','no','por','se']);
  const palavras = (txt) => txt.toLowerCase().split(/\W+/).filter(w => w.length > 3 && !STOPWORDS.has(w));
  const similarIncompativel = (() => {
    if (!item.nome_similar || !item.produto) return false;
    const pProd = new Set(palavras(item.produto));
    const pSim  = palavras(item.nome_similar);
    return !pSim.some(w => pProd.has(w)); // nenhuma palavra em comum
  })();

  const templates = [
    {
      label: 'Mensagem inicial',
      emoji: '💬',
      texto: `Boa tarde\nInfelizmente, tivemos uma falha sistêmica no item ${produto} - ${entrega}${linkSufixo(linkOriginal)}\n${blocoInicial}\nAguardamos retorno e seguimos à disposição.\nAtenciosamente!\nAtendimento Weconnect`,
    },
    {
      label: 'Cliente não aceita',
      emoji: '❌',
      texto: `Agradecemos a confirmação, Iremos acionar o canal de troca/venda para estornar os valores pagos. Nossas sinceras desculpas pelo ocorrido.\nAtenciosamente!\nAtendimento Weconnect`,
    },
    {
      label: 'Cliente aceita',
      emoji: '✅',
      texto: `Agradecemos a confirmação, seguiremos com a preparação d${multiplosSimilares ? 'os' : 'o'} ${blocoAceita}.\nNossas sinceras desculpas pelo ocorrido.\nAtenciosamente!\nAtendimento Weconnect`,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-xl mx-4 p-5 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-base flex items-center gap-2">
            <span>📱</span> Templates WhatsApp — Similar
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2 space-y-0.5">
          <div><strong>Produto:</strong> {produto}</div>
          <div><strong>Entrega:</strong> {entrega}</div>
          {item.nome_cliente && <div><strong>Cliente:</strong> {item.nome_cliente}</div>}
          {(() => {
            const foneRaw = item.fone_cliente || '';
            const foneDigits = foneRaw.replace(/\D/g, '');
            if (!foneDigits) return null;
            const wa = foneDigits.length <= 11 ? `55${foneDigits}` : foneDigits;
            return (
              <div className="flex items-center gap-2">
                <strong>Telefone:</strong>
                <button
                  onClick={() => copiar(foneRaw, 'Telefone copiado!')}
                  title="Clique para copiar"
                  className="font-mono hover:text-blue-600 hover:underline cursor-pointer"
                >{foneRaw}</button>
                <a
                  href={`https://wa.me/${wa}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Abrir no WhatsApp"
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-100 text-green-700 border border-green-300 hover:bg-green-200 text-[11px] font-semibold"
                >📱 WhatsApp</a>
              </div>
            );
          })()}
          <div className="flex items-start gap-1">
            <strong>{multiplosSimilares ? 'Similares:' : 'Similar:'}</strong>
            {multiplosSimilares ? (
              <span>{listaSimilares.map((s, i) => <span key={s.sku} className="block">{i + 1}) {fmtSim(s)}</span>)}</span>
            ) : (
              <span>{labelSimilar}</span>
            )}
            {similarIncompativel && (
              <span
                title="Atenção: O produto proposto como similar, possui uma descrição incompatível com o produto adquirido. Confirme antes de oferecer."
                className="cursor-help text-amber-500"
              >⚠️</span>
            )}
          </div>
        </div>

        {/* Imagens + custo: original x similar(es) — comparar custo e decidir o envio */}
        {(linkOriginal || custoOriginal != null || listaSimilares.some(s => imgDe(s) || custoDe(s) != null)) && (
          <div className="space-y-1">
            <div className="text-xs font-semibold text-slate-600">🖼️ Comparação (clique para abrir / copiar link):</div>
            <div className="flex flex-wrap gap-3 items-start">
              {/* Original */}
              {(linkOriginal || custoOriginal != null) && (
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[10px] font-semibold text-slate-500">ORIGINAL</span>
                  {linkOriginal ? (
                    <a href={linkOriginal} target="_blank" rel="noopener noreferrer" title="Abrir imagem">
                      <img src={linkOriginal} alt={produto}
                        className="w-24 h-24 object-contain border-2 border-slate-300 rounded bg-white" />
                    </a>
                  ) : (
                    <div className="w-24 h-24 flex items-center justify-center border-2 border-dashed border-slate-200 rounded text-[10px] text-slate-400">sem imagem</div>
                  )}
                  {custoOriginal != null && (
                    <span className="text-[11px] font-semibold text-slate-700">Custo: {formatMoney(custoOriginal)}</span>
                  )}
                  {linkOriginal && (
                    <button onClick={() => copiar(linkOriginal, 'Link do original copiado!')}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 border text-slate-600">📋 Copiar link</button>
                  )}
                </div>
              )}
              {(linkOriginal || custoOriginal != null) && listaSimilares.some(s => imgDe(s) || custoDe(s) != null) && (
                <div className="self-center text-2xl text-slate-300">→</div>
              )}
              {/* Similares */}
              {listaSimilares.filter(s => imgDe(s) || custoDe(s) != null).map((s) => {
                const cs = custoDe(s);
                const dif = (cs != null && custoOriginal != null) ? Math.round((cs - custoOriginal) * 100) / 100 : null;
                return (
                <div key={s.sku} className="flex flex-col items-center gap-1">
                  <span className="text-[10px] font-semibold text-green-600">SIMILAR</span>
                  {imgDe(s) ? (
                    <a href={imgDe(s)} target="_blank" rel="noopener noreferrer" title="Abrir imagem">
                      <img src={imgDe(s)} alt={s.nome}
                        className="w-24 h-24 object-contain border-2 border-green-300 rounded bg-white" />
                    </a>
                  ) : (
                    <div className="w-24 h-24 flex items-center justify-center border-2 border-dashed border-green-200 rounded text-[10px] text-slate-400">sem imagem</div>
                  )}
                  {cs != null && (
                    <span className="text-[11px] font-semibold text-slate-700">
                      Custo: {formatMoney(cs)}
                      {dif != null && (
                        <span className={dif > 0 ? 'text-red-600' : dif < 0 ? 'text-emerald-600' : ''}>
                          {' '}({dif >= 0 ? '+' : '−'}{formatMoney(Math.abs(dif))})
                        </span>
                      )}
                    </span>
                  )}
                  {imgDe(s) && (
                    <button onClick={() => copiar(imgDe(s), 'Link do similar copiado!')}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 border text-slate-600">📋 Copiar link</button>
                  )}
                </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="space-y-3">
          {templates.map((t, i) => {
            const aberto = !!abertos[i];
            return (
              <div key={i} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => toggleTexto(i)}
                    className="flex items-center gap-1.5 font-semibold text-sm hover:text-blue-600 transition-colors"
                    title={aberto ? 'Recolher texto' : 'Abrir texto'}
                  >
                    {aberto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    {t.emoji} {t.label}
                  </button>
                  <button
                    onClick={() => copiar(t.texto, `"${t.label}" copiado!`)}
                    className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-green-100 text-green-700 hover:bg-green-200 font-semibold border border-green-300 transition-colors"
                  >
                    <Copy className="h-3 w-3" /> Copiar
                  </button>
                </div>
                {aberto && (
                  <pre className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap bg-slate-50 dark:bg-slate-800 rounded p-2 font-sans leading-relaxed">
                    {t.texto}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// =================== TABELA POR TIPO ===================
function TabelaCancelamentos({ tipo, refreshKey, onRefresh }) {
  const { getAuthHeader, user } = useAuth();
  // Ações (alternar Similar/Cancelar, excluir, priorizar): admin E atendente.
  // 'consulta' (somente leitura) e 'dashboard' não têm.
  const isAdmin = ['admin', 'atendente'].includes(user?.role) || user?.email === 'adneia@weconnect360.com.br';
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('pendente'); // pendente | encerrado | todos
  const [filtroParceiro, setFiltroParceiro] = useState('');
  const [filtroEntrega, setFiltroEntrega] = useState('');
  const [filtroProduto, setFiltroProduto] = useState('');
  const [filtroCanal, setFiltroCanal] = useState('');
  const [verCompras, setVerCompras] = useState(false);  // true = visualiza só os em_compras
  const [showNovo, setShowNovo] = useState(false);
  const [zapModal, setZapModal] = React.useState(null);
  const [textoModal, setTextoModal] = React.useState(null);

  const togglePrioridade = async (item) => {
    try {
      await axios.put(
        `${API_URL}/api/cancelamentos/${item.id}`,
        { prioridade: !item.prioridade },
        { headers: getAuthHeader() }
      );
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, prioridade: !item.prioridade } : i));
    } catch (e) {
      alert('Erro prioridade: ' + (e?.response?.data?.detail || e?.message || 'erro desconhecido'));
    }
  };

  const toggleEmCompras = async (item) => {
    const novo = !item.em_compras;
    try {
      await axios.put(
        `${API_URL}/api/cancelamentos/${item.id}`,
        { em_compras: novo },
        { headers: getAuthHeader() }
      );
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, em_compras: novo } : i));
      toast.success(novo ? '→ Movido para Compras' : '← Voltou para o canal');
    } catch (e) {
      toast.error('Erro: ' + (e?.response?.data?.detail || e?.message || 'erro desconhecido'));
    }
  };

  // Alterna a ação deste registro entre Similar e Cancelar (somente este, não os irmãos do mesmo SKU).
  const toggleAcao = async (item) => {
    const eraSimilar = (item.acao || '').toLowerCase().includes('similar');
    const patch = eraSimilar
      ? { acao: 'Cancelar', analise_similar: 'cancelar' }
      : { acao: 'Similar', analise_similar: 'pendente' };
    try {
      await axios.put(`${API_URL}/api/cancelamentos/${item.id}`, patch, { headers: getAuthHeader() });
      toast.success(eraSimilar ? '→ Alterado para Cancelamento' : '→ Alterado para Similar');
      fetchItems(); onRefresh?.();
    } catch (e) {
      toast.error('Erro: ' + (e?.response?.data?.detail || e?.message || 'erro desconhecido'));
    }
  };

  // Exclui o cancelamento (uso administrativo, com confirmação).
  const excluirCancelamento = async (item) => {
    if (!window.confirm(`Excluir o cancelamento da entrega ${item.numero_pedido}?\nEsta ação não pode ser desfeita.`)) return;
    try {
      await axios.delete(`${API_URL}/api/cancelamentos/${item.id}`, { headers: getAuthHeader() });
      setItems(prev => prev.filter(i => i.id !== item.id));
      toast.success('Cancelamento excluído');
      onRefresh?.();
    } catch (e) {
      toast.error('Erro ao excluir: ' + (e?.response?.data?.detail || e?.message || 'erro desconhecido'));
    }
  };

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = { tipo, limit: 1000 };
      if (filtro !== 'todos') params.status = filtro;
      const res = await axios.get(`${API_URL}/api/cancelamentos`, { params, headers: getAuthHeader() });
      setItems(res.data?.cancelamentos || []);
    } catch (e) {
      toast.error('Erro ao carregar');
    } finally { setLoading(false); }
  }, [tipo, filtro, getAuthHeader]);

  useEffect(() => { fetchItems(); }, [fetchItems, refreshKey]);

  // Importa a devolução do Compras (arquivo da Relação Compras com Retorno + Status)
  const importarRetorno = async (file) => {
    try {
      toast.info('Lendo o retorno do Compras...');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { defval: '' });
      const rows = data.map(r => ({
        entrega: String(r['Entrega'] ?? r['Entrega Ped'] ?? r['entrega'] ?? '').split('.')[0].trim(),
        retorno: String(r['Retorno Compras'] ?? r['Retorno'] ?? '').trim(),
        status: String(r['Status'] ?? r['status'] ?? '').trim(),
      })).filter(r => r.entrega && (r.retorno || r.status));
      if (!rows.length) {
        toast.warning('Arquivo sem linhas válidas — precisa das colunas Entrega, Retorno Compras e Status.');
        return;
      }
      const res = await axios.post(`${API_URL}/api/cancelamentos/importar-retorno`, { rows }, { headers: getAuthHeader() });
      const s = res.data?.stats || {};
      toast.success(`Retorno importado: ${s.encerrados || 0} encerrados · ${s.mantidos || 0} mantidos · ${s.notas || 0} notas${s.nao_encontrados ? ` · ${s.nao_encontrados} não encontrados` : ''}`);
      fetchItems();
    } catch (e) {
      console.error(e);
      toast.error('Erro ao importar o retorno do Compras.');
    }
  };

  // Detecta se é "Similar": baseado APENAS no campo acao (não na observação)

  const isSimilar = (item) => {
    const acao = (item.acao || '').toLowerCase();
    return acao.includes('similar');
  };

  // Parceiros únicos com itens NA ABA ATIVA (para os botões de filtro rápido)
  // - pendente: só pendentes | encerrado: só encerrados | todos: todos
  const parceirosFiltrados = React.useMemo(() => {
    const counts = {};
    items.forEach(i => {
      if (filtro === 'pendente' && i.status === 'encerrado') return;
      if (filtro === 'encerrado' && i.status !== 'encerrado') return;
      const p = i.canal_vendas || i.parceiro_planilha;
      if (!p) return;
      counts[p] = (counts[p] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]); // maior quantidade primeiro
  }, [items, filtro]);

  // Filtrar + ordenar:
  //   PRIMEIRO: Similar antes de Cancelamento (similar sempre no topo)
  //   DEPOIS, 4 grupos:
  //     1 — Já acionado parceiros (tem ticket)
  //     2 — Tem atendimento mas sem ticket (acionar a seguir)
  //     3 — Falta acionar, valor ≤ R$300 (menos urgente)
  //     4 — Falta acionar, valor > R$300 (maior valor - no fim)
  //   POR FIM: data asc (mais antigo no topo, mais novo no final)
  const itemsExibidos = React.useMemo(() => {
    let arr = items;
    // Quando há BUSCA ativa (entrega / produto / canal), varre TODAS as caixas
    // (normal + Compras) — não esconde em_compras. Assim o pedido é encontrado em
    // qualquer caixa e a coluna/linha indica onde ele está.
    const buscandoAlgo = !!(filtroEntrega.trim() || filtroProduto.trim() || filtroCanal.trim());
    if (buscandoAlgo) {
      // busca global: não filtra por caixa
    } else if (verCompras) {
      // Caixa Compras: filtra só os em_compras=true (ignora outros filtros de parceiro)
      arr = arr.filter(i => i.em_compras === true);
    } else {
      // Modo normal: esconde os que foram movidos para Compras
      arr = arr.filter(i => !i.em_compras);
      if (filtroParceiro) {
        arr = arr.filter(i => (i.canal_vendas || i.parceiro_planilha) === filtroParceiro);
      }
    }
    if (filtroEntrega.trim()) {
      const q = filtroEntrega.trim();
      arr = arr.filter(i => String(i.numero_pedido || '').includes(q));
    }
    if (filtroProduto.trim()) {
      const q = filtroProduto.trim().toLowerCase();
      arr = arr.filter(i =>
        String(i.codigo_item_bseller || '').toLowerCase().includes(q) ||
        String(i.codigo_item_vtex || '').toLowerCase().includes(q) ||
        String(i.produto || '').toLowerCase().includes(q)
      );
    }
    if (filtroCanal.trim()) {
      const q = filtroCanal.trim().toLowerCase();
      arr = arr.filter(i => String(i.canal_vendas || i.parceiro_planilha || '').toLowerCase().includes(q));
    }
    const getGrupo = (i) => {
      const temTicket = i.ticket && i.ticket.trim();
      if (temTicket) return 1;
      if (i.tem_atendimento) return 2;
      const valor = Number(String(i.preco_final || '0').replace(',', '.'));
      return valor > 300 ? 4 : 3;
    };
    // Na aba Encerrados: ordena apenas por data_encerramento DESC (mais recente fechado no topo)
    if (filtro === 'encerrado') {
      return [...arr].sort((a, b) => {
        const da = a.data_encerramento || '';
        const db = b.data_encerramento || '';
        return db.localeCompare(da);
      });
    }
    const ordenado = [...arr].sort((a, b) => {
      // Tier -1: AES com estoque XD > 10 sobe ao TOPO ABSOLUTO (ação urgente: acionar Compras)
      const aXd = (tipo === 'aes' && Number(a.estoque_xd_disp || 0) > 10) ? 0 : 1;
      const bXd = (tipo === 'aes' && Number(b.estoque_xd_disp || 0) > 10) ? 0 : 1;
      if (aXd !== bXd) return aXd - bXd;
      // Tier 0: Priorizado sobe para o topo
      const aPrio = a.prioridade ? 0 : 1;
      const bPrio = b.prioridade ? 0 : 1;
      if (aPrio !== bPrio) return aPrio - bPrio;
      // Similar antes de Cancelamento
      const aSim = isSimilar(a) ? 0 : 1;
      const bSim = isSimilar(b) ? 0 : 1;
      if (aSim !== bSim) return aSim - bSim;
      // Depois, 4 grupos de ação
      const ga = getGrupo(a);
      const gb = getGrupo(b);
      if (ga !== gb) return ga - gb;
      // Por fim, data ASC
      return String(a.data || '').localeCompare(String(b.data || ''));
    });
    // AES: agrupa itens do mesmo SKU juntos, preservando a ordem de prioridade
    // (o SKU aparece na posição do seu primeiro item já ordenado).
    if (tipo === 'aes') {
      const grupos = new Map();
      for (const it of ordenado) {
        const k = (it.codigo_item_vtex || `__${it.id}`).toUpperCase();
        if (!grupos.has(k)) grupos.set(k, []);
        grupos.get(k).push(it);
      }
      return Array.from(grupos.values()).flat();
    }
    return ordenado;
  }, [items, filtroParceiro, filtroEntrega, filtroProduto, filtroCanal, filtro, tipo, verCompras]);

  // colunas: Dias, Data, Entrega, Parceiro, Cliente, Produto, [XD AES | Motivo ETR | MotivoRejeicao err], Valor, Ticket, Instância, [Template AES | Nova entrega err], Encerrado, Observação
  const colSpan = tipo === 'aes' ? 14 : tipo === 'etr' ? 13 : 14;

  return (
    <div className="space-y-3">
      {/* Filtros de status + ação */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2">
          <Button size="sm" variant={filtro === 'pendente' ? 'default' : 'outline'} onClick={() => { setFiltro('pendente'); setFiltroParceiro(''); }}>
            Pendentes
          </Button>
          <Button size="sm" variant={filtro === 'encerrado' ? 'default' : 'outline'} onClick={() => { setFiltro('encerrado'); setFiltroParceiro(''); }}>
            Encerrados
          </Button>
          <Button size="sm" variant={filtro === 'todos' ? 'default' : 'outline'} onClick={() => { setFiltro('todos'); setFiltroParceiro(''); }}>
            Todos
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {tipo === 'aes' && (
            <Button size="sm" variant="outline"
              onClick={() => copiar(
                'Boa tarde, recebemos para cancelamento na planilha de AET os itens em anexo, porém consta estoque na data de hoje. Poderiam verificar se seguimos com o cancelamento?',
                'Texto copiado!'
              )}
              className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-300">
              📋 Texto Compras
            </Button>
          )}
          {tipo === 'aes' && (
            <Button size="sm" variant="outline" onClick={() => baixarRelacaoComprasXLSX(getAuthHeader)}
              className="bg-red-50 hover:bg-red-100 text-red-700 border-red-300">
              ⚠️ Relação Compras
            </Button>
          )}
          {tipo === 'aes' && (
            <label
              className="inline-flex items-center gap-1 text-sm font-medium h-9 px-3 rounded-md border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 cursor-pointer"
              title="Importar o arquivo devolvido pelo Compras (Relação Compras com Retorno Compras + Status)">
              ⬆️ Importar Retorno
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) importarRetorno(f); e.target.value = ''; }} />
            </label>
          )}
          <Button size="sm" onClick={() => setShowNovo(true)}>
            <Plus className="h-4 w-4 mr-1" /> Novo
          </Button>
        </div>
      </div>

      {/* Botões rápidos por parceiro — aparecem em qualquer aba (pendente / encerrado / todos) */}
      {(parceirosFiltrados.length > 0 || tipo === 'aes') && (
        <div className="flex items-center gap-2 flex-wrap py-1">
          <span className="text-xs text-slate-500 font-medium mr-1">Filtrar parceiro:</span>
          {/* Botão "Compras" — só pra AES */}
          {tipo === 'aes' && (() => {
            const qtdCompras = items.filter(i => i.em_compras === true && (filtro === 'todos' ? true : (filtro === 'encerrado' ? i.status === 'encerrado' : i.status !== 'encerrado'))).length;
            return (
              <button
                type="button"
                onClick={() => { setVerCompras(v => !v); setFiltroParceiro(''); }}
                className={`text-xs px-2.5 py-1 rounded-full border font-semibold transition-colors ${
                  verCompras
                    ? 'bg-orange-600 text-white border-orange-600'
                    : 'bg-orange-50 text-orange-700 border-orange-300 hover:bg-orange-100'
                }`}
                title="Cancelamentos AES movidos para a caixa Compras"
              >
                🛒 Compras
                <span className={`ml-1 px-1.5 py-0 rounded ${verCompras ? 'bg-white/20' : 'bg-orange-200'}`}>{qtdCompras}</span>
              </button>
            );
          })()}
          {!verCompras && parceirosFiltrados.map(([nome, qtd]) => (
            <button
              key={nome}
              type="button"
              onClick={() => setFiltroParceiro(filtroParceiro === nome ? '' : nome)}
              className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                filtroParceiro === nome
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              {nome} <span className={`ml-1 px-1.5 py-0 rounded ${filtroParceiro === nome ? 'bg-white/20' : 'bg-slate-200 dark:bg-slate-700'}`}>{qtd}</span>
            </button>
          ))}
          {filtroParceiro && (
            <button
              type="button"
              onClick={() => setFiltroParceiro('')}
              className="text-xs px-2 py-1 text-slate-500 hover:text-slate-700"
            >
              ✕ limpar
            </button>
          )}
        </div>
      )}

      {/* Indicador de filtros ativos */}
      {(filtroParceiro || filtroEntrega || filtroProduto || filtroCanal) && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>Mostrando {itemsExibidos.length} de {items.length}</span>
          <Button size="sm" variant="ghost" onClick={() => { setFiltroParceiro(''); setFiltroEntrega(''); setFiltroProduto(''); setFiltroCanal(''); }}>
            <X className="h-4 w-4 mr-1" /> Limpar filtros
          </Button>
        </div>
      )}

      {/* Tabela com edição inline */}
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900/30 border-b">
            <tr className="text-left">
              <th className="px-2 py-2 font-medium text-slate-600 w-20 text-center">Tipo / Dias</th>
              <th className="px-2 py-2 font-medium text-slate-600 whitespace-nowrap">Data</th>
              <th className="px-2 py-2 font-medium text-slate-600 w-[110px]">
                <div>Entrega</div>
                <input
                  type="text"
                  placeholder="🔍 filtrar..."
                  value={filtroEntrega}
                  onChange={e => setFiltroEntrega(e.target.value)}
                  className="mt-1 w-full px-2 py-1 text-xs font-normal border rounded bg-background focus:ring-1 focus:ring-blue-300"
                />
              </th>
              <th className="px-2 py-2 font-medium text-slate-600 w-[110px]">
                <div>Parceiro</div>
                <input
                  type="text"
                  placeholder="🔍 canal..."
                  value={filtroCanal}
                  onChange={e => setFiltroCanal(e.target.value)}
                  className="mt-1 w-full px-2 py-1 text-xs font-normal border rounded bg-background focus:ring-1 focus:ring-blue-300"
                />
              </th>
              <th className="px-2 py-2 font-medium text-slate-600">Cliente</th>
              <th className="px-2 py-2 font-medium text-slate-600 max-w-[260px]">
                <div>Produto</div>
                <input
                  type="text"
                  placeholder="🔍 ID / SKU / nome..."
                  value={filtroProduto}
                  onChange={e => setFiltroProduto(e.target.value)}
                  className="mt-1 w-full px-2 py-1 text-xs font-normal border rounded bg-background focus:ring-1 focus:ring-blue-300"
                />
              </th>
              {tipo === 'aes' && <th className="px-2 py-2 font-medium text-slate-600 w-16 text-center" title="Estoque cross-dock (SIGEQ425)">XD</th>}
              {tipo === 'etr' && <th className="px-2 py-2 font-medium text-slate-600">Motivo</th>}
              {tipo === 'erro_nota' && <th className="px-2 py-2 font-medium text-slate-600">Motivo Rejeição</th>}
              <th className="px-2 py-2 font-medium text-slate-600 text-right whitespace-nowrap">Valor</th>
              <th className="px-2 py-2 font-medium text-slate-600 w-32">Ticket</th>
              <th className="px-2 py-2 font-medium text-slate-600 w-28">Instância</th>
              {tipo === 'aes' && <th className="px-2 py-2 font-medium text-slate-600 w-32">Template</th>}
              {tipo === 'erro_nota' && <th className="px-2 py-2 font-medium text-slate-600 w-28">Nova entrega</th>}
              <th className="px-2 py-2 font-medium text-slate-600 w-20 text-center">Encerrado</th>
              <th className="px-2 py-2 font-medium text-slate-600 min-w-[320px]">Observação</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={colSpan} className="px-3 py-8 text-center text-slate-400">Carregando...</td></tr>
            ) : itemsExibidos.length === 0 ? (
              <tr><td colSpan={colSpan} className="px-3 py-8 text-center text-slate-400">Nenhum cancelamento</td></tr>
            ) : itemsExibidos.map(item => {
              const valor = Number(String(item.preco_final || '0').replace(',', '.'));
              const valorAlto = valor > 300;
              const similar = isSimilar(item);
              const isParcial = !!item.is_parcial;
              const isSicredi = (item.canal_vendas || item.parceiro_planilha || '').toLowerCase().includes('sicredi');
              return (
              <tr key={item.id} className={`border-b hover:bg-slate-50/30 dark:hover:bg-slate-900/10 ${item.status === 'encerrado' ? 'opacity-60' : ''} ${valorAlto && item.status !== 'encerrado' ? 'bg-red-50/40 dark:bg-red-950/10' : ''}`}>
                <td className="px-2 py-2 text-center">
                  <div className="flex flex-col items-center gap-0.5">
                    <StatusBadge item={item} />
                    {similar ? (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200 font-semibold uppercase tracking-wide whitespace-nowrap">
                        🔄 {isParcial ? 'Similar Parcial' : 'Similar'}
                      </span>
                    ) : (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200 font-semibold uppercase tracking-wide whitespace-nowrap">
                        ✕ {isParcial ? 'Cancelar Parcial' : 'Cancelar'}
                      </span>
                    )}
                    {isParcial && isSicredi && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-800 border border-yellow-300 font-semibold whitespace-nowrap" title="SICREDI não aceita cancelamento parcial">
                        ⚠️ SICREDI
                      </span>
                    )}
                    {item.prioridade && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-300 font-semibold whitespace-nowrap">
                        ⭐ Priorizado
                      </span>
                    )}
                    {isAdmin && (
                      <input
                        type="checkbox"
                        checked={!!item.prioridade}
                        onChange={() => togglePrioridade(item)}
                        title={item.prioridade ? 'Remover prioridade' : 'Priorizar este item'}
                        className="mt-1 h-3.5 w-3.5 cursor-pointer accent-blue-600"
                      />
                    )}
                    {isAdmin && (
                      <div className="mt-1 flex items-center gap-1">
                        {tipo === 'aes' && (
                          <button
                            type="button"
                            onClick={() => toggleAcao(item)}
                            title={similar ? 'Alterar para Cancelamento' : 'Alterar para Similar (propor)'}
                            className={`w-6 h-6 flex items-center justify-center rounded-full border text-xs font-bold transition-colors ${similar ? 'bg-orange-50 text-orange-600 border-orange-300 hover:bg-orange-100' : 'bg-purple-50 text-purple-600 border-purple-300 hover:bg-purple-100'}`}
                          >
                            {similar ? '✕' : '🔄'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => excluirCancelamento(item)}
                          title="Excluir este cancelamento"
                          className="w-6 h-6 flex items-center justify-center rounded-full border bg-red-50 text-red-600 border-red-200 hover:bg-red-100 transition-colors"
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-2 py-2 text-sm whitespace-nowrap text-slate-600">{formatData(item.data)}</td>
                <td className="px-2 py-2 font-mono text-sm">
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => copiar(item.numero_pedido, 'Entrega copiada!')}
                      className="hover:text-blue-600 inline-flex items-center gap-1"
                    >
                      {item.numero_pedido} <Copy className="h-3 w-3 opacity-50" />
                    </button>
                    {item.tem_atendimento && (
                      <span
                        className="text-[10px] text-blue-700 dark:text-blue-400 font-semibold inline-flex items-center gap-1"
                        title={`Solicitação: ${item.solicitacao_atendimento || '—'} · Atendimento: ${item.id_atendimento || '—'}`}
                      >
                        🎫 {item.solicitacao_atendimento || 'Atendimento aberto'}
                      </span>
                    )}
                    {/* Caixa onde o pedido está (útil na busca global, que varre as duas) */}
                    <span
                      className={`text-[10px] font-semibold inline-flex items-center gap-1 w-fit px-1.5 py-0.5 rounded ${item.em_compras ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}
                      title={item.em_compras ? 'Caixa 🛒 Compras (movido para Compras)' : 'Lista normal (por canal)'}
                    >
                      {item.em_compras ? '🛒 Compras' : '📋 Normal'}
                    </span>
                  </div>
                </td>
                <td className="px-2 py-2 text-sm">{item.canal_vendas || item.parceiro_planilha || '—'}</td>
                <td className="px-2 py-2 text-sm">{item.nome_cliente || '—'}</td>
                <td className="px-2 py-2 text-sm max-w-[260px]">
                  <button
                    onClick={() => abrirImagemProduto(item.codigo_item_vtex, getAuthHeader)}
                    title="Clique para ver a imagem do produto"
                    className="leading-tight text-left hover:text-blue-600 hover:underline cursor-pointer"
                  >{item.produto || '—'}</button>
                  {item.codigo_item_vtex && (
                    <button
                      onClick={() => copiar(item.codigo_item_vtex, `SKU ${item.codigo_item_vtex} copiado!`)}
                      title="Clique para copiar o SKU"
                      className="block text-[10px] text-slate-400 font-mono mt-0.5 hover:text-blue-600 hover:underline cursor-pointer"
                    >{item.codigo_item_vtex}</button>
                  )}
                </td>
                {tipo === 'aes' && (() => {
                  const xd = Number(item.estoque_xd_disp || 0);
                  const emCompras = item.em_compras === true;
                  // Em Compras: badge laranja com seta de voltar
                  if (emCompras) {
                    return (
                      <td className="px-2 py-2 text-center">
                        <button
                          onClick={() => toggleEmCompras(item)}
                          title="Em Compras — clique para voltar ao canal"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-400 font-bold text-xs hover:bg-orange-200"
                        >
                          🛒 {xd}
                        </button>
                      </td>
                    );
                  }
                  if (xd > 10) {
                    return (
                      <td className="px-2 py-2 text-center">
                        <button
                          onClick={() => toggleEmCompras(item)}
                          title={`Estoque ${xd} — clique para mover para a caixa Compras`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-300 font-bold text-xs hover:bg-red-200"
                        >
                          ⚠️ {xd}
                        </button>
                      </td>
                    );
                  }
                  if (xd > 0) {
                    return <td className="px-2 py-2 text-center text-xs text-slate-500">{xd}</td>;
                  }
                  return <td className="px-2 py-2 text-center text-xs text-slate-400">0</td>;
                })()}
                {tipo === 'etr' && <td className="px-2 py-2 text-sm">{item.motivo || '—'}</td>}
                {tipo === 'erro_nota' && <td className="px-2 py-2 text-sm max-w-[200px] truncate" title={item.motivo_rejeicao}>{item.motivo_rejeicao || '—'}</td>}
                <td className={`px-2 py-2 text-right font-bold whitespace-nowrap text-sm ${valorAlto ? 'text-red-600' : 'text-emerald-700'}`}>
                  {formatMoney(item.preco_final)}
                </td>
                <td className="px-2 py-2">
                  <CellInput item={item} field="ticket" placeholder="—" onSaved={() => { fetchItems(); onRefresh?.(); }} />
                </td>
                <td className="px-2 py-2">
                  <CellInput item={item} field="instancia" placeholder="—" onSaved={() => { fetchItems(); onRefresh?.(); }} />
                </td>
                {tipo === 'aes' && (
                  <td className="px-2 py-2">
                    {item.analise_similar === 'pendente' && (item.similares_sugeridos || []).length > 0 ? (
                      <SimilarPropostaCell item={item} onSaved={() => { fetchItems(); onRefresh?.(); }} />
                    ) : similar ? (
                      <div className="flex flex-col gap-1">
                        <SimilarLookupCell item={item} onSaved={() => { fetchItems(); onRefresh?.(); }} />

                        {(() => {
                          const STOP = new Set(['de','da','do','em','com','para','e','a','o','um','uma','os','as','na','no','por','se']);
                          const pw = (t) => (t||'').toLowerCase().split(/\W+/).filter(w => w.length > 3 && !STOP.has(w));
                          const incompat = item.nome_similar && item.produto && !pw(item.nome_similar).some(w => new Set(pw(item.produto)).has(w));
                          return (
                            <button
                              onClick={() => setZapModal(item)}
                              title={incompat ? "Atenção: O produto proposto como similar, possui uma descrição incompatível com o produto adquirido. Confirme antes de oferecer." : undefined}
                              className={`inline-flex items-center justify-center gap-1 text-xs px-2 py-1 rounded-full font-semibold border transition-colors whitespace-nowrap ${incompat ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-400' : 'bg-green-100 text-green-700 hover:bg-green-200 border-green-300'}`}
                            >
                              {incompat ? '⚠️' : '📱'} Zap
                            </button>
                          );
                        })()}
                      </div>
                    ) : (
                      (() => {
                        const metodo = getCanalMetodo(item.canal_vendas || item.parceiro_planilha || '');
                        return (
                          <button
                            onClick={() => setTextoModal(item)}
                            className={`inline-flex items-center justify-center gap-1 text-xs px-2 py-1 rounded-full font-semibold border transition-colors whitespace-nowrap ${
                              metodo === 'portal'
                                ? 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-300'
                                : 'bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-300'
                            }`}
                          >
                            {metodo === 'portal' ? '🌐 Portal' : '📋 Texto'}
                          </button>
                        );
                      })()
                    )}
                  </td>
                )}
                {tipo === 'erro_nota' && (
                  <td className="px-2 py-2">
                    <CellInput item={item} field="nova_entrega" placeholder="—" onSaved={() => { fetchItems(); onRefresh?.(); }} />
                  </td>
                )}
                <td className="px-2 py-2 text-center">
                  <CellEncerrado item={item} onSaved={() => { fetchItems(); onRefresh?.(); }} />
                </td>
                <td className="px-2 py-2 min-w-[320px]">
                  <CellTextarea item={item} field="observacao" placeholder="Adicionar nota..." onSaved={() => { fetchItems(); onRefresh?.(); }} />
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <NovoCancelamentoDialog
        open={showNovo}
        onClose={() => setShowNovo(false)}
        tipo={tipo}
        onCreated={() => { fetchItems(); onRefresh?.(); }}
      />

      {zapModal && <ZapModal item={zapModal} onClose={() => setZapModal(null)} />}
      {textoModal && <TextoModal item={textoModal} onClose={() => setTextoModal(null)} />}
    </div>
  );
}

// =================== EXPORT DIRETO: RELAÇÃO COMPRAS XLSX ===================
async function baixarRelacaoComprasXLSX(getAuthHeader) {
  // Gerado no backend (openpyxl): inclui a coluna "Retorno Compras" e destaca em
  // AMARELO os itens já avaliados pelo Compras (que ainda constam com estoque).
  try {
    const r = await axios.get(`${API_URL}/api/cancelamentos/relacao-compras-xlsx`,
      { headers: getAuthHeader(), responseType: 'blob' });
    const cd = r.headers['content-disposition'] || '';
    const m = /filename="?([^"]+)"?/.exec(cd);
    const fname = m ? m[1] : `Relacao de Compras - AES ${new Date().toISOString().slice(0, 10)}.xlsx`;
    const url = window.URL.createObjectURL(new Blob([r.data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    toast.success('Relação de Compras gerada (já avaliados pelo Compras saem em amarelo).');
  } catch (e) {
    toast.error('Erro ao gerar a Relação de Compras.');
  }
}

// =================== PÁGINA PRINCIPAL ===================
export default function Cancelamentos() {
  const { getAuthHeader } = useAuth();
  const [stats, setStats] = useState({ aes: {}, etr: {}, erro_nota: {} });
  const [similarCusto, setSimilarCusto] = useState(null); // dif média de custo original x similar
  const [refreshKey, setRefreshKey] = useState(0);
  const [tab, setTab] = useState('aes');
  const [showMensal, setShowMensal] = useState(false);
  const [showSimilares, setShowSimilares] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/cancelamentos/stats`, { headers: getAuthHeader() });
      setStats(res.data || {});
    } catch (e) { /* ignore */ }
    try {
      const r2 = await axios.get(`${API_URL}/api/cancelamentos/similar-custo`, { headers: getAuthHeader() });
      setSimilarCusto(r2.data || null);
    } catch { setSimilarCusto(null); }
  }, [getAuthHeader]);

  useEffect(() => { fetchStats(); }, [fetchStats, refreshKey]);

  const triggerRefresh = () => { setRefreshKey(k => k + 1); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <X className="h-6 w-6 text-red-600" /> Cancelamentos
          </h1>
          <p className="text-sm text-muted-foreground">Gestão de cancelamentos AES, ETR e Erro na Nota</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant={showSimilares ? 'default' : 'outline'} size="sm" onClick={() => setShowSimilares(v => !v)}>
            🔁 Similares
          </Button>
          <Button variant={showMensal ? 'default' : 'outline'} size="sm" onClick={() => setShowMensal(v => !v)}>
            <BarChart3 className="h-4 w-4 mr-1" /> Indicadores mensais
          </Button>
          <Button variant="outline" size="sm" onClick={triggerRefresh}>
            <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
          </Button>
        </div>
      </div>

      {/* Cards de stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="border rounded-lg p-4 bg-orange-50 dark:bg-orange-950/20 border-orange-200">
          <div className="flex items-center gap-2 mb-2">
            <ShoppingCart className="h-5 w-5 text-orange-600" />
            <h3 className="font-semibold text-orange-900 dark:text-orange-200">AES (Compras)</h3>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div><div className="text-2xl font-bold">{stats.aes?.total || 0}</div><div className="text-xs text-slate-500">Total</div></div>
            <div><div className="text-2xl font-bold text-amber-600">{stats.aes?.pendentes || 0}</div><div className="text-xs text-slate-500">Pendentes</div></div>
            <div><div className="text-2xl font-bold text-emerald-600">{stats.aes?.encerrados || 0}</div><div className="text-xs text-slate-500">Encerrados</div></div>
          </div>
        </div>

        <div className="border rounded-lg p-4 bg-purple-50 dark:bg-purple-950/20 border-purple-200">
          <div className="flex items-center gap-2 mb-2">
            <Factory className="h-5 w-5 text-purple-600" />
            <h3 className="font-semibold text-purple-900 dark:text-purple-200">ETR (Produção)</h3>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div><div className="text-2xl font-bold">{stats.etr?.total || 0}</div><div className="text-xs text-slate-500">Total</div></div>
            <div><div className="text-2xl font-bold text-amber-600">{stats.etr?.pendentes || 0}</div><div className="text-xs text-slate-500">Pendentes</div></div>
            <div><div className="text-2xl font-bold text-emerald-600">{stats.etr?.encerrados || 0}</div><div className="text-xs text-slate-500">Encerrados</div></div>
          </div>
        </div>

        <div className="border rounded-lg p-4 bg-red-50 dark:bg-red-950/20 border-red-200">
          <div className="flex items-center gap-2 mb-2">
            <FileWarning className="h-5 w-5 text-red-600" />
            <h3 className="font-semibold text-red-900 dark:text-red-200">Erro na Nota</h3>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div><div className="text-2xl font-bold">{stats.erro_nota?.total || 0}</div><div className="text-xs text-slate-500">Total</div></div>
            <div><div className="text-2xl font-bold text-amber-600">{stats.erro_nota?.pendentes || 0}</div><div className="text-xs text-slate-500">Pendentes</div></div>
            <div><div className="text-2xl font-bold text-emerald-600">{stats.erro_nota?.encerrados || 0}</div><div className="text-xs text-slate-500">Encerrados</div></div>
          </div>
        </div>
      </div>

      {/* Ciclo de vida do tipo ativo (qtd + valor produto+frete) */}
      {stats.lifecycle?.[tab] && (() => {
        const lc = stats.lifecycle[tab];
        const tipoLabel = tab === 'aes' ? 'AES (Compras)' : tab === 'etr' ? 'ETR (Produção)' : 'Erro na Nota';
        const cards = [
          { k: 'pendente', label: 'Pendentes', sub: 'sem ticket', cls: 'border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800', txt: 'text-slate-700 dark:text-slate-200', lbl: 'text-slate-600 dark:text-slate-300' },
          { k: 'em_tratativa', label: 'Em tratativa', sub: 'com ticket', cls: 'border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20', txt: 'text-amber-800 dark:text-amber-200', lbl: 'text-amber-700 dark:text-amber-300' },
          { k: 'similar', label: 'Similar', sub: 'recuperado', cls: 'border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/20', txt: 'text-blue-800 dark:text-blue-200', lbl: 'text-blue-700 dark:text-blue-300' },
          { k: 'cancelado', label: 'Cancelado', sub: 'entrega cancelada', cls: 'border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20', txt: 'text-red-800 dark:text-red-200', lbl: 'text-red-700 dark:text-red-300' },
          { k: 'entregue', label: 'Entregue', sub: 'faturado mesmo assim', cls: 'border-teal-200 dark:border-teal-900 bg-teal-50 dark:bg-teal-950/20', txt: 'text-teal-800 dark:text-teal-200', lbl: 'text-teal-700 dark:text-teal-300' },
          { k: 'encerrado', label: 'Encerrado', sub: 'todos desfechos', cls: 'border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/20', txt: 'text-emerald-800 dark:text-emerald-200', lbl: 'text-emerald-700 dark:text-emerald-300' },
        ];
        const desdeFmt = stats.lifecycle?.desde
          ? `${stats.lifecycle.desde.slice(5, 7)}/${stats.lifecycle.desde.slice(0, 4)}`
          : null;
        return (
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Ciclo de vida — {tipoLabel}
              {desdeFmt && <span className="font-normal normal-case"> · acumulado desde {desdeFmt}</span>}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
              {cards.map(c => (
                <div key={c.k} className={`rounded-lg border px-3 py-2 ${c.cls}`}>
                  <div className={`text-[11px] font-semibold uppercase tracking-wide ${c.lbl}`}>{c.label}<span className="font-normal normal-case opacity-70"> · {c.sub}</span></div>
                  <div className="flex items-baseline gap-2">
                    <span className={`text-2xl font-bold ${c.txt}`}>{lc[c.k]?.n || 0}</span>
                    <span className={`text-sm font-medium ${c.lbl}`}>{formatMoney(lc[c.k]?.valor || 0)}</span>
                  </div>
                  {c.k === 'similar' && tab === 'aes' && similarCusto?.n > 0 && (
                    <div className={`text-[10px] mt-0.5 ${c.lbl}`}
                      title={`Média sobre ${similarCusto.n} caso(s) com similar enviado · custo médio: original ${formatMoney(similarCusto.custo_orig_medio)} → similar ${formatMoney(similarCusto.custo_sim_medio)}`}>
                      Δ custo méd.: <b>{similarCusto.dif_media >= 0 ? '+' : '−'}{formatMoney(Math.abs(similarCusto.dif_media))}</b>
                      {similarCusto.dif_media > 0 ? ' (mais caro)' : similarCusto.dif_media < 0 ? ' (economia)' : ''}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Painel: similares enviados — original × similar (custos + diferença) */}
      {showSimilares && (
        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <h3 className="font-semibold">🔁 Similares enviados — original × similar (custo)</h3>
            <span className="text-xs text-muted-foreground">
              {similarCusto?.total_pares || 0} itens · dif. média {similarCusto?.n ? `${similarCusto.dif_media >= 0 ? '+' : '−'}${formatMoney(Math.abs(similarCusto.dif_media))}` : '—'} ({similarCusto?.n || 0} com custo)
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-y">
                <tr className="text-left">
                  <th className="px-2 py-2 font-semibold">Entrega</th>
                  <th className="px-2 py-2 font-semibold">Produto</th>
                  <th className="px-2 py-2 font-semibold">SKU original</th>
                  <th className="px-2 py-2 font-semibold">SKU similar</th>
                  <th className="px-2 py-2 font-semibold text-right">Preço venda</th>
                  <th className="px-2 py-2 font-semibold text-right">Custo original</th>
                  <th className="px-2 py-2 font-semibold text-right">Custo similar</th>
                  <th className="px-2 py-2 font-semibold text-right">Diferença</th>
                </tr>
              </thead>
              <tbody>
                {(similarCusto?.itens || []).map((it, idx) => (
                  <tr key={idx} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="px-2 py-1.5 font-mono whitespace-nowrap">{it.entrega}</td>
                    <td className="px-2 py-1.5 max-w-[280px] truncate" title={it.produto}>{it.produto || '—'}</td>
                    <td className="px-2 py-1.5 font-mono whitespace-nowrap">{it.sku_original}</td>
                    <td className="px-2 py-1.5 font-mono whitespace-nowrap" title={it.sku_registrado ? `Despachado: ${it.sku_similar} · registrado no chamado: ${it.sku_registrado}` : it.nome_similar}>
                      {it.sku_similar}
                      {it.sku_registrado ? <span className="ml-1 text-[10px] text-amber-600">≠ reg</span> : null}
                    </td>
                    <td className="px-2 py-1.5 text-right whitespace-nowrap">{it.preco_venda != null ? formatMoney(it.preco_venda) : '—'}</td>
                    <td className="px-2 py-1.5 text-right whitespace-nowrap">{it.custo_original != null ? formatMoney(it.custo_original) : '—'}</td>
                    <td className="px-2 py-1.5 text-right whitespace-nowrap">{it.custo_similar != null ? formatMoney(it.custo_similar) : '—'}</td>
                    <td className={`px-2 py-1.5 text-right font-semibold whitespace-nowrap ${it.diferenca == null ? 'text-muted-foreground' : it.diferenca > 0 ? 'text-red-600' : it.diferenca < 0 ? 'text-emerald-600' : ''}`}>
                      {it.diferenca == null ? '—' : `${it.diferenca >= 0 ? '+' : '−'}${formatMoney(Math.abs(it.diferenca))}`}
                    </td>
                  </tr>
                ))}
                {(!similarCusto?.itens || similarCusto.itens.length === 0) && (
                  <tr><td colSpan={8} className="px-2 py-6 text-center text-muted-foreground">Nenhum similar enviado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            Custo = último preço de compra. Diferença = custo do similar − custo do original (vermelho = mais caro, verde = economia). Itens sem custo cadastrado aparecem com "—".
          </p>
        </div>
      )}

      {/* Indicadores mensais: solicitações (barras) x desfechos (linhas de tendência) */}
      {showMensal && stats.lifecycle?.mensal && (() => {
        const dados = stats.lifecycle.mensal.map(r => ({
          ...r,
          mesLabel: `${r.mes.slice(5, 7)}/${r.mes.slice(2, 4)}`,
          taxaCancel: r.solicitacoes ? (r.cancelado / r.solicitacoes * 100) : 0,
        }));
        return (
          <div className="border rounded-lg p-4 bg-card">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="h-5 w-5 text-indigo-600" />
              <h3 className="font-semibold">Indicadores mensais — Solicitações e desfechos</h3>
            </div>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <ComposedChart data={dados} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="mesLabel" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip formatter={(value, name, item) => {
                    const sol = item?.payload?.solicitacoes || 0;
                    if (name === 'Solicitações' || !sol) return value;
                    return `${value} (${(value / sol * 100).toFixed(1)}%)`;
                  }} />
                  <Legend />
                  <Bar dataKey="solicitacoes" name="Solicitações" fill="#cbd5e1" radius={[3, 3, 0, 0]} />
                  <Line type="monotone" dataKey="cancelado" name="Cancelados" stroke="#dc2626" strokeWidth={2} dot={{ r: 2 }} />
                  <Line type="monotone" dataKey="similar" name="Similares" stroke="#2563eb" strokeWidth={2} dot={{ r: 2 }} />
                  <Line type="monotone" dataKey="entregue" name="Entregues" stroke="#0d9488" strokeWidth={2} dot={{ r: 2 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              Barras = volume de <strong>solicitações</strong> abertas no mês. Linhas de tendência = desfechos
              (Cancelado = entrega cancelada · Similar = recuperado · Entregue = faturado no mesmo código apesar da solicitação).
              Mês pela data de abertura do cancelamento.
            </div>

            {/* Gráfico 2: valores em R$ + % de cancelamento */}
            <h3 className="font-semibold text-sm mt-5 mb-2">Valores (R$) e % de cancelamento</h3>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <ComposedChart data={dados} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="mesLabel" fontSize={12} />
                  <YAxis yAxisId="esq" fontSize={12} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <YAxis yAxisId="dir" orientation="right" fontSize={12} domain={[0, 'auto']} tickFormatter={(v) => `${Math.round(v)}%`} />
                  <Tooltip formatter={(value, name) => (name === '% Cancel.' ? `${Number(value).toFixed(1)}%` : formatMoney(value))} />
                  <Legend />
                  <Bar yAxisId="esq" dataKey="v_solicitacoes" name="Solicitações (R$)" fill="#cbd5e1" radius={[3, 3, 0, 0]} />
                  <Line yAxisId="esq" type="monotone" dataKey="v_cancelado" name="Cancelados (R$)" stroke="#dc2626" strokeWidth={2} dot={{ r: 2 }} />
                  <Line yAxisId="esq" type="monotone" dataKey="v_similar" name="Similares (R$)" stroke="#2563eb" strokeWidth={2} dot={{ r: 2 }} />
                  <Line yAxisId="esq" type="monotone" dataKey="v_entregue" name="Entregues (R$)" stroke="#0d9488" strokeWidth={2} dot={{ r: 2 }} />
                  <Line yAxisId="dir" type="monotone" dataKey="taxaCancel" name="% Cancel." stroke="#b45309" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 2 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              Valores em R$ (produto + frete) no eixo esquerdo. A linha tracejada laranja é a <strong>% de cancelamento</strong>
              (cancelados ÷ solicitações) no eixo direito.
            </div>
          </div>
        );
      })()}

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList>
          <TabsTrigger value="aes"><ShoppingCart className="h-4 w-4 mr-1" /> AES (Compras)</TabsTrigger>
          <TabsTrigger value="etr"><Factory className="h-4 w-4 mr-1" /> ETR (Produção)</TabsTrigger>
          <TabsTrigger value="erro_nota"><FileWarning className="h-4 w-4 mr-1" /> Erro na Nota</TabsTrigger>
        </TabsList>
        <TabsContent value="aes" className="mt-4">
          <TabelaCancelamentos tipo="aes" refreshKey={refreshKey} onRefresh={triggerRefresh} />
        </TabsContent>
        <TabsContent value="etr" className="mt-4">
          <TabelaCancelamentos tipo="etr" refreshKey={refreshKey} onRefresh={triggerRefresh} />
        </TabsContent>
        <TabsContent value="erro_nota" className="mt-4">
          <TabelaCancelamentos tipo="erro_nota" refreshKey={refreshKey} onRefresh={triggerRefresh} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

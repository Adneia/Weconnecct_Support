import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
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
  Plus, Search, X, Save,
} from 'lucide-react';

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
    setNumeroPedido(''); setDadosPedido(null); setAlerta(null);
    setMotivo(''); setAcao('Cancelar'); setMotivoRejeicao('');
    setTicket(''); setInstancia(''); setZeradoReserva(null); setObservacao('');
  };

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

          {/* Dados do pedido (preview) */}
          {dadosPedido && (
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/30 border space-y-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-slate-500">Cliente:</span> <strong>{dadosPedido.nome_cliente || '—'}</strong></div>
                <div><span className="text-slate-500">CPF:</span> {formatCPF(dadosPedido.cpf_cliente)}</div>
                <div><span className="text-slate-500">Canal:</span> {dadosPedido.canal_vendas || '—'}</div>
                <div><span className="text-slate-500">Filial:</span> {dadosPedido.filial || '—'}</div>
                <div className="col-span-2"><span className="text-slate-500">Produto:</span> <strong>{dadosPedido.produto || '—'}</strong></div>
                <div><span className="text-slate-500">SKU:</span> {dadosPedido.codigo_item_vtex || dadosPedido.codigo_item_bseller || '—'}</div>
                <div><span className="text-slate-500">Fornecedor:</span> {dadosPedido.codigo_fornecedor || '—'}</div>
                <div><span className="text-slate-500">Status atual:</span> <Badge variant="outline" className="text-xs">{dadosPedido.status_pedido || '—'}</Badge></div>
                <div><span className="text-slate-500">Valor da venda:</span> <strong className="text-emerald-700">{formatMoney(dadosPedido.preco_final)}</strong></div>
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
  const pedidoLL   = item.pedido_bseller || item.numero_pedido || '[número do pedido]';

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
          <div className="text-center py-6 space-y-2">
            <div className="text-5xl">🌐</div>
            <p className="font-semibold text-slate-700 dark:text-slate-200">Cancelamento direto no portal</p>
            <p className="text-sm text-slate-500">
              Acesse o portal do parceiro <strong>{canalVendas}</strong> e registre o cancelamento diretamente.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ---- E-mail / chamado / ocorrência / ticket ----
  const isLL = metodo === 'll';

  const assunto = isLL ? null : `Cancelamento - Pedido: ${entrega} - CPF: ${cpf}`;

  const corpo = isLL
    ? `Olá,\n\nInfelizmente, durante a preparação do item abaixo, identificamos falha no pedido, o que nos levou a optar pelo cancelamento.\n\nID Pedido: ${pedidoLL}\nCPF cliente: ${cpf}\nProduto(s): ${produto}\n\nPoderia, por gentileza, seguir com o cancelamento e o estorno ao cliente?\n\nAtenciosamente,\n${assinatura}`
    : `Olá,\n\nInfelizmente, durante a preparação do item ${produto} - ${entrega} identificamos falha no pedido, o que nos levou a optar pelo cancelamento.\n\nPoderia, por gentileza, seguir com o cancelamento e o estorno ao cliente?\n\nAtenciosamente,\n${assinatura}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-xl mx-4 p-5 space-y-4"
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
  const produto = item.produto || '[produto]';
  const entrega = item.numero_pedido || '[entrega]';
  const skuSimilar = item.sku_similar || '[novo item / SKU]';

  const templates = [
    {
      label: 'Mensagem inicial',
      emoji: '💬',
      texto: `Boa tarde\nInfelizmente, tivemos uma falha sistêmica no item ${produto} - ${entrega}\nTemos como alternativa um item similar: ${skuSimilar} (ID do novo sku). Poderia confirmar se aceita a substituição pelo item similar?\nAguardamos retorno e seguimos à disposição.\nAtenciosamente!\nAtendimento Weconnect`,
    },
    {
      label: 'Cliente não aceita',
      emoji: '❌',
      texto: `Agradecemos a confirmação, Iremos acionar o canal de troca/venda para estornar os valores pagos. Nossas sinceras desculpas pelo ocorrido.\nAtenciosamente!\nAtendimento Weconnect`,
    },
    {
      label: 'Cliente aceita',
      emoji: '✅',
      texto: `Agradecemos a confirmação, seguiremos com a preparação do novo item - ${skuSimilar} (ID do novo sku).\nNossas sinceras desculpas pelo ocorrido.\nAtenciosamente!\nAtendimento Weconnect`,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-xl mx-4 p-5 space-y-4"
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
          <div><strong>Similar:</strong> {skuSimilar}</div>
        </div>
        <div className="space-y-3">
          {templates.map((t, i) => (
            <div key={i} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm">{t.emoji} {t.label}</span>
                <button
                  onClick={() => copiar(t.texto, `"${t.label}" copiado!`)}
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-green-100 text-green-700 hover:bg-green-200 font-semibold border border-green-300 transition-colors"
                >
                  <Copy className="h-3 w-3" /> Copiar
                </button>
              </div>
              <pre className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap bg-slate-50 dark:bg-slate-800 rounded p-2 font-sans leading-relaxed">
                {t.texto}
              </pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// =================== TABELA POR TIPO ===================
function TabelaCancelamentos({ tipo, refreshKey, onRefresh }) {
  const { getAuthHeader, user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.email === 'adneia@weconnect360.com.br';
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('pendente'); // pendente | encerrado | todos
  const [filtroParceiro, setFiltroParceiro] = useState('');
  const [filtroEntrega, setFiltroEntrega] = useState('');
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

  // Detecta se é "Similar": baseado APENAS no campo acao (não na observação)

  const isSimilar = (item) => {
    const acao = (item.acao || '').toLowerCase();
    return acao.includes('similar');
  };

  // Parceiros únicos COM ITENS PENDENTES (para os botões de filtro rápido)
  const parceirosPendentes = React.useMemo(() => {
    const counts = {};
    items.forEach(i => {
      if (i.status === 'encerrado') return;
      const p = i.canal_vendas || i.parceiro_planilha;
      if (!p) return;
      counts[p] = (counts[p] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]); // mais pendentes primeiro
  }, [items]);

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
    if (filtroParceiro) {
      arr = arr.filter(i => (i.canal_vendas || i.parceiro_planilha) === filtroParceiro);
    }
    if (filtroEntrega.trim()) {
      const q = filtroEntrega.trim();
      arr = arr.filter(i => String(i.numero_pedido || '').includes(q));
    }
    const getGrupo = (i) => {
      const temTicket = i.ticket && i.ticket.trim();
      if (temTicket) return 1;
      if (i.tem_atendimento) return 2;
      const valor = Number(String(i.preco_final || '0').replace(',', '.'));
      return valor > 300 ? 4 : 3;
    };
    return [...arr].sort((a, b) => {
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
  }, [items, filtroParceiro, filtroEntrega]);

  // colunas: Dias, Data, Entrega, Parceiro, Cliente, Produto, [Motivo|MotivoRejeicao], Valor, Ticket, Instância, [Nova entrega], Encerrado, Observação
  const colSpan = tipo === 'aes' ? 13 : tipo === 'etr' ? 13 : 14;

  return (
    <div className="space-y-3">
      {/* Filtros de status + ação */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2">
          <Button size="sm" variant={filtro === 'pendente' ? 'default' : 'outline'} onClick={() => setFiltro('pendente')}>
            Pendentes
          </Button>
          <Button size="sm" variant={filtro === 'encerrado' ? 'default' : 'outline'} onClick={() => setFiltro('encerrado')}>
            Encerrados
          </Button>
          <Button size="sm" variant={filtro === 'todos' ? 'default' : 'outline'} onClick={() => setFiltro('todos')}>
            Todos
          </Button>
        </div>
        <Button size="sm" onClick={() => setShowNovo(true)}>
          <Plus className="h-4 w-4 mr-1" /> Novo
        </Button>
      </div>

      {/* Botões rápidos por parceiro com pendências */}
      {filtro === 'pendente' && parceirosPendentes.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap py-1">
          <span className="text-xs text-slate-500 font-medium mr-1">Filtrar parceiro:</span>
          {parceirosPendentes.map(([nome, qtd]) => (
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
      {(filtroParceiro || filtroEntrega) && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>Mostrando {itemsExibidos.length} de {items.length}</span>
          <Button size="sm" variant="ghost" onClick={() => { setFiltroParceiro(''); setFiltroEntrega(''); }}>
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
              <th className="px-2 py-2 font-medium text-slate-600 w-[90px]">Parceiro</th>
              <th className="px-2 py-2 font-medium text-slate-600">Cliente</th>
              <th className="px-2 py-2 font-medium text-slate-600">Produto</th>
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
                  </div>
                </td>
                <td className="px-2 py-2 text-sm">{item.canal_vendas || item.parceiro_planilha || '—'}</td>
                <td className="px-2 py-2 text-sm">{item.nome_cliente || '—'}</td>
                <td className="px-2 py-2 text-sm max-w-[240px] truncate" title={item.produto}>{item.produto || '—'}</td>
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
                    {similar ? (
                      <div className="flex flex-col gap-1">
                        <CellInput item={item} field="sku_similar" placeholder="SKU similar..." onSaved={() => { fetchItems(); onRefresh?.(); }} />
                        <button
                          onClick={() => setZapModal(item)}
                          className="inline-flex items-center justify-center gap-1 text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 hover:bg-green-200 border border-green-300 font-semibold transition-colors whitespace-nowrap"
                        >
                          📱 Zap
                        </button>
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

// =================== PÁGINA PRINCIPAL ===================
export default function Cancelamentos() {
  const { getAuthHeader } = useAuth();
  const [stats, setStats] = useState({ aes: {}, etr: {}, erro_nota: {} });
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchStats = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/cancelamentos/stats`, { headers: getAuthHeader() });
      setStats(res.data || {});
    } catch (e) { /* ignore */ }
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
        <Button variant="outline" size="sm" onClick={triggerRefresh}>
          <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
        </Button>
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

      {/* Tabs */}
      <Tabs defaultValue="aes" className="w-full">
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

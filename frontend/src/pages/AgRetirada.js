import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../components/ui/dialog';
import { RefreshCw, AlertTriangle, MessageSquare, Mail, CheckCircle, ChevronDown, ChevronUp, Pencil, Clock, Package, Plus } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const TEXTO_TEMPLATE = (nome, produto, rastreio, endereco, prazo) => `Prezado(a) ${nome || '[NOME DO CLIENTE]'},

Boa tarde!

Sobre o pedido ${produto || '[PRODUTO]'}, foi redespachado via correios pela transportadora e está aguardando retirada numa agência dos Correios, conforme abaixo:

Código de rastreio: ${rastreio || '[CÓDIGO DE RASTREIO]'}${prazo ? `\nPrazo limite para retirada: ${prazo} (após essa data o objeto retorna ao remetente)` : ''}

${endereco || '[ENDEREÇO DA AGÊNCIA DOS CORREIOS]'}

Para retirá-lo é preciso informar o código do objeto e documento que comprove ser o destinatário.

Permanecemos à disposição.

Atenciosamente!
Equipe de atendimento WeConnect`;

function diasDesdeUltimaAcao(ultimaAcao) {
  if (!ultimaAcao) return null;
  try {
    const [datePart, timePart] = ultimaAcao.split(' ');
    const [d, m, y] = datePart.split('/');
    const dt = new Date(`${y}-${m}-${d}T${timePart || '00:00'}`);
    const now = new Date();
    return Math.floor((now - dt) / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

function StatusBadge({ item }) {
  if (item.status_final) {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">
        ✓ {item.status_final}
      </Badge>
    );
  }
  const dias = diasDesdeUltimaAcao(item.ultima_acao);
  if (dias === null) {
    return <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">Não acionado</Badge>;
  }
  if (dias >= 3) {
    return <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">⚠ {dias}d sem contato</Badge>;
  }
  return <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">Acionado há {dias}d</Badge>;
}

export default function AgRetirada() {
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('todos'); // 'todos' | 'pendentes' | 'finalizados'
  const [expanded, setExpanded] = useState({});
  const [basesStatus, setBasesStatus] = useState(null);

  // Modais
  const [modalAcionar, setModalAcionar] = useState(null); // pedido selecionado
  const [modalRastreio, setModalRastreio] = useState(null);
  const [modalFinalizar, setModalFinalizar] = useState(null);
  const [modalHistorico, setModalHistorico] = useState(null);

  // Estado modal "Inserir manual"
  const [modalInserir, setModalInserir] = useState(false);
  const [inserirIdent, setInserirIdent] = useState('');
  const [inserirRastreio, setInserirRastreio] = useState('');
  const [salvandoInserir, setSalvandoInserir] = useState(false);

  // Estado do modal Acionar
  const [tipoAcao, setTipoAcao] = useState('ZAP');
  const [rastreioAcionar, setRastreioAcionar] = useState('');
  const [enderecoAcionar, setEnderecoAcionar] = useState('');
  const [prazoAcionar, setPrazoAcionar] = useState('');
  const [textoAcionar, setTextoAcionar] = useState('');
  const [salvandoAcao, setSalvandoAcao] = useState(false);

  // Estado modal rastreio
  const [rastreioEdit, setRastreioEdit] = useState('');
  const [enderecoEdit, setEnderecoEdit] = useState('');
  const [prazoEdit, setPrazoEdit] = useState('');

  // Estado modal finalizar
  const [statusFinalizar, setStatusFinalizar] = useState('Entregue');

  const { getAuthHeader } = useAuth();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/retirada`, { headers: getAuthHeader() });
      setPedidos(res.data || []);
    } catch (e) {
      toast.error('Erro ao carregar pedidos');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeader]);

  // Silent refresh for polling (no loading spinner)
  const fetchDataSilent = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/retirada`, { headers: getAuthHeader() });
      setPedidos(res.data || []);
    } catch {
      // silently ignore polling errors
    }
  }, [getAuthHeader]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Buscar status das bases (tabelão auto-sync + Total Express manual)
  const fetchBasesStatus = useCallback(async () => {
    try {
      const [r1, r2] = await Promise.all([
        axios.get(`${API_URL}/api/admin/sync-all-from-postgres/status`, { headers: getAuthHeader() }).catch(() => null),
        axios.get(`${API_URL}/api/bases-manuais/status`, { headers: getAuthHeader() }).catch(() => null),
      ]);
      setBasesStatus({
        tabelao: r1?.data?.tabelao_inc?.last_finished_at || r1?.data?.tabelao?.last_finished_at || null,
        base_total: r2?.data?.base_total?.ultima_atualizacao || null,
      });
    } catch (e) { /* ignore */ }
  }, [getAuthHeader]);
  useEffect(() => {
    fetchBasesStatus();
    const interval = setInterval(fetchBasesStatus, 60000);
    return () => clearInterval(interval);
  }, [fetchBasesStatus]);

  // Auto-refresh every 60 seconds to pick up Tabelão imports
  useEffect(() => {
    const interval = setInterval(fetchDataSilent, 60000);
    return () => clearInterval(interval);
  }, [fetchDataSilent]);

  // Atualiza texto do modal Acionar quando campos mudam
  useEffect(() => {
    if (!modalAcionar) return;
    setTextoAcionar(TEXTO_TEMPLATE(
      modalAcionar.nome_cliente,
      modalAcionar.produto,
      rastreioAcionar || modalAcionar.rastreio,
      enderecoAcionar || modalAcionar.endereco_retirada,
      prazoAcionar || modalAcionar.prazo_retirada
    ));
  }, [modalAcionar, rastreioAcionar, enderecoAcionar, prazoAcionar]);

  const abrirAcionar = (pedido) => {
    setModalAcionar(pedido);
    setTipoAcao('ZAP');
    setRastreioAcionar(pedido.rastreio || '');
    setEnderecoAcionar(pedido.endereco_retirada || '');
    setPrazoAcionar(pedido.prazo_retirada || '');
    setTextoAcionar(TEXTO_TEMPLATE(pedido.nome_cliente, pedido.produto, pedido.rastreio, pedido.endereco_retirada, pedido.prazo_retirada));
  };

  const confirmarAcionar = async () => {
    if (!modalAcionar) return;
    setSalvandoAcao(true);
    try {
      await axios.post(`${API_URL}/api/retirada/${encodeURIComponent(modalAcionar.nota_fiscal)}/acionar`,
        { tipo: tipoAcao, rastreio: rastreioAcionar, endereco_retirada: enderecoAcionar, prazo_retirada: prazoAcionar },
        { headers: getAuthHeader() }
      );
      toast.success(`Acionamento via ${tipoAcao} registrado!`);
      setModalAcionar(null);
      fetchData();
    } catch {
      toast.error('Erro ao registrar acionamento');
    } finally {
      setSalvandoAcao(false);
    }
  };

  const salvarRastreio = async () => {
    if (!modalRastreio) return;
    try {
      await axios.put(`${API_URL}/api/retirada/${encodeURIComponent(modalRastreio.nota_fiscal)}/rastreio`,
        { rastreio: rastreioEdit, endereco_retirada: enderecoEdit, prazo_retirada: prazoEdit },
        { headers: getAuthHeader() }
      );
      toast.success('Rastreio salvo!');
      setModalRastreio(null);
      fetchData();
    } catch {
      toast.error('Erro ao salvar rastreio');
    }
  };

  const confirmarInserir = async () => {
    const ident = inserirIdent.trim();
    if (!ident) { toast.error('Informe a entrega ou a nota fiscal'); return; }
    setSalvandoInserir(true);
    try {
      const res = await axios.post(`${API_URL}/api/retirada/inserir-manual`,
        { identificador: ident, rastreio: inserirRastreio.trim() },
        { headers: getAuthHeader() }
      );
      if (res.data?.ja_existia) {
        toast.info(`Nota ${res.data.nota_fiscal} já estava na lista`);
      } else {
        toast.success(`Pedido inserido (NF ${res.data?.nota_fiscal})`);
      }
      setModalInserir(false);
      setInserirIdent(''); setInserirRastreio('');
      fetchData();
    } catch (e) {
      toast.error('Erro: ' + (e?.response?.data?.detail || e?.message || 'falha ao inserir'));
    } finally {
      setSalvandoInserir(false);
    }
  };

  const confirmarFinalizar = async () => {
    if (!modalFinalizar) return;
    try {
      await axios.put(`${API_URL}/api/retirada/${encodeURIComponent(modalFinalizar.nota_fiscal)}/finalizar`,
        { status_final: statusFinalizar },
        { headers: getAuthHeader() }
      );
      toast.success(`Pedido marcado como ${statusFinalizar}`);
      setModalFinalizar(null);
      fetchData();
    } catch {
      toast.error('Erro ao finalizar');
    }
  };

  // Copia para o clipboard com fallback para HTTP (navigator.clipboard só funciona em HTTPS)
  const copyToClipboard = (text, mensagem = 'Texto copiado!') => {
    const txt = String(text || '');
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(txt)
        .then(() => toast.success(mensagem))
        .catch(() => toast.error('Erro ao copiar'));
      return;
    }
    const el = document.createElement('textarea');
    el.value = txt;
    el.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;z-index:9999';
    document.body.appendChild(el);
    el.focus();
    el.select();
    el.setSelectionRange(0, txt.length);
    try {
      const ok = document.execCommand('copy');
      if (ok) toast.success(mensagem);
      else toast.error('Erro ao copiar');
    } catch {
      toast.error('Erro ao copiar');
    }
    document.body.removeChild(el);
  };

  const copiarTexto = () => copyToClipboard(textoAcionar, 'Texto copiado!');

  // Filtros
  const pedidosFiltrados = pedidos.filter(p => {
    if (filtro === 'pendentes') return !p.status_final;
    if (filtro === 'finalizados') return !!p.status_final;
    return true;
  });

  const stats = {
    total: pedidos.length,
    pendentes: pedidos.filter(p => !p.status_final).length,
    urgentes: pedidos.filter(p => !p.status_final && diasDesdeUltimaAcao(p.ultima_acao) === null).length +
              pedidos.filter(p => !p.status_final && (diasDesdeUltimaAcao(p.ultima_acao) ?? 0) >= 3).length,
    finalizados: pedidos.filter(p => !!p.status_final).length,
    alertas: pedidos.filter(p => p.alerta_transportadora && !p.status_final).length,
  };

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Disponível para Retirada</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Pedidos aguardando retirada na agência dos Correios (via Total Express)
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <Button variant="default" size="sm" onClick={() => { setInserirIdent(''); setInserirRastreio(''); setModalInserir(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Inserir manual
            </Button>
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
          {basesStatus && (
            <div className="text-[11px] text-muted-foreground text-right">
              {basesStatus.tabelao && (
                <div>Tabelão: <span className="font-medium">{new Date(basesStatus.tabelao).toLocaleString('pt-BR')}</span></div>
              )}
              {basesStatus.base_total && (
                <div>Base Total: <span className="font-medium text-red-600">{new Date(basesStatus.base_total).toLocaleString('pt-BR')}</span></div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'text-slate-700' },
          { label: 'Pendentes', value: stats.pendentes, color: 'text-blue-600' },
          { label: 'Urgentes (3+ dias)', value: stats.urgentes, color: 'text-red-600' },
          { label: 'Finalizados', value: stats.finalizados, color: 'text-emerald-600' },
          { label: '⚠ Alerta transp.', value: stats.alertas, color: 'text-amber-600' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-slate-800 rounded-lg border p-3 text-center shadow-sm">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-2">
        {[
          { key: 'todos', label: 'Todos' },
          { key: 'pendentes', label: `Pendentes (${stats.pendentes})` },
          { key: 'finalizados', label: `Finalizados (${stats.finalizados})` },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFiltro(f.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              filtro === f.key
                ? 'bg-slate-800 text-white border-slate-800 dark:bg-slate-100 dark:text-slate-900'
                : 'border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Tabela */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border shadow-sm overflow-x-auto">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
            Carregando...
          </div>
        ) : pedidosFiltrados.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p>Nenhum pedido encontrado</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/40 border-b">
              <tr>
                <th className="text-left px-3 py-3 font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">Status</th>
                <th className="text-left px-3 py-3 font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">Entrega</th>
                <th className="text-left px-3 py-3 font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">Nota</th>
                <th className="text-left px-3 py-3 font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">Canal</th>
                <th className="text-left px-3 py-3 font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">Transportadora</th>
                <th className="text-left px-3 py-3 font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">Nome</th>
                <th className="text-left px-3 py-3 font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">Telefone</th>
                <th className="text-left px-3 py-3 font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">E-mail</th>
                <th className="text-left px-3 py-3 font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">Rastreio</th>
                <th className="text-left px-3 py-3 font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">Último Acion.</th>
                <th className="text-center px-3 py-3 font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">Nº Acion.</th>
                <th className="text-center px-3 py-3 font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">Ações</th>
              </tr>
            </thead>
            <tbody>
              {pedidosFiltrados.map((p) => {
                const isFinished = !!p.status_final;
                const dias = diasDesdeUltimaAcao(p.ultima_acao);
                const isUrgente = !isFinished && (dias === null || dias >= 3);
                return (
                  <tr
                    key={p.nota_fiscal}
                    className={`border-b last:border-0 transition-colors ${
                      isFinished
                        ? 'bg-emerald-50/50 dark:bg-emerald-950/20'
                        : isUrgente
                        ? 'bg-red-50/40 dark:bg-red-950/10'
                        : 'hover:bg-slate-50/50 dark:hover:bg-slate-700/30'
                    }`}
                  >
                    <td className="px-3 py-2.5">
                      <StatusBadge item={p} />
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">{p.numero_pedido}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">{p.nota_fiscal}</td>
                    <td className="px-3 py-2.5 text-xs whitespace-nowrap">{p.canal_vendas}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        {p.alerta_transportadora && (
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" title="Transportadora não é Total Express" />
                        )}
                        <span className={`text-xs ${p.alerta_transportadora ? 'text-amber-700 dark:text-amber-400 font-medium' : ''}`}>
                          {p.transportadora || '—'}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs whitespace-nowrap max-w-[140px] truncate" title={p.nome_cliente}>{p.nome_cliente || '—'}</td>
                    <td className="px-3 py-2.5 text-xs whitespace-nowrap">{p.fone_cliente || '—'}</td>
                    <td className="px-3 py-2.5 text-xs whitespace-nowrap max-w-[160px] truncate" title={p.email_cliente}>{p.email_cliente || '—'}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        {p.rastreio ? (
                          <span className="text-xs font-mono text-slate-700 dark:text-slate-300">{p.rastreio}</span>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Sem rastreio</span>
                        )}
                        <button
                          onClick={() => { setModalRastreio(p); setRastreioEdit(p.rastreio || ''); setEnderecoEdit(p.endereco_retirada || ''); setPrazoEdit(p.prazo_retirada || ''); }}
                          className="ml-1 text-slate-400 hover:text-blue-500 transition-colors"
                          title="Editar rastreio"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {p.ultima_acao ? (
                        <div className="text-xs">
                          <div className="text-slate-700 dark:text-slate-300">{p.ultima_acao}</div>
                          {p.acoes?.length > 0 && (
                            <div className="text-slate-400 text-[10px]">
                              via {p.acoes[p.acoes.length - 1]?.tipo || '?'} · {p.acoes[p.acoes.length - 1]?.registrado_por}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-red-500 font-medium">Nunca acionado</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span className={`text-sm font-semibold ${p.num_acionamentos > 0 ? 'text-blue-600' : 'text-slate-400'}`}>
                          {p.num_acionamentos}
                        </span>
                        {p.num_acionamentos > 0 && (
                          <button
                            onClick={() => setModalHistorico(p)}
                            className="text-slate-400 hover:text-blue-500"
                            title="Ver histórico"
                          >
                            <Clock className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5 justify-center">
                        {/* Acionar */}
                        <button
                          onClick={() => abrirAcionar(p)}
                          disabled={isFinished}
                          title="Acionar cliente"
                          className={`p-1.5 rounded-md border text-xs font-medium transition-colors ${
                            isFinished
                              ? 'opacity-30 cursor-not-allowed border-slate-200 text-slate-400'
                              : isUrgente
                              ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
                              : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                          }`}
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                        </button>
                        {/* Finalizar */}
                        {!isFinished && (
                          <button
                            onClick={() => { setModalFinalizar(p); setStatusFinalizar('Entregue'); }}
                            title="Finalizar pedido"
                            className="p-1.5 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Modal: Rastreio ── */}
      <Dialog open={!!modalRastreio} onOpenChange={() => setModalRastreio(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Rastreio</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="block text-sm font-medium mb-1">Código de Rastreio (Total Express)</label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm font-mono dark:bg-slate-800 dark:border-slate-600"
                placeholder="Ex: DQ 767 736 140 BR"
                value={rastreioEdit}
                onChange={e => setRastreioEdit(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Prazo limite para retirada</label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-600"
                placeholder="Ex: 06/06/2026"
                value={prazoEdit}
                onChange={e => setPrazoEdit(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Endereço da Agência dos Correios</label>
              <textarea
                className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-600"
                rows={4}
                placeholder={"Ex:\nObjeto aguardando retirada na Caixa Postal\n\nRua Silvio Daige, 475\nJardim Tejereba\nGuarujá - SP"}
                value={enderecoEdit}
                onChange={e => setEnderecoEdit(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalRastreio(null)}>Cancelar</Button>
            <Button onClick={salvarRastreio}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Acionar ── */}
      <Dialog open={!!modalAcionar} onOpenChange={() => setModalAcionar(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Acionar Cliente — {modalAcionar?.nome_cliente}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Info do pedido */}
            <div className="grid grid-cols-2 gap-3 text-sm bg-slate-50 dark:bg-slate-900/40 rounded-lg p-3 border">
              <div><span className="text-muted-foreground">Entrega:</span> <span className="font-mono font-medium">{modalAcionar?.numero_pedido}</span></div>
              <div><span className="text-muted-foreground">Nota:</span> <span className="font-mono font-medium">{modalAcionar?.nota_fiscal}</span></div>
              <div><span className="text-muted-foreground">Canal:</span> {modalAcionar?.canal_vendas}</div>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Transportadora:</span>
                {modalAcionar?.alerta_transportadora && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                <span className={modalAcionar?.alerta_transportadora ? 'text-amber-700 font-medium' : ''}>{modalAcionar?.transportadora}</span>
              </div>
            </div>

            {/* Canal de envio */}
            <div>
              <label className="block text-sm font-medium mb-2">Enviar via</label>
              <div className="flex gap-2">
                {['ZAP', 'Email'].map(t => (
                  <button
                    key={t}
                    onClick={() => setTipoAcao(t)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      tipoAcao === t
                        ? t === 'ZAP' ? 'bg-green-600 text-white border-green-600' : 'bg-blue-600 text-white border-blue-600'
                        : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {t === 'ZAP' ? <MessageSquare className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                    {t === 'ZAP' ? 'WhatsApp' : 'E-mail'}
                  </button>
                ))}
              </div>
            </div>

            {/* Contato do cliente — muda conforme canal selecionado */}
            {tipoAcao === 'ZAP' ? (
              <div className="flex items-center gap-3 px-4 py-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                <MessageSquare className="h-4 w-4 text-green-600 flex-shrink-0" />
                <div className="flex-1">
                  <div className="text-[11px] text-green-600 dark:text-green-400 font-medium uppercase tracking-wide mb-0.5">WhatsApp</div>
                  <div className="text-base font-semibold text-green-800 dark:text-green-200">
                    {modalAcionar?.fone_cliente || <span className="text-sm font-normal italic text-green-600/70">Telefone não informado</span>}
                  </div>
                </div>
                {modalAcionar?.fone_cliente && (
                  <button
                    onClick={() => copyToClipboard(modalAcionar.fone_cliente, 'Telefone copiado!')}
                    className="text-xs text-green-700 hover:text-green-900 font-medium flex items-center gap-1 px-2 py-1 rounded border border-green-300 bg-green-100 hover:bg-green-200 transition-colors"
                  >
                    📋 Copiar
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <Mail className="h-4 w-4 text-blue-600 flex-shrink-0" />
                <div className="flex-1">
                  <div className="text-[11px] text-blue-600 dark:text-blue-400 font-medium uppercase tracking-wide mb-0.5">E-mail</div>
                  <div className="text-base font-semibold text-blue-800 dark:text-blue-200">
                    {modalAcionar?.email_cliente || <span className="text-sm font-normal italic text-blue-600/70">E-mail não informado</span>}
                  </div>
                </div>
                {modalAcionar?.email_cliente && (
                  <button
                    onClick={() => copyToClipboard(modalAcionar.email_cliente, 'E-mail copiado!')}
                    className="text-xs text-blue-700 hover:text-blue-900 font-medium flex items-center gap-1 px-2 py-1 rounded border border-blue-300 bg-blue-100 hover:bg-blue-200 transition-colors"
                  >
                    📋 Copiar
                  </button>
                )}
              </div>
            )}

            {/* Rastreio inline */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Código de Rastreio</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm font-mono dark:bg-slate-800 dark:border-slate-600"
                  placeholder="Ex: DQ 767 736 140 BR"
                  value={rastreioAcionar}
                  onChange={e => setRastreioAcionar(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Prazo limite p/ retirada</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-600"
                  placeholder="Ex: 06/06/2026"
                  value={prazoAcionar}
                  onChange={e => setPrazoAcionar(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Endereço Agência</label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-600"
                placeholder="Rua, Nº - Cidade/UF"
                value={enderecoAcionar}
                onChange={e => setEnderecoAcionar(e.target.value)}
              />
            </div>

            {/* Texto gerado */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium">Mensagem</label>
                <button
                  onClick={copiarTexto}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                >
                  📋 Copiar texto
                </button>
              </div>
              <textarea
                className="w-full border rounded-lg px-3 py-2 text-sm font-mono dark:bg-slate-800 dark:border-slate-600"
                rows={10}
                value={textoAcionar}
                onChange={e => setTextoAcionar(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAcionar(null)}>Cancelar</Button>
            <Button
              onClick={confirmarAcionar}
              disabled={salvandoAcao}
              className={tipoAcao === 'ZAP' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}
            >
              {salvandoAcao ? 'Registrando...' : `Confirmar envio via ${tipoAcao === 'ZAP' ? 'WhatsApp' : 'E-mail'}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Histórico ── */}
      <Dialog open={!!modalHistorico} onOpenChange={() => setModalHistorico(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Histórico de Acionamentos — {modalHistorico?.nota_fiscal}</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-2 max-h-80 overflow-y-auto">
            {(modalHistorico?.acoes || []).length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">Nenhum acionamento registrado</p>
            ) : (
              [...(modalHistorico?.acoes || [])].reverse().map((a, i) => (
                <div key={i} className="flex items-start gap-3 bg-slate-50 dark:bg-slate-900/40 rounded-lg p-3 border">
                  <div className={`mt-0.5 rounded-full p-1 ${a.tipo === 'ZAP' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                    {a.tipo === 'ZAP' ? <MessageSquare className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
                  </div>
                  <div>
                    <div className="text-sm font-medium">{a.tipo === 'ZAP' ? 'WhatsApp' : 'E-mail'}</div>
                    <div className="text-xs text-muted-foreground">{a.data} · por {a.registrado_por}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Finalizar ── */}
      <Dialog open={!!modalFinalizar} onOpenChange={() => setModalFinalizar(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Finalizar Pedido</DialogTitle>
          </DialogHeader>
          <div className="py-3 space-y-3">
            <p className="text-sm text-muted-foreground">
              Nota: <span className="font-mono font-medium text-slate-700 dark:text-slate-300">{modalFinalizar?.nota_fiscal}</span>
              {' — '}{modalFinalizar?.nome_cliente}
            </p>
            <div>
              <label className="block text-sm font-medium mb-2">Status final</label>
              <div className="flex gap-2">
                {['Entregue', 'Em Devolução'].map(s => (
                  <button
                    key={s}
                    onClick={() => setStatusFinalizar(s)}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      statusFinalizar === s
                        ? s === 'Entregue' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-600 text-white border-slate-600'
                        : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {s === 'Entregue' ? '✓ Entregue' : '↩ Em Devolução'}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalFinalizar(null)}>Cancelar</Button>
            <Button onClick={confirmarFinalizar} className="bg-emerald-600 hover:bg-emerald-700">
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Inserir manual na lista de retirada */}
      <Dialog open={modalInserir} onOpenChange={(o) => { if (!o) setModalInserir(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Plus className="h-5 w-5" /> Inserir pedido manualmente</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-sm text-muted-foreground">
              Adiciona um pedido à lista de Disponível para Retirada. Informe o número da
              <strong> entrega</strong> ou da <strong>nota fiscal</strong> — os dados do cliente/produto
              são puxados do tabelão automaticamente.
            </p>
            <div>
              <label className="text-xs font-medium text-slate-600">Entrega ou Nota Fiscal *</label>
              <input
                type="text"
                autoFocus
                value={inserirIdent}
                onChange={(e) => setInserirIdent(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') confirmarInserir(); }}
                placeholder="ex.: 122664533 ou 28866"
                className="mt-1 w-full px-3 py-2 text-sm border rounded bg-background focus:ring-1 focus:ring-blue-300"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Código de rastreio (opcional)</label>
              <input
                type="text"
                value={inserirRastreio}
                onChange={(e) => setInserirRastreio(e.target.value)}
                placeholder="ex.: AD388048065BR"
                className="mt-1 w-full px-3 py-2 text-sm border rounded bg-background focus:ring-1 focus:ring-blue-300 font-mono"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setModalInserir(false)}>Cancelar</Button>
            <Button size="sm" onClick={confirmarInserir} disabled={salvandoInserir || !inserirIdent.trim()}>
              {salvandoInserir ? 'Inserindo...' : 'Inserir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

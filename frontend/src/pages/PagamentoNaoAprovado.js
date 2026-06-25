import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import {
  AlertTriangle, CheckCircle, RefreshCw, Copy, FileText, CreditCard,
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

function StatusBadge({ item }) {
  if (item.status_final) {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs whitespace-nowrap">
        ✓ {item.status_final}
      </Badge>
    );
  }
  const dias = item.dias_no_status;
  if (dias === null || dias === undefined) {
    return <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-xs">Sem data</Badge>;
  }
  if (dias >= 7) {
    return (
      <Badge className="bg-red-100 text-red-700 border-red-200 text-xs whitespace-nowrap">
        ⚠ {dias}d — Urgente
      </Badge>
    );
  }
  return (
    <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs whitespace-nowrap">
      {dias}d no status
    </Badge>
  );
}

function copiar(texto, msg = 'Copiado!') {
  const str = String(texto || '');
  // navigator.clipboard só funciona em HTTPS — fallback via execCommand para HTTP
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
  el.focus();
  el.select();
  el.setSelectionRange(0, str.length);
  try {
    const ok = document.execCommand('copy');
    if (ok) toast.success(msg);
    else toast.error('Erro ao copiar');
  } catch {
    toast.error('Erro ao copiar');
  }
  document.body.removeChild(el);
}

function formatCPF(cpf) {
  if (!cpf) return '—';
  return String(cpf).replace(/\D/g, '').padStart(11, '0');
}

export default function PagamentoNaoAprovado() {
  const [pedidos, setPedidos] = useState([]);
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('todos');
  const [basesStatus, setBasesStatus] = useState(null);

  // Instâncias inline: { [numero_pedido]: string }
  const [instancias, setInstancias] = useState({});
  const [salvandoId, setSalvandoId] = useState(null);

  const { getAuthHeader } = useAuth();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/pagamento`, { headers: getAuthHeader() });
      setPedidos(res.data?.pedidos || []);
      setTemplate(res.data?.instancia_template || null);
    } catch {
      toast.error('Erro ao carregar pedidos');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeader]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Última atualização do tabelão (Bseller auto-sync)
  const fetchBasesStatus = useCallback(async () => {
    try {
      const r = await axios.get(`${API_URL}/api/admin/sync-all-from-postgres/status`, { headers: getAuthHeader() });
      setBasesStatus({
        tabelao: r?.data?.tabelao_inc?.last_finished_at || r?.data?.tabelao?.last_finished_at || null,
      });
    } catch (e) { /* ignore */ }
  }, [getAuthHeader]);
  useEffect(() => {
    fetchBasesStatus();
    const interval = setInterval(fetchBasesStatus, 60000);
    return () => clearInterval(interval);
  }, [fetchBasesStatus]);

  // Polling silencioso
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`${API_URL}/api/pagamento`, { headers: getAuthHeader() });
        setPedidos(res.data?.pedidos || []);
        if (res.data?.instancia_template) setTemplate(res.data.instancia_template);
      } catch { /* silencioso */ }
    }, 60000);
    return () => clearInterval(interval);
  }, [getAuthHeader]);

  const salvarInline = async (numeroPedido) => {
    const instancia = (instancias[numeroPedido] || '').trim();
    if (!instancia) {
      toast.error('Informe o número da instância');
      return;
    }
    setSalvandoId(numeroPedido);
    try {
      await axios.post(
        `${API_URL}/api/pagamento/${encodeURIComponent(numeroPedido)}/processar`,
        { instancia },
        { headers: getAuthHeader() }
      );
      toast.success('Registrado como Cancelado!');
      setInstancias(prev => { const n = { ...prev }; delete n[numeroPedido]; return n; });
      fetchData();
    } catch {
      toast.error('Erro ao registrar');
    } finally {
      setSalvandoId(null);
    }
  };

  const pedidosFiltrados = pedidos.filter(p => {
    if (filtro === 'pendentes') return !p.status_final;
    if (filtro === 'processados') return !!p.status_final;
    return true;
  });

  const stats = {
    total: pedidos.length,
    urgentes: pedidos.filter(p => !p.status_final && (p.dias_no_status ?? 0) >= 7).length,
    pendentes: pedidos.filter(p => !p.status_final).length,
    processados: pedidos.filter(p => !!p.status_final).length,
  };

  return (
    <div className="p-6 space-y-5">

      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Pagamento Não Aprovado</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Pedidos Tudo Azul aguardando aprovação de pagamento — emitir instância após 7 dias
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          {basesStatus?.tabelao && (
            <div className="text-[11px] text-muted-foreground text-right">
              Tabelão: <span className="font-medium">{new Date(basesStatus.tabelao).toLocaleString('pt-BR')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'text-slate-700' },
          { label: '⚠ Urgentes (7+ dias)', value: stats.urgentes, color: 'text-red-600' },
          { label: 'Pendentes', value: stats.pendentes, color: 'text-amber-600' },
          { label: 'Processados', value: stats.processados, color: 'text-emerald-600' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-slate-800 rounded-lg border p-3 text-center shadow-sm">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Instância + Cancelamento — lado a lado */}
      {template && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

          {/* Card: Dados da Instância */}
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Dados da Instância (copiar ao emitir)
            </p>
            <div className="space-y-2">
              {[
                ['Assunto', template.assunto],
                ['Categoria', template.categoria],
                ['Motivo', template.motivo],
                ['Observação', template.observacao],
              ].map(([label, val]) => (
                <div key={label} className="flex items-start gap-2 text-sm">
                  <span className="text-blue-600 dark:text-blue-400 font-semibold min-w-[90px] flex-shrink-0">{label}:</span>
                  <span
                    className="text-slate-700 dark:text-slate-300 cursor-pointer hover:text-blue-600 flex items-center gap-1 group"
                    onClick={() => copiar(val)}
                    title="Copiar"
                  >
                    {val}
                    <Copy className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Card: Passos do Cancelamento */}
          <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Passo a Passo — Cancelamento
            </p>
            <div className="flex flex-wrap gap-x-1.5 gap-y-2 text-sm items-center">
              {[
                { txt: 'Pedidos de Saída' },
                { txt: 'Pagamentos' },
                { txt: 'Análise Manual' },
                { txt: 'Meio Pagto:', bold: '2 (Boleto)' },
                { txt: 'Cliente:', cpf: true },
                { txt: 'Status', bold: 'Reprovar' },
                { action: 'Processar' },
              ].map((s, i, arr) => (
                <span key={i} className="flex items-center gap-1.5">
                  {s.action
                    ? <strong className="bg-emerald-600 text-white px-2.5 py-0.5 rounded text-xs font-semibold">{s.action}</strong>
                    : s.cpf
                    ? <span className="text-slate-600 dark:text-slate-300">Cliente: <strong className="text-blue-600 dark:text-blue-400">CPF</strong></span>
                    : s.bold
                    ? <span className="text-slate-600 dark:text-slate-300">{s.txt} <strong className="text-slate-800 dark:text-slate-100">{s.bold}</strong></span>
                    : <span className="text-slate-600 dark:text-slate-300">{s.txt}</span>
                  }
                  {i < arr.length - 1 && <span className="text-slate-300 dark:text-slate-600">→</span>}
                </span>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-2">
        {[
          { key: 'todos', label: 'Todos' },
          { key: 'pendentes', label: `Pendentes (${stats.pendentes})` },
          { key: 'processados', label: `Processados (${stats.processados})` },
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
            <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p>Nenhum pedido encontrado</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/40 border-b">
              <tr>
                <th className="text-left px-3 py-3 font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">Status</th>
                <th className="text-left px-3 py-3 font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">Entrega</th>
                <th className="text-left px-3 py-3 font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">Canal</th>
                <th className="text-left px-3 py-3 font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">Cliente</th>
                <th className="text-left px-3 py-3 font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">CPF</th>
                <th className="text-left px-3 py-3 font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">Produto</th>
                <th className="text-center px-3 py-3 font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">Dias</th>
                <th className="text-left px-3 py-3 font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">Dt. Status</th>
                <th className="text-left px-3 py-3 font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap min-w-[160px]">Instância</th>
                <th className="text-center px-3 py-3 font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">Ação</th>
              </tr>
            </thead>
            <tbody>
              {pedidosFiltrados.map(p => {
                const isFeito = !!p.status_final;
                const isUrgente = !isFeito && (p.dias_no_status ?? 0) >= 7;
                const inputVal = instancias[p.numero_pedido] ?? '';
                const isSalvando = salvandoId === p.numero_pedido;

                return (
                  <tr
                    key={p.numero_pedido}
                    className={`border-b last:border-0 transition-colors ${
                      isFeito
                        ? 'bg-emerald-50/50 dark:bg-emerald-950/20'
                        : isUrgente
                        ? 'bg-red-50/40 dark:bg-red-950/10'
                        : 'hover:bg-slate-50/50 dark:hover:bg-slate-700/30'
                    }`}
                  >
                    <td className="px-3 py-2.5"><StatusBadge item={p} /></td>

                    {/* Entrega — copiável */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span
                        className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer hover:text-blue-600 flex items-center gap-1"
                        onClick={() => copiar(p.numero_pedido, 'Entrega copiada!')}
                        title="Copiar entrega"
                      >
                        {p.numero_pedido}
                        <Copy className="h-2.5 w-2.5 opacity-50" />
                      </span>
                    </td>

                    <td className="px-3 py-2.5 text-xs whitespace-nowrap">{p.canal_vendas}</td>

                    <td className="px-3 py-2.5 text-xs whitespace-nowrap max-w-[160px] truncate" title={p.nome_cliente}>
                      {p.nome_cliente || '—'}
                    </td>

                    {/* CPF copiável */}
                    <td className="px-3 py-2.5 text-xs whitespace-nowrap font-mono">
                      {p.cpf_cliente ? (
                        <span
                          className="cursor-pointer hover:text-blue-600 flex items-center gap-1"
                          onClick={() => copiar(formatCPF(p.cpf_cliente), 'CPF copiado!')}
                          title="Copiar CPF"
                        >
                          {formatCPF(p.cpf_cliente)}
                          <Copy className="h-2.5 w-2.5 opacity-50" />
                        </span>
                      ) : '—'}
                    </td>

                    <td className="px-3 py-2.5 text-xs max-w-[180px] truncate" title={p.produto}>{p.produto || '—'}</td>

                    {/* Dias */}
                    <td className="px-3 py-2.5 text-center">
                      {p.dias_no_status !== null && p.dias_no_status !== undefined ? (
                        <span className={`text-sm font-bold ${
                          isFeito ? 'text-emerald-600' : p.dias_no_status >= 7 ? 'text-red-600' : 'text-amber-600'
                        }`}>
                          {p.dias_no_status}d
                        </span>
                      ) : <span className="text-slate-400 text-xs">—</span>}
                    </td>

                    {/* Data do status */}
                    <td className="px-3 py-2.5 text-xs text-slate-500 whitespace-nowrap">
                      {p.data_status ? p.data_status.split(' ')[0] : '—'}
                    </td>

                    {/* Instância — inline input ou info */}
                    <td className="px-3 py-2 whitespace-nowrap">
                      {isFeito ? (
                        <div className="flex items-center gap-1.5">
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                          <div>
                            <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">{p.instancia}</span>
                            {p.data_instancia && (
                              <div className="text-[10px] text-slate-400 leading-tight">{p.data_instancia}<br />{p.registrado_por}</div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <input
                          type="text"
                          placeholder="Nº instância"
                          value={inputVal}
                          onChange={e => setInstancias(prev => ({ ...prev, [p.numero_pedido]: e.target.value }))}
                          onKeyDown={e => e.key === 'Enter' && salvarInline(p.numero_pedido)}
                          className={`w-36 px-2 py-1 text-xs font-mono rounded border focus:outline-none focus:ring-1 focus:ring-blue-400 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100 ${
                            isUrgente ? 'border-red-300 bg-red-50/50' : 'border-slate-300 bg-white'
                          }`}
                        />
                      )}
                    </td>

                    {/* Ação */}
                    <td className="px-3 py-2 text-center">
                      {isFeito ? (
                        <span className="flex items-center justify-center gap-1 text-emerald-600 text-xs font-medium">
                          <CheckCircle className="h-3.5 w-3.5" /> Cancelada
                        </span>
                      ) : (
                        <button
                          onClick={() => salvarInline(p.numero_pedido)}
                          disabled={!inputVal.trim() || isSalvando}
                          title="Confirmar cancelamento"
                          className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors flex items-center gap-1.5 mx-auto ${
                            inputVal.trim()
                              ? 'bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700'
                              : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed dark:bg-slate-700 dark:border-slate-600'
                          }`}
                        >
                          {isSalvando
                            ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            : <CheckCircle className="h-3.5 w-3.5" />
                          }
                          {isSalvando ? 'Salvando…' : 'Cancelar'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

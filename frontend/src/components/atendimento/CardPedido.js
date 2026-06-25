/**
 * CardPedido - Exibe informações detalhadas do pedido ERP
 */
import { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  Package, Truck, User, MapPin, Phone, Mail, Calendar,
  ShoppingBag, Copy, FileText, Hash, Building,
  ChevronDown, ChevronUp, AlertCircle, RefreshCw, Clock
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Categoria visual por idPonto (alinhado com bseller-api-map)
const CATEGORIA_POR_IDPONTO = {
  ENT: { label: 'Entregue', color: 'bg-green-100 text-green-800 border-green-300' },
  I04: { label: 'Entregue', color: 'bg-green-100 text-green-800 border-green-300' },
  I79: { label: 'Entregue', color: 'bg-green-100 text-green-800 border-green-300' },
  ETR: { label: 'Em transporte', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  NFS: { label: 'NF emitida', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  CAN: { label: 'Cancelado', color: 'bg-red-100 text-red-800 border-red-300' },
  I78: { label: 'Cancelado', color: 'bg-red-100 text-red-800 border-red-300' },
  AAP: { label: 'Aguardando aprovação', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  PAP: { label: 'Pedido aprovado', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  AES: { label: 'Aguardando estoque', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  ALS: { label: 'Bloqueio SAC', color: 'bg-orange-100 text-orange-800 border-orange-300' },
  RIE: { label: 'Em devolução', color: 'bg-purple-100 text-purple-800 border-purple-300' },
  I19: { label: 'Em devolução', color: 'bg-purple-100 text-purple-800 border-purple-300' },
  I63: { label: 'Em devolução', color: 'bg-purple-100 text-purple-800 border-purple-300' },
};

const CardPedido = ({ pedidoErp, expanded, onToggle }) => {
  const { getAuthHeader } = useAuth();
  const [rastreio, setRastreio] = useState(null);
  const [loadingRastreio, setLoadingRastreio] = useState(false);
  const [rastreioError, setRastreioError] = useState(null);

  if (!pedidoErp) return null;

  const copyToClipboard = (text) => {
    const str = String(text || '');
    const el = document.createElement('textarea');
    el.value = str;
    el.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;z-index:9999';
    document.body.appendChild(el);
    el.focus(); el.select(); el.setSelectionRange(0, str.length);
    let ok = false;
    try { ok = document.execCommand('copy'); } catch {}
    document.body.removeChild(el);
    if (ok) { toast.success('Copiado!'); return; }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(str).then(() => toast.success('Copiado!')).catch(() => toast.error('Erro ao copiar'));
    } else { toast.error('Erro ao copiar'); }
  };

  const fetchRastreio = async () => {
    const numero = pedidoErp.numero_pedido;
    if (!numero) return;
    setLoadingRastreio(true);
    setRastreioError(null);
    try {
      const resp = await axios.get(
        `${API_URL}/api/pedidos-erp/${numero}/rastreio-realtime`,
        { headers: getAuthHeader() }
      );
      setRastreio(resp.data);
      if (resp.data?.status === 'ok' && (resp.data.entregas?.length ?? 0) === 0) {
        toast.info('BSeller respondeu sem entregas para este pedido.');
      }
    } catch (err) {
      const msg = err?.response?.data?.detail || err.message || 'Erro consultando rastreio';
      setRastreioError(msg);
      toast.error(`Falha consultando BSeller: ${msg}`);
    } finally {
      setLoadingRastreio(false);
    }
  };

  const InfoRow = ({ icon: Icon, label, value, copyable = false }) => (
    <div className="flex items-center gap-2 text-sm">
      <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium truncate">{value || '-'}</span>
      {copyable && value && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 ml-1"
          onClick={() => copyToClipboard(value)}
        >
          <Copy className="h-3 w-3" />
        </Button>
      )}
    </div>
  );

  return (
    <Card className="border-green-200 bg-green-50/30">
      <CardHeader className="py-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-5 w-5 text-green-600" />
            Pedido Encontrado
            <Badge variant="outline" className="ml-2 text-green-700 border-green-300">
              {pedidoErp.numero_pedido}
            </Badge>
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="h-8"
          >
            {expanded ? (
              <><ChevronUp className="h-4 w-4 mr-1" /> Recolher</>
            ) : (
              <><ChevronDown className="h-4 w-4 mr-1" /> Expandir</>
            )}
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className={`pt-0 ${expanded ? '' : 'pb-3'}`}>
        {/* Informações básicas - sempre visíveis */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <InfoRow icon={User} label="Cliente" value={pedidoErp.nome_cliente} />
          <InfoRow icon={Hash} label="CPF" value={pedidoErp.cpf_cliente} copyable />
          <InfoRow icon={Package} label="Produto" value={pedidoErp.produto} />
          <InfoRow icon={Truck} label="Transportadora" value={pedidoErp.transportadora} />
          
          {/* Status com cor dinâmica */}
          <div className="flex items-center gap-2 text-sm md:col-span-2">
            <AlertCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="text-muted-foreground">Status:</span>
            <Badge 
              variant={
                pedidoErp.status_pedido?.toLowerCase().includes('entregue') ? 'default' :
                pedidoErp.status_pedido?.toLowerCase().includes('aguardando') ? 'secondary' :
                'outline'
              }
            >
              {pedidoErp.status_pedido || 'Não informado'}
            </Badge>
          </div>
        </div>

        {/* Informações expandidas */}
        {expanded && (
          <div className="mt-4 pt-4 border-t border-green-200 space-y-4">
            {/* Contato */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Contato</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <InfoRow icon={Phone} label="Telefone" value={pedidoErp.fone_cliente} copyable />
                <InfoRow icon={Mail} label="Email" value={pedidoErp.email_cliente} copyable />
              </div>
            </div>

            {/* Endereço */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Endereço</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <InfoRow icon={MapPin} label="Cidade" value={pedidoErp.cidade} />
                <InfoRow icon={MapPin} label="UF" value={pedidoErp.uf} />
                <InfoRow icon={MapPin} label="CEP" value={pedidoErp.cep} copyable />
              </div>
            </div>

            {/* Nota Fiscal */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Nota Fiscal</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <InfoRow icon={FileText} label="NF" value={pedidoErp.nota_fiscal?.toString().replace('.0', '')} copyable />
                <InfoRow icon={Hash} label="Série" value={pedidoErp.serie_nf} />
                <InfoRow icon={Building} label="Galpão" value={pedidoErp.uf_galpao || pedidoErp.filial} />
              </div>
              {pedidoErp.chave_nota && (
                <div className="mt-2">
                  <InfoRow icon={Hash} label="Chave de Acesso" value={pedidoErp.chave_nota} copyable />
                </div>
              )}
            </div>

            {/* Outros dados */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Outros</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <InfoRow icon={ShoppingBag} label="Canal" value={pedidoErp.canal_vendas} />
                <InfoRow icon={Calendar} label="Data Status" value={pedidoErp.data_status?.split(' ')[0]} />
                {pedidoErp.estoque_disponivel !== null && pedidoErp.estoque_disponivel !== undefined && (
                  <InfoRow icon={Package} label="Estoque Disp." value={pedidoErp.estoque_disponivel} />
                )}
              </div>
            </div>

            {/* Código de rastreio se existir */}
            {pedidoErp.codigo_rastreio && (
              <div className="p-3 bg-blue-50 rounded-lg">
                <InfoRow icon={Truck} label="Código Rastreio" value={pedidoErp.codigo_rastreio} copyable />
              </div>
            )}

            {/* Status em Tempo Real (BSeller SAC) */}
            <div className="pt-3 border-t border-green-200">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-muted-foreground">Status em Tempo Real (BSeller)</h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchRastreio}
                  disabled={loadingRastreio}
                  className="h-7 text-xs"
                >
                  <RefreshCw className={`h-3 w-3 mr-1 ${loadingRastreio ? 'animate-spin' : ''}`} />
                  {rastreio ? 'Atualizar' : 'Consultar BSeller'}
                </Button>
              </div>

              {rastreioError && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
                  {rastreioError}
                </div>
              )}

              {rastreio && rastreio.status === 'id_invalido' && (
                <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
                  {rastreio.mensagem}
                </div>
              )}

              {rastreio && rastreio.status === 'nao_encontrado' && (
                <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
                  {rastreio.mensagem}
                </div>
              )}

              {rastreio && rastreio.status === 'ok' && rastreio.entregas?.length > 0 && (
                <div className="space-y-2">
                  {rastreio.entregas.map((ent, idx) => {
                    const cat = CATEGORIA_POR_IDPONTO[ent.id_ponto] || { label: ent.ponto_descricao || ent.id_ponto, color: 'bg-gray-100 text-gray-800 border-gray-300' };
                    return (
                      <div key={ent.id_entrega || idx} className="border border-green-200 rounded p-2 bg-white">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <Badge variant="outline" className={cat.color}>
                            {ent.id_ponto} · {cat.label}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            Entrega {ent.id_entrega}
                          </Badge>
                          {ent.filial_uf && (
                            <Badge variant="outline" className="text-xs">
                              Filial {ent.filial_uf}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {ent.data_ponto || '—'}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mb-1">
                          {ent.ponto_descricao || '—'}
                        </div>
                        {ent.usuario && (
                          <div className="text-xs">
                            <span className="text-muted-foreground">Usuário: </span>
                            <span className="font-medium">{ent.usuario}</span>
                            <Badge variant="outline" className="ml-2 text-[10px]">{ent.usuario_tipo}</Badge>
                          </div>
                        )}
                        {ent.endereco?.completo && (
                          <div className="flex items-start gap-1 text-xs mt-1">
                            <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0 text-muted-foreground" />
                            <span className="flex-1">{ent.endereco.completo}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0"
                              onClick={() => copyToClipboard(ent.endereco.completo)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div className="text-[10px] text-muted-foreground text-right">
                    Consultado em {rastreio.consultado_em ? new Date(rastreio.consultado_em).toLocaleString('pt-BR') : '—'}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CardPedido;

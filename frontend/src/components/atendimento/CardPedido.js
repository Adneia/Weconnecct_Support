/**
 * CardPedido - Exibe informações detalhadas do pedido ERP
 */
import { useState } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  Package, Truck, User, MapPin, Phone, Mail, Calendar,
  ShoppingBag, Copy, FileText, Hash, Building,
  ChevronDown, ChevronUp, AlertCircle, RefreshCw, Clock, Bot, UserCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const CardPedido = ({ pedidoErp, expanded, onToggle }) => {
  const { getAuthHeader } = useAuth();
  const [rastreio, setRastreio] = useState(null);
  const [loadingRastreio, setLoadingRastreio] = useState(false);

  if (!pedidoErp) return null;

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado para a área de transferência!');
  };

  const fetchRastreio = async () => {
    const numero = pedidoErp.numero_pedido;
    if (!numero) {
      toast.error('Pedido sem número — não dá pra consultar BSeller');
      return;
    }
    setLoadingRastreio(true);
    try {
      const resp = await axios.get(
        `${API_URL}/api/pedidos-erp/${numero}/rastreio-realtime`,
        { headers: getAuthHeader() }
      );
      setRastreio(resp.data);
      if (resp.data.status === 'ok') {
        toast.success(`Status atualizado: ${resp.data.entregas?.[0]?.ponto_descricao || 'OK'}`);
      } else if (resp.data.status === 'id_invalido') {
        toast.error('Esse pedido tem ID com sufixo — BSeller não aceita');
      } else if (resp.data.status === 'nao_encontrado') {
        toast.error('Pedido não encontrado no BSeller');
      } else {
        toast.error(resp.data.mensagem || 'Erro consultando BSeller');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro consultando BSeller');
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
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchRastreio}
              disabled={loadingRastreio}
              className="h-8 border-blue-300 text-blue-700 hover:bg-blue-50"
              title="Consulta status atual + endereço completo na API BSeller"
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${loadingRastreio ? 'animate-spin' : ''}`} />
              {loadingRastreio ? 'Consultando...' : 'Status BSeller'}
            </Button>
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
        </div>
      </CardHeader>
      
      <CardContent className={`pt-0 ${expanded ? '' : 'pb-3'}`}>
        {/* Rastreio realtime BSeller (aparece quando consultado) */}
        {rastreio && rastreio.status === 'ok' && rastreio.entregas?.length > 0 && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-blue-900 flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Status BSeller — tempo real
                {rastreio.quantidade_entregas > 1 && (
                  <Badge variant="outline" className="text-xs">
                    {rastreio.quantidade_entregas} entregas
                  </Badge>
                )}
              </h4>
              <span className="text-xs text-blue-700">
                {new Date(rastreio.consultado_em).toLocaleTimeString('pt-BR')}
              </span>
            </div>

            {rastreio.entregas.map((ent, idx) => (
              <div
                key={ent.id_entrega || idx}
                className={`${idx > 0 ? 'mt-3 pt-3 border-t border-blue-200' : ''}`}
              >
                {/* Header da entrega */}
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <Badge className="bg-blue-600 hover:bg-blue-700">
                    {ent.id_ponto}
                  </Badge>
                  <span className="font-medium text-sm text-blue-900">
                    {ent.ponto_descricao}
                  </span>
                  {ent.filial_uf && (
                    <Badge variant="outline" className="text-xs border-blue-300">
                      <Building className="h-3 w-3 mr-1" />
                      {ent.filial_uf}
                    </Badge>
                  )}
                  {rastreio.quantidade_entregas > 1 && (
                    <Badge variant="outline" className="text-xs">
                      Entrega #{idx + 1} ({ent.id_entrega})
                    </Badge>
                  )}
                </div>

                {/* Quem moveu + quando */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-blue-800 mb-2">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {ent.data_ponto || '-'}
                  </span>
                  <span className="flex items-center gap-1">
                    {ent.usuario_tipo === 'automacao' ? (
                      <Bot className="h-3 w-3" />
                    ) : (
                      <UserCheck className="h-3 w-3" />
                    )}
                    {ent.usuario || 'desconhecido'}
                    <Badge
                      variant="outline"
                      className={`ml-1 text-[10px] py-0 ${
                        ent.usuario_tipo === 'automacao'
                          ? 'border-purple-300 text-purple-700'
                          : 'border-green-300 text-green-700'
                      }`}
                    >
                      {ent.usuario_tipo}
                    </Badge>
                  </span>
                </div>

                {/* Endereço completo */}
                {ent.endereco?.completo && (
                  <div className="mt-2 p-2 bg-white border border-blue-100 rounded text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-1 flex-1">
                        <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0 text-blue-600" />
                        <span className="break-words">{ent.endereco.completo}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 flex-shrink-0"
                        onClick={() => copyToClipboard(ent.endereco.completo)}
                        title="Copiar endereço completo"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Classificação SAC quando existir */}
                {ent.matriz_classificacao && ent.matriz_classificacao.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {ent.matriz_classificacao.map((m, i) => (
                      <Badge key={i} variant="outline" className="text-[10px] border-orange-300 text-orange-700">
                        <AlertCircle className="h-2.5 w-2.5 mr-1" />
                        {m.nomeCategoria} → {m.nomeMotivo}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Mensagem quando rastreio falhou */}
        {rastreio && rastreio.status !== 'ok' && (
          <div className="mb-4 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
            <AlertCircle className="h-3 w-3 inline mr-1" />
            {rastreio.mensagem}
          </div>
        )}

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
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CardPedido;

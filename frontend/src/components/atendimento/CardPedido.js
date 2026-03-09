/**
 * CardPedido - Exibe informações detalhadas do pedido ERP
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { 
  Package, Truck, User, MapPin, Phone, Mail, Calendar, 
  ShoppingBag, Copy, FileText, Hash, Building, 
  ChevronDown, ChevronUp, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

const CardPedido = ({ pedidoErp, expanded, onToggle }) => {
  if (!pedidoErp) return null;

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado para a área de transferência!');
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
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CardPedido;

/**
 * DialogsAtendimento - Todos os diálogos usados no formulário de atendimento
 */
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Copy, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

// Diálogo para exibir texto padrão
export const TextoDialog = ({ 
  open, 
  onClose, 
  texto, 
  onCopy, 
  onUseText 
}) => {
  const handleCopy = () => {
    navigator.clipboard.writeText(texto);
    toast.success('Texto copiado!');
    onCopy?.();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Texto Padrão
          </DialogTitle>
          <DialogDescription>
            Copie o texto ou use como anotação
          </DialogDescription>
        </DialogHeader>
        <div className="my-4 p-4 bg-muted rounded-lg overflow-auto max-h-[50vh]">
          <pre className="whitespace-pre-wrap text-sm font-mono">
            {texto}
          </pre>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          <Button variant="secondary" onClick={handleCopy}>
            <Copy className="h-4 w-4 mr-2" />
            Copiar
          </Button>
          {onUseText && (
            <Button onClick={onUseText}>
              Usar nas Anotações
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Diálogo para lista de pedidos encontrados
export const PedidosListDialog = ({ 
  open, 
  onClose, 
  pedidos, 
  onSelectPedido 
}) => {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Pedidos Encontrados</DialogTitle>
          <DialogDescription>
            Selecione o pedido para o atendimento
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-auto max-h-[60vh]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background">
              <tr className="border-b">
                <th className="text-left p-2">Entrega</th>
                <th className="text-left p-2">Cliente</th>
                <th className="text-left p-2">Produto</th>
                <th className="text-left p-2">Status</th>
                <th className="text-left p-2">Ação</th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map((pedido, idx) => (
                <tr key={idx} className="border-b hover:bg-muted/50">
                  <td className="p-2 font-medium">{pedido.numero_pedido}</td>
                  <td className="p-2">{pedido.nome_cliente}</td>
                  <td className="p-2 truncate max-w-[200px]">{pedido.produto}</td>
                  <td className="p-2">
                    <Badge variant="outline" className="text-xs">
                      {pedido.status_pedido}
                    </Badge>
                  </td>
                  <td className="p-2">
                    <Button 
                      size="sm" 
                      onClick={() => onSelectPedido(pedido)}
                    >
                      Selecionar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Diálogo de atendimento existente
export const ExistingAtendimentoDialog = ({
  open,
  onClose,
  atendimento,
  onGoToExisting,
  onContinueNew
}) => {
  if (!atendimento) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Atendimento Existente</DialogTitle>
          <DialogDescription>
            Já existe um atendimento para este pedido
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <div className="p-4 bg-amber-50 rounded-lg space-y-2">
            <p className="text-sm">
              <strong>ID:</strong> {atendimento.id_atendimento}
            </p>
            <p className="text-sm">
              <strong>Categoria:</strong> {atendimento.categoria}
            </p>
            <p className="text-sm">
              <strong>Status:</strong>{' '}
              <Badge variant={atendimento.pendente ? 'secondary' : 'default'}>
                {atendimento.pendente ? 'Pendente' : 'Encerrado'}
              </Badge>
            </p>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="secondary" onClick={onGoToExisting}>
            Ir para Atendimento
          </Button>
          <Button onClick={onContinueNew}>
            Criar Novo Mesmo Assim
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Diálogo de confirmação de devolução
export const DevolucaoDialog = ({
  open,
  onClose,
  onConfirm,
  onSkip
}) => {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar Devolução?</DialogTitle>
          <DialogDescription>
            Deseja registrar esta devolução na planilha de Gestão de Devoluções?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onSkip}>
            Não, apenas salvar
          </Button>
          <Button onClick={onConfirm}>
            Sim, registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Diálogo de status da devolução
export const StatusDevolucaoDialog = ({
  open,
  onClose,
  onSelectStatus
}) => {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Status da Devolução</DialogTitle>
          <DialogDescription>
            Selecione o status atual desta devolução
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-4">
          <Button
            variant="outline"
            className="justify-start h-auto py-3"
            onClick={() => onSelectStatus('Aguardando')}
          >
            <div className="text-left">
              <div className="font-medium">Aguardando</div>
              <div className="text-xs text-muted-foreground">
                Aguardando recebimento no galpão
              </div>
            </div>
          </Button>
          <Button
            variant="outline"
            className="justify-start h-auto py-3"
            onClick={() => onSelectStatus('Estornado')}
          >
            <div className="text-left">
              <div className="font-medium">Estornado</div>
              <div className="text-xs text-muted-foreground">
                Valor já foi estornado ao cliente
              </div>
            </div>
          </Button>
          <Button
            variant="outline"
            className="justify-start h-auto py-3"
            onClick={() => onSelectStatus('Reenviado')}
          >
            <div className="text-left">
              <div className="font-medium">Reenviado</div>
              <div className="text-xs text-muted-foreground">
                Novo pedido já foi enviado
              </div>
            </div>
          </Button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

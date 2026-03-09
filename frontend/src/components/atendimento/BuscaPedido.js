/**
 * BuscaPedido - Componente para buscar pedidos ERP
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Loader2, Search, AlertCircle } from 'lucide-react';

const BuscaPedido = ({ 
  searchType, 
  onSearchTypeChange, 
  searchValue, 
  onSearchValueChange,
  selectedGalpao,
  onGalpaoChange,
  isSearching,
  pedidoNotFound
}) => {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Search className="h-5 w-5" />
          Buscar Pedido
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Tipo de busca */}
          <div className="md:col-span-3">
            <Label className="text-xs text-muted-foreground">Buscar por</Label>
            <Select value={searchType} onValueChange={onSearchTypeChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="entrega">Entrega</SelectItem>
                <SelectItem value="cpf">CPF</SelectItem>
                <SelectItem value="nome">Nome</SelectItem>
                <SelectItem value="pedido">Pedido</SelectItem>
                <SelectItem value="galpao">Galpão + Nota</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Seletor de Galpão (só aparece no tipo galpao) */}
          {searchType === 'galpao' && (
            <div className="md:col-span-2">
              <Label className="text-xs text-muted-foreground">Galpão</Label>
              <Select value={selectedGalpao} onValueChange={onGalpaoChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SP">São Paulo (SP)</SelectItem>
                  <SelectItem value="SC">Santa Catarina (SC)</SelectItem>
                  <SelectItem value="ES">Espírito Santo (ES)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Campo de busca */}
          <div className={searchType === 'galpao' ? 'md:col-span-7' : 'md:col-span-9'}>
            <Label className="text-xs text-muted-foreground">
              {searchType === 'entrega' && 'Número da Entrega'}
              {searchType === 'cpf' && 'CPF do Cliente'}
              {searchType === 'nome' && 'Nome do Cliente'}
              {searchType === 'pedido' && 'Número do Pedido'}
              {searchType === 'galpao' && 'Nota Fiscal'}
            </Label>
            <div className="relative">
              <Input
                value={searchValue}
                onChange={(e) => onSearchValueChange(e.target.value)}
                placeholder={
                  searchType === 'entrega' ? 'Ex: 12345678' :
                  searchType === 'cpf' ? 'Ex: 12345678900' :
                  searchType === 'nome' ? 'Ex: João Silva' :
                  searchType === 'pedido' ? 'Ex: PED-123' :
                  'Ex: 10753'
                }
                className="pr-10"
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
          </div>
        </div>

        {/* Mensagem de pedido não encontrado */}
        {pedidoNotFound && (
          <div className="mt-3 flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
            <AlertCircle className="h-4 w-4" />
            <span>
              Pedido não encontrado na base. Você pode continuar criando o atendimento manualmente.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BuscaPedido;

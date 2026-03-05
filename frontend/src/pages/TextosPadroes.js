import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, FileText, Copy, Check } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const TextosPadroes = () => {
  const [textos, setTextos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentTexto, setCurrentTexto] = useState({ categoria: '', texto: '' });
  const [copiedId, setCopiedId] = useState(null);

  const { getAuthHeader } = useAuth();

  useEffect(() => {
    fetchTextos();
  }, []);

  const fetchTextos = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/textos-padroes-lista`,
        { headers: getAuthHeader() }
      );
      setTextos(response.data);
    } catch (error) {
      toast.error('Erro ao carregar textos padrões');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentTexto.categoria.trim() || !currentTexto.texto.trim()) {
      toast.error('Preencha todos os campos');
      return;
    }

    try {
      if (editMode) {
        await axios.put(
          `${API_URL}/api/textos-padroes/${encodeURIComponent(currentTexto.categoria)}`,
          { texto: currentTexto.texto },
          { headers: getAuthHeader() }
        );
        toast.success('Texto padrão atualizado!');
      } else {
        await axios.post(
          `${API_URL}/api/textos-padroes`,
          currentTexto,
          { headers: getAuthHeader() }
        );
        toast.success('Texto padrão criado!');
      }
      setShowDialog(false);
      setCurrentTexto({ categoria: '', texto: '' });
      fetchTextos();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao salvar texto padrão');
    }
  };

  const handleEdit = (texto) => {
    setCurrentTexto({ categoria: texto.categoria, texto: texto.texto });
    setEditMode(true);
    setShowDialog(true);
  };

  const handleDelete = async (categoria) => {
    if (!window.confirm('Tem certeza que deseja excluir este texto padrão?')) {
      return;
    }

    try {
      await axios.delete(
        `${API_URL}/api/textos-padroes/${encodeURIComponent(categoria)}`,
        { headers: getAuthHeader() }
      );
      toast.success('Texto padrão excluído!');
      fetchTextos();
    } catch (error) {
      toast.error('Erro ao excluir texto padrão');
    }
  };

  const handleCopy = (texto) => {
    navigator.clipboard.writeText(texto.texto);
    setCopiedId(texto.categoria);
    toast.success('Texto copiado!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const openNewDialog = () => {
    setCurrentTexto({ categoria: '', texto: '' });
    setEditMode(false);
    setShowDialog(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="textos-padroes-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-['Plus_Jakarta_Sans']">Textos Padrões</h1>
          <p className="text-muted-foreground text-sm">{textos.length} textos cadastrados</p>
        </div>
        <Button onClick={openNewDialog} data-testid="btn-novo-texto">
          <Plus className="h-4 w-4 mr-2" />
          Novo Texto Padrão
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs uppercase tracking-wider font-medium bg-muted/50 w-48">Categoria</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider font-medium bg-muted/50">Texto</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider font-medium bg-muted/50 w-32 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {textos.map((texto) => (
                  <TableRow key={texto.categoria} data-testid={`row-${texto.categoria}`}>
                    <TableCell className="font-medium">
                      <Badge variant="outline">{texto.categoria}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      <p className="line-clamp-2 text-muted-foreground">{texto.texto.substring(0, 150)}...</p>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleCopy(texto)}
                          data-testid={`btn-copy-${texto.categoria}`}
                        >
                          {copiedId === texto.categoria ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleEdit(texto)}
                          data-testid={`btn-edit-${texto.categoria}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleDelete(texto.categoria)}
                          className="text-destructive hover:text-destructive"
                          data-testid={`btn-delete-${texto.categoria}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog: Criar/Editar Texto */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              <FileText className="h-5 w-5 inline mr-2" />
              {editMode ? 'Editar Texto Padrão' : 'Novo Texto Padrão'}
            </DialogTitle>
            <DialogDescription>
              {editMode 
                ? 'Edite o texto padrão abaixo' 
                : 'Crie um novo texto padrão para usar nos atendimentos'
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Categoria / Nome</Label>
              <Input
                value={currentTexto.categoria}
                onChange={(e) => setCurrentTexto(prev => ({ ...prev, categoria: e.target.value }))}
                placeholder="Ex: Falha de Compras - Reenvio"
                disabled={editMode}
                data-testid="input-categoria"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Dica: Use placeholders como [PRODUTO], [ENTREGA], [ASSINATURA], [NOME_CLIENTE]
              </p>
            </div>
            
            <div>
              <Label>Texto</Label>
              <Textarea
                value={currentTexto.texto}
                onChange={(e) => setCurrentTexto(prev => ({ ...prev, texto: e.target.value }))}
                placeholder="Digite o texto padrão aqui..."
                rows={10}
                className="font-mono text-sm"
                data-testid="input-texto"
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} data-testid="btn-salvar">
              {editMode ? 'Atualizar' : 'Criar'} Texto Padrão
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TextosPadroes;

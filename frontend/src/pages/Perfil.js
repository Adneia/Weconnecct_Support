import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { Separator } from '../components/ui/separator';
import { toast } from 'sonner';
import { User, Mail, Lock, Save, Loader2 } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const Perfil = () => {
  const { user, getAuthHeader } = useAuth();
  const [loading, setLoading] = useState(false);
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: ''
  });

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    
    if (passwords.new !== passwords.confirm) {
      toast.error('As senhas não coincidem');
      return;
    }

    if (passwords.new.length < 6) {
      toast.error('A nova senha deve ter pelo menos 6 caracteres');
      return;
    }

    setLoading(true);
    try {
      await axios.post(
        `${API_URL}/api/auth/change-password`,
        {
          current_password: passwords.current,
          new_password: passwords.new
        },
        { headers: getAuthHeader() }
      );
      
      toast.success('Senha alterada com sucesso!');
      setPasswords({ current: '', new: '', confirm: '' });
    } catch (error) {
      const message = error.response?.data?.detail || 'Erro ao alterar senha';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6" data-testid="perfil-page">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-['Plus_Jakarta_Sans']">Meu Perfil</h1>
        <p className="text-muted-foreground">Gerencie suas informações de conta</p>
      </div>

      {/* Informações do Usuário */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5" />
            Informações Pessoais
          </CardTitle>
          <CardDescription>Seus dados de cadastro</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                {getInitials(user?.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-xl font-semibold">{user?.name}</p>
              <p className="text-muted-foreground flex items-center gap-1">
                <Mail className="h-4 w-4" />
                {user?.email}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alterar Senha */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Alterar Senha
          </CardTitle>
          <CardDescription>Atualize sua senha de acesso</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <Label htmlFor="current">Senha Atual</Label>
              <Input
                id="current"
                type="password"
                value={passwords.current}
                onChange={(e) => setPasswords(p => ({ ...p, current: e.target.value }))}
                placeholder="Digite sua senha atual"
                data-testid="input-current-password"
                required
              />
            </div>

            <Separator />

            <div>
              <Label htmlFor="new">Nova Senha</Label>
              <Input
                id="new"
                type="password"
                value={passwords.new}
                onChange={(e) => setPasswords(p => ({ ...p, new: e.target.value }))}
                placeholder="Digite a nova senha"
                data-testid="input-new-password"
                required
              />
            </div>

            <div>
              <Label htmlFor="confirm">Confirmar Nova Senha</Label>
              <Input
                id="confirm"
                type="password"
                value={passwords.confirm}
                onChange={(e) => setPasswords(p => ({ ...p, confirm: e.target.value }))}
                placeholder="Confirme a nova senha"
                data-testid="input-confirm-password"
                required
              />
            </div>

            <Button type="submit" disabled={loading} data-testid="btn-change-password">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Alterando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Alterar Senha
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Perfil;

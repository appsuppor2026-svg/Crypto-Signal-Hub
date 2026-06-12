import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/i18n';
import { useToast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { notifyProfileSaved } from '@/services/aiService';

export default function Profile() {
  const { t, setLanguage } = useTranslation();
  const { toast } = useToast();

  const [profile, setProfile] = useState({
    name: '',
    nickname: '',
    email: '',
    phone: '',
    country: '',
    language: 'es',
  });

  useEffect(() => {
    const saved = localStorage.getItem('lr_user_profile');
    if (saved) {
      try { setProfile(JSON.parse(saved)); } catch {}
    }
  }, []);

  const handleChange = (field: string, value: string) =>
    setProfile(prev => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    localStorage.setItem('lr_user_profile', JSON.stringify(profile));
    setLanguage(profile.language as 'es' | 'en');
    // Silently notify (fire-and-forget, user doesn't see destination)
    notifyProfileSaved(profile);
    toast({ title: 'Perfil actualizado', description: 'Los cambios se han guardado correctamente.' });
  };

  return (
    <div className="flex-1 flex flex-col p-4 space-y-6 pb-24">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-2xl font-bold font-mono tracking-tight mb-6">Perfil de Usuario</h1>

        <Card className="bg-card border-border shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">Información Personal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre completo</Label>
              <Input id="name" value={profile.name} onChange={e => handleChange('name', e.target.value)} placeholder="Ej. Juan Pérez" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nickname">Nickname</Label>
              <Input id="nickname" value={profile.nickname} onChange={e => handleChange('nickname', e.target.value)} placeholder="Ej. CryptoTrader99" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input id="email" type="email" value={profile.email} onChange={e => handleChange('email', e.target.value)} placeholder="correo@ejemplo.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono (opcional)</Label>
              <Input id="phone" type="tel" value={profile.phone} onChange={e => handleChange('phone', e.target.value)} placeholder="+1 234 567 8900" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">País</Label>
              <Input id="country" value={profile.country} onChange={e => handleChange('country', e.target.value)} placeholder="Ej. México" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="language">Idioma preferido</Label>
              <Select value={profile.language} onValueChange={v => handleChange('language', v)}>
                <SelectTrigger id="language"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="es">Español</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full mt-6" onClick={handleSave}>
              Guardar cambios
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

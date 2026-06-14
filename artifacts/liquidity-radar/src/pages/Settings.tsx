import { useTranslation } from "@/i18n";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { User, ChevronRight, MessageSquare, Zap } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useSubscription } from "@/context/SubscriptionContext";

export default function Settings() {
  const { t, language, setLanguage } = useTranslation();
  const [, setLocation] = useLocation();
  const [nickname, setNickname] = useState<string | null>(null);
  const { isActive, isTrial } = useSubscription();

  useEffect(() => {
    const saved = localStorage.getItem('lr_user_profile');
    if (saved) {
      try {
        const profile = JSON.parse(saved);
        if (profile.nickname) setNickname(profile.nickname);
      } catch (e) {}
    }
  }, []);

  return (
    <div className="flex-1 flex flex-col p-4 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-6"
      >
        <h1 className="text-2xl font-bold font-mono tracking-tight mb-6">{t("settings.title")}</h1>
        
        <Card
          className="bg-card border-border shadow-md cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setLocation('/profile')}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-primary/10 text-primary rounded-full">
                <User size={20} />
              </div>
              <div>
                <h2 className="font-medium text-foreground">{t('settings.profile')}</h2>
                <p className="text-sm text-muted-foreground">{nickname || t('settings.profileDesc')}</p>
              </div>
            </div>
            <ChevronRight size={20} className="text-muted-foreground" />
          </CardContent>
        </Card>

        {/* Subscription card */}
        <Card
          className="bg-card border-border shadow-md cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setLocation('/subscription')}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-[#f7931a]/10 text-[#f7931a] rounded-full">
                <Zap size={20} />
              </div>
              <div>
                <h2 className="font-medium text-foreground">{t('sub.settingsTitle')}</h2>
                <p className="text-sm text-muted-foreground">
                  {isActive ? (isTrial ? t('sub.trial_active') : t('sub.active')) : t('sub.settingsDesc')}
                </p>
              </div>
            </div>
            <ChevronRight size={20} className="text-muted-foreground" />
          </CardContent>
        </Card>

        <Card
          className="bg-card border-border shadow-md cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setLocation('/support')}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-500/10 text-blue-400 rounded-full">
                <MessageSquare size={20} />
              </div>
              <div>
                <h2 className="font-medium text-foreground">{t('support.title')}</h2>
                <p className="text-sm text-muted-foreground">{t('settings.supportDesc')}</p>
              </div>
            </div>
            <ChevronRight size={20} className="text-muted-foreground" />
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-md">
          <CardContent className="p-4 space-y-4">
            <h2 className="font-medium text-foreground">{t("settings.language")}</h2>
            
            <RadioGroup 
              value={language} 
              onValueChange={(val) => setLanguage(val as 'es' | 'en')}
              className="space-y-3"
            >
              <div className="flex items-center space-x-3">
                <RadioGroupItem value="es" id="lang-es" />
                <Label htmlFor="lang-es" className="text-base cursor-pointer">Español</Label>
              </div>
              <div className="flex items-center space-x-3">
                <RadioGroupItem value="en" id="lang-en" />
                <Label htmlFor="lang-en" className="text-base cursor-pointer">English</Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

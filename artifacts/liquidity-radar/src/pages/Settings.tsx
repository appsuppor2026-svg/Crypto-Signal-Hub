import { useTranslation } from "@/i18n";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export default function Settings() {
  const { t, language, setLanguage } = useTranslation();

  return (
    <div className="flex-1 flex flex-col p-4 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-2xl font-bold font-mono tracking-tight mb-6">{t("settings.title")}</h1>
        
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

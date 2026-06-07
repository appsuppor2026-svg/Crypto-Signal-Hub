import { useTranslation } from "@/i18n";
import { motion } from "framer-motion";
import { Briefcase } from "lucide-react";

export default function Portfolio() {
  const { t } = useTranslation();

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col items-center text-center space-y-4"
      >
        <div className="h-16 w-16 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground shadow-xl">
          <Briefcase size={32} />
        </div>
        <h1 className="text-2xl font-bold font-mono tracking-tight text-foreground">{t("nav.portfolio")}</h1>
        <p className="text-muted-foreground max-w-[250px]">
          {t("coming.soon")}
        </p>
      </motion.div>
    </div>
  );
}

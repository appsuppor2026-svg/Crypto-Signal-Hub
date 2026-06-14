import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { sendContactForm } from '@/services/aiService';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/i18n';
import { MessageSquare, Send, CheckCircle2, HelpCircle, AlertCircle, Lightbulb } from 'lucide-react';

export default function Support() {
  const { toast } = useToast();
  const { t } = useTranslation();

  const SUBJECTS = [
    { value: 'consulta',    label: t('support.sub.consulta'),    icon: HelpCircle },
    { value: 'error',       label: t('support.sub.error'),       icon: AlertCircle },
    { value: 'sugerencia',  label: t('support.sub.sugerencia'),  icon: Lightbulb },
    { value: 'cuenta',      label: t('support.sub.cuenta'),      icon: MessageSquare },
    { value: 'otro',        label: t('support.sub.otro'),        icon: MessageSquare },
  ];

  const FAQS = [
    { q: t('support.faq0.q'), a: t('support.faq0.a') },
    { q: t('support.faq1.q'), a: t('support.faq1.a') },
    { q: t('support.faq2.q'), a: t('support.faq2.a') },
    { q: t('support.faq3.q'), a: t('support.faq3.a') },
  ];

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('consulta');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('lr_user_profile');
      if (saved) {
        const p = JSON.parse(saved);
        if (p.name) setName(p.name);
        if (p.email) setEmail(p.email);
      }
    } catch {}
  }, []);

  const handleSend = async () => {
    if (!message.trim() || message.trim().length < 10) {
      toast({ title: t('support.tooShort'), description: t('support.tooShortDesc'), variant: 'destructive' });
      return;
    }
    setSending(true);
    const subjectLabel = SUBJECTS.find(s => s.value === subject)?.label ?? subject;
    const ok = await sendContactForm({ name, email, subject: subjectLabel, message });
    setSending(false);
    if (ok) {
      setSent(true);
      setMessage('');
      toast({ title: t('support.sentToast'), description: t('support.sentToastDesc') });
    } else {
      toast({ title: t('support.errorSend'), description: t('support.errorSendDesc'), variant: 'destructive' });
    }
  };

  return (
    <div className="flex-1 pb-24 overflow-y-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 p-4">

        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">{t('support.title')}</h1>
            <p className="text-[10px] text-muted-foreground">{t('support.subtitle')}</p>
          </div>
        </div>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider">{t('support.faqTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {FAQS.map((faq, i) => (
              <div key={i} className="border border-border/40 rounded-xl overflow-hidden">
                <button
                  className="w-full text-left px-3 py-3 text-sm font-medium flex items-center justify-between gap-2 hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                >
                  <span>{faq.q}</span>
                  <span className={`text-muted-foreground transition-transform shrink-0 ${expandedFaq === i ? 'rotate-180' : ''}`}>▾</span>
                </button>
                {expandedFaq === i && (
                  <div className="px-3 pb-3 text-xs text-muted-foreground leading-relaxed border-t border-border/30 pt-2">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Send className="w-4 h-4 text-blue-400" />
              {t('support.sendTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-4">
            {sent ? (
              <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7 text-green-400" />
                </div>
                <div>
                  <p className="font-semibold text-green-400">{t('support.sentTitle')}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t('support.sentDesc')}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setSent(false)}>
                  {t('support.anotherQuery')}
                </Button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t('support.name')}</Label>
                    <Input value={name} onChange={e => setName(e.target.value)} placeholder={t('support.namePh')} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t('support.email')}</Label>
                    <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={t('support.emailPh')} className="h-9 text-sm" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">{t('support.subject')}</Label>
                  <Select value={subject} onValueChange={setSubject}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SUBJECTS.map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">{t('support.message')} <span className="text-destructive">*</span></Label>
                  <Textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder={t('support.messagePh')}
                    className="min-h-[110px] text-sm resize-none"
                  />
                  <p className="text-[10px] text-muted-foreground/60 text-right">{message.length} {t('support.chars')}</p>
                </div>

                <Button
                  className="w-full h-11 font-bold gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={handleSend}
                  disabled={sending || message.trim().length < 10}
                >
                  {sending ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> {t('support.sending')}</>
                  ) : (
                    <><Send className="w-4 h-4" /> {t('support.sendBtn')}</>
                  )}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <p className="text-[10px] text-muted-foreground/40 text-center">
          {t('support.footer')}
        </p>
      </motion.div>
    </div>
  );
}

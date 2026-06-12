export interface AnalyzeRequest {
  symbol: string;
  price: number;
  change24h: number;
  radarScore?: number;
  upperZones?: { price: number; label?: string }[];
  lowerZones?: { price: number; label?: string }[];
  bias?: string;
}

export async function streamAnalysis(
  data: AnalyzeRequest,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (msg: string) => void
): Promise<void> {
  try {
    const res = await fetch('/api/ai/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!res.ok || !res.body) {
      onError('Error conectando con el servidor de análisis');
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const parsed = JSON.parse(line.slice(6));
          if (parsed.error) { onError(parsed.error); return; }
          if (parsed.done) { onDone(); return; }
          if (parsed.content) onChunk(parsed.content);
        } catch {}
      }
    }
    onDone();
  } catch (err: any) {
    onError(err.message || 'Error de red');
  }
}

export async function sendContactForm(data: {
  name?: string;
  email?: string;
  subject?: string;
  message: string;
}): Promise<boolean> {
  try {
    const res = await fetch('/api/ai/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    return json.ok === true;
  } catch {
    return false;
  }
}

export async function notifyProfileSaved(profile: Record<string, string>): Promise<void> {
  try {
    await fetch('/api/ai/profile-notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile }),
    });
  } catch {}
}

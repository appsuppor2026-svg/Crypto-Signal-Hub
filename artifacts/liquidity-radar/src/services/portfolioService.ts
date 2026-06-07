export interface PortfolioEntry {
  symbol: string;
  amount: number;
  entryPrice: number;
}

export function getPortfolio(): PortfolioEntry[] {
  try {
    return JSON.parse(localStorage.getItem('lr_portfolio') || '[]');
  } catch {
    return [];
  }
}

export function savePortfolio(entries: PortfolioEntry[]): void {
  localStorage.setItem('lr_portfolio', JSON.stringify(entries));
}

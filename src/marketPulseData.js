// Illustrative values for the dashboard demo, not current market quotes.
export const marketPulseCategories = [
  {id: 'stocks', label: 'Stock Market'},
  {id: 'commodities', label: 'Commodity market'},
  {id: 'crypto', label: 'Cryptos'},
];

export const marketPulseInstruments = [
  ['VNINDEX', 'VNINDEX', 1274.32, 0.62, 'Index points', 'Vietnam', 'stocks'],
  ['SPX', 'S&P 500', 5996.76, 1.10, 'Index points', 'United States', 'stocks'],
  ['IXIC', 'NASDAQ', 19386.07, -0.64, 'Index points', 'United States', 'stocks'],
  ['DJI', 'DOW JONES', 42732.13, 0.78, 'Index points', 'United States', 'stocks'],
  ['XAU', 'Gold', 2435.60, 0.90, 'USD / oz', 'Commodities', 'commodities'],
  ['FTSE', 'FTSE 100', 8427.67, 0.42, 'Index points', 'United Kingdom', 'stocks'],
  ['DAX', 'DAX', 18686.60, -0.35, 'Index points', 'Germany', 'stocks'],
  ['CAC', 'CAC 40', 8028.43, 0.28, 'Index points', 'France', 'stocks'],
  ['N225', 'NIKKEI 225', 38920.26, 1.24, 'Index points', 'Japan', 'stocks'],
  ['HSI', 'HANG SENG', 18412.28, -1.08, 'Index points', 'Hong Kong', 'stocks'],
  ['STOXX50', 'EURO STOXX 50', 4983.67, 0.56, 'Index points', 'Europe', 'stocks'],
  ['SSE', 'Shanghai Composite', 3324.20, 0.45, 'Index points', 'China', 'stocks'],
  ['BRENT', 'Brent oil', 82.48, -0.92, 'USD / barrel', 'Commodities', 'commodities'],
  ['XAG', 'Silver', 30.61, 1.36, 'USD / oz', 'Commodities', 'commodities'],
  ['BTC', 'Bitcoin', 64280.45, 2.41, 'USD / coin', 'Digital assets', 'crypto'],
  ['ETH', 'Ethereum', 3486.12, -1.18, 'USD / coin', 'Digital assets', 'crypto'],
  ['SOL', 'Solana', 146.82, 3.62, 'USD / coin', 'Digital assets', 'crypto'],
  ['BNB', 'BNB', 592.40, 0.86, 'USD / coin', 'Digital assets', 'crypto'],
  ['XRP', 'XRP', 0.5246, -0.74, 'USD / coin', 'Digital assets', 'crypto'],
  ['DOGE', 'Dogecoin', 0.1284, 1.95, 'USD / coin', 'Digital assets', 'crypto'],
].map(([ticker, name, price, change, unit, region, category], index) => ({ticker, name, price, change, unit, region, category, index, precision: price < 1 ? 4 : 2}));

import {companies} from './marketData.js';

export const researchTabs = ['Overview', 'Financial strength', 'Growth', 'Profitability', 'Valuation', 'Cash flow', 'Peers'];

const source = 'Sample dataset';
const sectorProfiles = {
  Technology: {netMargin: .23, operatingMargin: .30, grossMargin: .59, revenueGrowth: 13, roe: 24, leverage: .75},
  Consumer: {netMargin: .09, operatingMargin: .13, grossMargin: .31, revenueGrowth: 10, roe: 15, leverage: 1.05},
  Financials: {netMargin: .26, operatingMargin: .34, grossMargin: .66, revenueGrowth: 7, roe: 16, leverage: 2.2},
  Energy: {netMargin: .12, operatingMargin: .18, grossMargin: .35, revenueGrowth: 4, roe: 14, leverage: .85},
  Healthcare: {netMargin: .18, operatingMargin: .25, grossMargin: .62, revenueGrowth: 6, roe: 18, leverage: .9},
};

const usd = value => '$' + Number(value).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
const billions = value => usd(value) + 'B';
const percentage = value => Number(value).toFixed(1) + '%';
const multiple = value => Number(value).toFixed(2) + '×';
const change = (current, prior) => (current / prior - 1) * 100;
const median = values => {
  if (!values.length) return null;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
};

function marketCapInBillions(value) {
  const match = String(value || '').match(/^([\d.]+)\s*([TBM])?$/i);
  if (!match) return 100;
  const scale = {T: 1000, B: 1, M: .001};
  return Number(match[1]) * (scale[(match[2] || 'B').toUpperCase()] || 1);
}

// All statement figures are a deterministic example scenario, not company reports.
// Monetary totals and share counts use billions; per-share figures use USD.
function scenario(company) {
  const profile = sectorProfiles[company.sector] || sectorProfiles.Technology;
  const index = Number(company.index) || 0;
  const variation = (index % 4 - 1.5) * .008;
  const price = Number(company.price) || 100;
  const pe = Number(company.pe) || 20;
  const marketCap = marketCapInBillions(company.cap);
  const sharesOutstanding = marketCap / price;
  const eps = price / pe;
  const netIncome = eps * sharesOutstanding;
  const netMargin = profile.netMargin + variation;
  const operatingMargin = profile.operatingMargin + variation;
  const grossMargin = profile.grossMargin + variation;
  const revenueGrowth = profile.revenueGrowth + (index % 3 - 1) * 1.5;
  const revenue = netIncome / netMargin;
  const operatingIncome = revenue * operatingMargin;
  const grossProfit = revenue * grossMargin;
  const roe = profile.roe + (index % 4 - 1.5) * 1.8;
  const equity = netIncome / (roe / 100);
  const totalLiabilities = equity * profile.leverage;
  const totalAssets = equity + totalLiabilities;
  const debt = totalLiabilities * .40;
  const cash = totalAssets * .11;
  const currentLiabilities = totalLiabilities * .38;
  const currentAssets = Math.max(cash * 1.4, currentLiabilities * (1.65 + index % 3 * .15));
  const operatingCashFlow = netIncome * (1.28 + index % 3 * .08);
  const capitalExpenditure = operatingCashFlow * (company.sector === 'Energy' ? .38 : .22 + index % 3 * .035);
  const freeCashFlow = operatingCashFlow - capitalExpenditure;
  const depreciation = capitalExpenditure * .55;
  const interestExpense = debt * .045;
  const dividends = netIncome * (company.sector === 'Consumer' ? .08 : .24);
  const investedCapital = equity + debt - cash;
  return {
    price, pe, marketCap, sharesOutstanding, eps, netIncome, revenue, revenueGrowth,
    grossProfit, grossMargin, operatingIncome, operatingMargin, netMargin, roe,
    equity, totalLiabilities, totalAssets, debt, cash, currentAssets, currentLiabilities,
    operatingCashFlow, capitalExpenditure, freeCashFlow, depreciation, interestExpense, dividends,
    bookValuePerShare: equity / sharesOutstanding,
    forwardPe: pe / (1 + revenueGrowth / 100),
    priceToBook: marketCap / equity,
    debtToEquity: debt / equity,
    currentRatio: currentAssets / currentLiabilities,
    interestCoverage: operatingIncome / interestExpense,
    cashToDebt: cash / debt,
    roa: netIncome / totalAssets * 100,
    roic: operatingIncome * .79 / investedCapital * 100,
    freeCashFlowYield: freeCashFlow / marketCap * 100,
    cashConversion: operatingCashFlow / netIncome * 100,
    dividendYield: dividends / marketCap * 100,
  };
}

function priorScenario(current, company) {
  const index = Number(company.index) || 0;
  const revenue = current.revenue / (1 + current.revenueGrowth / 100);
  const netMargin = current.netMargin * .96;
  const operatingMargin = current.operatingMargin * .96;
  const netIncome = revenue * netMargin;
  const operatingIncome = revenue * operatingMargin;
  const eps = netIncome / current.sharesOutstanding;
  const pe = current.pe * .94;
  const price = eps * pe;
  const marketCap = price * current.sharesOutstanding;
  const equity = current.equity / 1.08;
  const totalLiabilities = current.totalLiabilities / 1.05;
  const totalAssets = equity + totalLiabilities;
  const debt = current.debt / 1.05;
  const cash = current.cash / 1.07;
  const currentAssets = current.currentAssets / 1.07;
  const currentLiabilities = current.currentLiabilities / 1.05;
  const operatingCashFlow = netIncome * (1.25 + index % 3 * .08);
  const capitalExpenditure = current.capitalExpenditure / 1.08;
  const freeCashFlow = operatingCashFlow - capitalExpenditure;
  return {
    ...current, price, pe, marketCap, revenue, netIncome, eps, operatingIncome,
    netMargin, operatingMargin, grossMargin: current.grossMargin * .98,
    grossProfit: revenue * current.grossMargin * .98,
    equity, totalLiabilities, totalAssets, debt, cash, currentAssets, currentLiabilities,
    operatingCashFlow, capitalExpenditure, freeCashFlow,
    revenueGrowth: current.revenueGrowth - 1.5,
    netIncomeGrowth: current.revenueGrowth - .5,
    epsGrowth: current.revenueGrowth - .5,
    operatingIncomeGrowth: current.revenueGrowth + .5,
    assetGrowth: 5.5,
    freeCashFlowGrowth: current.revenueGrowth + 1,
    roe: netIncome / equity * 100,
    roa: netIncome / totalAssets * 100,
    roic: operatingIncome * .79 / (equity + debt - cash) * 100,
    forwardPe: pe / (1 + (current.revenueGrowth - 1.5) / 100),
    priceToBook: marketCap / equity,
    debtToEquity: debt / equity,
    currentRatio: currentAssets / currentLiabilities,
    interestCoverage: operatingIncome / (debt * .045),
    cashToDebt: cash / debt,
    freeCashFlowYield: freeCashFlow / marketCap * 100,
    cashConversion: operatingCashFlow / netIncome * 100,
    dividends: netIncome * (company.sector === 'Consumer' ? .08 : .24),
    dividendYield: netIncome * (company.sector === 'Consumer' ? .08 : .24) / marketCap * 100,
  };
}

export function getCompanyResearch(company) {
  const current = scenario(company);
  const prior = priorScenario(current, company);
  Object.assign(current, {
    netIncomeGrowth: change(current.netIncome, prior.netIncome),
    epsGrowth: change(current.eps, prior.eps),
    operatingIncomeGrowth: change(current.operatingIncome, prior.operatingIncome),
    assetGrowth: change(current.totalAssets, prior.totalAssets),
    freeCashFlowGrowth: change(current.freeCashFlow, prior.freeCashFlow),
  });
  const peers = companies.filter(item => item.sector === company.sector && item.ticker !== company.ticker);
  const peerScenarios = peers.map(item => {
    const sample = scenario(item);
    const previous = priorScenario(sample, item);
    return {...sample, netIncomeGrowth: change(sample.netIncome, previous.netIncome), epsGrowth: change(sample.eps, previous.eps), operatingIncomeGrowth: change(sample.operatingIncome, previous.operatingIncome), assetGrowth: change(sample.totalAssets, previous.totalAssets), freeCashFlowGrowth: change(sample.freeCashFlow, previous.freeCashFlow)};
  });
  const metric = (label, key, format, category, note = 'Illustrative annual scenario') => {
    const peer = median(peerScenarios.map(item => item[key]));
    return {label, note, value: format(current[key]), prior: format(prior[key]), peer: peer === null ? 'Unavailable' : format(peer), evidence: source, category};
  };
  const strength = 'Balance sheet & liquidity';
  const income = 'Income statement & growth';
  const capital = 'Capital & efficiency';
  const flows = 'Cash flow & returns';
  const valuation = 'Valuation';
  const metricsByTab = {
    'Financial strength': [
      metric('Total assets', 'totalAssets', billions, strength),
      metric("Shareholders’ equity", 'equity', billions, strength),
      metric('Debt / equity', 'debtToEquity', multiple, strength),
      metric('Current ratio', 'currentRatio', multiple, strength),
      metric('Interest coverage', 'interestCoverage', multiple, strength),
      metric('Cash / debt', 'cashToDebt', multiple, strength),
    ],
    Growth: [
      metric('Revenue growth', 'revenueGrowth', percentage, income),
      metric('Net income growth', 'netIncomeGrowth', percentage, income),
      metric('EPS growth', 'epsGrowth', percentage, income),
      metric('Operating profit growth', 'operatingIncomeGrowth', percentage, income),
      metric('Asset growth', 'assetGrowth', percentage, capital),
      metric('Free cash flow growth', 'freeCashFlowGrowth', percentage, flows),
    ],
    Profitability: [
      metric('Gross margin', 'grossMargin', value => percentage(value * 100), income),
      metric('Operating margin', 'operatingMargin', value => percentage(value * 100), income),
      metric('Net margin', 'netMargin', value => percentage(value * 100), income),
      metric('Return on equity', 'roe', percentage, capital),
      metric('Return on assets', 'roa', percentage, capital),
      metric('Return on invested capital', 'roic', percentage, capital),
    ],
    Valuation: [
      metric('Share price', 'price', usd, valuation, 'Existing sample market snapshot'),
      metric('Market capitalization', 'marketCap', billions, valuation, 'Existing sample market snapshot'),
      metric('P/E', 'pe', multiple, valuation, 'Existing sample market snapshot'),
      metric('Forward P/E', 'forwardPe', multiple, valuation, 'Illustrative growth assumption'),
      metric('Price / book', 'priceToBook', multiple, valuation),
      metric('Earnings per share', 'eps', usd, valuation),
    ],
    'Cash flow': [
      metric('Operating cash flow', 'operatingCashFlow', billions, flows),
      metric('Capital expenditures', 'capitalExpenditure', billions, flows),
      metric('Free cash flow', 'freeCashFlow', billions, flows),
      metric('Free cash flow yield', 'freeCashFlowYield', percentage, flows),
      metric('Cash conversion', 'cashConversion', percentage, flows),
      metric('Dividend yield', 'dividendYield', percentage, flows),
    ],
    Peers: [
      metric('P/E', 'pe', multiple, valuation),
      metric('Return on equity', 'roe', percentage, capital),
      metric('Net margin', 'netMargin', value => percentage(value * 100), income),
      metric('Revenue growth', 'revenueGrowth', percentage, income),
      metric('Market capitalization', 'marketCap', billions, valuation),
      metric('Free cash flow yield', 'freeCashFlowYield', percentage, flows),
    ],
  };
  const row = (label, value) => ({label, value, evidence: source});
  const categories = [
    {name: income, rows: [
      row('Revenue', billions(current.revenue)),
      row('Cost of revenue', billions(current.revenue - current.grossProfit)),
      row('Gross profit', billions(current.grossProfit)),
      row('Operating expenses', billions(current.grossProfit - current.operatingIncome)),
      row('Operating income', billions(current.operatingIncome)),
      row('Net income', billions(current.netIncome)),
      row('Revenue growth', percentage(current.revenueGrowth)),
      row('Net margin', percentage(current.netMargin * 100)),
    ]},
    {name: capital, rows: [
      row('Total assets', billions(current.totalAssets)),
      row('Total liabilities', billions(current.totalLiabilities)),
      row("Shareholders’ equity", billions(current.equity)),
      row('Liabilities & equity', billions(current.totalLiabilities + current.equity)),
      row('Return on equity', percentage(current.roe)),
      row('Return on assets', percentage(current.roa)),
      row('Return on invested capital', percentage(current.roic)),
      row('Asset turnover', multiple(current.revenue / current.totalAssets)),
    ]},
    {name: strength, rows: [
      row('Cash & equivalents', billions(current.cash)),
      row('Current assets', billions(current.currentAssets)),
      row('Current liabilities', billions(current.currentLiabilities)),
      row('Working capital', billions(current.currentAssets - current.currentLiabilities)),
      row('Total debt', billions(current.debt)),
      row('Net debt', billions(current.debt - current.cash)),
      row('Current ratio', multiple(current.currentRatio)),
      row('Debt / equity', multiple(current.debtToEquity)),
    ]},
    {name: flows, rows: [
      row('Operating cash flow', billions(current.operatingCashFlow)),
      row('Capital expenditures', billions(current.capitalExpenditure)),
      row('Free cash flow', billions(current.freeCashFlow)),
      row('Depreciation & amortization', billions(current.depreciation)),
      row('Dividends', billions(current.dividends)),
      row('Cash conversion', percentage(current.cashConversion)),
      row('Free cash flow yield', percentage(current.freeCashFlowYield)),
      row('Dividend yield', percentage(current.dividendYield)),
    ]},
  ];
  return {
    ...current,
    source,
    reportDate: source,
    metricsByTab,
    categories,
    peerCount: peers.length,
    peerPositions: [company, ...peers].map(item => {
      const sample = item.ticker === company.ticker ? current : scenario(item);
      return {ticker: item.ticker, name: item.name, sector: item.sector, pe: sample.pe, roe: sample.roe, isSelected: item.ticker === company.ticker, source};
    }),
    coreValueAssumptions: {annualGrowth: current.revenueGrowth, discountRate: 9, terminalGrowth: 2.5, projectionYears: 5},
  };
}

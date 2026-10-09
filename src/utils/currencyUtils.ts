import { Currency } from '@/types/characterState';

/**
 * 将所有货币换算为铜币 (CP) 总量
 */
export function totalInCP(currency: Currency): number {
  return (
    (currency.pp || 0) * 1000 +
    (currency.gp || 0) * 100 +
    (currency.ep || 0) * 50 +
    (currency.sp || 0) * 10 +
    (currency.cp || 0)
  );
}

/**
 * 将铜币 (CP) 总量换算回结构化货币，并按面额从大到小平衡
 */
export function fromCPToCurrency(totalCp: number): Currency {
  let remaining = totalCp;

  const pp = Math.floor(remaining / 1000);
  remaining %= 1000;

  const gp = Math.floor(remaining / 100);
  remaining %= 100;

  const ep = Math.floor(remaining / 50);
  remaining %= 50;

  const sp = Math.floor(remaining / 10);
  remaining %= 10;

  const cp = remaining;

  return { pp, gp, ep, sp, cp };
}

/**
 * 扣除指定 CP 金额，返回扣除后的货币分布
 */
export function deductCP(current: Currency, cpToDeduct: number): Currency {
  const totalCp = totalInCP(current);

  if (totalCp < cpToDeduct) {
    console.warn('Insufficient funds');
    return current;
  }

  const remainingCp = totalCp - cpToDeduct;
  return fromCPToCurrency(remainingCp);
}

/**
 * 扣除指定 GP 金额，返回扣除后的货币分布
 */
export function deductCurrency(current: Currency, gpToDeduct: number): Currency {
  return deductCP(current, Math.round(gpToDeduct * 100));
}

/**
 * 解析价格字符串（如 "10 GP"）并换算为 CP
 */
export function parsePriceToCP(priceStr: string): number {
  if (!priceStr) return 0;

  const normalized = priceStr.trim().toUpperCase();
  const match = normalized.match(/^([\d.]+)\s*(PP|GP|EP|SP|CP)$/);

  if (!match) return 0;

  const value = parseFloat(match[1]);
  const unit = match[2];

  switch (unit) {
    case 'PP':
      return value * 1000;
    case 'GP':
      return value * 100;
    case 'EP':
      return value * 50;
    case 'SP':
      return value * 10;
    case 'CP':
      return value;
    default:
      return 0;
  }
}

/**
 * 计算货币的总重量 (50 枚硬币 = 1 磅)
 */
export function getCurrencyWeight(currency: Currency): number {
  if (!currency) return 0;
  const totalCoins =
    (currency.pp || 0) +
    (currency.gp || 0) +
    (currency.ep || 0) +
    (currency.sp || 0) +
    (currency.cp || 0);
  return totalCoins / 50;
}

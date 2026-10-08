export const money = (value: any, symbol = '') => `${Number(value || 0).toFixed(2)}${symbol ? ' ' + symbol : ''}`.trim();
export const safeText = (value: any) => value ?? '-';
export const safeNumber = (value: any) => Number(value || 0);

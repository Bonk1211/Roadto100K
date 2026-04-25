export function formatRM(amount: number): string {
  return `RM ${amount.toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function maskAccount(acc: string): string {
  if (acc.length <= 4) return acc;
  return `${acc.slice(0, 2)}•• •••• ${acc.slice(-4)}`;
}

export default function formatAmountToKMEnhanced(amount: number | string) {
  const num = Math.abs(Number(amount) || 0);
  let result = '';

  if (num >= 1000000) {
    result = (num / 1000000).toFixed(1);
    result = result.replace(/\.0$/, '') + 'M';
  } else if (num >= 1000) {
    result = (num / 1000).toFixed(1);
    result = result.replace(/\.0$/, '') + 'K';
  } else {
    result = num.toString();
  }

  return result === '0' ? '0' : result;
}
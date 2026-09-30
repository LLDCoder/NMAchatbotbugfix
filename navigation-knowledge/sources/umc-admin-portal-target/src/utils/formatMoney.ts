const formatMoney = (num?: Number | string, float: boolean = true) => {
  if(!num) return float ? '0.00' : '0';
  if (typeof num !== 'number' && typeof num !== 'string') return num;
  let str =  Number(num).toFixed(2).toString().trim();
  if (!str || isNaN(Number(str))) return num;
  const [integerPart, decimalPart] = str.split('.');
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decimalPart && float ? `${formattedInteger}.${decimalPart}` : formattedInteger;
};

export default formatMoney;
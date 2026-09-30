// export csv file
export const exportCSVFile = (csvData: any, fileName: string) => {
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvData], {
        type: 'text/csv;charset=utf-8'
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = decodeURIComponent(fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
};
export const formatMoney = (num?: Number | string) => {
  if(!num) return '0.00';
  if (typeof num !== 'number' && typeof num !== 'string') return num;
  let str =  Number(num).toFixed(2).toString().trim();
  if (!str || isNaN(Number(str))) return num;
  const [integerPart, decimalPart] = str.split('.');
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decimalPart ? `${formattedInteger}.${decimalPart}` : formattedInteger;
};

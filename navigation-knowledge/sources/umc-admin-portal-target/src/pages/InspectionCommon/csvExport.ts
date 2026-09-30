export type CsvRows = Array<Array<unknown>>;

const CSV_BOM = '\uFEFF';

const escapeCsvValue = (value: unknown) => {
  const normalized = String(value ?? '').replace(/\r?\n/g, ' ');
  if (/[",]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
};

const buildCsvContent = (rows: CsvRows) => (
  rows.map((row) => row.map(escapeCsvValue).join(',')).join('\r\n')
);

export const downloadBlobFile = (filename: string, blob: Blob) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const downloadCsvFile = (filename: string, rows: CsvRows) => {
  const blob = new Blob([CSV_BOM, buildCsvContent(rows)], {
    type: 'text/csv;charset=utf-8;',
  });
  downloadBlobFile(filename, blob);
};

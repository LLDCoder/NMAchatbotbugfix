import request from "@/utils/request";

type SaveFileOptions = {
  timeout?: number;
  paramsSerializer?: (params: unknown) => string;
};

export default async function saveFileWithAxios(
  path: string,
  fileName?: string,
  params?: unknown,
  method: 'get' | 'post' = 'get',
  options: SaveFileOptions = {},
) {
  const response = await request[method](path, params as Record<string, unknown> | undefined, {
    responseType: 'blob',
    rawResponse: true,
    ...options,
  });
  const rawResponse = response as {
    data: Blob;
    headers?: Record<string, string | undefined>;
  };
  let downloadFileName = fileName;
  if (!downloadFileName) {
    const disposition = rawResponse.headers?.['content-disposition'] ?? '';
    const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
    if (match?.[1]) {
      try {
        downloadFileName = decodeURIComponent(match[1]);
      } catch {
        downloadFileName = match[1];
      }
    }
  }
  const url = URL.createObjectURL(rawResponse.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = downloadFileName || 'download';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

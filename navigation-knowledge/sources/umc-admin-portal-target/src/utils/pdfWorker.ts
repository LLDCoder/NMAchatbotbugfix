import { GlobalWorkerOptions } from "pdfjs-dist";

const PDF_WORKER_FILE = "assets/pdf.worker.min.js";

function joinBaseUrl(baseUrl: string, filePath: string) {
  return `${baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`}${filePath}`;
}

export const pdfWorkerSrc = joinBaseUrl(
  import.meta.env.BASE_URL,
  PDF_WORKER_FILE,
);

GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

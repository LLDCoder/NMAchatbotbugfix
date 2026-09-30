import request from '@/utils/request';

export interface AnalyzeBookRequest {
  filePath: string;
  typeOfPublication?: string;
  serviceCode: number | string;
  originalFileName?:string
}

export interface AnalyzeBookResponseData {
  analysisStatus?: string;
  requestId?: string;
  riskLevel?: string;
  isCompliant?: boolean;
  recommendationSummary?: string;
  aiGeneratedFields?: Record<string, unknown>;
  aiGeneratedLabels?: Record<string, unknown>;
  aiGeneratedFieldKeys?: string[];
  mappingWarnings?: string[];
}

export interface AnalyzeBookResponseEnvelope {
  isSuccess: boolean;
  statusCode: number;
  message: string;
  data: AnalyzeBookResponseData;
}

export const analyzeBookMaterial = (data: AnalyzeBookRequest) => {
  // P8 Plan A: route through the gateway (relative /api); no per-service base URL override.
  return request.post<AnalyzeBookResponseEnvelope>(
    `/api/MyRequest/AI/analyze-book`,
    data,
  );
};

import { useEffect, useState } from "react";
import { loadAuthenticatedDocumentSource } from "@/utils/loadAuthenticatedDocumentSource";

export type AuthenticatedDocumentStatus =
  | "idle"
  | "loading"
  | "success"
  | "error";

export type AuthenticatedDocumentResult = {
  source: string;
  status: AuthenticatedDocumentStatus;
  data?: ArrayBuffer;
};

type ResolvedSource = {
  reference: string;
  source: string;
  status: AuthenticatedDocumentStatus;
  data?: ArrayBuffer;
};

/**
 * Resolves a protected Document reference through the authenticated Axios client
 * and exposes the load lifecycle. Native image navigation and pdf.js cannot attach
 * the Admin bearer token, so protected files are fetched as blobs and exposed to the
 * browser through a short-lived object URL. Consumers that need to distinguish the
 * pending phase from a real failure should read `status`; the pending phase must not
 * be rendered as an unavailable/error state.
 */
export const useAuthenticatedDocumentSource = (
  fileReference?: string | null,
  fallback = "",
): AuthenticatedDocumentResult => {
  const reference = fileReference?.trim() || "";
  const [resolved, setResolved] = useState<ResolvedSource>({
    reference,
    source: fallback,
    status: reference ? "loading" : "idle",
  });

  useEffect(() => {
    if (!reference) {
      setResolved({ reference, source: fallback, status: "idle" });
      return;
    }

    setResolved({ reference, source: fallback, status: "loading" });

    const abortController = new AbortController();
    let objectUrl = "";

    const load = async () => {
      try {
        const resolvedSource = await loadAuthenticatedDocumentSource(
          reference,
          abortController.signal,
        );

        if (abortController.signal.aborted) {
          if (resolvedSource.objectUrl) {
            URL.revokeObjectURL(resolvedSource.objectUrl);
          }
          return;
        }

        objectUrl = resolvedSource.objectUrl || "";
        setResolved({
          reference,
          source: resolvedSource.source,
          status: "success",
          data: resolvedSource.data,
        });
      } catch {
        if (!abortController.signal.aborted) {
          setResolved({ reference, source: fallback, status: "error" });
        }
      }
    };

    void load();

    return () => {
      abortController.abort();
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [fallback, reference]);

  if (resolved.reference !== reference) {
    return {
      source: fallback,
      status: reference ? "loading" : "idle",
    };
  }

  return {
    source: resolved.source,
    status: resolved.status,
    data: resolved.data,
  };
};

/**
 * Backward-compatible string accessor kept for existing consumers that only need
 * the resolved source URL.
 */
export const useAuthenticatedDocumentUrl = (
  fileReference?: string | null,
  fallback = "",
) => {
  return useAuthenticatedDocumentSource(fileReference, fallback).source;
};

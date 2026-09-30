import { useEffect, type RefObject } from "react";
import { loadAuthenticatedDocumentSource } from "@/utils/loadAuthenticatedDocumentSource";
import { parseProtectedDocumentPlaceholder } from "@/utils/protectedDocumentTarget";

const PROTECTED_DOCUMENT_PATTERN =
  /\/api\/(?:Document\/(?:Dowload|Download)|pdf\/preview)(?:\?|$)/i;

export const useAuthenticatedDocumentMedia = (
  containerRef: RefObject<HTMLElement>,
  active: boolean,
) => {
  useEffect(() => {
    const container = containerRef.current;
    if (!active || !container) return undefined;

    const abortController = new AbortController();
    const elementObjectUrls = new Map<Element, string>();
    const pendingSources = new WeakMap<Element, string>();

    const revokeElementObjectUrl = (element: Element) => {
      const objectUrl = elementObjectUrls.get(element);
      if (!objectUrl) return;

      URL.revokeObjectURL(objectUrl);
      elementObjectUrls.delete(element);
    };

    const resolveElement = async (element: Element) => {
      const source = element.getAttribute("src") || "";
      const currentObjectUrl = elementObjectUrls.get(element);
      if (currentObjectUrl && source !== currentObjectUrl) {
        revokeElementObjectUrl(element);
      }

      const documentSource = parseProtectedDocumentPlaceholder(source) || source;
      if (
        !PROTECTED_DOCUMENT_PATTERN.test(documentSource) ||
        pendingSources.get(element) === documentSource
      ) {
        return;
      }

      pendingSources.set(element, documentSource);
      try {
        const authenticatedSource = await loadAuthenticatedDocumentSource(
          documentSource,
          abortController.signal,
        );
        const currentSource = element.getAttribute("src") || "";
        const currentDocumentSource =
          parseProtectedDocumentPlaceholder(currentSource) || currentSource;
        if (
          abortController.signal.aborted ||
          !element.isConnected ||
          pendingSources.get(element) !== documentSource ||
          currentDocumentSource !== documentSource
        ) {
          if (authenticatedSource.objectUrl) {
            URL.revokeObjectURL(authenticatedSource.objectUrl);
          }
          return;
        }

        element.setAttribute("src", authenticatedSource.source);
        if (authenticatedSource.objectUrl) {
          elementObjectUrls.set(element, authenticatedSource.objectUrl);
        }
      } catch {
        if (
          !abortController.signal.aborted &&
          pendingSources.get(element) === documentSource
        ) {
          element.removeAttribute("src");
        }
      } finally {
        if (pendingSources.get(element) === documentSource) {
          pendingSources.delete(element);
        }
      }
    };

    const resolveMediaElements = () => {
      elementObjectUrls.forEach((_objectUrl, element) => {
        if (!element.isConnected || !container.contains(element)) {
          revokeElementObjectUrl(element);
        }
      });

      container
        .querySelectorAll("img[src], video[src], source[src]")
        .forEach((element) => {
          void resolveElement(element);
        });
    };

    resolveMediaElements();

    const observer = new MutationObserver(resolveMediaElements);
    observer.observe(container, {
      attributes: true,
      attributeFilter: ["src"],
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      abortController.abort();
      elementObjectUrls.forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
      elementObjectUrls.clear();
    };
  }, [active, containerRef]);
};

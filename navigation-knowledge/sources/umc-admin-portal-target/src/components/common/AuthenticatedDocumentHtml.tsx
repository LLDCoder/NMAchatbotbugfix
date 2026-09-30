import { useEffect, useMemo, useState } from "react";
import type { HTMLAttributes } from "react";
import { sanitizeHtml } from "@/utils/sanitizeHtml";
import { loadAuthenticatedDocumentSource } from "@/utils/loadAuthenticatedDocumentSource";

type AuthenticatedDocumentHtmlProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "dangerouslySetInnerHTML"
> & {
  html?: string | null;
};

type ResolvedHtml = {
  reference: string;
  html: string;
};

const PROTECTED_DOCUMENT_MEDIA_PATTERN =
  /\/api\/(?:Document\/(?:Dowload|Download)|pdf\/preview)(?:\?|["'])/i;

export const AuthenticatedDocumentHtml = ({
  html,
  ...props
}: AuthenticatedDocumentHtmlProps) => {
  const sanitizedHtml = useMemo(() => sanitizeHtml(html), [html]);
  const [resolved, setResolved] = useState<ResolvedHtml>({
    reference: sanitizedHtml,
    html: PROTECTED_DOCUMENT_MEDIA_PATTERN.test(sanitizedHtml)
      ? ""
      : sanitizedHtml,
  });

  useEffect(() => {
    if (!PROTECTED_DOCUMENT_MEDIA_PATTERN.test(sanitizedHtml)) {
      setResolved({ reference: sanitizedHtml, html: sanitizedHtml });
      return undefined;
    }

    const abortController = new AbortController();
    const objectUrls: string[] = [];
    const documentNode = new DOMParser().parseFromString(
      sanitizedHtml,
      "text/html",
    );
    const mediaElements = Array.from(
      documentNode.querySelectorAll<HTMLElement>(
        "img[src], video[src], source[src]",
      ),
    ).filter((element) =>
      PROTECTED_DOCUMENT_MEDIA_PATTERN.test(element.getAttribute("src") || ""),
    );

    const resolveMedia = async () => {
      await Promise.all(
        mediaElements.map(async (element) => {
          const source = element.getAttribute("src") || "";
          try {
            const authenticatedSource = await loadAuthenticatedDocumentSource(
              source,
              abortController.signal,
            );
            if (abortController.signal.aborted) {
              if (authenticatedSource.objectUrl) {
                URL.revokeObjectURL(authenticatedSource.objectUrl);
              }
              return;
            }

            element.setAttribute("src", authenticatedSource.source);
            if (authenticatedSource.objectUrl) {
              objectUrls.push(authenticatedSource.objectUrl);
            }
          } catch {
            element.removeAttribute("src");
          }
        }),
      );

      if (!abortController.signal.aborted) {
        setResolved({
          reference: sanitizedHtml,
          html: documentNode.body.innerHTML,
        });
      }
    };

    void resolveMedia();

    return () => {
      abortController.abort();
      objectUrls.forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
    };
  }, [sanitizedHtml]);

  const resolvedHtml = resolved.reference === sanitizedHtml
    ? resolved.html
    : PROTECTED_DOCUMENT_MEDIA_PATTERN.test(sanitizedHtml)
      ? ""
      : sanitizedHtml;

  return <div {...props} dangerouslySetInnerHTML={{ __html: resolvedHtml }} />;
};

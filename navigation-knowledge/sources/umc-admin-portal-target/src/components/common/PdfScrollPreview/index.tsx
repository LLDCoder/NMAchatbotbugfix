import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Spin } from "antd";
import {
  getDocument,
  type PDFDocumentLoadingTask,
  type PDFDocumentProxy,
  type PDFPageProxy,
  type RenderTask,
} from "pdfjs-dist";
import { useTranslation } from "react-i18next";
import "@/utils/pdfWorker";
import "./index.less";

const DEFAULT_PAGE_RATIO = 0.75;
const INITIAL_RENDER_PAGE_COUNT = 2;
const VIEWPORT_PADDING_PX = 12;
const OBSERVER_ROOT_MARGIN = "800px 0px";

interface PdfScrollPreviewProps {
  file: string;
  data?: ArrayBuffer;
  scale: number;
  className?: string;
  onDocumentLoadSuccess?: (payload: { numPages: number }) => void;
  onPassword?: (callback: (password: string) => void, reason: number) => void;
}

interface PdfScrollPreviewPageProps {
  documentProxy: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  basePageWidth: number;
  defaultAspectRatio: number;
  rootElement: HTMLDivElement | null;
  onRendered?: () => void;
}

function joinClassNames(...values: Array<string | undefined | false>) {
  return values.filter(Boolean).join(" ");
}

const PdfScrollPreviewPage: React.FC<PdfScrollPreviewPageProps> = ({
  documentProxy,
  pageNumber,
  scale,
  basePageWidth,
  defaultAspectRatio,
  rootElement,
  onRendered,
}) => {
  const onRenderedRef = useRef(onRendered);
  onRenderedRef.current = onRendered;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pageRef = useRef<PDFPageProxy | null>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const [shouldRender, setShouldRender] = useState(
    pageNumber <= INITIAL_RENDER_PAGE_COUNT,
  );
  const [isRendering, setIsRendering] = useState(pageNumber <= INITIAL_RENDER_PAGE_COUNT);
  const [renderSize, setRenderSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const fallbackSize = useMemo(() => {
    const width = Math.max(160, Math.floor(basePageWidth * (scale / 100)));
    return {
      width,
      height: Math.max(220, Math.floor(width / defaultAspectRatio)),
    };
  }, [basePageWidth, defaultAspectRatio, scale]);

  useEffect(() => {
    if (shouldRender) return undefined;

    const target = wrapperRef.current;

    if (!rootElement || !target) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        setShouldRender(true);
        observer.disconnect();
      },
      {
        root: rootElement,
        rootMargin: OBSERVER_ROOT_MARGIN,
      },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [rootElement, shouldRender]);

  useEffect(() => {
    let disposed = false;

    const renderPage = async () => {
      if (!shouldRender || !basePageWidth || !canvasRef.current) return;

      setIsRendering(true);

      try {
        const page = pageRef.current || (await documentProxy.getPage(pageNumber));
        if (disposed) return;

        pageRef.current = page;

        const baseViewport = page.getViewport({ scale: 1 });
        const fitScale = basePageWidth / Math.max(baseViewport.width, 1);
        const viewport = page.getViewport({
          scale: fitScale * (scale / 100),
        });

        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext("2d", { alpha: false });
        if (!context) return;

        const outputScale = window.devicePixelRatio || 1;
        canvas.width = Math.max(1, Math.floor(viewport.width * outputScale));
        canvas.height = Math.max(1, Math.floor(viewport.height * outputScale));
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        context.setTransform(outputScale, 0, 0, outputScale, 0, 0);
        context.clearRect(0, 0, canvas.width, canvas.height);

        renderTaskRef.current?.cancel();
        const renderTask = page.render({
          canvasContext: context,
          canvas,
          viewport,
          background: "rgb(255,255,255)",
        });
        renderTaskRef.current = renderTask;
        setRenderSize({ width: viewport.width, height: viewport.height });

        await renderTask.promise;
        if (!disposed) {
        setIsRendering(false);
        onRenderedRef.current?.();
        }
        } catch (error) {
        if (
        disposed ||
        (error instanceof Error && error.name === "RenderingCancelledException")
        ) {
        return;
        }
        setIsRendering(false);
        onRenderedRef.current?.();
        }
    };

    void renderPage();

    return () => {
      disposed = true;
      renderTaskRef.current?.cancel();
    };
  }, [basePageWidth, documentProxy, pageNumber, scale, shouldRender]);

  useEffect(
    () => () => {
      renderTaskRef.current?.cancel();
      pageRef.current?.cleanup();
    },
    [],
  );

  const size = renderSize || fallbackSize;

  return (
    <div
      ref={wrapperRef}
      className="pdf-scroll-preview__page"
      style={{ width: `${size.width}px`, minHeight: `${size.height}px` }}
      data-page-number={pageNumber}
    >
      {!shouldRender || isRendering ? (
        <div className="pdf-scroll-preview__page-placeholder">
          <Spin size="small" />
        </div>
      ) : null}
      <canvas
        dir="ltr"
        ref={canvasRef}
        className={joinClassNames(
          "pdf-scroll-preview__canvas",
          shouldRender && !isRendering && "is-ready",
        )}
      />
    </div>
  );
};

const PdfScrollPreview: React.FC<PdfScrollPreviewProps> = ({
  file,
  data,
  scale,
  className,
  onDocumentLoadSuccess,
  onPassword,
}) => {
  const { t } = useTranslation();
  const viewportRef = useRef<HTMLDivElement>(null);
  const loadingTaskRef = useRef<PDFDocumentLoadingTask | null>(null);
  const documentRef = useRef<PDFDocumentProxy | null>(null);
  const onDocumentLoadSuccessRef = useRef(onDocumentLoadSuccess);
  const onPasswordRef = useRef(onPassword);
  const [rootElement, setRootElement] = useState<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [documentProxy, setDocumentProxy] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [basePageWidth, setBasePageWidth] = useState(0);
  const [defaultAspectRatio, setDefaultAspectRatio] = useState(DEFAULT_PAGE_RATIO);
  const [firstPageRendered, setFirstPageRendered] = useState(false);
  const handleFirstPageRendered = useCallback(() => {
    setFirstPageRendered(true);
  }, []);

  useEffect(() => {
    onDocumentLoadSuccessRef.current = onDocumentLoadSuccess;
  }, [onDocumentLoadSuccess]);

  useEffect(() => {
    onPasswordRef.current = onPassword;
  }, [onPassword]);

  useEffect(() => {
    let disposed = false;

    setStatus("loading");
    setDocumentProxy(null);
    setNumPages(0);
    setDefaultAspectRatio(DEFAULT_PAGE_RATIO);
    setFirstPageRendered(false);

    const loadingTask = getDocument(data ? { data: new Uint8Array(data) } : file);
    loadingTaskRef.current = loadingTask;
    loadingTask.onPassword = (
      callback: (password: string) => void,
      reason: number,
    ) => {
      onPasswordRef.current?.(callback, reason);
    };

    void loadingTask.promise
      .then(async (nextDocument) => {
        if (disposed) {
          await nextDocument.destroy();
          return;
        }

        documentRef.current = nextDocument;
        setDocumentProxy(nextDocument);
        setNumPages(nextDocument.numPages);
        setStatus("ready");
        onDocumentLoadSuccessRef.current?.({ numPages: nextDocument.numPages });

        const firstPage = await nextDocument.getPage(1);
        if (disposed) {
          firstPage.cleanup();
          return;
        }

        const viewport = firstPage.getViewport({ scale: 1 });
        if (viewport.width && viewport.height) {
          setDefaultAspectRatio(viewport.width / viewport.height);
        }
        firstPage.cleanup();
      })
      .catch((error: unknown) => {
        if (
          disposed ||
          (error instanceof Error &&
            (error.name === "RenderingCancelledException" ||
              error.name === "AbortException"))
        ) {
          return;
        }

        setStatus("error");
      });

    return () => {
      disposed = true;
      loadingTaskRef.current?.destroy();
      loadingTaskRef.current = null;

      if (documentRef.current) {
        void documentRef.current.destroy();
        documentRef.current = null;
      }
    };
  }, [data, file]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;

    setRootElement(viewport);

    const updateWidth = () => {
      setBasePageWidth(
        Math.max(240, Math.floor(viewport.clientWidth - VIEWPORT_PADDING_PX * 2)),
      );
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={joinClassNames("pdf-scroll-preview", className)}>
      <div ref={viewportRef} className="pdf-scroll-preview__viewport">
        {status === "error" ? (
          <div className="pdf-scroll-preview__state">
            <div className="pdf-scroll-preview__state-card">
              <div className="pdf-scroll-preview__state-title">
                {t("sharedComponents.previewModal.unavailable.title")}
              </div>
              <div className="pdf-scroll-preview__state-copy">
                {t("sharedComponents.previewModal.unavailable.description")}
              </div>
            </div>
          </div>
        ) : (
        <>
        {documentProxy ? (
        <div className="pdf-scroll-preview__content">
          {Array.from({ length: numPages }, (_, index) => (
          <PdfScrollPreviewPage
          key={index + 1}
          documentProxy={documentProxy}
          pageNumber={index + 1}
          scale={scale}
          basePageWidth={basePageWidth}
          defaultAspectRatio={defaultAspectRatio}
          rootElement={rootElement}
          onRendered={index === 0 ? handleFirstPageRendered : undefined}
          />
          ))}
        </div>
        ) : null}
        {status === "loading" ||
        !documentProxy ||
        (numPages > 0 && !firstPageRendered) ? (
        <div className="pdf-scroll-preview__state pdf-scroll-preview__state--overlay">
          <Spin />
        </div>
        ) : null}
        </>
        )}
      </div>
    </div>
  );
};

export default PdfScrollPreview;

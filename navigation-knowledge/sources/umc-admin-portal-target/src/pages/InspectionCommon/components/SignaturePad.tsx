import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from 'antd';
import { useAuthenticatedDocumentUrl } from '@/hooks/useAuthenticatedDocumentUrl';
import './SignaturePad.less';

type SignatureIconProps = {
  className?: string;
};

const SignatureEditIcon: React.FC<SignatureIconProps> = ({ className }) => (
  <svg
    className={className}
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <g transform="translate(2.2008 2.2008)">
      <path
        d="M0 16.7998V2.7998C0 2.0572 0.295211 1.34541 0.820312 0.820312C1.34541 0.295211 2.0572 0 2.7998 0H9.7998C10.2416 0 10.5996 0.357977 10.5996 0.799805C10.5996 1.24163 10.2416 1.59961 9.7998 1.59961H2.7998C2.48154 1.59961 2.17622 1.72613 1.95117 1.95117C1.72613 2.17622 1.59961 2.48154 1.59961 2.7998V16.7998C1.59961 17.1181 1.72613 17.4234 1.95117 17.6484C2.17622 17.8735 2.48155 18 2.7998 18H16.7998C17.1181 18 17.4234 17.8735 17.6484 17.6484C17.8735 17.4234 18 17.1181 18 16.7998V9.7998C18 9.35798 18.358 9 18.7998 9C19.2416 9 19.5996 9.35798 19.5996 9.7998V16.7998C19.5996 17.5424 19.3044 18.2542 18.7793 18.7793C18.2542 19.3044 17.5424 19.5996 16.7998 19.5996H2.7998C2.0572 19.5996 1.34541 19.3044 0.820312 18.7793C0.295211 18.2542 0 17.5424 0 16.7998Z"
        fill="#92722A"
      />
    </g>
    <g transform="translate(7.1952 1.2048)">
      <path
        d="M14.0005 2.9209C14.0004 2.57054 13.8615 2.23407 13.6137 1.98633C13.366 1.73863 13.0295 1.59961 12.6792 1.59961C12.3288 1.59963 11.9924 1.7386 11.7446 1.98633L2.7319 11.001C2.58942 11.1432 2.48491 11.3195 2.42819 11.5127L1.74167 13.8584L4.08835 13.1719H4.08932C4.28235 13.1154 4.45775 13.0112 4.60007 12.8691L13.6137 3.85547L13.7016 3.75879C13.8943 3.52366 14.0005 3.22754 14.0005 2.9209ZM15.601 2.9209C15.601 3.69565 15.2924 4.43848 14.7446 4.98633L5.7319 14.001C5.44101 14.2916 5.08993 14.514 4.70456 14.6533L4.53757 14.708L1.66452 15.5479C1.44091 15.6131 1.20364 15.6173 0.977995 15.5596C0.752395 15.5018 0.546055 15.3843 0.381316 15.2197C0.216563 15.055 0.0983472 14.8487 0.0404953 14.623C-0.017342 14.3973 -0.01304 14.1593 0.0522141 13.9355L0.892058 11.0625L0.893034 11.0615C1.02531 10.6112 1.26799 10.2008 1.60007 9.86914L10.6137 0.855469L10.8276 0.661133C11.3474 0.235208 12.0013 2.16581e-05 12.6792 0C13.4539 0 14.1968 0.307715 14.7446 0.855469C15.2924 1.40327 15.601 2.1462 15.601 2.9209Z"
        fill="#92722A"
      />
    </g>
  </svg>
);

const SignatureUndoIcon: React.FC<SignatureIconProps> = ({ className }) => (
  <svg
    className={className}
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <path
      d="M8.00003 1.24986C11.7278 1.24994 14.75 4.27206 14.75 7.99986C14.75 11.7277 11.7279 14.7498 8.00003 14.7499C6.13628 14.7499 4.44727 13.994 3.22659 12.7733C2.93372 12.4804 2.93375 12.0047 3.22659 11.7118C3.5195 11.419 3.99528 11.4189 4.28812 11.7118C5.23898 12.6627 6.55006 13.2499 8.00003 13.2499C10.8994 13.2498 13.25 10.8993 13.25 7.99986C13.25 5.10049 10.8994 2.74994 8.00003 2.74986C6.55014 2.74986 5.23897 3.33715 4.28812 4.28794C4.08036 4.49569 3.76831 4.83224 3.46195 5.16685H4.66702C4.9429 5.16711 5.16695 5.39093 5.16702 5.66685C5.16685 5.94268 4.94284 6.16659 4.66702 6.16685H2.55765C2.28224 6.47382 1.81073 6.50154 1.50198 6.22739C1.19227 5.95237 1.16447 5.47853 1.43948 5.1688V5.16782H1.44046C1.4411 5.16703 1.44229 5.16516 1.44339 5.16392C1.44573 5.16126 1.44897 5.15691 1.45316 5.1522C1.46226 5.14198 1.47622 5.1273 1.4932 5.10825C1.49543 5.10574 1.49767 5.1031 1.50003 5.10044V2.99986C1.50011 2.72378 1.72394 2.49986 2.00003 2.49986C2.27605 2.49994 2.49995 2.72383 2.50003 2.99986V3.99497C2.76547 3.70624 3.03166 3.42134 3.22659 3.22642C4.44725 2.00581 6.13635 1.24986 8.00003 1.24986Z"
      fill="#92722A"
    />
  </svg>
);

const SignatureClearIcon: React.FC<SignatureIconProps> = ({ className }) => (
  <svg
    className={className}
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <path
      d="M10.4141 1.74986C10.6438 1.74988 10.8718 1.79478 11.084 1.88267C11.2962 1.97059 11.4889 2.10016 11.6514 2.26255L14.2373 4.84849C14.3996 5.01083 14.5283 5.20384 14.6162 5.41587C14.7041 5.62812 14.75 5.85604 14.75 6.08579C14.75 6.31552 14.7041 6.54348 14.6162 6.75572C14.5283 6.9678 14.3996 7.16073 14.2373 7.3231L8.81055 12.7499H13.5C13.914 12.7499 14.2498 13.0858 14.25 13.4999C14.2499 13.9139 13.9141 14.2498 13.5 14.2499H4.17188C3.97309 14.2498 3.7822 14.1707 3.6416 14.0301L1.7627 12.1512C1.60031 11.9888 1.47073 11.796 1.38281 11.5838C1.29494 11.3716 1.25002 11.1436 1.25 10.9139C1.25004 10.6842 1.29493 10.4562 1.38281 10.244C1.47074 10.0318 1.6003 9.83903 1.7627 9.67661L9.17676 2.26255L9.30371 2.14732C9.4365 2.03833 9.58486 1.94866 9.74414 1.88267C9.95639 1.79476 10.1843 1.74988 10.4141 1.74986ZM2.82324 10.7372C2.80012 10.7603 2.78111 10.788 2.76855 10.8182C2.7561 10.8484 2.75004 10.8813 2.75 10.9139C2.75002 10.9466 2.7561 10.9794 2.76855 11.0096C2.78108 11.0399 2.80012 11.0675 2.82324 11.0907L4.48242 12.7499H6.68945L8.93945 10.4999L6 7.5604L2.82324 10.7372ZM10.4141 3.24986C10.3814 3.24987 10.3486 3.25594 10.3184 3.26841C10.2881 3.28095 10.2605 3.29996 10.2373 3.3231L7.06055 6.49986L10 9.43931L13.1768 6.26255C13.1998 6.23943 13.2179 6.21168 13.2305 6.1815C13.243 6.15126 13.25 6.1185 13.25 6.08579C13.25 6.05308 13.243 6.02032 13.2305 5.99009C13.2179 5.95998 13.1998 5.93212 13.1768 5.90904L10.5908 3.3231C10.5677 3.29998 10.54 3.28094 10.5098 3.26841C10.4795 3.25594 10.4468 3.24988 10.4141 3.24986Z"
      fill="#92722A"
    />
  </svg>
);

export type SignaturePadLabels = {
  clickToSign: string;
  drawHint: string;
  undo: string;
  clear: string;
  save: string;
  clickToEdit: string;
};

export type SignaturePadProps = {
  value?: string;
  editing?: boolean;
  locked?: boolean;
  labels: SignaturePadLabels;
  className?: string;
  onStartEditing: () => void;
  onValueChange: (value: string, locked: boolean) => void;
  onSave?: (value: string) => void | Promise<void>;
};

export const SignaturePad: React.FC<SignaturePadProps> = ({
  value = '',
  editing = false,
  locked = false,
  labels,
  className,
  onStartEditing,
  onValueChange,
  onSave,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const historyRef = useRef<string[]>([]);
  const latestValueRef = useRef(value);
  const renderedValueRef = useRef('');
  const localCommittedValueRef = useRef<string | null>(null);
  const pendingDrawValueRef = useRef('');
  const drawRequestRef = useRef(0);
  const hasStrokeRef = useRef(Boolean(value));
  const [canSave, setCanSave] = useState(Boolean(value));
  const [saving, setSaving] = useState(false);
  const rootClassName = ['inspection-signature-pad', className].filter(Boolean).join(' ');
  const authenticatedPreviewUrl = useAuthenticatedDocumentUrl(value);
  latestValueRef.current = value;

  const configureContext = useCallback((context: CanvasRenderingContext2D) => {
    context.lineWidth = 3;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = '#111111';
    context.fillStyle = '#111111';
  }, []);

  const cancelPendingDraw = useCallback(() => {
    drawRequestRef.current += 1;
    pendingDrawValueRef.current = '';
  }, []);

  const clearCanvas = useCallback(() => {
    cancelPendingDraw();
    renderedValueRef.current = '';
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const rect = canvas.getBoundingClientRect();
    context.clearRect(0, 0, rect.width, rect.height);
    configureContext(context);
  }, [cancelPendingDraw, configureContext]);

  const markLocalRenderedValue = useCallback((nextValue: string) => {
    cancelPendingDraw();
    renderedValueRef.current = nextValue;
    localCommittedValueRef.current = nextValue;
  }, [cancelPendingDraw]);

  const drawImageToCanvas = useCallback((imageUrl: string, force = false) => {
    if (!imageUrl.startsWith('data:image/')) {
      clearCanvas();
      return;
    }
    if (!force && renderedValueRef.current === imageUrl) return;
    if (pendingDrawValueRef.current === imageUrl) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const requestId = drawRequestRef.current + 1;
    drawRequestRef.current = requestId;
    pendingDrawValueRef.current = imageUrl;
    const image = new Image();
    image.onload = () => {
      if (drawRequestRef.current !== requestId || pendingDrawValueRef.current !== imageUrl) return;
      const nextCanvas = canvasRef.current;
      const nextContext = nextCanvas?.getContext('2d');
      if (!nextCanvas || !nextContext || nextCanvas !== canvas) return;
      const rect = nextCanvas.getBoundingClientRect();
      nextContext.clearRect(0, 0, rect.width, rect.height);
      nextContext.drawImage(image, 0, 0, rect.width, rect.height);
      configureContext(nextContext);
      renderedValueRef.current = imageUrl;
      pendingDrawValueRef.current = '';
    };
    image.onerror = () => {
      if (drawRequestRef.current === requestId) {
        pendingDrawValueRef.current = '';
      }
    };
    image.src = imageUrl;
  }, [clearCanvas, configureContext]);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(Math.floor(rect.width * ratio), 1);
    canvas.height = Math.max(Math.floor(rect.height * ratio), 1);
    const context = canvas.getContext('2d');
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    configureContext(context);
    cancelPendingDraw();
    renderedValueRef.current = '';
    if (latestValueRef.current) {
      drawImageToCanvas(latestValueRef.current, true);
    }
  }, [cancelPendingDraw, configureContext, drawImageToCanvas]);

  useEffect(() => {
    if (!editing) return undefined;
    resizeCanvas();
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', resizeCanvas);
      return () => window.removeEventListener('resize', resizeCanvas);
    }
    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [editing, resizeCanvas]);

  useEffect(() => {
    const hasValue = Boolean(value);
    hasStrokeRef.current = hasValue;
    setCanSave(hasValue);
    if (!editing) {
      cancelPendingDraw();
      renderedValueRef.current = '';
      return;
    }
    if (
      localCommittedValueRef.current === value &&
      (renderedValueRef.current === value || pendingDrawValueRef.current === value)
    ) {
      localCommittedValueRef.current = null;
      return;
    }
    const hasStalePendingDraw = Boolean(pendingDrawValueRef.current && pendingDrawValueRef.current !== value);
    if (renderedValueRef.current !== value || hasStalePendingDraw) {
      drawImageToCanvas(value);
    }
  }, [cancelPendingDraw, drawImageToCanvas, editing, value]);

  const getPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  const getCanvasDataUrl = () => {
    const canvas = canvasRef.current;
    return canvas ? canvas.toDataURL('image/png') : '';
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    if (saving) return;
    const context = event.currentTarget.getContext('2d');
    if (!context) return;
    cancelPendingDraw();
    historyRef.current = [...historyRef.current, renderedValueRef.current || value];
    drawingRef.current = true;
    const point = getPoint(event);
    lastPointRef.current = point;
    event.currentTarget.setPointerCapture(event.pointerId);
    context.beginPath();
    context.arc(point.x, point.y, 1.5, 0, Math.PI * 2);
    context.fill();
    hasStrokeRef.current = true;
    setCanSave(true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || !lastPointRef.current) return;
    event.preventDefault();
    const context = event.currentTarget.getContext('2d');
    if (!context) return;
    const point = getPoint(event);
    context.beginPath();
    context.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    context.lineTo(point.x, point.y);
    context.stroke();
    lastPointRef.current = point;
    hasStrokeRef.current = true;
    setCanSave(true);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    event.preventDefault();
    drawingRef.current = false;
    lastPointRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const nextValue = getCanvasDataUrl();
    markLocalRenderedValue(nextValue);
    onValueChange(nextValue, false);
  };

  const handleUndo = () => {
    const previousValue = historyRef.current.pop() || '';
    hasStrokeRef.current = Boolean(previousValue);
    setCanSave(Boolean(previousValue));
    if (previousValue) {
      localCommittedValueRef.current = previousValue;
      drawImageToCanvas(previousValue, true);
    } else {
      clearCanvas();
      localCommittedValueRef.current = '';
    }
    onValueChange(previousValue, false);
  };

  const handleClear = () => {
    if (value) {
      historyRef.current = [...historyRef.current, value];
    }
    clearCanvas();
    hasStrokeRef.current = false;
    setCanSave(false);
    localCommittedValueRef.current = '';
    onValueChange('', false);
  };

  const handleSave = async () => {
    if (saving) return;
    const nextValue = value || (hasStrokeRef.current ? getCanvasDataUrl() : '');
    if (!nextValue) return;

    if (!onSave) {
      onValueChange(nextValue, true);
      return;
    }

    setSaving(true);
    try {
      await onSave(nextValue);
    } catch {
      // The caller owns user-facing upload errors.
    } finally {
      setSaving(false);
    }
  };

  if (locked && value) {
    return (
      <div className={rootClassName}>
        <div className="inspection-signature-pad__panel inspection-signature-pad__panel--locked">
          <img className="inspection-signature-pad__preview-image" src={authenticatedPreviewUrl} alt="" />
          <Button
            htmlType="button"
            className="inspection-signature-pad__edit-button"
            icon={<SignatureEditIcon />}
            onClick={onStartEditing}
          >
            {labels.clickToEdit}
          </Button>
        </div>
      </div>
    );
  }

  if (!editing && !value) {
    return (
      <div className={rootClassName}>
        <div className="inspection-signature-pad__panel inspection-signature-pad__panel--empty">
          <Button
            htmlType="button"
            className="inspection-signature-pad__start-button"
            icon={<SignatureEditIcon />}
            onClick={onStartEditing}
          >
            {labels.clickToSign}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={rootClassName}>
      <div className="inspection-signature-pad__panel inspection-signature-pad__panel--editing">
        {!canSave ? <span className="inspection-signature-pad__placeholder">{labels.drawHint}</span> : null}
        <canvas
          ref={canvasRef}
          className="inspection-signature-pad__canvas"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
      </div>
      <div className="inspection-signature-pad__actions">
        <div className="inspection-signature-pad__secondary-actions">
          <Button
            htmlType="button"
            className="inspection-signature-pad__outline-button"
            icon={<SignatureUndoIcon />}
            disabled={saving}
            onClick={handleUndo}
          >
            {labels.undo}
          </Button>
          <Button
            htmlType="button"
            className="inspection-signature-pad__outline-button"
            icon={<SignatureClearIcon />}
            disabled={saving}
            onClick={handleClear}
          >
            {labels.clear}
          </Button>
        </div>
        <Button
          htmlType="button"
          type="primary"
          disabled={!canSave}
          loading={saving}
          className="inspection-signature-pad__save-button"
          onClick={handleSave}
        >
          {labels.save}
        </Button>
      </div>
    </div>
  );
};

export default SignaturePad;

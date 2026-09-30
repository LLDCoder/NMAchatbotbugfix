



import eventEmiiter from '@/utils/EventEmiiter';
import {
  AimOutlined,
  MinusOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const MIN_SCALE = 0.5;
const MAX_SCALE = 1.5;
const SCALE_STEP = 0.1;
const DEFAULT_SCALE = 1;

type CanvasPoint = {
  x: number;
  y: number;
};

const DraggableCanvas = ({ children }: React.PropsWithChildren<{}>) => {
  const { t } = useTranslation();
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(DEFAULT_SCALE);
  const canvasRef = useRef<HTMLDivElement>(null);
  const parentRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(offset);
  const scaleRef = useRef(scale);
  const isDragging = useRef(false);
  const startPoint = useRef({ x: 0, y: 0 });

  const emitCanvasRect = () => {
    const rect = parentRef.current?.getBoundingClientRect();
    eventEmiiter.emit('change:rect', {
      px: rect?.x ?? 0,
      py: rect?.y ?? 0,
      offsetX: offsetRef.current.x,
      offsetY: offsetRef.current.y,
      scale: scaleRef.current,
    });
  };

  const getCanvasCenterPoint = (): CanvasPoint | undefined => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return undefined;
    return {
      x: rect.width / 2,
      y: rect.height / 2,
    };
  };

  const getWheelAnchorPoint = (e: WheelEvent): CanvasPoint | undefined => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return undefined;
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const updateScale = (nextScale: number, anchorPoint?: CanvasPoint) => {
    const currentScale = scaleRef.current;
    const normalizedScale = Math.min(
      MAX_SCALE,
      Math.max(MIN_SCALE, Number(nextScale.toFixed(2)))
    );
    if (normalizedScale === currentScale) return;

    if (anchorPoint) {
      const contentPoint = {
        x: (anchorPoint.x - offsetRef.current.x) / currentScale,
        y: (anchorPoint.y - offsetRef.current.y) / currentScale,
      };
      const nextOffset = {
        x: anchorPoint.x - contentPoint.x * normalizedScale,
        y: anchorPoint.y - contentPoint.y * normalizedScale,
      };
      offsetRef.current = nextOffset;
      setOffset(nextOffset);
    }

    scaleRef.current = normalizedScale;
    setScale(normalizedScale);
    requestAnimationFrame(emitCanvasRect);
  };

  const zoomIn = () => {
    updateScale(scaleRef.current + SCALE_STEP, getCanvasCenterPoint());
  };

  const zoomOut = () => {
    updateScale(scaleRef.current - SCALE_STEP, getCanvasCenterPoint());
  };

  const updateOffset = (
    nextOffset: { x: number; y: number },
    shouldEmit = false
  ) => {
    offsetRef.current = nextOffset;
    setOffset(nextOffset);
    if (shouldEmit) {
      requestAnimationFrame(emitCanvasRect);
    }
  };

  const resetView = () => {
    offsetRef.current = { x: 0, y: 0 };
    scaleRef.current = DEFAULT_SCALE;
    setOffset(offsetRef.current);
    setScale(DEFAULT_SCALE);
    requestAnimationFrame(emitCanvasRect);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('.workflow-canvas-zoom-controls')) {
      return;
    }
    isDragging.current = true;
    startPoint.current = {
      x: e.clientX - offsetRef.current.x,
      y: e.clientY - offsetRef.current.y,
    };
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging.current) return;
    const nextOffset = {
      x: e.clientX - startPoint.current.x,
      y: e.clientY - startPoint.current.y,
    };
    updateOffset(nextOffset);
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    emitCanvasRect();
  };

  const handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      updateScale(
        scaleRef.current + (e.deltaY > 0 ? -SCALE_STEP : SCALE_STEP),
        getWheelAnchorPoint(e)
      );
      return;
    }

    const deltaMultiplier = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 80 : 1;
    const rawDeltaX = e.deltaX * deltaMultiplier;
    const rawDeltaY = e.deltaY * deltaMultiplier;
    const deltaX = e.shiftKey && Math.abs(rawDeltaX) < 1 ? rawDeltaY : rawDeltaX;
    const deltaY = e.shiftKey && Math.abs(rawDeltaX) < 1 ? 0 : rawDeltaY;

    updateOffset(
      {
        x: offsetRef.current.x - deltaX,
        y: offsetRef.current.y - deltaY,
      },
      true
    );
  };

  const preventNativeGestureZoom = (e: Event) => {
    e.preventDefault();
  };

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    const canvasElement = canvasRef.current;
    canvasElement?.addEventListener('wheel', handleWheel, { passive: false });
    canvasElement?.addEventListener('gesturestart', preventNativeGestureZoom);
    canvasElement?.addEventListener('gesturechange', preventNativeGestureZoom);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      canvasElement?.removeEventListener('wheel', handleWheel);
      canvasElement?.removeEventListener('gesturestart', preventNativeGestureZoom);
      canvasElement?.removeEventListener('gesturechange', preventNativeGestureZoom);
    };
  }, []);
  return (
    <div
      className='workflow-canvas-surface'
      ref={canvasRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        overscrollBehavior: 'contain',
        touchAction: 'none',
      }}
      onMouseDown={handleMouseDown}
    >
      <div
        className='draggable-canvas-inner'
        ref={parentRef}
        style={{
          position: 'absolute',
          top: offset.y,
          left: offset.x,
          width: '100%',
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        {children}
      </div>
      <div
        className='workflow-canvas-zoom-controls'
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type='button'
          className='workflow-canvas-zoom-btn'
          onClick={resetView}
          aria-label={t('workflow.processTree.canvas.resetView')}
        >
          <AimOutlined />
        </button>
        <button
          type='button'
          className='workflow-canvas-zoom-btn'
          disabled={scale <= MIN_SCALE}
          onClick={zoomOut}
          aria-label={t('workflow.processTree.canvas.zoomOut')}
        >
          <MinusOutlined />
        </button>
        <button
          type='button'
          className='workflow-canvas-zoom-btn'
          disabled={scale >= MAX_SCALE}
          onClick={zoomIn}
          aria-label={t('workflow.processTree.canvas.zoomIn')}
        >
          <PlusOutlined />
        </button>
      </div>
    </div>
  );
};

export default DraggableCanvas;

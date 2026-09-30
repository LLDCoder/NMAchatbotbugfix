import React, { useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "antd";
import {
  CaretRightFilled,
  LeftOutlined,
  PauseOutlined,
  RightOutlined,
} from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import request from "@/utils/request";
import { ImageBaseUrl } from "@/utils/url";
import "./index.less";

export interface MoviePreviewModalProps {
  fileData: { url: string; name: string; filePath?: string };
  fileList?: Array<{ url: string; name: string; filePath?: string }>;
  visible: boolean;
  initialTime?: number;
  autoPlay?: boolean;
  onCancel: () => void;
}

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function isProtocolRelativeUrl(value: string) {
  return /^\/\//.test(value);
}

function isRootRelativeUrl(value: string) {
  return value.startsWith("/") && !value.startsWith("//");
}

function isApiPath(value: string) {
  return /^\/api\//i.test(value);
}

function isDirectRootRelativeUrl(value: string) {
  return isRootRelativeUrl(value) && !isApiPath(value);
}

function isDocumentDownloadUrl(value?: string) {
  const text = String(value ?? "").trim();
  if (!text) return false;

  try {
    return /\/api\/Document\/Dowload$/i.test(new URL(text, "https://local.invalid").pathname);
  } catch {
    return false;
  }
}

function isDirectVideoUrl(value?: string) {
  const text = String(value ?? "").trim();
  if (!text) return false;
  if (isDocumentDownloadUrl(text)) return false;

  return (
    isHttpUrl(text) ||
    isProtocolRelativeUrl(text) ||
    isDirectRootRelativeUrl(text) ||
    text.startsWith("blob:") ||
    text.startsWith("data:")
  );
}

function encodePreviewFilePath(value: string) {
  try {
    return encodeURIComponent(decodeURIComponent(value));
  } catch {
    return encodeURIComponent(value);
  }
}

function buildDocumentDownloadUrl(filePath: string) {
  return `${ImageBaseUrl}${encodePreviewFilePath(filePath)}`;
}

function normalizeVideoFilePath(value?: string) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  return text;
}

function resolveVideoRequestSource(url?: string, filePath?: string) {
  const normalizedUrl = normalizeVideoFilePath(url);
  const normalizedFilePath = normalizeVideoFilePath(filePath);

  if (isDocumentDownloadUrl(normalizedUrl)) {
    return normalizedUrl;
  }

  if (normalizedFilePath && !isDirectVideoUrl(normalizedFilePath)) {
    return buildDocumentDownloadUrl(normalizedFilePath);
  }

  if (normalizedUrl && !isDirectVideoUrl(normalizedUrl)) {
    return buildDocumentDownloadUrl(normalizedUrl);
  }

  return normalizedUrl || normalizedFilePath;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function formatVideoTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "00:00:00";

  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  return [hours, minutes, secs]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

const MoviePreviewModal: React.FC<MoviePreviewModalProps> = ({
  fileData,
  fileList,
  visible,
  initialTime,
  autoPlay = false,
  onCancel,
}) => {
  const { t } = useTranslation();
  const sourceList = useMemo(() => {
    const candidates = (Array.isArray(fileList) && fileList.length > 0
      ? fileList
      : [fileData]
    ).filter((item) => {
      const url = String(item?.url ?? "").trim();
      const filePath = String(item?.filePath ?? "").trim();
      return Boolean(url || filePath);
    });

    return candidates.filter((item, index, items) => {
      const currentKey = String(item.filePath || item.url || "").trim();
      return (
        currentKey !== "" &&
        items.findIndex(
          (candidate) =>
            String(candidate.filePath || candidate.url || "").trim() === currentKey,
        ) === index
      );
    });
  }, [fileData, fileList]);
  const [activeSourceIndex, setActiveSourceIndex] = useState(0);
  const activeFileData = sourceList[activeSourceIndex] || sourceList[0] || fileData;
  const previewUrl = String(activeFileData.url ?? "").trim();
  const resolvedRequestSource = useMemo(
    () => resolveVideoRequestSource(previewUrl, activeFileData.filePath),
    [activeFileData.filePath, previewUrl],
  );
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);
  const sourcesRef = useRef<HTMLDivElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);
  const [playbackUrl, setPlaybackUrl] = useState("");

  useEffect(() => {
    if (!visible) {
      setActiveSourceIndex(0);
      return;
    }

    setActiveSourceIndex((previous) =>
      previous >= sourceList.length ? 0 : previous,
    );
  }, [sourceList.length, visible]);

  useEffect(() => {
    if (!visible) {
      const video = videoRef.current;
      video?.pause();
      setIsPlaying(false);
      return;
    }

    setDuration(0);
    setCurrentTime(0);
    setIsPlaying(false);
    setIsVideoReady(false);
    setIsLoadingVideo(false);
    setLoadError("");
  }, [initialTime, resolvedRequestSource, t, visible]);

  useEffect(() => {
    const revokeObjectUrl = () => {
      if (!objectUrlRef.current) return;
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    };

    if (!visible || !resolvedRequestSource) {
      revokeObjectUrl();
      setPlaybackUrl("");
      return undefined;
    }

    if (isDirectVideoUrl(resolvedRequestSource)) {
      revokeObjectUrl();
      setPlaybackUrl(resolvedRequestSource);
      setIsLoadingVideo(false);
      setLoadError("");
      return undefined;
    }

    let cancelled = false;
    setIsLoadingVideo(true);
    setLoadError("");
    setPlaybackUrl("");

    request
      .get<Blob, Blob>(resolvedRequestSource, {}, { responseType: "blob", skipErrorMessage: true })
      .then((blob) => {
        if (cancelled) return;

        revokeObjectUrl();

        if (!(blob instanceof Blob) || blob.size <= 0) {
          setLoadError(t("sharedComponents.moviePreviewModal.unavailable"));
          return;
        }

        const nextObjectUrl = URL.createObjectURL(blob);
        objectUrlRef.current = nextObjectUrl;
        setPlaybackUrl(nextObjectUrl);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError(t("sharedComponents.moviePreviewModal.unavailable"));
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoadingVideo(false);
      });

    return () => {
      cancelled = true;
      revokeObjectUrl();
    };
  }, [resolvedRequestSource, t, visible]);

  const progressRatio = duration > 0 ? clamp(currentTime / duration, 0, 1) : 0;

  const handleTogglePlayback = async () => {
    const video = videoRef.current;
    if (!video || loadError) return;

    if (video.paused) {
      try {
        await video.play();
      } catch {
        setLoadError(t("sharedComponents.moviePreviewModal.playError"));
      }
      return;
    }

    video.pause();
  };

  const handleSeek = (time: number) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(duration)) return;

    const nextTime = clamp(time, 0, duration || 0);
    video.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const handleProgressClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || duration <= 0) return;

    const bounds = progressRef.current.getBoundingClientRect();
    const ratio = clamp((event.clientX - bounds.left) / bounds.width, 0, 1);
    handleSeek(duration * ratio);
  };

  const showUnavailableState = !resolvedRequestSource || !!loadError;

  const handleSourceScroll = (direction: "prev" | "next") => {
    sourcesRef.current?.scrollBy({
      left: direction === "prev" ? -220 : 220,
      behavior: "smooth",
    });
  };

  const handleSelectSource = (index: number) => {
    setActiveSourceIndex(index);
  };

  useEffect(() => {
    if (!visible) return;

    const activeSource = sourcesRef.current?.querySelector<HTMLButtonElement>(
      `[data-source-index="${activeSourceIndex}"]`,
    );
    activeSource?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [activeSourceIndex, visible]);

  return (
    <Modal
      visible={visible}
      onCancel={onCancel}
      footer={null}
      destroyOnClose
      centered
      width="100vw"
      closable
      className="movie-preview-modal"
      wrapClassName="movie-preview-modal__wrap"
    >
      <div className="movie-preview-modal__panel">
        <div className="movie-preview-modal__label">
          {activeFileData.name || t("sharedComponents.moviePreviewModal.defaultName")}
        </div>

        <div className="movie-preview-modal__stage">
          {showUnavailableState ? (
            <div className="movie-preview-modal__empty">
              <span>{loadError || t("sharedComponents.moviePreviewModal.unavailable")}</span>
            </div>
          ) : isLoadingVideo || !playbackUrl ? (
            <div className="movie-preview-modal__empty">
              <span>{t("sharedComponents.moviePreviewModal.loading")}</span>
            </div>
          ) : (
            <>
              <div className="movie-preview-modal__video-shell">
                <video
                  ref={videoRef}
                  className="movie-preview-modal__video"
                  src={playbackUrl}
                  controls
                  playsInline
                  preload="metadata"
                  onLoadedMetadata={(event) => {
                    const nextDuration = Number.isFinite(event.currentTarget.duration)
                      ? event.currentTarget.duration
                      : 0;
                    const requestedInitialTime =
                      typeof initialTime === "number" && Number.isFinite(initialTime)
                        ? Math.max(0, initialTime)
                        : 0;
                    const nextCurrentTime = nextDuration > 0
                      ? clamp(requestedInitialTime, 0, nextDuration)
                      : requestedInitialTime;

                    setDuration(nextDuration);
                    event.currentTarget.currentTime = nextCurrentTime;
                    setCurrentTime(nextCurrentTime);
                    setIsVideoReady(true);

                    if (autoPlay) {
                      void event.currentTarget.play().catch(() => {
                        setIsPlaying(false);
                      });
                    }
                  }}
                  onLoadedData={() => {
                    setIsVideoReady(true);
                    setLoadError("");
                  }}
                  onTimeUpdate={(event) => {
                    setCurrentTime(event.currentTarget.currentTime);
                  }}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                  onError={() => {
                    setIsPlaying(false);
                    setLoadError(t("sharedComponents.moviePreviewModal.unavailable"));
                  }}
                />

                <button
                  type="button"
                  className="movie-preview-modal__playback-toggle"
                  onClick={handleTogglePlayback}
                  disabled={!isVideoReady}
                  aria-label={isPlaying ? t("sharedComponents.moviePreviewModal.pause") : t("sharedComponents.moviePreviewModal.play")}
                >
                  {isPlaying ? <PauseOutlined /> : <CaretRightFilled />}
                </button>

                <div className="movie-preview-modal__timeline">
                  <span className="movie-preview-modal__time">
                    {formatVideoTime(currentTime)}
                  </span>
                  <div
                    ref={progressRef}
                    className={`movie-preview-modal__progress ${isVideoReady ? "" : "is-disabled"}`.trim()}
                    onClick={handleProgressClick}
                    role="presentation"
                  >
                    <div
                      className="movie-preview-modal__progress-fill"
                      style={{ width: `${progressRatio * 100}%` }}
                    />
                  </div>
                  <span className="movie-preview-modal__time">
                    {formatVideoTime(duration)}
                  </span>
                </div>
              </div>

              {sourceList.length > 1 ? (
                <div className="movie-preview-modal__thumbnail-rail">
                  <button
                    type="button"
                    className="movie-preview-modal__arrow"
                    onClick={() => handleSourceScroll("prev")}
                    aria-label={t("sharedComponents.moviePreviewModal.previousThumbnails")}
                  >
                    <LeftOutlined />
                  </button>

                  <div className="movie-preview-modal__thumbnails" ref={sourcesRef}>
                    {sourceList.map((source, index) => (
                      <button
                        key={`${source.filePath || source.url}-${index}`}
                        type="button"
                        className={`movie-preview-modal__thumbnail ${
                          index === activeSourceIndex ? "is-active" : ""
                        }`.trim()}
                        onClick={() => handleSelectSource(index)}
                        data-source-index={index}
                      >
                        <div className="movie-preview-modal__thumbnail-fallback movie-preview-modal__thumbnail-card">
                          <span className="movie-preview-modal__thumbnail-index">
                            {index + 1}
                          </span>
                          <span className="movie-preview-modal__thumbnail-name">
                            {source.name || `${t("sharedComponents.moviePreviewModal.defaultName")} ${index + 1}`}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    className="movie-preview-modal__arrow"
                    onClick={() => handleSourceScroll("next")}
                    aria-label={t("sharedComponents.moviePreviewModal.nextThumbnails")}
                  >
                    <RightOutlined />
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default MoviePreviewModal;

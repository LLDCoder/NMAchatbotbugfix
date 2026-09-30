import React, { useEffect, useMemo } from "react";
import { observer, useField } from "@formily/react";
import { useTranslation } from "react-i18next";
import VideoPlayerCore from "./components/VideoPlayerCore";
import { normalizeVideoUrl } from "./utils";
import "./styles.less";

type VideoFieldProps = {
  requiredViewing?: boolean;
  visible?: boolean;
  videoUrl?: string;
};

type VideoFieldValue = {
  videoUrl?: string;
  hasWatchedFully?: boolean;
};

type VideoFormilyField = {
  value?: VideoFieldValue;
  pattern?: string;
  setValue: (value: VideoFieldValue) => void;
  setValidator: (validator: (value?: VideoFieldValue) => string) => void;
  validate?: () => void;
};

export const VideoField: React.FC<VideoFieldProps> = observer((props) => {
  const field = useField() as VideoFormilyField;
  const isReadPretty = field.pattern === "readPretty";
  const { t } = useTranslation();
  const {
    requiredViewing = true,
    visible = true,
    videoUrl,
  } = props;

  const previewUrl = useMemo(
    () => (videoUrl ? normalizeVideoUrl(videoUrl) : ""),
    [videoUrl],
  );

  useEffect(() => {
    if (isReadPretty || !videoUrl) return;
    if (field.value?.videoUrl === videoUrl) return;

    field.setValue({
      ...(field.value || {}),
      videoUrl,
      hasWatchedFully: false,
    });
  }, [field, isReadPretty, videoUrl]);

  const watchCompleteValidator = useMemo(() => {
    return (value?: VideoFieldValue) => {
      if (!visible || !requiredViewing) return "";
      if (!videoUrl) return "";
      return value?.hasWatchedFully ? "" : t("Video.watchCompleteRequired");
    };
  }, [requiredViewing, videoUrl, visible, t]);

  useEffect(() => {
    field.setValidator(watchCompleteValidator);
  }, [field, watchCompleteValidator]);

  const handleVideoEnded = () => {
    if (isReadPretty) {
      return;
    }

    field.setValue({
      ...(field.value || {}),
      videoUrl,
      hasWatchedFully: true,
    });
    field.validate?.();
  };

  if (!visible) {
    return null;
  }

  return (
    <div className="video-field-container">
      <div className="video-field-content">
        <VideoPlayerCore videoUrl={previewUrl} onEnded={handleVideoEnded} />
      </div>
    </div>
  );
});

export default VideoField;

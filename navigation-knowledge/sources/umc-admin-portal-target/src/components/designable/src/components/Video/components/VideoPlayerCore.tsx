import React, { useMemo } from "react";
import { normalizeVideoUrl } from "../utils";
import { AuthenticatedDocumentVideo } from "@/components/common/AuthenticatedDocumentMedia";

interface VideoPlayerCoreProps {
  videoUrl?: string;
  onEnded?: () => void;
}

const VideoPlayerCore: React.FC<VideoPlayerCoreProps> = ({ videoUrl, onEnded }) => {
  const previewUrl = useMemo(() => normalizeVideoUrl(videoUrl), [videoUrl]);

  if (!previewUrl) {
    return (
      <div className="video-upload-placeholder">
        <div className="video-icon">
          <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="10" y="15" width="60" height="50" rx="4" stroke="#d9d9d9" strokeWidth="2" fill="none" />
            <rect x="10" y="15" width="60" height="10" stroke="#d9d9d9" strokeWidth="2" fill="none" />
            <rect x="10" y="55" width="60" height="10" stroke="#d9d9d9" strokeWidth="2" fill="none" />
            <line x1="25" y1="15" x2="25" y2="25" stroke="#d9d9d9" strokeWidth="2" />
            <line x1="40" y1="15" x2="40" y2="25" stroke="#d9d9d9" strokeWidth="2" />
            <line x1="55" y1="15" x2="55" y2="25" stroke="#d9d9d9" strokeWidth="2" />
            <line x1="25" y1="55" x2="25" y2="65" stroke="#d9d9d9" strokeWidth="2" />
            <line x1="40" y1="55" x2="40" y2="65" stroke="#d9d9d9" strokeWidth="2" />
            <line x1="55" y1="55" x2="55" y2="65" stroke="#d9d9d9" strokeWidth="2" />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className="video-preview-container">
      <AuthenticatedDocumentVideo
        src={previewUrl}
        controls
        onEnded={onEnded}
        className="video-player"
      />
    </div>
  );
};

export default VideoPlayerCore;

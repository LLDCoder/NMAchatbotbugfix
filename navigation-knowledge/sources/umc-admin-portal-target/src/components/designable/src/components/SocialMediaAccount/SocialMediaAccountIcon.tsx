import * as React from "react";
import facebookIcon from "@/assets/icons/social-media/facebook.svg";
import xIcon from "@/assets/icons/social-media/x.svg";
import instagramIcon from "@/assets/icons/social-media/instagram.svg";
import tiktokIcon from "@/assets/icons/social-media/tiktok.svg";
import youtubeIcon from "@/assets/icons/social-media/youtube.svg";
import snapchatIcon from "@/assets/icons/social-media/snapchat.svg";
import linkedinIcon from "@/assets/icons/social-media/linkedin.svg";
import applePodcastIcon from "@/assets/icons/social-media/apple-podcast.svg";
import appStoreIcon from "@/assets/icons/social-media/app-store.svg";
import googlePlayIcon from "@/assets/icons/social-media/google-play.svg";
import spotifyIcon from "@/assets/icons/social-media/spotify.svg";
import othersIcon from "@/assets/icons/social-media/others.svg";
import websiteIcon from "@/assets/icons/social-media/website.svg";

const SOCIAL_MEDIA_ICON_BY_NAME_EN: Record<string, string> = {
  Website: websiteIcon,
  "Mobile Application - Apple Store": appStoreIcon,
  "Mobile Application - Play Store": googlePlayIcon,
  Facebook: facebookIcon,
  X: xIcon,
  Instagram: instagramIcon,
  YouTube: youtubeIcon,
  Snapchat: snapchatIcon,
  LinkedIn: linkedinIcon,
  Tiktok: tiktokIcon,
  Spotify: spotifyIcon,
  "Apple Podcast": applePodcastIcon,
  Others: othersIcon,
};

type SocialMediaAccountIconProps = {
  nameEn?: string | null;
  className?: string;
};

export const SocialMediaAccountIcon: React.FC<SocialMediaAccountIconProps> = ({
  nameEn,
  className = "social-media-account__icon-image",
}) => {
  const normalizedName = String(nameEn ?? "").trim();

  return (
    <img
      className={className}
      src={SOCIAL_MEDIA_ICON_BY_NAME_EN[normalizedName] ?? othersIcon}
      alt=""
    />
  );
};

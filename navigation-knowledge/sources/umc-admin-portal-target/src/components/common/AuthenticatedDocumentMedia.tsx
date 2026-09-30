import type {
  ImgHTMLAttributes,
  VideoHTMLAttributes,
} from "react";
import { Avatar } from "antd";
import type { AvatarProps } from "antd/lib/avatar";
import { useAuthenticatedDocumentUrl } from "@/hooks/useAuthenticatedDocumentUrl";

type AuthenticatedDocumentImageProps = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  "src"
> & {
  src?: string | null;
  fallbackSrc?: string;
};

type AuthenticatedDocumentVideoProps = Omit<
  VideoHTMLAttributes<HTMLVideoElement>,
  "src"
> & {
  src?: string | null;
};

type AuthenticatedDocumentAvatarProps = Omit<AvatarProps, "src"> & {
  src?: string | null;
  fallbackSrc?: string;
};

export const AuthenticatedDocumentImage = ({
  src,
  fallbackSrc = "",
  ...props
}: AuthenticatedDocumentImageProps) => {
  const authenticatedSource = useAuthenticatedDocumentUrl(src, fallbackSrc);

  return <img {...props} src={authenticatedSource || undefined} />;
};

export const AuthenticatedDocumentVideo = ({
  src,
  ...props
}: AuthenticatedDocumentVideoProps) => {
  const authenticatedSource = useAuthenticatedDocumentUrl(src);

  return <video {...props} src={authenticatedSource || undefined} />;
};

export const AuthenticatedDocumentAvatar = ({
  src,
  fallbackSrc = "",
  ...props
}: AuthenticatedDocumentAvatarProps) => {
  const authenticatedSource = useAuthenticatedDocumentUrl(src, fallbackSrc);

  return <Avatar {...props} src={authenticatedSource || undefined} />;
};

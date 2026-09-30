import {
  useEffect,
  useState,
  type FC,
  type ImgHTMLAttributes,
  type ReactNode,
  type SyntheticEvent,
} from "react"
import { useAuthenticatedDocumentUrl } from "@/hooks/useAuthenticatedDocumentUrl"

export interface SafeImageProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> {
  /** Image source; empty/null/undefined renders the fallback directly. */
  src?: string | null
  /** Node rendered when src is empty or the image fails to load. */
  fallback: ReactNode
}

/**
 * Thin <img> wrapper that renders `fallback` when the source is empty
 * or fails to load, instead of showing the browser's broken-image icon.
 */
const SafeImage: FC<SafeImageProps> = ({
  src,
  fallback,
  onError,
  ...rest
}) => {
  const [loadFailed, setLoadFailed] = useState(false)
  const authenticatedSource = useAuthenticatedDocumentUrl(src)

  useEffect(() => {
    setLoadFailed(false)
  }, [src])

  const handleError = (event: SyntheticEvent<HTMLImageElement, Event>) => {
    // Diagnostic log: keep this. It prints the fully resolved (absolute,
    // prefix-concatenated) URL the browser actually requested so a broken
    // image can be traced. `event.currentTarget.src` is the complete URL,
    // whereas the `src` prop may still be a relative/partial path.
    // Do not remove — required for troubleshooting failed image loads.
    if (typeof console !== "undefined") {
      const failedUrl = event.currentTarget?.src || src
      console.warn("[SafeImage] image failed to load:", failedUrl)
    }
    onError?.(event)
    setLoadFailed(true)
  }

  if (!src || loadFailed) {
    return <>{fallback}</>
  }

  return <img src={authenticatedSource || undefined} onError={handleError} {...rest} />
}

export default SafeImage

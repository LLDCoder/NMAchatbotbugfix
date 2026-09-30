type UrlParse = (url: string, base?: string | URL) => URL | null

type UrlConstructorWithParse = typeof URL & {
  parse?: UrlParse
}

const URLWithParse = URL as UrlConstructorWithParse

if (typeof URLWithParse.parse !== "function") {
  Object.defineProperty(URLWithParse, "parse", {
    configurable: true,
    writable: true,
    value: ((url: string, base?: string | URL) => {
      try {
        return typeof base === "undefined" ? new URL(url) : new URL(url, base)
      } catch {
        return null
      }
    }) satisfies UrlParse,
  })
}

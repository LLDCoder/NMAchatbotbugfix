import { createContext } from "react"
import type { IContentContext } from "./type"

export const ContentContext = createContext<IContentContext | null>(null)

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { api } from './api'

interface AuthCtx {
  authed: boolean | null // null = pas encore vérifié
  login: (u: string, p: string) => Promise<void>
  logout: () => Promise<void>
}

const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null)

  useEffect(() => {
    api.me().then((r) => setAuthed(r.authenticated)).catch(() => setAuthed(false))
  }, [])

  const login = useCallback(async (u: string, p: string) => {
    await api.login(u, p)
    setAuthed(true)
  }, [])

  const logout = useCallback(async () => {
    await api.logout().catch(() => {})
    setAuthed(false)
  }, [])

  return <Ctx.Provider value={{ authed, login, logout }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)

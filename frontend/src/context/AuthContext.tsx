/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ApiError, onAdminSessionInvalidated } from "../services/api";
import type { AuthUser, LoginCredentials } from "../types/auth";
import { authService } from "../features/auth/services/auth.service";
import { persistAdminSessionNotice } from "../utils/sessionReauth";

interface AuthContextValue {
  user: AuthUser | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (credentials: LoginCredentials) => Promise<AuthUser>
  logout: () => Promise<void>
  refreshSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function isUnauthorizedError(error: unknown) {
  return error instanceof ApiError && error.status === 401
}

function isConnectionError(error: unknown) {
  return error instanceof ApiError && error.status === 0
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const isAuthenticatedRef = useRef(false)

  useEffect(() => {
    isAuthenticatedRef.current = Boolean(user)
  }, [user])

  async function refreshSession() {
    try {
      const response = await authService.me()
      setUser(response.data.user)
    } catch (error) {
      if (!isUnauthorizedError(error) && !isConnectionError(error)) {
        console.error(error)
      }
      setUser(null)
    }
  }

  useEffect(() => {
    async function bootstrapSession() {
      setIsLoading(true)
      await refreshSession()
      setIsLoading(false)
    }

    bootstrapSession()
  }, [])

  useEffect(() => {
    const unsubscribe = onAdminSessionInvalidated(({ reason }) => {
      if (!isAuthenticatedRef.current) {
        return
      }

      persistAdminSessionNotice(reason)
      setUser(null)
      setIsLoading(false)
    })

    return unsubscribe
  }, [])

  async function login(credentials: LoginCredentials) {
    const response = await authService.login(credentials)
    const nextUser = response.data.user
    setUser(nextUser)
    return nextUser
  }

  async function logout() {
    try {
      await authService.logout()
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) {
        throw error
      }
    } finally {
      setUser(null)
    }
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: Boolean(user),
      login,
      logout,
      refreshSession,
    }),
    [isLoading, user]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider')
  }

  return context
}

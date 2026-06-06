import { useCallback, useEffect, useState } from "react";
import { totemClientService } from "../services/totemClient.service";
import type {
    TotemClientBootstrapData,
    TotemClientSession,
} from "../../../types/totemClient";
import { getErrorMessage } from "../../../utils/getErrorMessage";

const HEARTBEAT_INTERVAL_MS = 30_000
const BOOTSTRAP_REFRESH_INTERVAL_MS = 120_000

export function useTotemClient(session: TotemClientSession | null) {
    const [data, setData] = useState<TotemClientBootstrapData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [networkWarning, setNetworkWarning] = useState('')

    const loadBootstrap = useCallback(
        async (silent = false) => {
            if (!session) {
                setData(null)
                setError('')
                setNetworkWarning('')
                setLoading(false)
                return
            }

            if (!silent) {
                setLoading(true)
                setError('')
            }

            try {
                const response = await totemClientService.getBootstrap()
                setData(response.data)
                setNetworkWarning('')
                setError('')
            } catch (err) {
                const message = getErrorMessage(err, 'No se pudo cargar el bootstrap del tótem')

                if (silent) {
                    setNetworkWarning(message)
                } else {
                    setError(message)
                }
            } finally {
                if (!silent) {
                    setLoading(false)
                }
            }
        },
        [session]
    )

    const sendHeartbeat = useCallback(async () => {
        if (!session) return

        try {
            const response = await totemClientService.sendHeartbeat()

            setData((previous) => {
                if (!previous) {
                    return null
                }

                return {
                    ...previous,
                    totem: response.data.totem,
                    questionMode: response.data.questionMode,
                    questionSession: response.data.questionSession,
                }
            })

            setNetworkWarning('')
        } catch (err) {
            setNetworkWarning(
                getErrorMessage(err, 'No se pudo enviar la señal de actividad al servidor')
            )
        }
    }, [session])

    useEffect(() => {
        void loadBootstrap(false)
    }, [loadBootstrap])

    useEffect(() => {
        if (!session) return

        const heartbeatTimer = window.setInterval(() => {
            void sendHeartbeat()
        }, HEARTBEAT_INTERVAL_MS)

        const refreshTimer = window.setInterval(() => {
            void loadBootstrap(true)
        }, BOOTSTRAP_REFRESH_INTERVAL_MS)

        return () => {
            window.clearInterval(heartbeatTimer)
            window.clearInterval(refreshTimer)
        }
    }, [session, loadBootstrap, sendHeartbeat])

    const retry = useCallback(() => {
        void loadBootstrap(false)
    }, [loadBootstrap])

    const refresh = useCallback(() => {
        void loadBootstrap(true)
    }, [loadBootstrap])

    return {
        data,
        loading,
        error,
        networkWarning,
        retry,
        refresh,
    }
}

import { apiRequest } from '../../../services/api'
import type { DashboardSummaryResponse } from '../../../types/dashboard'

export const dashboardService = {
  async getSummary(options: { signal?: AbortSignal } = {}) {
    return apiRequest<DashboardSummaryResponse>('/api/dashboard/summary', {
      signal: options.signal,
    })
  },
}

import type { ContentType } from './content'

export type DashboardTotemIssueType =
  | 'active_offline'
  | 'no_connection_record'

export type DashboardAlertSeverity = 'critical' | 'warning'

export interface DashboardSummaryResponse {
  ok: boolean
  data: DashboardSummary
}

export interface DashboardSummary {
  generatedAt: string
  scope: {
    role: string | null
    campusId: number | null
    campusName: string | null
  }
  thresholds: {
    assignmentExpiringSoonHours: number
  }
  metrics: {
    totems: {
      total: number
      active: number
      inactive: number
      online: number
      activeOffline: number
      withoutConnectionRecord: number
    }
    contents: {
      active: number
      activeByType: Record<ContentType, number>
      activeWithoutAssignment: number
      activeWithUnavailableFile: number
    }
    assignments: {
      active: number
      scheduled: number
      expired: number
      expiringSoon: number
    }
    notifications: {
      active: number
      urgentActive: number
      scheduled: number
      finishedOrExpired: number
    }
    users: {
      active: number
      pendingInvited: number
    } | null
  }
  problematicTotems: DashboardProblematicTotem[]
}

export interface DashboardProblematicTotem {
  id: number
  code: string
  name: string
  campus: {
    id: number
    name: string
  } | null
  connectionStatus: 'online' | 'offline'
  lastSeenAt: string | null
  issueType: DashboardTotemIssueType
  issueLabel: string
  issueSeverity: DashboardAlertSeverity
}

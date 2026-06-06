import type { ApiItemResponse } from "../../../types/totem";
import type {
    TotemClientQuestionAnswerData,
    TotemClientBootstrapData,
    TotemClientDeviceStatus,
    TotemClientHeartbeatData,
    TotemClientQuestionModeMutationData,
    TotemClientQuestionSessionEndData,
    TotemClientQuestionSessionStartData,
    TotemQuestionActivationTrigger,
    TotemQuestionModeActivityType,
    TotemQuestionModeExitReason,
} from "../../../types/totemClient";
import { totemClientApiRequestWithSession } from "./totemClientAuth.service";

export const totemClientService = {
    async getBootstrap() {
        return totemClientApiRequestWithSession<ApiItemResponse<TotemClientBootstrapData>>(
            '/client/totem/bootstrap',
            {
                method: 'GET',
                cache: 'no-store',
            }
        )
    },

    async sendHeartbeat() {
        return totemClientApiRequestWithSession<ApiItemResponse<TotemClientHeartbeatData>>(
            '/client/totem/heartbeat',
            {
                method: 'POST',
            }
        )
    },

    async enterQuestionMode(trigger: TotemQuestionActivationTrigger) {
        return totemClientApiRequestWithSession<ApiItemResponse<TotemClientQuestionModeMutationData>>(
            '/client/totem/question-mode/enter',
            {
                method: 'POST',
                body: JSON.stringify({ trigger }),
            }
        )
    },

    async reportQuestionModeActivity(
        activityType: TotemQuestionModeActivityType,
    ) {
        return totemClientApiRequestWithSession<ApiItemResponse<TotemClientQuestionModeMutationData>>(
            '/client/totem/question-mode/activity',
            {
                method: 'POST',
                body: JSON.stringify({ activityType }),
            }
        )
    },

    async exitQuestionMode(reason: TotemQuestionModeExitReason) {
        return totemClientApiRequestWithSession<ApiItemResponse<TotemClientQuestionModeMutationData>>(
            '/client/totem/question-mode/exit',
            {
                method: 'POST',
                body: JSON.stringify({ reason }),
            }
        )
    },

    async reportDeviceStatus(
        payload: Pick<TotemClientDeviceStatus, 'camera' | 'microphone'>,
    ) {
        return totemClientApiRequestWithSession<ApiItemResponse<TotemClientQuestionModeMutationData>>(
            '/client/totem/device-status',
            {
                method: 'POST',
                body: JSON.stringify(payload),
            }
        )
    },

    async startQuestionSession() {
        return totemClientApiRequestWithSession<ApiItemResponse<TotemClientQuestionSessionStartData>>(
            '/client/totem/question-sessions',
            {
                method: 'POST',
                body: JSON.stringify({}),
            }
        )
    },

    async submitQuestion(
        sessionId: number,
        questionText: string,
    ) {
        return totemClientApiRequestWithSession<ApiItemResponse<TotemClientQuestionAnswerData>>(
            `/client/totem/question-sessions/${sessionId}/questions`,
            {
                method: 'POST',
                body: JSON.stringify({ questionText }),
            }
        )
    },

    async endQuestionSession(
        sessionId: number,
        reason: TotemQuestionModeExitReason,
    ) {
        return totemClientApiRequestWithSession<ApiItemResponse<TotemClientQuestionSessionEndData>>(
            `/client/totem/question-sessions/${sessionId}/end`,
            {
                method: 'POST',
                body: JSON.stringify({ reason }),
            }
        )
    },
}

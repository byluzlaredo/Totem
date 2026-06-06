import totemClientService from "../services/totemClient.service.js";
import totemClientSessionService from "../services/totemClientSession.service.js";
import { disconnectTotemRealtimeClients } from "../services/totemClientRealtime.service.js";

export async function postTotemDeviceLink(req, res) {
    const data = req.validated.body.linkCode
        ? await totemClientSessionService.linkDeviceByLinkCode(req.validated.body.linkCode)
        : await totemClientSessionService.linkDeviceByToken(req.validated.body.deviceToken)

    res.status(200).json({
        ok: true,
        message: 'Tótem vinculado correctamente',
        data,
    })
}

export async function postTotemSessionRefresh(req, res) {
    const data = await totemClientSessionService.refreshSessionByToken(
        req.validated.body.refreshToken
    )

    res.status(200).json({
        ok: true,
        message: 'Sesión del tótem renovada correctamente',
        data,
    })
}

export async function postTotemSessionUnlink(req, res) {
    const data = await totemClientSessionService.unlinkSessionByAccessToken(
        req.clientAccessToken,
        'device_unlinked'
    )

    disconnectTotemRealtimeClients(req.clientDeviceToken)

    res.status(200).json({
        ok: true,
        message: 'Tótem desvinculado correctamente',
        data,
    })
}

export async function getTotemBootstrap(req, res) {
    const data = await totemClientService.getBootstrap(req.clientTotem)

    res.status(200).json({
        ok: true,
        data,
    })
}

export async function postTotemHeartbeat(req, res) {
    const data = await totemClientService.heartbeat(req.clientTotem)

    res.status(200).json({
        ok: true,
        message: 'Heartbeat recibido correctamente',
        data,
    })
}

export async function postEnterQuestionMode(req, res) {
    const data = await totemClientService.enterQuestionModeByGesture(
        req.clientTotem,
        req.clientDeviceToken,
        req.validated.body.trigger
    )

    res.status(200).json({
        ok: true,
        message: 'Modo preguntas activado correctamente',
        data,
    })
}

export async function postQuestionModeActivity(req, res) {
    const data = await totemClientService.registerQuestionModeActivity(
        req.clientTotem,
        req.clientDeviceToken,
        req.validated.body.activityType
    )

    res.status(200).json({
        ok: true,
        message: 'Actividad del modo preguntas registrada correctamente',
        data,
    })
}

export async function postExitQuestionMode(req, res) {
    const data = await totemClientService.exitQuestionMode(
        req.clientTotem,
        req.clientDeviceToken,
        req.validated.body.reason
    )

    res.status(200).json({
        ok: true,
        message: 'Modo preguntas desactivado correctamente',
        data,
    })
}

export async function postDeviceStatus(req, res) {
    const data = await totemClientService.reportDeviceStatus(
        req.clientTotem,
        req.clientDeviceToken,
        req.validated.body
    )

    res.status(200).json({
        ok: true,
        message: 'Estado de dispositivos registrado correctamente',
        data,
    })
}

export async function postStartQuestionSession(req, res) {
    const data = await totemClientService.startQuestionSession(req.clientTotem)

    res.status(201).json({
        ok: true,
        message: 'Sesión de preguntas iniciada correctamente',
        data,
    })
}

export async function postQuestion(req, res) {
    const { sessionId } = req.validated.params
    const { questionText } = req.validated.body

    const data = await totemClientService.answerQuestion(
        req.clientTotem,
        sessionId,
        questionText
    )

    res.status(200).json({
        ok: true,
        message: 'Pregunta procesada correctamente',
        data,
    })
}

export async function postEndQuestionSession(req, res) {
    const { sessionId } = req.validated.params
    const { reason } = req.validated.body

    const data = await totemClientService.endQuestionSession(
        req.clientTotem,
        sessionId,
        reason
    )

    res.status(200).json({
        ok: true,
        message: 'Sesión de preguntas finalizada correctamente',
        data,
    })
}

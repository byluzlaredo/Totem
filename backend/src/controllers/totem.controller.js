import totemService from "../services/totem.service.js";
import { emitTotemEmergency } from "../services/totemClientRealtime.service.js";

export async function createTotem(req, res) {
    const totem = await totemService.createTotem(req.validated.body, req.authUser)

    res.status(201).json({
        ok: true,
        message: 'Tótem registrado correctamente',
        data: totem,
    })
}

export async function listTotems(req, res) {
    const result = await totemService.listTotems(req.validated.query, req.authUser)

    res.status(200).json({
        ok: true,
        data: result.items,
        meta: result.meta,
    })
}

export async function getTotemById(req, res) {
    const { id } = req.validated.params
    const totem = await totemService.getTotemById(id, req.authUser)

    res.status(200).json({
        ok: true,
        data: totem,
    })
}

export async function getTotemLinkingCode(req, res) {
    const { id } = req.validated.params
    const data = await totemService.getTotemLinkingCodeStatus(id, req.authUser)

    res.status(200).json({
        ok: true,
        data,
    })
}

export async function generateTotemLinkingCode(req, res) {
    const { id } = req.validated.params
    const data = await totemService.generateTotemLinkingCode(
      id,
      req.validated.body,
      req.authUser
    )

    res.status(200).json({
        ok: true,
        message: 'Código de vinculación generado correctamente',
        data,
    })
}

export async function updateTotem(req, res) {
    const { id } = req.validated.params
    const totem = await totemService.updateTotem(id, req.validated.body, req.authUser)

    res.status(200).json({
        ok: true,
        message: 'Tótem actualizado correctamente',
        data: totem,
    })
}

export async function changeTotemState(req, res) {
    const { id } = req.validated.params
    const { state } = req.validated.body

    const totem = await totemService.changeTotemState(id, state, req.authUser)

    res.status(200).json({
        ok: true,
        message: 'Estado del tótem actualizado correctamente',
        data: totem,
    })
}

export async function deleteTotem(req, res) {
    const { id } = req.validated.params

    await totemService.deleteTotem(id, req.authUser)

    res.status(200).json({
        ok: true,
        message: 'Tótem y asignaciones relacionadas eliminados lógicamente correctamente',
    })

}

export async function sendEmergency(req, res) {
    const { id } = req.validated.params
    const { message } = req.validated.body

    const totem = await totemService.getTotemByIdWithDeviceToken(id, req.authUser)

    emitTotemEmergency(totem.deviceToken, message)

    res.status(200).json({
        ok: true,
        message: 'Emergencia enviada al tótem correctamente',
    })
}

import usersService from '../services/users.service.js'

export async function listUsers(req, res) {
  const result = await usersService.listUsers(req.validated.query)

  res.status(200).json({
    ok: true,
    data: result.items,
    meta: result.meta,
  })
}

export async function getUserById(req, res) {
  const { id } = req.validated.params
  const user = await usersService.getUserById(id)

  res.status(200).json({
    ok: true,
    data: user,
  })
}

export async function createUser(req, res) {
  const result = await usersService.createUser(req.validated.body)

  res.status(201).json({
    ok: true,
    message: result.invitationEmailSent
      ? 'Usuario creado e invitado correctamente'
      : 'Usuario creado, pero no se pudo enviar el correo de invitación',
    data: result.user,
  })
}

export async function updateUser(req, res) {
  const { id } = req.validated.params
  const user = await usersService.updateUser(id, req.validated.body, req.authUser)

  res.status(200).json({
    ok: true,
    message: 'Usuario actualizado correctamente',
    data: user,
  })
}

export async function changeUserStatus(req, res) {
  const { id } = req.validated.params
  const { status } = req.validated.body
  const user = await usersService.changeUserStatus(id, status, req.authUser)

  res.status(200).json({
    ok: true,
    message: 'Estado del usuario actualizado correctamente',
    data: user,
  })
}

export async function deleteUser(req, res) {
  const { id } = req.validated.params

  await usersService.deleteUser(id, req.authUser)

  res.status(200).json({
    ok: true,
    message: 'Usuario eliminado lógicamente correctamente',
  })
}

export async function resendUserInvitation(req, res) {
  const { id } = req.validated.params
  const result = await usersService.resendUserInvitation(id, req.authUser)

  res.status(200).json({
    ok: true,
    message: result.invitationEmailSent
      ? 'Invitación reenviada correctamente'
      : 'Invitación renovada, pero no se pudo enviar el correo',
    data: result.user,
  })
}

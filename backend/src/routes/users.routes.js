import { Router } from 'express'
import * as usersController from '../controllers/users.controller.js'
import {
  validateChangeUserStatus,
  validateCreateUser,
  validateListUsers,
  validateUpdateUser,
  validateUserIdParam,
} from '../validators/users.validator.js'

const usersRouter = Router()

usersRouter.get('/', validateListUsers, usersController.listUsers)
usersRouter.get('/:id', validateUserIdParam, usersController.getUserById)
usersRouter.post('/', validateCreateUser, usersController.createUser)
usersRouter.patch('/:id', validateUserIdParam, validateUpdateUser, usersController.updateUser)
usersRouter.patch(
  '/:id/status',
  validateUserIdParam,
  validateChangeUserStatus,
  usersController.changeUserStatus
)
usersRouter.post(
  '/:id/resend-invitation',
  validateUserIdParam,
  usersController.resendUserInvitation
)
usersRouter.delete('/:id', validateUserIdParam, usersController.deleteUser)

export { usersRouter }

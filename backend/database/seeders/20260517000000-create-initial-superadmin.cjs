'use strict'

const bcrypt = require('bcrypt')
const { QueryTypes } = require('sequelize')

const INITIAL_SUPERADMIN = {
  name: 'Juan Perez',
  email: 'superadmin@gmail.com',
  password: 'Qqwerty8!',
  role: 'SuperAdmin',
  status: 1,
  campusId: 1,
}

const PASSWORD_SALT_ROUNDS = 12

module.exports = {
  async up(queryInterface) {
    const [campus] = await queryInterface.sequelize.query(
      `
        SELECT id
        FROM public.campuses
        WHERE id = :campusId
        LIMIT 1
      `,
      {
        replacements: { campusId: INITIAL_SUPERADMIN.campusId },
        type: QueryTypes.SELECT,
      }
    )

    if (!campus) {
      throw new Error(
        `No existe campus_id=${INITIAL_SUPERADMIN.campusId}. Ejecuta las migraciones antes de crear el SuperAdmin inicial.`
      )
    }

    const now = new Date()
    const passwordHash = await bcrypt.hash(
      INITIAL_SUPERADMIN.password,
      PASSWORD_SALT_ROUNDS
    )

    const [existingUser] = await queryInterface.sequelize.query(
      `
        SELECT id
        FROM public.app_user
        WHERE lower(email) = lower(:email)
        ORDER BY id ASC
        LIMIT 1
      `,
      {
        replacements: { email: INITIAL_SUPERADMIN.email },
        type: QueryTypes.SELECT,
      }
    )

    const userData = {
      name: INITIAL_SUPERADMIN.name,
      email: INITIAL_SUPERADMIN.email,
      password_hash: passwordHash,
      role: INITIAL_SUPERADMIN.role,
      status: INITIAL_SUPERADMIN.status,
      campus_id: INITIAL_SUPERADMIN.campusId,
      deleted_at: null,
      updated_at: now,
    }

    if (existingUser) {
      await queryInterface.bulkUpdate(
        'app_user',
        userData,
        { id: existingUser.id }
      )
      return
    }

    await queryInterface.bulkInsert('app_user', [
      {
        ...userData,
        created_at: now,
      },
    ])
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `
        DELETE FROM public.app_user
        WHERE lower(email) = lower(:email)
      `,
      {
        replacements: { email: INITIAL_SUPERADMIN.email },
      }
    )
  },
}

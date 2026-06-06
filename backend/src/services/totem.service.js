import crypto from "crypto";
import { sequelize } from "../config/db.js";
import { AppError, ConflictError, NotFoundError } from "../errors/AppError.js";
import totemContentRepository from "../repositories/totemContent.repository.js";
import totemRepository from "../repositories/totem.repository.js";
import campusService from "./campus.service.js";
import totemClientSessionService from "./totemClientSession.service.js";
import { disconnectTotemRealtimeClients } from "./totemClientRealtime.service.js";
import {
    applyCampusScopeToQuery,
    normalizeScopedCampusIdInput,
    requireCampusScopeId,
} from "../utils/campusAccess.js";

const LINKING_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const LINKING_CODE_LENGTH = 6
const DEFAULT_LINKING_CODE_TTL_MINUTES = 10
const MIN_LINKING_CODE_TTL_MINUTES = 3
const MAX_LINKING_CODE_TTL_MINUTES = 30
const MAX_LINKING_CODE_GENERATION_ATTEMPTS = 12
const TOTEM_NAME_DUPLICATE_IN_CAMPUS_MESSAGE =
    "Ya existe un tótem con este nombre en el campus seleccionado."
const TOTEM_CODE_DUPLICATE_MESSAGE =
    "Ya existe un tótem con este código en el sistema"

function generateDeviceToken() {
    return crypto.randomBytes(32).toString('hex')
}

function parseTtlMinutes(rawValue, fallbackValue) {
    const parsedValue = Number(rawValue)

    if (!Number.isInteger(parsedValue)) {
        return fallbackValue
    }

    return Math.min(
        MAX_LINKING_CODE_TTL_MINUTES,
        Math.max(MIN_LINKING_CODE_TTL_MINUTES, parsedValue)
    )
}

function addMinutes(baseDate, minutes) {
    return new Date(baseDate.getTime() + minutes * 60 * 1000)
}

function toIsoOrNull(value) {
    if (!value) {
        return null
    }

    const parsedDate = value instanceof Date ? value : new Date(value)

    if (Number.isNaN(parsedDate.getTime())) {
        return null
    }

    return parsedDate.toISOString()
}

function resolveLinkingCodeStatus(totem, now = new Date()) {
    if (!totem?.linkingCode || !totem.linkingCodeGeneratedAt || !totem.linkingCodeExpiresAt) {
        return 'none'
    }

    if (totem.linkingCodeUsedAt) {
        return 'used'
    }

    const expiresAt = new Date(totem.linkingCodeExpiresAt)

    if (Number.isNaN(expiresAt.getTime()) || expiresAt <= now) {
        return 'expired'
    }

    return 'active'
}

function mapLinkingCodePayload(totem, now = new Date()) {
    const status = resolveLinkingCodeStatus(totem, now)
    const expiresAtIso = toIsoOrNull(totem?.linkingCodeExpiresAt)
    const remainingSeconds =
        status === 'active' && expiresAtIso
            ? Math.max(0, Math.floor((Date.parse(expiresAtIso) - now.getTime()) / 1000))
            : 0

    return {
        status,
        code: status === 'active' ? totem?.linkingCode ?? null : null,
        generatedAt: toIsoOrNull(totem?.linkingCodeGeneratedAt),
        expiresAt: expiresAtIso,
        usedAt: toIsoOrNull(totem?.linkingCodeUsedAt),
        ttlMinutes: Number.isInteger(totem?.linkingCodeTtlMinutes)
            ? totem.linkingCodeTtlMinutes
            : null,
        remainingSeconds,
        isUsable: status === 'active',
    }
}

function generateLinkingCode() {
    let code = ''

    for (let index = 0; index < LINKING_CODE_LENGTH; index += 1) {
        const randomByte = crypto.randomBytes(1)[0]
        const nextIndex = randomByte % LINKING_CODE_ALPHABET.length
        code += LINKING_CODE_ALPHABET[nextIndex]
    }

    return code
}

function isUniqueConstraintError(error) {
    return (
        error?.name === 'SequelizeUniqueConstraintError' ||
        error?.original?.code === '23505' ||
        error?.parent?.code === '23505' ||
        error?.code === '23505'
    )
}

function normalizeConstraintName(error) {
    const constraint =
        error?.original?.constraint ??
        error?.parent?.constraint ??
        error?.constraint ??
        null

    return typeof constraint === "string" ? constraint.trim().toLowerCase() : ""
}

function resolveDuplicateTotemConflict(error) {
    if (!isUniqueConstraintError(error)) {
        return null
    }

    const constraintName = normalizeConstraintName(error)
    const errorPaths = Array.isArray(error?.errors)
        ? error.errors
            .map((item) => String(item?.path ?? "").trim().toLowerCase())
            .filter(Boolean)
        : []

    if (
        constraintName.includes("totems_name_campus_unique_not_deleted") ||
        constraintName.includes("totems_name_unique_not_deleted") ||
        errorPaths.includes("name")
    ) {
        return new ConflictError(
            TOTEM_NAME_DUPLICATE_IN_CAMPUS_MESSAGE,
            { name: TOTEM_NAME_DUPLICATE_IN_CAMPUS_MESSAGE },
        )
    }

    if (
        constraintName.includes("totems_code_unique_not_deleted") ||
        errorPaths.includes("code")
    ) {
        return new ConflictError(
            TOTEM_CODE_DUPLICATE_MESSAGE,
            { code: TOTEM_CODE_DUPLICATE_MESSAGE },
        )
    }

    return null
}

class TotemService {
    constructor() {
        this.defaultLinkingCodeTtlMinutes = parseTtlMinutes(
            process.env.TOTEM_LINK_CODE_TTL_MINUTES,
            DEFAULT_LINKING_CODE_TTL_MINUTES
        )
    }

    ensureTotemIsActive(totem) {
        if (totem?.state === 'active') {
            return
        }

        throw new AppError(
            403,
            'El tótem no está habilitado',
            'TOTEM_INACTIVE'
        )
    }

    clearLinkingCodeData() {
        return {
            linkingCode: null,
            linkingCodeGeneratedAt: null,
            linkingCodeExpiresAt: null,
            linkingCodeUsedAt: null,
            linkingCodeTtlMinutes: null,
        }
    }

    assertCampusAccessOrNotFound(totem, authUser = null) {
        const scopedCampusId = requireCampusScopeId(authUser)

        if (scopedCampusId === null) {
            return
        }

        if (Number(totem?.campusId) !== scopedCampusId) {
            throw new NotFoundError('El tótem no existe')
        }
    }

    async createTotem(data, authUser = null) {
        const campusId = normalizeScopedCampusIdInput(data.campusId, authUser)
        await campusService.assertCampusIdExists(campusId)

        const existingTotem = await totemRepository.findByNameInCampus(
            data.name,
            campusId,
        )

        if (existingTotem) {
            throw new ConflictError(
                TOTEM_NAME_DUPLICATE_IN_CAMPUS_MESSAGE,
                { name: TOTEM_NAME_DUPLICATE_IN_CAMPUS_MESSAGE },
            )
        }

        const existingCode = await totemRepository.findByCode(data.code)

        if (existingCode) {
            throw new ConflictError(
                TOTEM_CODE_DUPLICATE_MESSAGE,
                { code: TOTEM_CODE_DUPLICATE_MESSAGE },
            )
        }

        try {
            return await totemRepository.create({
                ...data,
                campusId,
                state: 'active',
                connectionStatus: 'offline',
                lastSeenAt: null,
                deviceToken: generateDeviceToken(),
                ...this.clearLinkingCodeData(),
            })
        } catch (error) {
            const duplicatedTotemConflict = resolveDuplicateTotemConflict(error)

            if (duplicatedTotemConflict) {
                throw duplicatedTotemConflict
            }

            throw error
        }
    }

    async listTotems(query, authUser = null) {
        const scopedQuery = applyCampusScopeToQuery(query, authUser)
        const { count, rows } = await totemRepository.findAllWithPagination(scopedQuery)

        return {
            items: rows,
            meta: {
                totalItems: count,
                totalPages: count === 0 ? 0 : Math.ceil(count / scopedQuery.limit),
                currentPage: scopedQuery.page,
                pageSize: scopedQuery.limit,
            },
        }
    }

    async findTotemByIdOrThrow(id, authUser = null, options = {}) {
        const totem = await totemRepository.findById(id, options)

        if (!totem) {
            throw new NotFoundError('El tótem no existe')
        }

        this.assertCampusAccessOrNotFound(totem, authUser)
        return totem
    }

    async getTotemById(id, authUser = null) {
        const totem = await totemRepository.findByIdWithLinkingCode(id)

        if (!totem) {
            throw new NotFoundError('El tótem no existe')
        }

        this.assertCampusAccessOrNotFound(totem, authUser)
        return totem
    }

    async getTotemByIdWithDeviceToken(id, authUser = null) {
        const totem = await totemRepository.findByIdWithDeviceToken(id)

        if (!totem) {
            throw new NotFoundError('El tótem no existe')
        }

        this.assertCampusAccessOrNotFound(totem, authUser)
        return totem
    }

    async updateTotem(id, data, authUser = null) {
        const totem = await this.findTotemByIdOrThrow(id, authUser)

        const scopedCampusId = requireCampusScopeId(authUser)
        let nextCampusId = data.campusId

        if (scopedCampusId !== null) {
            nextCampusId = normalizeScopedCampusIdInput(data.campusId, authUser)
        }

        if (
            nextCampusId !== undefined &&
            Number(nextCampusId) !== Number(totem.campusId)
        ) {
            await campusService.assertCampusIdExists(nextCampusId)
        }

        const targetCampusId =
            nextCampusId !== undefined ? Number(nextCampusId) : Number(totem.campusId)
        const targetName = data.name !== undefined ? data.name : totem.name

        if (
            targetName !== totem.name ||
            targetCampusId !== Number(totem.campusId)
        ) {
            const existingTotem = await totemRepository.findByNameInCampus(
                targetName,
                targetCampusId,
                id,
            )

            if (existingTotem) {
                throw new ConflictError(
                    TOTEM_NAME_DUPLICATE_IN_CAMPUS_MESSAGE,
                    { name: TOTEM_NAME_DUPLICATE_IN_CAMPUS_MESSAGE },
                )
            }
        }

        if (data.code && data.code !== totem.code) {
            const existingCode = await totemRepository.findByCode(data.code, id)

            if (existingCode) {
                throw new ConflictError(
                    TOTEM_CODE_DUPLICATE_MESSAGE,
                    { code: TOTEM_CODE_DUPLICATE_MESSAGE },
                )
            }
        }

        let updatedTotem

        try {
            updatedTotem = await totemRepository.update(totem, {
                ...data,
                ...(nextCampusId !== undefined ? { campusId: nextCampusId } : {}),
            })
        } catch (error) {
            const duplicatedTotemConflict = resolveDuplicateTotemConflict(error)

            if (duplicatedTotemConflict) {
                throw duplicatedTotemConflict
            }

            throw error
        }

        return totemRepository.findById(updatedTotem.id)
    }

    async changeTotemState(id, state, authUser = null) {
        const totem = await totemRepository.findByIdWithLinkingCode(id)

        if (!totem) {
            throw new NotFoundError('El tótem no existe')
        }

        this.assertCampusAccessOrNotFound(totem, authUser)

        if (totem.state === state) {
            return totem
        }

        const updatePayload =
            state === 'inactive'
                ? {
                    state,
                    connectionStatus: 'offline',
                }
                : { state }

        if (
            state === 'inactive' &&
            totem.linkingCode &&
            !totem.linkingCodeUsedAt
        ) {
            // Se invalida cualquier codigo vigente al desactivar,
            // pero se conserva trazabilidad (codigo, fechas, ultimo uso).
            updatePayload.linkingCodeUsedAt = new Date()
        }

        const updatedTotem = await totemRepository.update(totem, updatePayload)

        if (state === 'inactive') {
            await totemClientSessionService.revokeSessionsByTotemId(
                totem.id,
                'totem_inactive_by_admin'
            )

            const totemWithDeviceToken = await totemRepository.findByIdWithDeviceToken(id)

            if (totemWithDeviceToken?.deviceToken) {
                disconnectTotemRealtimeClients(totemWithDeviceToken.deviceToken)
            }
        }

        return totemRepository.findById(updatedTotem.id)
    }

    async getTotemLinkingCodeStatus(id, authUser = null) {
        const totem = await totemRepository.findByIdWithLinkingCode(id)

        if (!totem) {
            throw new NotFoundError('El tótem no existe')
        }

        this.assertCampusAccessOrNotFound(totem, authUser)

        return {
            totemId: totem.id,
            totemName: totem.name,
            totemState: totem.state,
            ...mapLinkingCodePayload(totem),
            defaultTtlMinutes: this.defaultLinkingCodeTtlMinutes,
            allowedTtlMinutes: [5, 10],
        }
    }

    async generateTotemLinkingCode(id, options = {}, authUser = null) {
        const totem = await totemRepository.findByIdWithLinkingCode(id)

        if (!totem) {
            throw new NotFoundError('El tótem no existe')
        }

        this.assertCampusAccessOrNotFound(totem, authUser)
        this.ensureTotemIsActive(totem)

        const ttlMinutes = parseTtlMinutes(
            options.ttlMinutes,
            this.defaultLinkingCodeTtlMinutes
        )
        const generatedAt = new Date()
        const expiresAt = addMinutes(generatedAt, ttlMinutes)

        for (let attempt = 0; attempt < MAX_LINKING_CODE_GENERATION_ATTEMPTS; attempt += 1) {
            const linkingCode = generateLinkingCode()
            const existingTotemWithCode = await totemRepository.findByLinkingCode(linkingCode)

            if (existingTotemWithCode && existingTotemWithCode.id !== totem.id) {
                continue
            }

            try {
                const updatedTotem = await totemRepository.update(totem, {
                    linkingCode,
                    linkingCodeGeneratedAt: generatedAt,
                    linkingCodeExpiresAt: expiresAt,
                    linkingCodeUsedAt: null,
                    linkingCodeTtlMinutes: ttlMinutes,
                })

                return {
                    totemId: updatedTotem.id,
                    totemName: updatedTotem.name,
                    totemState: updatedTotem.state,
                    ...mapLinkingCodePayload(updatedTotem, generatedAt),
                    defaultTtlMinutes: this.defaultLinkingCodeTtlMinutes,
                    allowedTtlMinutes: [5, 10],
                }
            } catch (error) {
                if (!isUniqueConstraintError(error)) {
                    throw error
                }
            }
        }

        throw new AppError(
            500,
            'No se pudo generar un código de vinculación único',
            'TOTEM_LINK_CODE_GENERATION_FAILED'
        )
    }

    async deleteTotem(id, authUser = null) {
        let totemDeviceToken = null

        await sequelize.transaction(async (transaction) => {
            const totem = await this.findTotemByIdOrThrow(id, authUser, {
                transaction,
                lock: transaction.LOCK.UPDATE,
            })
            const totemWithDeviceToken = await totemRepository.findByIdWithDeviceToken(id, {
                transaction,
                lock: transaction.LOCK.UPDATE,
            })
            this.assertCampusAccessOrNotFound(totemWithDeviceToken, authUser)

            totemDeviceToken = totemWithDeviceToken?.deviceToken ?? null

            await totemClientSessionService.revokeSessionsByTotemId(
                id,
                'totem_deleted',
                { transaction }
            )

            await totemContentRepository.softDeleteByTotemId(id, { transaction })
            await totemRepository.softDelete(totem, { transaction })
        })

        if (totemDeviceToken) {
            disconnectTotemRealtimeClients(totemDeviceToken)
        }
    }
}

export default new TotemService()

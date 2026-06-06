import Totem from "./Totem.js"
import Content from "./Content.js"
import TotemContent from "./TotemContent.js"
import AppUser from "./app-user.js"
import Notification from "./Notification.js"
import NotificationTarget from "./NotificationTarget.js"
import Campus from './Campus.js'
import PdfChunk from "./PdfChunk.js"
import PdfDocument from "./PdfDocument.js"
import PdfQuestionImage from "./PdfQuestionImage.js"
import TotemQuestionSession from "./TotemQuestionSession.js"
import TotemDeviceSession from './TotemDeviceSession.js'
import PasswordResetToken from './PasswordResetToken.js'
import UserInvitation from './UserInvitation.js'

Totem.hasMany(TotemContent, {
    foreignKey: 'totemId',
    as: 'contentAssignments',
})

Campus.hasMany(Totem, {
    foreignKey: 'campusId',
    as: 'totems',
})

Totem.belongsTo(Campus, {
    foreignKey: 'campusId',
    as: 'campus',
})

Campus.hasMany(AppUser, {
    foreignKey: 'campusId',
    as: 'users',
})

AppUser.belongsTo(Campus, {
    foreignKey: 'campusId',
    as: 'campus',
})

AppUser.hasMany(PasswordResetToken, {
    foreignKey: 'userId',
    as: 'passwordResetTokens',
})

PasswordResetToken.belongsTo(AppUser, {
    foreignKey: 'userId',
    as: 'user',
})

AppUser.hasMany(UserInvitation, {
    foreignKey: 'userId',
    as: 'userInvitations',
})

UserInvitation.belongsTo(AppUser, {
    foreignKey: 'userId',
    as: 'user',
})

Campus.hasMany(Content, {
    foreignKey: 'campusId',
    as: 'contents',
})

Content.belongsTo(Campus, {
    foreignKey: 'campusId',
    as: 'campus',
})

Totem.hasMany(NotificationTarget, {
    foreignKey: 'totemId',
    as: 'notificationTargets',
})

Campus.hasMany(NotificationTarget, {
    foreignKey: 'campusId',
    as: 'notificationTargets',
})

Notification.hasMany(NotificationTarget, {
    foreignKey: 'notificationId',
    as: 'targets',
})

Content.hasMany(TotemContent, {
    foreignKey: 'contentId',
    as: 'totemAssignments',
})

TotemContent.belongsTo(Totem, {
    foreignKey: 'totemId',
    as: 'totem',
})

TotemContent.belongsTo(Content, {
    foreignKey: 'contentId',
    as: 'content',
})

Totem.hasMany(TotemQuestionSession, {
    foreignKey: 'totemId',
    as: 'questionSessions',
})

TotemQuestionSession.belongsTo(Totem, {
    foreignKey: 'totemId',
    as: 'totem',
})

Totem.hasMany(TotemDeviceSession, {
    foreignKey: 'totemId',
    as: 'deviceSessions',
})

TotemDeviceSession.belongsTo(Totem, {
    foreignKey: 'totemId',
    as: 'totem',
})

NotificationTarget.belongsTo(Notification, {
    foreignKey: 'notificationId',
    as: 'notification',
})

NotificationTarget.belongsTo(Totem, {
    foreignKey: 'totemId',
    as: 'totem',
})

NotificationTarget.belongsTo(Campus, {
    foreignKey: 'campusId',
    as: 'campus',
})

Content.hasMany(PdfDocument, {
    foreignKey: 'contentId',
    as: 'pdfDocuments',
})

PdfDocument.belongsTo(Content, {
    foreignKey: 'contentId',
    as: 'content',
})

PdfDocument.hasMany(PdfChunk, {
    foreignKey: 'pdfDocumentId',
    as: 'chunks',
})

PdfChunk.belongsTo(PdfDocument, {
    foreignKey: 'pdfDocumentId',
    as: 'pdfDocument',
})

PdfChunk.hasMany(PdfQuestionImage, {
    foreignKey: 'pdfChunkId',
    as: 'questionImages',
})

PdfQuestionImage.belongsTo(PdfChunk, {
    foreignKey: 'pdfChunkId',
    as: 'pdfChunk',
})

export {
    Totem,
    Content,
    TotemContent,
    Notification,
    NotificationTarget,
    Campus,
    AppUser,
    PdfChunk,
    PdfDocument,
    PdfQuestionImage,
    TotemQuestionSession,
    TotemDeviceSession,
    PasswordResetToken,
    UserInvitation,
}

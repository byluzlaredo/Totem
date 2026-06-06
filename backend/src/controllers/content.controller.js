import contentService from "../services/content.service.js";
import contentPdfQuestionImagesService from "../services/contentPdfQuestionImages.service.js";
import { emitTotemContentsUpdated } from "../services/totemClientRealtime.service.js";

export async function createContent(req, res) {
    const content = await contentService.createContent(
      req.validated.body,
      req.file,
      req.authUser
    )

    emitTotemContentsUpdated({
        action: 'created',
        contentId: content.id,
        emittedAt: new Date().toISOString(),
    })

    res.status(201).json({
        ok: true,
        message: 'Contenido registrado correctamente',
        data: content,
    })
}

export async function listContents(req, res) {
    const result = await contentService.listContents(req.validated.query, req.authUser)

    res.status(200).json({
        ok: true,
        data: result.items,
        meta: result.meta,
    })
}

export async function getContentById(req, res) {
    const { id } = req.validated.params
    const content = await contentService.getContentById(id, req.authUser)

    res.status(200).json({
        ok: true,
        data: content,
    })
}

export async function updateContent(req, res) {
    const { id } = req.validated.params
    const content = await contentService.updateContent(
      id,
      req.validated.body,
      req.file,
      req.authUser
    )

    emitTotemContentsUpdated({
        action: 'updated',
        contentId: content.id,
        emittedAt: new Date().toISOString(),
    })

    res.status(200).json({
        ok: true,
        message: 'Contenido actualizado correctamente',
        data: content,
    })
}

export async function deleteContent(req, res) {
    const { id } = req.validated.params

    await contentService.deleteContent(id, req.authUser)

    emitTotemContentsUpdated({
        action: 'deleted',
        contentId: Number(id),
        emittedAt: new Date().toISOString(),
    })

    res.status(200).json({
        ok: true,
        message: 'Contenido eliminado lógicamente correctamente',
    })
}

export async function getPdfQuestionChunks(req, res) {
    const { id } = req.validated.params
    const data = await contentPdfQuestionImagesService.listPdfQuestionChunks(
      id,
      req.authUser
    )

    res.status(200).json({
        ok: true,
        data,
    })
}

export async function getPdfChunkImages(req, res) {
    const { id, chunkId } = req.validated.params
    const data = await contentPdfQuestionImagesService.listChunkImages(
      id,
      chunkId,
      req.authUser
    )

    res.status(200).json({
        ok: true,
        data,
    })
}

export async function postPdfChunkImages(req, res) {
    const { id, chunkId } = req.validated.params
    const files = req.validated.files ?? req.files ?? []
    const images = await contentPdfQuestionImagesService.uploadChunkImages(
      id,
      chunkId,
      files,
      req.authUser
    )

    res.status(201).json({
        ok: true,
        message: 'Imágenes registradas correctamente',
        data: images,
    })
}

export async function patchPdfQuestionImageMetadata(req, res) {
    const { id, imageId } = req.validated.params
    const data = await contentPdfQuestionImagesService.updateImageMetadata(
      id,
      imageId,
      req.validated.body,
      req.authUser
    )

    res.status(200).json({
        ok: true,
        message: 'Imagen actualizada correctamente',
        data,
    })
}

export async function putPdfQuestionImageFile(req, res) {
    const { id, imageId } = req.validated.params
    const data = await contentPdfQuestionImagesService.replaceImageFile(
      id,
      imageId,
      req.file,
      req.authUser
    )

    res.status(200).json({
        ok: true,
        message: 'Imagen reemplazada correctamente',
        data,
    })
}

export async function deletePdfQuestionImage(req, res) {
    const { id, imageId } = req.validated.params
    const data = await contentPdfQuestionImagesService.deleteImage(
      id,
      imageId,
      req.authUser
    )

    res.status(200).json({
        ok: true,
        message: 'Imagen eliminada correctamente',
        data,
    })
}

import { Router } from 'express'
import * as contentController from '../controllers/content.controller.js'
import { uploadContentFile } from '../middlewares/contentUpload.js'
import {
  uploadPdfQuestionImageFile,
  uploadPdfQuestionImageFiles,
} from '../middlewares/pdfQuestionImageUpload.js'
import {
  validateContentIdParam,
  validateCreateContent,
  validatePdfChunkIdParam,
  validatePdfQuestionImageIdParam,
  validateListContents,
  validateReplacePdfQuestionImageFile,
  validateUpdatePdfQuestionImageMetadata,
  validateUpdateContent,
  validateUploadPdfQuestionImages,
} from '../validators/content.validators.js'

const router = Router()

router.post('/', uploadContentFile, validateCreateContent, contentController.createContent)
router.get('/', validateListContents, contentController.listContents)
router.get(
  '/:id/pdf-question-chunks',
  validateContentIdParam,
  contentController.getPdfQuestionChunks
)
router.get(
  '/:id/pdf-question-chunks/:chunkId/images',
  validateContentIdParam,
  validatePdfChunkIdParam,
  contentController.getPdfChunkImages
)
router.post(
  '/:id/pdf-question-chunks/:chunkId/images',
  validateContentIdParam,
  validatePdfChunkIdParam,
  uploadPdfQuestionImageFiles,
  validateUploadPdfQuestionImages,
  contentController.postPdfChunkImages
)
router.patch(
  '/:id/pdf-question-images/:imageId',
  validateContentIdParam,
  validatePdfQuestionImageIdParam,
  validateUpdatePdfQuestionImageMetadata,
  contentController.patchPdfQuestionImageMetadata
)
router.put(
  '/:id/pdf-question-images/:imageId/file',
  validateContentIdParam,
  validatePdfQuestionImageIdParam,
  uploadPdfQuestionImageFile,
  validateReplacePdfQuestionImageFile,
  contentController.putPdfQuestionImageFile
)
router.delete(
  '/:id/pdf-question-images/:imageId',
  validateContentIdParam,
  validatePdfQuestionImageIdParam,
  contentController.deletePdfQuestionImage
)
router.get('/:id', validateContentIdParam, contentController.getContentById)
router.patch('/:id', validateContentIdParam, uploadContentFile, validateUpdateContent, contentController.updateContent)
router.delete('/:id', validateContentIdParam, contentController.deleteContent)

export default router

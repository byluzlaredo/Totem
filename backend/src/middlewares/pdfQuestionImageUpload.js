import multer from 'multer'

const MAX_QUESTION_IMAGE_SIZE_BYTES = 15 * 1024 * 1024
const MAX_QUESTION_IMAGE_FILES_PER_REQUEST = 20

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_QUESTION_IMAGE_SIZE_BYTES,
    files: MAX_QUESTION_IMAGE_FILES_PER_REQUEST,
  },
})

export const uploadPdfQuestionImageFiles = upload.array(
  'files',
  MAX_QUESTION_IMAGE_FILES_PER_REQUEST
)

export const uploadPdfQuestionImageFile = upload.single('file')


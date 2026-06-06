import multer from 'multer'

const MAX_UPLOAD_SIZE_BYTES = 150 * 1024 * 1024

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_SIZE_BYTES,
  },
})

export const uploadContentFile = upload.single('file')

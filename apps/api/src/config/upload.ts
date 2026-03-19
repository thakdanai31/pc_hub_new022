import multer from 'multer';
import { AppError } from '../common/errors.js';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new AppError(
          'Invalid file type. Allowed: JPEG, PNG, WebP',
          400,
          'INVALID_FILE_TYPE',
        ),
      );
    }
  },
});

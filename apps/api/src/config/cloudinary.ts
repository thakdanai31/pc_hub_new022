import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'node:stream';
import { env } from './env.js';
import { AppError } from '../common/errors.js';

export function isCloudinaryConfigured(): boolean {
  return !!(
    env.CLOUDINARY_CLOUD_NAME &&
    env.CLOUDINARY_API_KEY &&
    env.CLOUDINARY_API_SECRET
  );
}

export function ensureCloudinaryConfigured(): void {
  if (!isCloudinaryConfigured()) {
    throw new AppError(
      'Image service is not configured',
      503,
      'SERVICE_UNAVAILABLE',
    );
  }
}

let configured = false;

function initCloudinary(): void {
  if (configured) return;
  if (!isCloudinaryConfigured()) return;

  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
  });
  configured = true;
}

interface UploadResult {
  imageUrl: string;
  imagePublicId: string;
}

export async function uploadImage(
  buffer: Buffer,
  folder: string,
): Promise<UploadResult> {
  ensureCloudinaryConfigured();
  initCloudinary();

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image' },
      (error, result) => {
        if (error || !result) {
          reject(
            new AppError(
              'Image upload failed',
              502,
              'UPLOAD_FAILED',
            ),
          );
          return;
        }
        resolve({
          imageUrl: result.secure_url,
          imagePublicId: result.public_id,
        });
      },
    );

    const readable = Readable.from(buffer);
    readable.pipe(stream);
  });
}

export async function deleteImage(publicId: string): Promise<void> {
  ensureCloudinaryConfigured();
  initCloudinary();

  try {
    await cloudinary.uploader.destroy(publicId);
  } catch {
    // Log warning but don't fail — orphan cleanup is acceptable
    console.warn(`Failed to delete Cloudinary image: ${publicId}`);
  }
}

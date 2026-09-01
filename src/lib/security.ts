const PASSWORD_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#';

export function generateSecurePassword(length = 12): string {
  const array = new Uint32Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (n) => PASSWORD_CHARS[n % PASSWORD_CHARS.length]).join('');
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB

const ALLOWED_DOC_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg', 'image/png', 'image/webp',
];
const MAX_DOC_SIZE = 50 * 1024 * 1024; // 50 MB

export function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return 'Only JPEG, PNG, WebP, and GIF images are allowed.';
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return 'Image must be under 5 MB.';
  }
  return null;
}

export function validateDocumentFile(file: File): string | null {
  if (!ALLOWED_DOC_TYPES.includes(file.type)) {
    return 'Only PDF, Word documents, and images are allowed.';
  }
  if (file.size > MAX_DOC_SIZE) {
    return 'File must be under 50 MB.';
  }
  return null;
}

import { describe, it, expect } from 'vitest';
import { generateSecurePassword, validateImageFile, validateDocumentFile } from './security';

describe('generateSecurePassword', () => {
  it('generates a 12-character password by default', () => {
    const pw = generateSecurePassword();
    expect(pw).toHaveLength(12);
  });

  it('respects custom length', () => {
    expect(generateSecurePassword(8)).toHaveLength(8);
    expect(generateSecurePassword(20)).toHaveLength(20);
  });

  it('only uses allowed characters', () => {
    const allowed = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#';
    for (let i = 0; i < 50; i++) {
      const pw = generateSecurePassword();
      for (const ch of pw) {
        expect(allowed).toContain(ch);
      }
    }
  });

  it('produces different passwords on consecutive calls', () => {
    const passwords = new Set(Array.from({ length: 20 }, () => generateSecurePassword()));
    expect(passwords.size).toBeGreaterThan(15);
  });
});

describe('validateImageFile', () => {
  const makeFile = (name: string, type: string, sizeBytes: number): File => {
    const buf = new ArrayBuffer(sizeBytes);
    return new File([buf], name, { type });
  };

  it('accepts valid JPEG', () => {
    expect(validateImageFile(makeFile('photo.jpg', 'image/jpeg', 1000))).toBeNull();
  });

  it('accepts valid PNG', () => {
    expect(validateImageFile(makeFile('photo.png', 'image/png', 1000))).toBeNull();
  });

  it('accepts valid WebP', () => {
    expect(validateImageFile(makeFile('photo.webp', 'image/webp', 1000))).toBeNull();
  });

  it('accepts valid GIF', () => {
    expect(validateImageFile(makeFile('anim.gif', 'image/gif', 1000))).toBeNull();
  });

  it('rejects SVG files', () => {
    expect(validateImageFile(makeFile('logo.svg', 'image/svg+xml', 500))).toContain('JPEG');
  });

  it('rejects PDF disguised as image', () => {
    expect(validateImageFile(makeFile('fake.jpg', 'application/pdf', 500))).toContain('JPEG');
  });

  it('rejects executable files', () => {
    expect(validateImageFile(makeFile('virus.exe', 'application/x-msdownload', 500))).toContain('JPEG');
  });

  it('rejects files over 5 MB', () => {
    const size = 5 * 1024 * 1024 + 1;
    expect(validateImageFile(makeFile('big.jpg', 'image/jpeg', size))).toContain('5 MB');
  });

  it('accepts files exactly 5 MB', () => {
    const size = 5 * 1024 * 1024;
    expect(validateImageFile(makeFile('ok.jpg', 'image/jpeg', size))).toBeNull();
  });
});

describe('validateDocumentFile', () => {
  const makeFile = (name: string, type: string, sizeBytes: number): File => {
    const buf = new ArrayBuffer(sizeBytes);
    return new File([buf], name, { type });
  };

  it('accepts PDF', () => {
    expect(validateDocumentFile(makeFile('cert.pdf', 'application/pdf', 1000))).toBeNull();
  });

  it('accepts Word doc', () => {
    expect(validateDocumentFile(makeFile('doc.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 1000))).toBeNull();
  });

  it('accepts JPEG image', () => {
    expect(validateDocumentFile(makeFile('scan.jpg', 'image/jpeg', 1000))).toBeNull();
  });

  it('rejects HTML files', () => {
    expect(validateDocumentFile(makeFile('page.html', 'text/html', 500))).toContain('PDF');
  });

  it('rejects zip files', () => {
    expect(validateDocumentFile(makeFile('archive.zip', 'application/zip', 500))).toContain('PDF');
  });

  it('rejects files over 50 MB', () => {
    const size = 50 * 1024 * 1024 + 1;
    expect(validateDocumentFile(makeFile('huge.pdf', 'application/pdf', size))).toContain('50 MB');
  });

  it('accepts files exactly 50 MB', () => {
    const size = 50 * 1024 * 1024;
    expect(validateDocumentFile(makeFile('ok.pdf', 'application/pdf', size))).toBeNull();
  });
});

import QRCode from 'qrcode';

export async function generateQRDataURL(text: string, size = 220): Promise<string> {
  return QRCode.toDataURL(text, {
    width: size,
    margin: 2,
    color: { dark: '#0f172a', light: '#ffffff' },
    errorCorrectionLevel: 'M',
  });
}

export function generateLocationURL(location: string): string {
  const base = window.location.origin + window.location.pathname;
  return `${base}?location=${encodeURIComponent(location)}`;
}

import QRCode from "qrcode";

/**
 * Renders a QR payload to a self-contained PNG data URI.
 *
 * Done in-process rather than through a hosted QR/VietQR image service, so the
 * shop's bank account number never travels to a third party and the image can
 * never be tampered with in transit.
 */
export function renderQrCodeDataUrl(payload: string): Promise<string> {
  return QRCode.toDataURL(payload, { errorCorrectionLevel: "M", margin: 1, width: 512 });
}

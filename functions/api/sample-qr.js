// Import the necessary libraries
// pdf-lib is for creating and editing PDF documents
// qrcode is for generating QR code data
import { PDFDocument, StandardFonts } from 'pdf-lib';
import qrcode from 'qrcode';

/**
 * This is the Cloudflare Pages Function handler.
 * It intercepts requests to /sticker
 * @param {EventContext} context
 * @returns {Response}
 */
export async function onRequest(context) {
  try {
    // 1. Get the unique ID from the URL query parameters
    const url = new URL(context.request.url);
    const uniqueId = url.searchParams.get('id');

    // 2. Handle cases where the 'id' parameter is missing
    if (!uniqueId) {
      return new Response('Error: "id" query parameter is required.', {
        status: 400,
      });
    }

    // 3. Generate the QR code as a base64 Data URL (PNG format)
    // We set errorCorrection to 'H' (High) for better scannability
    const qrCodeDataURL = await qrcode.toDataURL(uniqueId, {
      errorCorrectionLevel: 'H',
      margin: 2,
    });

    // 4. Create a new PDF document
    const pdfDoc = await PDFDocument.create();

    // 5. Define sticker dimensions (e.g., 2 inches wide x 2.5 inches tall)
    // pdf-lib uses "points" (1 inch = 72 points)
    const stickerWidth = 2 * 72; // 144 points
    const stickerHeight = 2.5 * 72; // 180 points

    // Add a page to the document with our dimensions
    const page = pdfDoc.addPage([stickerWidth, stickerHeight]);
    const { width, height } = page.getSize();

    // 6. Embed the QR code image into the PDF
    // The data URL is a base64-encoded PNG
    const qrImage = await pdfDoc.embedPng(qrCodeDataURL);
    const qrDims = qrImage.scale(1); // Get original dimensions

    // Define the size we want the QR code to be on the PDF (e.g., 120x120 points)
    const qrSize = 120;

    // Draw the QR code image on the page
    // Centered horizontally, and near the top
    page.drawImage(qrImage, {
      x: (width - qrSize) / 2,
      y: height - qrSize - 20, // 20 points from the top
      width: qrSize,
      height: qrSize,
    });

    // 7. Add the unique ID text below the QR code
    // Embed a standard font
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontSize = 10;
    const text = uniqueId;
    const textWidth = font.widthOfTextAtSize(text, fontSize);

    // Draw the text, centered horizontally
    page.drawText(text, {
      x: (width - textWidth) / 2,
      y: height - qrSize - 45, // Positioned 25 points below the QR code
      size: fontSize,
      font: font,
    });

    // 8. Save the PDF document to a Uint8Array
    const pdfBytes = await pdfDoc.save();

    // 9. Return the PDF as a response
    // We set headers to force a file download
    return new Response(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="sticker.pdf"`,
      },
    });
  } catch (error) {
    // Handle any unexpected errors
    console.error(error);
    return new Response('An error occurred while generating the PDF.', {
      status: 500,
    });
  }
}

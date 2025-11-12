import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import qrcode from "qrcode"; // Make sure you have this library

/* ---------- Dynamic QR Code Handler ---------- */
export async function onRequest(context) {
  try {
    // 1. Get the ID from the URL query parameters
    const url = new URL(context.request.url);
    const uniqueId = url.searchParams.get("id") || "MISSING-ID"; // Use the 'id' param, or a default

    // 2. Generate the QR code as a base64 PNG data URL
    const qrDataUrl = await qrcode.toDataURL(uniqueId, { margin: 1 });

    // 3. Create a small PDF document
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([200, 250]); // 200x250 points
    const { width, height } = page.getSize();
    const helv = await pdf.embedFont(StandardFonts.Helvetica);

    // 4. Embed the QR code PNG into the PDF
    const qrImage = await pdf.embedPng(qrDataUrl);
    
    // 5. Define layout variables
    const qrSize = 150;
    const textSize = 12;
    const padding = 10;

    // 6. Calculate text width
    const textW = helv.widthOfTextAtSize(uniqueId, textSize);

    // 7. Calculate centered positions
    const qrX = (width - qrSize) / 2;
    const qrY = height - qrSize - 25; // Position from top

    const textX = (width - textW) / 2;
    const textY = qrY - textSize - padding; // Position below QR

    // 8. Draw the QR code image
    page.drawImage(qrImage, {
      x: qrX,
      y: qrY,
      width: qrSize,
      height: qrSize,
    });

    // 9. Draw the text ID
    page.drawText(uniqueId, {
      x: textX,
      y: textY,
      size: textSize,
      font: helv,
      color: rgb(0, 0, 0),
    });

    // 10. Save and return the PDF (with dynamic filename)
    const bytes = await pdf.save();
    return new Response(bytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="qr_label_${uniqueId}.pdf"`,
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
      }
    });
  } catch (err) {
    return new Response(`Failed to generate PDF: ${err.message}`, {
      status: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
      }
    });
  }
}

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import * as qrcode from "qrcode";

/* ---------- Corrected QR Code Handler ---------- */
export async function onRequest(context) {
  try {
    // FIX 1: Use "uniqueid" to match your URL parameter
    const url = new URL(context.request.url);
    const uniqueId = url.searchParams.get("uniqueid") || "MISSING-ID";

    // FIX 2: Generate a Buffer instead of a DataURL
    // This bypasses any need for a <canvas> element
    const qrBuffer = await qrcode.toBuffer(uniqueId, { 
        margin: 1,
        type: 'png' // Explicitly ask for PNG data
    });

    // 3. Create a small PDF document
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([200, 250]); // 200x250 points
    const { width, height } = page.getSize();
    const helv = await pdf.embedFont(StandardFonts.Helvetica);

    // 4. Embed the QR code PNG Buffer
    const qrImage = await pdf.embedPng(qrBuffer);
    
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

    // 10. Save and return the PDF
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
    // This will now pass the error message from qrcode/pdf-lib
    return new Response(`Failed to generate PDF: ${err.message}`, {
      status: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
      }
    });
  }
}

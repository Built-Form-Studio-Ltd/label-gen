import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";

export async function onRequest(context) {
  try {
    const { request } = context;
    const url = new URL(request.url);
    const id = decodeURIComponent(url.searchParams.get("id") || "").trim();

    if (!id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing 'id' query parameter. Example: ?id=JF0140-1300140-18-09-2025",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Generate QR code
    let qrDataUrl, qrBase64, qrBytes;
    try {
      qrDataUrl = await QRCode.toDataURL(id, { margin: 1, scale: 10 });
      qrBase64 = qrDataUrl.split(",")[1];
      qrBytes = Uint8Array.from(atob(qrBase64), (c) => c.charCodeAt(0));
    } catch (err) {
      console.error("QR generation failed:", err);
      return new Response(
        JSON.stringify({
          success: false,
          error: "QR code generation failed",
          details: err.message,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Create PDF
    let pdfBytes;
    try {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([250, 250]);
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const qrImage = await pdfDoc.embedPng(qrBytes);

      const qrDims = 150;
      const { width, height } = page.getSize();

      page.drawImage(qrImage, {
        x: (width - qrDims) / 2,
        y: (height - qrDims) / 2 + 20,
        width: qrDims,
        height: qrDims,
      });

      const textWidth = font.widthOfTextAtSize(id, 10);
      page.drawText(id, {
        x: (width - textWidth) / 2,
        y: 30,
        size: 10,
        font,
        color: rgb(0, 0, 0),
      });

      pdfBytes = await pdfDoc.save();
    } catch (err) {
      console.error("PDF creation failed:", err);
      return new Response(
        JSON.stringify({
          success: false,
          error: "PDF generation failed",
          details: err.message,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${id}.pdf"`,
      },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Unexpected server error",
        details: err.message,
        stack: err.stack,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const pathParts = url.pathname.split("/");
      const id = decodeURIComponent(pathParts.pop() || pathParts.pop()); // Handles trailing slash

      if (!id || id.trim() === "") {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Missing or invalid ID in URL path. Expected format: /download/<ID>",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

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
            error: "Failed to generate QR code",
            details: err.message,
          }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }

      let pdfBytes;
      try {
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([250, 250]);
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const qrImage = await pdfDoc.embedPng(qrBytes);

        // Draw QR image
        const qrDims = 150;
        const { width, height } = page.getSize();
        page.drawImage(qrImage, {
          x: (width - qrDims) / 2,
          y: (height - qrDims) / 2 + 20,
          width: qrDims,
          height: qrDims,
        });

        // Draw ID text
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
            error: "Failed to create PDF",
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
  },
};

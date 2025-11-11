import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import bwipjs from "bwip-js/browser";

export async function onRequestGet(context) {
  try {
    const { request } = context;
    const { searchParams } = new URL(request.url);
    const fnsku = searchParams.get("fnsku") || "X000000000";
    const sku = searchParams.get("sku") || "SKU123";
    const desc = searchParams.get("desc") || "Sample Product";
    const country = searchParams.get("country") || "UK";

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // ✅ Generate a barcode image as a Data URL
    const dataUrl = bwipjs.toDataURL({
      bcid: "code128",
      text: fnsku,
      scale: 3,                // higher = sharper bars
      includetext: false,
      backgroundcolor: "FFFFFF",
      padding: 0,
    });

    // Convert Data URL to bytes and embed
    const pngBytes = Uint8Array.from(atob(dataUrl.split(",")[1]), c => c.charCodeAt(0));
    const barcodeImg = await pdfDoc.embedPng(pngBytes);

    // --- simple placement example ---
    const labelW = 595.28, labelH = 100;
    const barcodeW = 400, barcodeH = 80;
    const x = (labelW - barcodeW) / 2;
    const y = 700;

    page.drawImage(barcodeImg, { x, y, width: barcodeW, height: barcodeH });
    page.drawText(fnsku, { x, y: y - 20, size: 12, font: bold, color: rgb(0, 0, 0) });

    const pdfBytes = await pdfDoc.save();
    return new Response(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="label_${fnsku}.pdf"`,
      },
    });
  } catch (err) {
    return new Response(`Failed to generate PDF: ${err.message}`, { status: 500 });
  }
}

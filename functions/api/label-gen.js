import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import bwipjs from "bwip-js/browser";

// Utility: convert Canvas to Uint8Array PNG bytes
async function canvasToPngBytes(canvas) {
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  return new Uint8Array(await blob.arrayBuffer());
}

export async function onRequestGet(context) {
  try {
    const { request } = context;
    const { searchParams } = new URL(request.url);
    const fnsku = searchParams.get("fnsku") || "X000000000";
    const sku = searchParams.get("sku") || "SKU123";
    const desc = searchParams.get("desc") || "Sample Product";
    const country = searchParams.get("country") || "UK";

    // --- Generate barcode on an offscreen canvas ---
    const canvas = new OffscreenCanvas(200, 200);
    const ctx = canvas.getContext("2d");

    bwipjs.toCanvas(ctx, {
      bcid: "code128",     // barcode type
      text: fnsku,
      scale: 3,            // sharpness (increase if small labels)
      includetext: false,
      backgroundcolor: "FFFFFF",
    });

    const barcodeBytes = await canvasToPngBytes(canvas);

    // --- Build PDF ---
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const barcodeImg = await pdfDoc.embedPng(barcodeBytes);
    const barcodeW = 250;
    const barcodeH = 60;
    const x = (595.28 - barcodeW) / 2;
    const y = 700;

    page.drawImage(barcodeImg, { x, y, width: barcodeW, height: barcodeH });
    page.drawText(fnsku, { x, y: y - 20, size: 12, font: bold, color: rgb(0, 0, 0) });
    page.drawText(sku, { x, y: y - 35, size: 10, font, color: rgb(0, 0, 0) });
    page.drawText(desc, { x, y: y - 50, size: 8, font, color: rgb(0, 0, 0) });
    page.drawText(country, { x, y: y - 65, size: 8, font: bold, color: rgb(0, 0, 0) });

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

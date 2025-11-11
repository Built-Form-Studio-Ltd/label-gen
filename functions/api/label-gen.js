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

    // Create new PDF
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4 size
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const cols = 4, rows = 10;
    const marginX = 18, marginY = 18, gapX = 3, gapY = 3;
    const pageW = 595.28, pageH = 841.89;
    const labelW = (pageW - 2 * marginX - (cols - 1) * gapX) / cols;
    const labelH = (pageH - 2 * marginY - (rows - 1) * gapY) / rows;

    // Generate barcode buffer
    const barcodeBuf = await bwipjs.toBuffer({
      bcid: "code128",
      text: fnsku,
      includetext: false,
      backgroundcolor: "FFFFFF",
      scale: 2,
      padding: 0,
    });
    const barcodeImg = await pdfDoc.embedPng(barcodeBuf);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = marginX + c * (labelW + gapX);
        const y = pageH - marginY - (r + 1) * labelH - r * gapY;

        // Draw barcode
        const barcodeW = labelW * 0.9;
        const barcodeH = labelH * 0.4;
        page.drawImage(barcodeImg, {
          x: x + (labelW - barcodeW) / 2,
          y: y + labelH - barcodeH - 6,
          width: barcodeW,
          height: barcodeH,
        });

        let textY = y + labelH - barcodeH - 16;
        page.drawText(fnsku, { x: x + 5, y: textY, size: 9, font, color: rgb(0, 0, 0) });
        textY -= 11;
        page.drawText(sku, { x: x + 5, y: textY, size: 7, font: boldFont });
        textY -= 11;
        page.drawText(desc, { x: x + 5, y: textY, size: 5, font });

        // Bottom row
        page.drawText("NEW", { x: x + 5, y: y + 5, size: 6, font: boldFont });
        const textWidth = boldFont.widthOfTextAtSize(country, 6);
        page.drawText(country, {
          x: x + labelW - textWidth - 5,
          y: y + 5,
          size: 6,
          font: boldFont,
        });
      }
    }

    const pdfBytes = await pdfDoc.save();
    return new Response(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="labels_${fnsku}.pdf"`,
      },
    });
  } catch (err) {
    return new Response(`Failed to generate PDF: ${err.message}`, { status: 500 });
  }
}

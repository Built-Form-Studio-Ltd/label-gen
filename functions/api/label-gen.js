globalThis.__dirname = "/";
import PDFDocument from 'pdfkit/js/pdfkit.browser.es5.js';
import bwipjs from "bwip-js/browser";

/**
 * Helper to concat Uint8Arrays (Buffer.concat)
 */
function concatUint8Arrays(arrays) {
  let totalLength = 0;
  for (const arr of arrays) {
    totalLength += arr.length;
  }
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

/**
 * This is the Cloudflare Pages Function handler
 * It will only respond to GET requests
 */
export async function onRequestGet(context) {
  try {
    // 1. Get query parameters from the request URL
    const { request } = context;
    const { searchParams } = new URL(request.url);
    const fnsku = searchParams.get("fnsku") || "X000000000";
    const sku = searchParams.get("sku") || "SKU123";
    const desc = searchParams.get("desc") || "Sample Product";
    const country = searchParams.get("country") || "UK";

    const doc = new PDFDocument({ size: "A4", margin: 0 });
    const chunks = [];
    doc.on("data", (d) => chunks.push(d));

    // 2. Define page layout
    const cols = 4, rows = 10;
    const pageW = 595.28, pageH = 841.89;
    const marginX = 18, marginY = 18;
    const gapX = 3, gapY = 3;
    const labelW = (pageW - 2 * marginX - (cols - 1) * gapX) / cols;
    const labelH = (pageH - 2 * marginY - (rows - 1) * gapY) / rows;

    // 3. Generate barcode
    const barcode = await bwipjs.toBuffer({
      bcid: "code128",
      text: fnsku,
      includetext: false,
      backgroundcolor: "FFFFFF",
      scale: 2,
      padding: 0,
    });

    // 4. Draw labels
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = marginX + c * (labelW + gapX);
        const y = marginY + r * (labelH + gapY);
        doc.save();
        doc.translate(x, y);

        // --- Barcode ---
        const barcodeW = labelW * 0.90;
        const barcodeH = labelH * 0.40;
        const barcodeX = (labelW - barcodeW) / 2;
        const barcodeY = 6;
        doc.image(barcode, barcodeX, barcodeY, { width: barcodeW, height: barcodeH });

        // --- Text section ---
        let cursorY = barcodeY + barcodeH + 6;
        doc.font("Helvetica").fontSize(9);
        doc.text(fnsku, 0, cursorY, { width: labelW, align: "center" });
        cursorY += 11;
        doc.font("Helvetica-Bold").fontSize(7);
        doc.text(sku, 0, cursorY, { width: labelW, align: "center" });
        cursorY += 11;
        doc.font("Helvetica").fontSize(5);
        doc.text(desc, 5, cursorY, {
          width: barcodeW,
          align: "center",
          lineGap: 1,
        });

        // --- Bottom labels ---
        const bottomY = labelH - 7;
        doc.font("Helvetica-Bold").fontSize(6);
        doc.text("NEW", barcodeX, bottomY, { align: "left" });
        doc.text(country, barcodeX, bottomY, { width: barcodeW , align: "right" });

        doc.restore();
      }
    }

    // 5. Create a Promise to await the PDF stream end
    const pdfPromise = new Promise((resolve, reject) => {
      doc.on("end", () => {
        try {
          const pdfData = concatUint8Arrays(chunks);
          resolve(pdfData);
        } catch (err) {
          reject(err);
        }
      });
      doc.on("error", (err) => reject(err));
    });

    // Finish the PDF document
    doc.end();

    // Wait for the promise to resolve
    const pdfData = await pdfPromise;

    // 6. Return a Cloudflare Response object
    return new Response(pdfData, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="labels_${fnsku}.pdf"`,
      },
    });

  } catch (err) {
    console.error(err);
    return new Response(`Failed to generate PDF: ${err.message}`, { status: 500 });
  }
}

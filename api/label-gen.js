import PDFDocument from "pdfkit";
import bwipjs from "bwip-js";

export default async function handler(req, res) {
  const {
    fnsku = "X000000000",
    sku = "SKU123",
    desc = "Sample Product",
    country = "UK",
  } = req.query;

  const doc = new PDFDocument({ size: "A4", margin: 0 });
  const chunks = [];
  doc.on("data", (d) => chunks.push(d));

  // --- Label grid ---
  const cols = 4, rows = 10;
  const pageW = 595.28, pageH = 841.89;
  const marginX = 18, marginY = 18;
  const gapX = 3, gapY = 3;
  const labelW = (pageW - 2 * marginX - (cols - 1) * gapX) / cols;
  const labelH = (pageH - 2 * marginY - (rows - 1) * gapY) / rows;

  // --- Generate barcode (vector) ---
  const barcode = await bwipjs.toBuffer({
    bcid: "code128",
    text: fnsku,
    includetext: false,
    backgroundcolor: "FFFFFF",
    scale: 2,
    padding: 0,
    parsefn: "pdf",
  });

  // --- Render labels ---
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = marginX + c * (labelW + gapX);
      const y = marginY + r * (labelH + gapY);
      doc.save();
      doc.translate(x, y);

      // Barcode full width
      const barcodeW = labelW * 0.98;
      const barcodeH = labelH * 0.30;
      const barcodeX = (labelW - barcodeW) / 2;
      const barcodeY = 8;
      doc.image(barcode, barcodeX, barcodeY, {
        width: barcodeW,
        height: barcodeH,
      });

      // FNSKU (regular)
      let cursorY = barcodeY + barcodeH + 6;
      doc.font("Helvetica").fontSize(9);
      doc.text(fnsku, 0, cursorY, { width: labelW, align: "center" });
      cursorY += 11;

      // SKU (bold)
      doc.font("Helvetica-Bold").fontSize(8);
      doc.text(sku, 0, cursorY, { width: labelW, align: "center" });
      cursorY += 11;

      // Description (smaller, centered)
      doc.font("Helvetica").fontSize(6);
      doc.text(desc, 4, cursorY, {
        width: labelW - 8,
        align: "center",
        lineGap: 1.2,
      });

      // Bottom NEW + Country
      const bottomY = labelH - 10;
      doc.font("Helvetica-Bold").fontSize(6);
      doc.text("NEW", 5, bottomY, { align: "left" });
      doc.text(country, labelW - 5, bottomY, { align: "right" });

      doc.restore();
    }
  }

  // --- Output PDF ---
  doc.end();
  await new Promise((resolve) => doc.on("end", resolve));
  const pdf = Buffer.concat(chunks);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="labels_${fnsku}.pdf"`
  );
  res.send(pdf);
}

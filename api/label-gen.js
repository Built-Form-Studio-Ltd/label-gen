import PDFDocument from "pdfkit";
import bwipjs from "bwip-js";

export default async function handler(req, res) {
  const { fnsku = "X000000000", sku = "SKU123", desc = "Sample Product", country = "UK" } = req.query;

  const doc = new PDFDocument({ size: "A4", margin: 0 });
  const chunks = [];
  doc.on("data", (d) => chunks.push(d));

  const cols = 4, rows = 10;
  const pageW = 595.28, pageH = 841.89;
  const marginX = 18, marginY = 18;
  const gapX = 3, gapY = 3;
  const labelW = (pageW - 2 * marginX - (cols - 1) * gapX) / cols;
  const labelH = (pageH - 2 * marginY - (rows - 1) * gapY) / rows;

  const barcode = await bwipjs.toBuffer({
    bcid: "code128",
    text: fnsku,
    includetext: false,
    backgroundcolor: "FFFFFF",
    scale: 2,
    padding: 0,
    parsefn: "pdf",
  });

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = marginX + c * (labelW + gapX);
      const y = marginY + r * (labelH + gapY);
      doc.save();
      doc.translate(x, y);

      // --- Barcode (full width, slightly taller) ---
      const barcodeW = labelW * 0.90;
      const barcodeH = labelH * 0.40;
      const barcodeX = (labelW - barcodeW) / 2;
      const barcodeY = 6;
      doc.image(barcode, barcodeX, barcodeY, { width: barcodeW, height: barcodeH });

      // --- Text section ---
      let cursorY = barcodeY + barcodeH + 6;

      // FNSKU (regular)
      doc.font("Helvetica").fontSize(9);
      doc.text(fnsku, 0, cursorY, { width: labelW, align: "center" });
      cursorY += 11;

      // SKU (bold)
      doc.font("Helvetica-Bold").fontSize(7);
      doc.text(sku, 0, cursorY, { width: labelW, align: "center" });
      cursorY += 11;

      // Description (multi-line centered)
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

  doc.end();
  await new Promise((resolve) => doc.on("end", resolve));
  const pdf = Buffer.concat(chunks);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="labels_${fnsku}.pdf"`);
  res.send(pdf);
}

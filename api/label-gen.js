import PDFDocument from "pdfkit";
import bwipjs from "bwip-js";

export default async function handler(req, res) {
  const { fnsku = "X000000000", sku = "SKU123", desc = "Sample Product", country = "UK" } = req.query;

  const doc = new PDFDocument({ size: "A4", margin: 0 });
  const chunks = [];
  doc.on("data", (d) => chunks.push(d));

  // Label grid settings
  const cols = 4, rows = 10;
  const pageW = 595.28, pageH = 841.89; // A4
  const marginX = 20, marginY = 20;
  const gapX = 4, gapY = 4;
  const labelW = (pageW - 2 * marginX - (cols - 1) * gapX) / cols;
  const labelH = (pageH - 2 * marginY - (rows - 1) * gapY) / rows;

  // Barcode generation
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

      // --- Barcode (top, centered) ---
      const barcodeWidth = labelW * 0.8;
      const barcodeX = (labelW - barcodeWidth) / 2;
      doc.image(barcode, barcodeX, 8, { width: barcodeWidth });

      // --- FNSKU ---
      doc.font("Helvetica-Bold").fontSize(9);
      doc.text(fnsku, 0, 38, { width: labelW, align: "center" });

      // --- SKU ---
      doc.font("Helvetica-Bold").fontSize(8);
      doc.text(sku, 0, 50, { width: labelW, align: "center" });

      // --- Description ---
      doc.font("Helvetica").fontSize(6);
      const descTop = 62;
      const descHeight = labelH - descTop - 18;
      doc.text(desc, 5, descTop, {
        width: labelW - 10,
        height: descHeight,
        align: "center",
      });

      // --- Bottom text ---
      doc.font("Helvetica-Bold").fontSize(6);
      const bottomY = labelH - 12;
      doc.text("NEW", 4, bottomY);
      doc.text(country, labelW - 4, bottomY, { align: "right" });

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

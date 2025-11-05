import PDFDocument from "pdfkit";
import bwipjs from "bwip-js";

export default async function handler(req, res) {
  const { fnsku = "X000000000", sku = "SKU123", desc = "Sample Product", country = "UK" } = req.query;

  // Create PDF document
  const doc = new PDFDocument({ size: "A4", margin: 0 });
  const chunks = [];
  doc.on("data", (d) => chunks.push(d));

  const cols = 4, rows = 10;
  const pageW = 595.28, pageH = 841.89; // A4 in points
  const marginX = 20, marginY = 20;
  const gapX = 4, gapY = 4;
  const labelW = (pageW - 2 * marginX - (cols - 1) * gapX) / cols;
  const labelH = (pageH - 2 * marginY - (rows - 1) * gapY) / rows;

  // Generate barcode once (vector PDF)
  const barcode = await bwipjs.toBuffer({
    bcid: "code128",
    text: fnsku,
    includetext: false,
    scale: 2,
    backgroundcolor: "FFFFFF",
    padding: 0,
    parsefn: "pdf",
  });

  // Draw labels
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = marginX + c * (labelW + gapX);
      const y = marginY + r * (labelH + gapY);
      doc.save();
      doc.translate(x, y);

      doc.image(barcode, labelW * 0.1, 6, { width: labelW * 0.8 });
      doc.font("Helvetica-Bold").fontSize(8).text(fnsku, 0, 55, { width: labelW, align: "center" });
      doc.text(sku, 0, 68, { width: labelW, align: "center" });
      doc.fontSize(6).text(desc, 0, 82, { width: labelW, align: "center" });
      doc.text("NEW", 4, labelH - 15);
      doc.text(country, labelW - 4, labelH - 15, { align: "right" });
      doc.rect(0, 0, labelW, labelH).stroke();
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

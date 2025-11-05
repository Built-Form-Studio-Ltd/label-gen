import PDFDocument from "pdfkit";
import bwipjs from "bwip-js";

export default async function handler(req, res) {
  const {
    fnsku = "X000000000",
    sku = "SKU123",
    desc = "Sample Product",
    country = "UK",
  } = req.query;

  // Create PDF document
  const doc = new PDFDocument({ size: "A4", margin: 0 });
  const chunks = [];
  doc.on("data", (d) => chunks.push(d));

  // Grid layout (A4 = 595x842pt)
  const cols = 4, rows = 10;
  const pageW = 595.28, pageH = 841.89;
  const marginX = 18, marginY = 18;
  const gapX = 3, gapY = 3;
  const labelW = (pageW - 2 * marginX - (cols - 1) * gapX) / cols;
  const labelH = (pageH - 2 * marginY - (rows - 1) * gapY) / rows;

  // Generate barcode once (PDF vector)
  const barcode = await bwipjs.toBuffer({
    bcid: "code128",
    text: fnsku,
    includetext: false,
    backgroundcolor: "FFFFFF",
    scale: 2,
    padding: 0,
    parsefn: "pdf",
  });

  // --- Draw labels ---
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = marginX + c * (labelW + gapX);
      const y = marginY + r * (labelH + gapY);
      doc.save();
      doc.translate(x, y);

      // --- Barcode section ---
      const barcodeW = labelW * 0.78; // narrower width for balanced white space
      const barcodeH = labelH * 0.25; // 25% of label height
      const barcodeX = (labelW - barcodeW) / 2;
      const barcodeY = 10;
      doc.image(barcode, barcodeX, barcodeY, {
        width: barcodeW,
        height: barcodeH,
      });

      // --- Text section ---
      let cursorY = barcodeY + barcodeH + 6;

      // FNSKU
      doc.font("Helvetica-Bold").fontSize(9);
      doc.text(fnsku, 0, cursorY, { width: labelW, align: "center" });
      cursorY += 11;

      // SKU
      doc.font("Helvetica-Bold").fontSize(8);
      doc.text(sku, 0, cursorY, { width: labelW, align: "center" });
      cursorY += 11;

      // Description (auto-wrap)
      doc.font("Helvetica").fontSize(6);
      doc.text(desc, 4, cursorY, {
        width: labelW - 8,
        align: "center",
        lineGap: 1.5,
      });

      // Bottom text (NEW + country)
      const bottomY = labelH - 10;
      doc.font("Helvetica-Bold").fontSize(6);
      doc.text("NEW", 5, bottomY);
      doc.text(country, labelW - 5, bottomY, { align: "right" });

      doc.restore();
    }
  }

  // Finalise
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

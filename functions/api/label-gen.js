import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/**
 * Minimal Code 128 (set B) renderer for pdf-lib.
 * - Encodes ASCII 32..126 directly (typical FNSKU/SKU range)
 * - Draws bars by module widths (11 modules per symbol)
 * - StartB=104, Stop=106, checksum per spec
 */

// 107 symbol patterns, each 6 integers (3 bars + 3 spaces) totaling 11 modules.
// From ISO/IEC 15417: patterns for Code 128 (compact table).
const CODE128_PATTERNS = [
  [2,1,2,2,2,2],[2,2,2,1,2,2],[2,2,2,2,2,1],[1,2,1,2,2,3],[1,2,1,3,2,2],
  [1,3,1,2,2,2],[1,2,2,2,1,3],[1,2,2,3,1,2],[1,3,2,2,1,2],[2,2,1,2,1,3],
  [2,2,1,3,1,2],[2,3,1,2,1,2],[1,1,2,2,3,2],[1,2,2,1,3,2],[1,2,2,2,3,1],
  [1,1,3,2,2,2],[1,2,3,1,2,2],[1,2,3,2,2,1],[2,2,3,2,1,1],[2,2,1,1,3,2],
  [2,2,1,2,3,1],[2,1,3,2,1,2],[2,2,3,1,1,2],[3,1,2,1,3,1],[3,1,1,2,2,2],
  [3,2,1,1,2,2],[3,2,1,2,2,1],[3,1,2,2,1,2],[3,2,2,1,1,2],[3,2,2,2,1,1],
  [2,1,2,1,2,3],[2,1,2,3,2,1],[2,3,2,1,2,1],[1,1,1,3,2,3],[1,3,1,1,2,3],
  [1,3,1,3,2,1],[1,1,2,3,1,3],[1,3,2,1,1,3],[1,3,2,3,1,1],[2,1,1,3,1,3],
  [2,3,1,1,1,3],[2,3,1,3,1,1],[1,1,2,1,3,3],[1,1,2,3,3,1],[1,3,2,1,3,1],
  [1,1,3,1,2,3],[1,1,3,3,2,1],[1,3,3,1,2,1],[3,1,3,1,2,1],[2,1,1,3,3,1],
  [2,3,1,1,3,1],[2,1,3,1,1,3],[2,1,3,3,1,1],[2,1,3,1,3,1],[3,1,1,1,2,3],
  [3,1,1,3,2,1],[3,3,1,1,2,1],[3,1,2,1,1,3],[3,1,2,3,1,1],[3,3,2,1,1,1],
  [3,1,4,1,1,1],[2,2,1,4,1,1],[4,3,1,1,1,1],[1,1,1,2,2,4],[1,1,1,4,2,2],
  [1,2,1,1,2,4],[1,2,1,4,2,1],[1,4,1,1,2,2],[1,4,1,2,2,1],[1,1,2,2,1,4],
  [1,1,2,4,1,2],[1,2,2,1,1,4],[1,2,2,4,1,1],[1,4,2,1,1,2],[1,4,2,2,1,1],
  [2,4,1,2,1,1],[2,2,1,1,1,4],[2,2,1,4,1,1],[2,1,1,2,1,4],[2,1,1,4,1,2],
  [2,1,1,4,1,2],[1,1,1,2,4,2],[1,2,1,1,4,2],[1,2,1,2,4,1],[1,1,4,2,1,2],
  [1,2,4,1,1,2],[1,2,4,2,1,1],[4,1,1,2,1,2],[4,2,1,1,1,2],[4,2,1,2,1,1],
  [2,1,2,1,4,1],[2,1,4,1,2,1],[4,1,2,1,2,1],[1,1,1,1,4,3],[1,1,1,3,4,1],
  [1,3,1,1,4,1],[1,1,4,1,1,3],[1,1,4,3,1,1],[4,1,1,1,1,3],[4,1,1,3,1,1],
  [1,1,3,1,4,1],[1,1,4,1,3,1],[3,1,1,1,4,1],[4,1,1,1,3,1],[2,1,1,4,2,1],
  [2,1,2,1,1,4],[2,1,2,4,1,1],[2,4,1,1,2,1],[4,1,2,1,1,2],[1,3,4,1,1,1],
  [1,1,1,2,2,2] // STOP (106) special will be handled with 13-module terminator drawn below
];

// Encodes text in Code 128 set B. Returns array of symbol indices.
function encodeCode128B(text) {
  // StartB = 104
  const codes = [104];
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code < 32 || code > 126) {
      throw new Error(`Unsupported char '${ch}' for Code128-B`);
    }
    codes.push(code - 32);
  }
  // checksum: (start + sum(code * pos)) % 103
  let checksum = codes[0];
  for (let i = 1; i < codes.length; i++) checksum += codes[i] * i;
  checksum = checksum % 103;
  codes.push(checksum);
  // stop = 106
  codes.push(106);
  return codes;
}

// Draws the encoded sequence at (x,y) with given module width and bar height.
function drawCode128OnPage(page, x, y, text, moduleW, barH, color = rgb(0,0,0)) {
  const codes = encodeCode128B(text);
  let cursor = x;

  for (let i = 0; i < codes.length; i++) {
    const sym = codes[i];
    if (sym === 106) {
      // STOP pattern: 2-3-3-1-1-1-2 (13 modules: 4 bars & 3 spaces; last 2 modules are bars)
      const stop = [2,3,3,1,1,1,2];
      let isBar = true;
      for (const w of stop) {
        const width = w * moduleW;
        if (isBar) {
          page.drawRectangle({ x: cursor, y, width, height: barH, color });
        }
        cursor += width;
        isBar = !isBar;
      }
      break;
    }
    const patt = CODE128_PATTERNS[sym];
    let isBar = true;
    for (const w of patt) {
      const width = w * moduleW;
      if (isBar) {
        page.drawRectangle({ x: cursor, y, width, height: barH, color });
      }
      cursor += width;
      isBar = !isBar;
    }
  }
  // Optional quiet zone (10 modules recommended) – already implicit if you pad before/after.
  return cursor - x;
}

export async function onRequestGet(context) {
  try {
    const { request } = context;
    const { searchParams } = new URL(request.url);

    const fnsku  = searchParams.get("fnsku")  || "X000000000";
    const sku    = searchParams.get("sku")    || "SKU123";
    const desc   = searchParams.get("desc")   || "Sample Product";
    const country= searchParams.get("country")|| "UK";

    // Build PDF
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595.28, 841.89]); // A4
    const helv = await pdf.embedFont(StandardFonts.Helvetica);
    const helvB= await pdf.embedFont(StandardFonts.HelveticaBold);

    // --- Example placement (single label demo). Scale up or use your 4x10 grid math. ---
    const labelW = 400;
    const barcodeY = 650;

    // Choose module width so overall barcode fits comfortably.
    // Code128 needs ~ (text length + 3 symbols) * 11 modules + stop (13 mods).
    const estSymbols = fnsku.length + 3; // start+checksum+stop approx
    const estModules = estSymbols * 11 + 13;
    const targetBarcodeWidth = 300;                // px on PDF
    const moduleW = Math.max(0.6, targetBarcodeWidth / estModules); // >=0.6 for print clarity
    const barH = 60;

    const leftX = (595.28 - targetBarcodeWidth) / 2;

    // Draw barcode bars
    drawCode128OnPage(page, leftX, barcodeY, fnsku, moduleW, barH);

    // Human-readable text & fields
    page.drawText(fnsku, { x: leftX, y: barcodeY - 16, size: 12, font: helvB, color: rgb(0,0,0) });
    page.drawText(sku,   { x: leftX, y: barcodeY - 32, size: 10, font: helv,  color: rgb(0,0,0) });
    page.drawText(desc,  { x: leftX, y: barcodeY - 48, size: 9,  font: helv,  color: rgb(0,0,0), maxWidth: 300 });
    page.drawText(country,{x: leftX, y: barcodeY - 64, size: 9,  font: helvB, color: rgb(0,0,0) });

    // DONE
    const bytes = await pdf.save();
    return new Response(bytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="label_${fnsku}.pdf"`,
      },
    });
  } catch (err) {
    return new Response(`Failed to generate PDF: ${err.message}`, { status: 500 });
  }
}

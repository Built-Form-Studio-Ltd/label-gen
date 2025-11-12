import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/* ---------------- Code 128 (Set B) renderer — edge safe (no fs/canvas) ---------------- */

// ... [CODE128_PATTERNS constant - no changes] ...
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
  [1,1,1,2,2,2] // index 106=STOP handled specially below
];

function encodeCode128B(text) {
  // ... [encodeCode128B function - no changes] ...
  const codes = [104];
  for (const ch of text) {
    const cc = ch.charCodeAt(0);
    if (cc < 32 || cc > 126) throw new Error(`Unsupported char: ${ch}`);
    codes.push(cc - 32);
  }
  let sum = codes[0];
  for (let i = 1; i < codes.length; i++) sum += codes[i] * i;
  codes.push(sum % 103, 106);
  return codes;
}

// =================================================================
// --- FIXED: drawCode128 now returns its final width ---
// =================================================================
function drawCode128(page, x, y, text, moduleW, barH, color = rgb(0, 0, 0)) {
  const codes = encodeCode128B(text);
  let cursor = x;
  for (const code of codes) {
    if (code === 106) {
      const stop = [2,3,3,1,1,1,2];
      let bar = true;
      for (const w of stop) {
        const width = w * moduleW;
        if (bar) page.drawRectangle({ x: cursor, y, width, height: barH, color });
        cursor += width; bar = !bar;
      }
      break;
    }
    const patt = CODE128_PATTERNS[code];
    let bar = true;
    for (const w of patt) {
      const width = w * moduleW;
      if (bar) page.drawRectangle({ x: cursor, y, width, height: barH, color });
      cursor += width; bar = !bar;
    }
  }
  return cursor; // Return the final X position (the right edge)
}

/* ---------- POST + GET Handler ---------- */
export async function onRequest(context) {
  try {
    const { request } = context;
    let params = new URLSearchParams();

    // ... [Parameter parsing - no changes] ...
    if (request.method === "POST") {
      const contentType = request.headers.get("content-type") || "";
      if (contentType.includes("application/x-www-form-urlencoded")) {
        const text = await request.text();
        params = new URLSearchParams(text);
      } else {
        const formData = await request.formData();
        for (const [k, v] of formData.entries()) params.set(k, v);
      }
    } else {
      params = new URL(request.url).searchParams;
    }

    // --- Collect values ---
    const fnsku   = params.get("fnsku")   || "X000000000";
    const sku     = params.get("sku")     || "SKU123";
    const desc    = params.get("desc")    || "Sample Product";
    const country = params.get("country") || "UK";

    console.log({ fnsku, sku, desc, country });

    // --- Create PDF ---
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595.28, 841.89]);
    const helv  = await pdf.embedFont(StandardFonts.Helvetica);
    const helvB = await pdf.embedFont(StandardFonts.HelveticaBold);

    // ... [Label grid setup - no changes] ...
    const cols = 4, rows = 10;
    const pageW = 595.28, pageH = 841.89;
    const marginX = 18, marginY = 18;
    const gapX = 3, gapY = 3;
    const labelW = (pageW - 2 * marginX - (cols - 1) * gapX) / cols;
    const labelH = (pageH - 2 * marginY - (rows - 1) * gapY) / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = marginX + c * (labelW + gapX);
        const y = pageH - marginY - (r + 1) * labelH - r * gapY;

        // --- Barcode Drawing ---
        const barcodeTargetW = labelW * 0.95; // This is the *target* width
        const barcodeH = labelH * 0.4;
        const barcodeX = x + (labelW - barcodeTargetW) / 2;
        const barcodeY = y + labelH - barcodeH - 10;

        const estModules = (fnsku.length + 3) * 11 + 13;
        const estModuleW = barcodeTargetW / estModules;
        const moduleW = Math.max(0.7, estModuleW);

        // =================================================================
        // --- FIXED: Capture the *actual* rendered width of the barcode ---
        // =================================================================
        const barcodeRightEdge = drawCode128(page, barcodeX, barcodeY, fnsku, moduleW, barcodeH);
        const actualBarcodeW = barcodeRightEdge - barcodeX;

        // --- FNSKU ---
        let textY = barcodeY - 8;
        const fnskuSize = 6;
        const fnskuW = helv.widthOfTextAtSize(fnsku, fnskuSize);
        page.drawText(fnsku, {
          x: x + (labelW - fnskuW) / 2,
          y: textY,
          size: fnskuSize,
          font: helv
        });

        // --- SKU ---
        textY -= 8;
        const skuSize = 5.5;
        const skuW = helvB.widthOfTextAtSize(sku, skuSize);
        page.drawText(sku, {
          x: x + (labelW - skuW) / 2,
          y: textY,
          size: skuSize,
          font: helvB
        });

        // --- DESCRIPTION (auto-fit + CENTERING) ---
        textY -= 5;
        
        const safeBottom = y + 8;
        const availableHeight = textY - safeBottom;
        
        // =================================================================
        // --- FIXED: Use the *actual* barcode width for the text box ---
        // =================================================================
        const descBoxW = actualBarcodeW;
        // const descX = barcodeX; // We still use barcodeX as the left-anchor
        
        const minFont = 3.0;
        const maxFont = 4.0;
        let descSize = maxFont;
        let descLines = [];
        
        function makeLines(size) {
          // Pass the *exact* width to the wrapper
          return wrapText(desc.trim(), descBoxW, helv, size);
        }

        // --- Font-fitting loop (no changes, but now more accurate) ---
        for (let s = maxFont; s >= minFont; s -= 0.2) {
          descSize = s;
          descLines = makeLines(descSize);

          const totalHeight = descLines.length * (descSize + 1.0);
          if (totalHeight > availableHeight) {
            continue;
          }

          let widest = 0;
          for (const line of descLines) {
            widest = Math.max(widest, helv.widthOfTextAtSize(line, descSize));
          }
          if (widest > descBoxW) {
            continue;
          }
          break;
        }
        
        // =================================================================
        // --- FIXED: Draw all description lines CENTERED ---
        // =================================================================
        let drawY = textY;
        for (const line of descLines) {
          const actualWidth = helv.widthOfTextAtSize(line, descSize);
          // Center *this line* relative to the barcode
          const centeredX = barcodeX + (actualBarcodeW - actualWidth) / 2;
          
          page.drawText(line, {
            x: centeredX,
            y: drawY,
            size: descSize,
            font: helv,
          });
          drawY -= descSize + 1.0;
        }

        // =================================================================
        // --- FIXED: Fallback logic is also centered ---
        // =================================================================
        if (!descLines.length && desc.trim().length > 0) {
          const fallback = desc.slice(0, 40);
          const fallbackWidth = helv.widthOfTextAtSize(fallback, minFont);
          const centeredX = barcodeX + (actualBarcodeW - fallbackWidth) / 2;
          page.drawText(fallback, {
            x: centeredX,
            y: textY,
            size: minFont,
            font: helv,
          });
        }
        
        // --- NEW + COUNTRY ---
        const bottomY = y + 5;
        // "NEW" is aligned to the left of the *label*
        page.drawText("NEW", { x: x + 5, y: bottomY, size: 4, font: helvB });
        const countryW = helvB.widthOfTextAtSize(country, 4);
        
        // =================================================================
        // --- FIXED: Country is aligned to the right of the *label* ---
        // =================================================================
        page.drawText(country, {
          x: x + labelW - countryW - 5, // Use labelW, not barcodeW
          y: bottomY,
          size: 4,
          font: helvB
        });
      }
    }      

    const bytes = await pdf.save();
    return new Response(bytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="labels_${fnsku}.pdf"`,
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
      }
    });
  } catch (err) {
    // ... [Error handling - no changes] ...
    return new Response(`Failed to generate PDF: ${err.message}`, {
      status: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
      }
    });
  }
}

// =================================================================
// --- Corrected wrapText function (no changes from last time) ---
// =================================================================
function wrapText(text, maxWidth, font, fontSize) {
  const words = text.trim().split(/\s+/);
  const lines = [];
  let lineWords = [];

  for (const word of words) {
    lineWords.push(word);
    const testLine = lineWords.join(' ');
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);

    if (testWidth > maxWidth && lineWords.length > 1) {
      const lastWord = lineWords.pop();
      lines.push(lineWords.join(' '));
      lineWords = [lastWord];
    }
  }

  if (lineWords.length > 0) {
    lines.push(lineWords.join(' '));
  }

  return lines;
}

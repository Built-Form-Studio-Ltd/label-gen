import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/* ---------------- Code 128 (Set B) renderer — edge safe (no fs/canvas) ---------------- */

// 107 symbol patterns: 6 integers (3 bars + 3 spaces) totalling 11 modules per symbol.
// Based on ISO/IEC 15417. DO NOT EDIT.
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
}

/* ---------- POST + GET Handler ---------- */
export async function onRequest(context) {
  try {
    const { request } = context;
    let params = new URLSearchParams();

    // --- Robust parameter parsing (covers GET, POST, URL-encoded, multipart) ---
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

    // --- TEMP diagnostic: log params so you can see what Cloudflare received ---
    console.log({ fnsku, sku, desc, country });

    // --- Create PDF ---
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595.28, 841.89]);
    const helv  = await pdf.embedFont(StandardFonts.Helvetica);
    const helvB = await pdf.embedFont(StandardFonts.HelveticaBold);

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

        const barcodeW = labelW * 0.95;
        const barcodeH = labelH * 0.4;
        const barcodeX = x + (labelW - barcodeW) / 2;
        const barcodeY = y + labelH - barcodeH - 10;

        const estModules = (fnsku.length + 3) * 11 + 13;
        const moduleW = Math.max(0.7, barcodeW / estModules);
        drawCode128(page, barcodeX, barcodeY, fnsku, moduleW, barcodeH);

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

// --- DESCRIPTION (auto-fit + always centered) ---
        textY -= 5; // position below SKU
        
        const safeBottom = y + 8; // space for NEW + country
        const availableHeight = textY - safeBottom;
        
        // Restrict width to barcode area
        const descBoxW = barcodeW;
        const descX = barcodeX; // Barcode's left edge
        
        // Font size range
        const minFont = 3.5;
        const maxFont = 4.5;
        let descSize = maxFont;
        let descLines = [];
        
        function makeLines(size) {
          // Use the (now fixed) wrapText function
          return wrapText(desc.trim(), descBoxW, helv, size);
        }

        // --- NEW FONT-FITTING LOOP ---
        // Start from maxFont and shrink until it fits *both* width and height
        for (let s = maxFont; s >= minFont; s -= 0.1) {
          descSize = s;
          descLines = makeLines(descSize);

          // Check 1: Does it fit height?
          const totalHeight = descLines.length * (descSize + 1.0);
          if (totalHeight > availableHeight) {
            continue; // Too tall, try smaller font
          }

          // Check 2: Does it fit width?
          let widest = 0;
          for (const line of descLines) {
            widest = Math.max(widest, helv.widthOfTextAtSize(line, descSize));
          }
          if (widest > descBoxW) {
            continue; // Too wide, try smaller font
          }

          // If we get here, it fits both.
          break;
        }
        // --- END NEW FONT-FITTING LOOP ---
        // At this point, descLines and descSize are the best-fit
        
        // Draw ALL lines centered
        let drawY = textY;
        for (const line of descLines) {
          const actualWidth = helv.widthOfTextAtSize(line, descSize);
          const centeredX = descX + (barcodeW - actualWidth) / 2;
          
          page.drawText(line, {
            x: centeredX,
            y: drawY,
            size: descSize,
            font: helv,
          });
          drawY -= descSize + 1.0;
        }
        
        // Fallback for edge cases (this is now redundant but safe to keep)
        if (!descLines.length) {
          const fallback = desc.slice(0, 40);
          const fallbackWidth = helv.widthOfTextAtSize(fallback, minFont);
          const centeredX = descX + (barcodeW - fallbackWidth) / 2;
          page.drawText(fallback, {
            x: centeredX,
            y: safeBottom + 10,
            size: minFont,
            font: helv,
          });
        }
        // --- NEW + COUNTRY ---
        const bottomY = y + 5;
        page.drawText("NEW", { x: x + 5, y: bottomY, size: 4, font: helvB });
        const countryW = helvB.widthOfTextAtSize(country, 4);
        page.drawText(country, {
          x: x + barcodeW - countryW - 5,
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
    return new Response(`Failed to generate PDF: ${err.message}`, {
      status: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
      }
    });
  }
}

/* ---------- Word wrap helper ---------- */
function wrapText(text, maxWidth, font, fontSize) {
  const words = text.split(' ');
  const lines = [];
  let line = '';

  for (const word of words) {
    // Add a space if the line is not empty
    const testLine = line + (line ? ' ' : '') + word;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);

    if (testWidth > maxWidth) {
      if (line) {
        // The new word doesn't fit, so push the line *without* the new word
        lines.push(line);
      }
      // Start the new line with the current word
      line = word;

      // Now, check if this single word *itself* is too long
      const wordWidth = font.widthOfTextAtSize(word, fontSize);
      if (wordWidth > maxWidth) {
        // This word is too long. Push it to its own line
        // (the outer font-shrinking loop will handle shrinking it)
        lines.push(line);
        line = ''; // Clear the line so it doesn't get pushed again
      }
    } else {
      // The word fits, so add it to the current line
      line = testLine;
    }
  }

  // Push any remaining text (the last line)
  if (line) {
    lines.push(line);
  }
  return lines;
}

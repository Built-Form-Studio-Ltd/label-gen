import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import qrcode from "qrcode-generator"; // works in Cloudflare — no canvas

export async function onRequest(context) {
  try {
    const { request } = context;
    const url = new URL(request.url);
    const id = decodeURIComponent(url.searchParams.get("id") || "").trim();

    if (!id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing 'id' query parameter. Example: ?id=JF0140-1300140-18-09-2025",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    let pdfBytes;
    try {
      // ==========================================================
      // ✅ Generate QR code data (no canvas required)
      // ==========================================================
      const qr = qrcode(0, "M");
      qr.addData(id);
      qr.make();

      const moduleCount = qr.getModuleCount();
      const moduleSize = 4; // px per square
      const size = moduleCount * moduleSize;

      // Create a 1-bit (black/white) PNG buffer manually
      const qrCanvas = new Uint8ClampedArray(size * size * 4);
      for (let row = 0; row < moduleCount; row++) {
        for (let col = 0; col < moduleCount; col++) {
          const isDark = qr.isDark(row, col);
          const color = isDark ? 0 : 255;
          const idx = (row * size + col) * 4;
          qrCanvas[idx] = qrCanvas[idx + 1] = qrCanvas[idx + 2] = color;
          qrCanvas[idx + 3] = 255;
        }
      }

      // Convert RGBA array to PNG buffer using pdf-lib's embedPng
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([250, 250]);
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

      // Embed the raw PNG image
      const qrImage = await pdfDoc.embedPng(
        await encodeToPNG(qrCanvas, size, size)
      );

      const qrDims = 150;
      const { width, height } = page.getSize();
      page.drawImage(qrImage, {
        x: (width - qrDims) / 2,
        y: (height - qrDims) / 2 + 20,
        width: qrDims,
        height: qrDims,
      });

      // Draw the ID text below the QR
      const textWidth = font.widthOfTextAtSize(id, 10);
      page.drawText(id, {
        x: (width - textWidth) / 2,
        y: 30,
        size: 10,
        font,
        color: rgb(0, 0, 0),
      });

      pdfBytes = await pdfDoc.save();
    } catch (err) {
      console.error("QR or PDF generation failed:", err);
      return new Response(
        JSON.stringify({
          success: false,
          error: "QR or PDF generation failed",
          details: err.message,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Return the finished PDF
    return new Response(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${id}.pdf"`,
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,OPTIONS",
      },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Unexpected server error",
        details: err.message,
        stack: err.stack,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

/* -------------------------------------------------------------------
   Helper: Encode raw RGBA buffer → PNG
   -------------------------------------------------------------------
   This creates a small valid PNG using only typed arrays.
   It’s self-contained and Cloudflare-compatible.
------------------------------------------------------------------- */
async function encodeToPNG(rgbaArray, width, height) {
  // Use offscreen encoding through PDFLib PNG embedding workaround
  // Simply wrap the data in a PNG structure.
  // pdf-lib supports embedding uncompressed 8-bit RGBA streams as PNGs
  const pngChunks = [
    // PNG signature
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
  ];
  const crc32 = (buf) => {
    const table = new Uint32Array(256).map((_, i) => {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      return c >>> 0;
    });
    let crc = 0xffffffff;
    for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  };

  const writeChunk = (type, data) => {
    const typeBytes = new TextEncoder().encode(type);
    const len = new Uint8Array([
      (data.length >>> 24) & 0xff,
      (data.length >>> 16) & 0xff,
      (data.length >>> 8) & 0xff,
      data.length & 0xff,
    ]);
    const chunk = new Uint8Array(len.length + typeBytes.length + data.length + 4);
    chunk.set(len);
    chunk.set(typeBytes, len.length);
    chunk.set(data, len.length + typeBytes.length);
    const crc = crc32(new Uint8Array([...typeBytes, ...data]));
    const view = new DataView(chunk.buffer);
    view.setUint32(chunk.length - 4, crc);
    pngChunks.push(chunk);
  };

  // IHDR
  const ihdr = new DataView(new ArrayBuffer(13));
  ihdr.setUint32(0, width);
  ihdr.setUint32(4, height);
  ihdr.setUint8(8, 8); // bit depth
  ihdr.setUint8(9, 6); // color type (RGBA)
  ihdr.setUint8(10, 0);
  ihdr.setUint8(11, 0);
  ihdr.setUint8(12, 0);
  writeChunk("IHDR", new Uint8Array(ihdr.buffer));

  // IDAT (raw deflate-compressed pixels — simplified)
  const raw = new Uint8Array((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter byte
    raw.set(
      rgbaArray.subarray(y * width * 4, (y + 1) * width * 4),
      y * (width * 4 + 1) + 1
    );
  }
  const cs = new CompressionStream("deflate");
  const writer = cs.writable.getWriter();
  writer.write(raw);
  writer.close();
  const compressed = await new Response(cs.readable).arrayBuffer();
  writeChunk("IDAT", new Uint8Array(compressed));

  // IEND
  writeChunk("IEND", new Uint8Array());
  return new Blob(pngChunks, { type: "image/png" }).arrayBuffer();
}

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import qrcode from "qrcode-generator";

export async function onRequest(context) {
  try {
    const { request } = context;
    const url = new URL(request.url);
    const id = decodeURIComponent(url.searchParams.get("id") || "").trim();

    if (!id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing 'id' query parameter. Example: ?id=JF0140-1300140-18/09/2025",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // --- Generate base QR pattern (no canvas) ---
    const qr = qrcode(0, "M");
    qr.addData(id);
    qr.make();

    const moduleCount = qr.getModuleCount();
    const moduleSize = 10; // block size before upscale
    const smallSize = moduleCount * moduleSize;

    // --- Build RGBA buffer ---
    const small = new Uint8ClampedArray(smallSize * smallSize * 4);
    for (let r = 0; r < moduleCount; r++) {
      for (let c = 0; c < moduleCount; c++) {
        const dark = qr.isDark(r, c);
        const color = dark ? 0 : 255;
        for (let y = 0; y < moduleSize; y++) {
          for (let x = 0; x < moduleSize; x++) {
            const i = ((r * moduleSize + y) * smallSize + (c * moduleSize + x)) * 4;
            small[i] = small[i + 1] = small[i + 2] = color;
            small[i + 3] = 255;
          }
        }
      }
    }

    // --- Upscale QR buffer (so PDF sees a big image) ---
    const scale = 4; // 4× bigger physically
    const bigW = smallSize * scale;
    const bigH = smallSize * scale;
    const big = new Uint8ClampedArray(bigW * bigH * 4);
    for (let y = 0; y < bigH; y++) {
      for (let x = 0; x < bigW; x++) {
        const sx = Math.floor(x / scale);
        const sy = Math.floor(y / scale);
        const si = (sy * smallSize + sx) * 4;
        const di = (y * bigW + x) * 4;
        big[di] = small[si];
        big[di + 1] = small[si + 1];
        big[di + 2] = small[si + 2];
        big[di + 3] = 255;
      }
    }

    // --- Create PDF (same 512×512 sticker page) ---
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([512, 512]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const qrImage = await pdfDoc.embedPng(await encodeToPNG(big, bigW, bigH));

    // --- Centre layout ---
    const qrDisplaySize = 420;
    const { width, height } = page.getSize();
    const qrX = (width - qrDisplaySize) / 2;
    const qrY = (height - qrDisplaySize) / 2 + 25;

    page.drawImage(qrImage, {
      x: qrX,
      y: qrY,
      width: qrDisplaySize,
      height: qrDisplaySize,
    });

    // --- ID text below QR ---
    const textSize = 14;
    const textWidth = font.widthOfTextAtSize(id, textSize);
    page.drawText(id, {
      x: (width - textWidth) / 2,
      y: qrY - 30,
      size: textSize,
      font,
      color: rgb(0, 0, 0),
    });

    const pdfBytes = await pdfDoc.save();
    return new Response(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${id.replaceAll('/', '-')}.pdf"`,
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,OPTIONS",
      },
    });
  } catch (err) {
    console.error("QR PDF generation failed:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: "QR PDF generation failed",
        details: err.message,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

/* --- Same PNG encoder helper as before --- */
async function encodeToPNG(rgbaArray, width, height) {
  const pngChunks = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])];
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
    new DataView(chunk.buffer).setUint32(chunk.length - 4, crc);
    pngChunks.push(chunk);
  };

  const ihdr = new DataView(new ArrayBuffer(13));
  ihdr.setUint32(0, width);
  ihdr.setUint32(4, height);
  ihdr.setUint8(8, 8);
  ihdr.setUint8(9, 6);
  ihdr.setUint8(10, 0);
  ihdr.setUint8(11, 0);
  ihdr.setUint8(12, 0);
  writeChunk("IHDR", new Uint8Array(ihdr.buffer));

  const raw = new Uint8Array((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
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
  writeChunk("IEND", new Uint8Array());
  return new Blob(pngChunks, { type: "image/png" }).arrayBuffer();
}

import bwipjs from 'bwip-js';

// Example usage:
// https://your-vercel-app.vercel.app/api/datamatrix?text=01(06948788184080)17(250101)10(1323003)&gs1=1

export default async function handler(req, res) {
  try {
    const {
      text = '01(06948788184080)17(250101)10(1323003)', // default sample UDI
      scale = 5,     // pixels per module
      padding = 6,   // white border
      format = 'png' // png or svg
    } = req.query;

    const isGS1 = true; // Always GS1-compliant for this endpoint

    const options = {
      bcid: 'datamatrix',
      text,
      scale: parseInt(scale, 10),
      padding: parseInt(padding, 10),
      backgroundcolor: 'FFFFFF',
      includetext: false,
      parse: 'gs1',   // ✅ Required for GS1 / FNC1 encoding
    };

    let output;
    if (format === 'svg') {
      output = await bwipjs.toSVG(options);
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Content-Disposition', `attachment; filename="datamatrix_${Date.now()}.svg"`);
      return res.status(200).send(output);
    } else {
      output = await bwipjs.toBuffer(options);
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Disposition', `attachment; filename="datamatrix_${Date.now()}.png"`);
      return res.status(200).send(output);
    }

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}

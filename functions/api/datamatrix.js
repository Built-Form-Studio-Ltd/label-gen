import bwipjs from 'bwip-js';

// Example usage:
// https://your-vercel-app.vercel.app/api/datamatrix?text=01069738648514741125120117301101101434001

export default async function handler(req, res) {
  try {
    const {
      text = '01069738648514741125120117301101101434001',
      scale = 5,
      padding = 6,
      format = 'png'
    } = req.query;

    const options = {
      bcid: 'gs1datamatrix', // ✅ correct symbology for GS1 UDI
      text,
      scale: parseInt(scale, 10),
      padding: parseInt(padding, 10),
      backgroundcolor: 'FFFFFF',
      includetext: false,
      parse: true, // ✅ must be boolean
    };

    if (format === 'svg') {
      const svg = await bwipjs.toSVG(options);
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Content-Disposition', `attachment; filename="datamatrix_${Date.now()}.svg"`);
      return res.status(200).send(svg);
    }

    const png = await bwipjs.toBuffer(options);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="datamatrix_${Date.now()}.png"`);
    res.status(200).send(png);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}

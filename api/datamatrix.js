import bwipjs from 'bwip-js';

// Example endpoint: https://your-vercel-app.vercel.app/api/datamatrix?text=01069487881840801125060117300501101323003

export default async function handler(req, res) {
  try {
    const { text = '1234567890', gs1 } = req.query;

    const png = await bwipjs.toBuffer({
      bcid: 'datamatrix',     // 2D Data Matrix ECC200
      text: text,
      scale: 5,               // pixels per module
      padding: 6,             // quiet zone
      backgroundcolor: 'FFFFFF',
      includetext: false,
      parse: gs1 ? 'gs1' : undefined, // enable GS1-encoded mode if ?gs1=1
    });

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="datamatrix_${text}.png"`);
    res.status(200).send(png);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}

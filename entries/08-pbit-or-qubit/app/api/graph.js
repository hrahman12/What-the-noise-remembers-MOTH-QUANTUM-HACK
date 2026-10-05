/* Vercel serverless function: the same /api/graph as server.js (POST submits, GET ?job_id= polls). */
'use strict';
const atlas = require('../lib/atlas.js');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      return res.status(200).json(await atlas.submit(body));
    }
    if (req.method === 'GET') return res.status(200).json(await atlas.poll(req.query.job_id));
    return res.status(405).json({ error: 'use GET or POST' });
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message });
  }
};

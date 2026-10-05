/* Vercel serverless function: what the deployment allows. Live runs need ALLOW_LIVE=1 on Vercel. */
'use strict';
const atlas = require('../lib/atlas.js');

module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json(atlas.health());
};

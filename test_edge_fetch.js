const { EdgeRuntime } = require('edge-runtime');
const runtime = new EdgeRuntime();
runtime.evaluate(`
  fetch('http://127.0.0.1:8000/api/stock/AAPL').then(r => r.status).catch(e => e.message)
`).then(console.log);

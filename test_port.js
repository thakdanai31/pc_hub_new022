const net = require('net');
const s = net.createServer();
s.listen(4200, '127.0.0.1', () => {
  console.log('SUCCESS: Port 4200 on 127.0.0.1 works');
  s.close();
});
s.on('error', (e) => {
  console.log('FAIL:', e.code, e.message);
});

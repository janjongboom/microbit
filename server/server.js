var noble = require('noble');
var co = require('co');
var promisify = require('es6-promisify');


// ===== THIS IS THE WEBSOCKET PART!!!!

var connect = require('connect');

connect()
    .use(connect.static(__dirname + '/public'))
    .listen(7001, '0.0.0.0');

var ws = require("nodejs-websocket");
var server = ws.createServer(function(conn) {
  console.log("New connection");
  conn.on("text", function(str) {
    console.log("Received " + str);
    broadcast(str);
  });
  conn.on("close", function(code, reason) {
    console.log("Connection closed");
  });
}).listen(7002, '0.0.0.0');

function broadcast(msg) {
  server.connections.forEach(function(conn) {
    conn.sendText(msg);
  });
}

console.log('Listening on port', 7001, 7002);

// ======= HERE COMES BLE!

noble.on('stateChange', function(state) {
  console.log('stateChange', state);
  if (state === 'poweredOn')
    noble.startScanning([], true); // ['E95D0753251D470AA062FA1922DFA9A8'], true
  else
    noble.stopScanning();
});


noble.on('discover', co.wrap(function*(e) {
  try {
    if ((e.advertisement.localName || '').indexOf('BBC micro:bit (Jan)') !== 0 &&
        (e.advertisement.localName || '').indexOf('Juggler') !== 0 &&
        e.address !== 'ce:39:38:b5:1b:fe') {
      return;
    }

    var address = e.address;
    address = address == 'unknown' ? (Math.random() * 1000 | 0) : address;

    console.log('Found', e.advertisement.localName + '...', address);
    // noble.stopScanning();

    yield promisify(e.connect.bind(e))();
    console.log('Connected');

    var service = (yield promisify(e.discoverServices.bind(e))(['e95d0753251d470aa062fa1922dfa9a8', '1337']))[0];
    // console.log('Service', service);

    if (!service) throw 'Could not find accelerometer service, did you set MICROBIT_BLE_ACCELEROMETER_SERVICE?';

    console.log('Gonna get characteristics');
    // get the characteristic that holds accel data
    var characteristic = (yield promisify(service.discoverCharacteristics.bind(service))(['e95dca4b251d470aa062fa1922dfa9a8']))[0];
    // console.log('Characteristic', characteristic);

    characteristic.on('data', e => {
      var z = e[5] << 8 | e[4];

      if (z > 32767) { // overflow
        z = z - 65535;
      }

      z /= 100;

      broadcast(JSON.stringify({
        deviceId: address,
        type: 'devicemotion',
        timestamp: +new Date(),
        z: z
      }));

      console.log('read', address, z);

      setTimeout(() => {
      // console.log(+new Date(), 'calling read function')
      characteristic.read();
      }, 20);
    });

    characteristic.read();

    // for now we'll just keep reading...

    // yield timeout(20000);

    // yield promisify(e.disconnect.bind(e))();
    // console.log('Disconnected');
  }
  catch (ex) {
    console.error('Oops', ex);
  }
}));

function timeout(ms) {
  return new Promise((res, rej) => {
    setTimeout(res, ms);
  });
}

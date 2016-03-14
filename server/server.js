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
    try {
      conn.sendText(msg);
    }
    catch (ex) {}
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

    var originalE = e;

    yield promisify(e.connect.bind(e))();
    console.log('Connected');

    var service = (yield promisify(e.discoverServices.bind(e))(['e95d0753251d470aa062fa1922dfa9a8', '1337']))[0];
    // console.log('Service', service);

    if (!service) throw 'Could not find accelerometer service, did you set MICROBIT_BLE_ACCELEROMETER_SERVICE?';

    console.log('Gonna get characteristics');
    // get the characteristic that holds accel data
    var characteristic = (yield promisify(service.discoverCharacteristics.bind(service))(['e95dca4b251d470aa062fa1922dfa9a8']))[0];
    // console.log('Characteristic', characteristic);

    var first = true;
    var lastEvent = 0;
    var freefallStart = null;

    var dataTimer;

    characteristic.on('data', e => {
      clearTimeout(dataTimer);
      dataTimer = setTimeout(function() {
        console.log(address, 'Disconnected...');
        originalE.disconnect();
      }, 1000);

      var z = e[5] << 8 | e[4];

      if (z > 32767) { // overflow
        z = z - 65535;
      }

      z /= 100;
      z = Math.abs(z);

      // only stream every 30 ms. otherwise so much stuff
      if (Date.now() - lastEvent > 30) {
        broadcast(JSON.stringify({
          deviceId: address,
          type: 'devicemotion',
          timestamp: +new Date(),
          z: z
        }));
      }

      if (z < 1 && !freefallStart) {
        freefallStart = Date.now();
      }
      if (z > 1 && freefallStart) {
        var t = (Date.now() - freefallStart) / 1000;
        var h = (Math.pow(t, 2) / 8) * 9.81;
        if (h > 0.1) {
          console.log('Freefall...', (h.toFixed(2)) + ' meters (in ' + t.toFixed(2) + 's)');
        }
        freefallStart = null;
      }

      lastEvent = Date.now();

      if (first) {
        console.log('event', address, z);
        first = false;
      }

      setTimeout(function() {
        characteristic.read();
      }, 10);
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

/*
 *  Example node.js EMDR client
 */

var zmq = require('zmq');
var zlib = require('zlib');
var child_process = require('child_process');

var sock = zmq.socket('sub');

var captureWorkers = [];
var nextCaptureWorker = 0;
var maxCaptureWorkers = 3;

var i;

// Create workers
for (i = 0; i < maxCaptureWorkers; i++) {
	captureWorkers[i] = child_process.fork('capture-worker', [i.toString()], {silent: false});
	captureWorkers[i].num = i;
	captureWorkers[i].id = "CW-" + i;

	captureWorkers[i].on('message', function(data) {
		console.log(this.id + " MSG " + data);
	});

	captureWorkers[i].on('error', function(data) {
		console.log(this.id + " ERR " + data);
	});

	captureWorkers[i].on('disconnect', function(data) {
		console.log(this.id + " DSC " + data);
	});

	/*captureWorkers[i].stderr.on('data', function(data) {
		console.log(this.id + " ERR " + data);
	});

	captureWorkers[i].on('close', function(code) {
		console.log(this.id + " EXIT " + code);
	});*/

	console.log("Capture worker " + i + " created", captureWorkers[i].id, "\n");
}

// Disconnect the workers
for (i = captureWorkers.length - 1; i >= 0; i--) {
	if (typeof captureWorkers[i] !== 'undefined' && captureWorkers[i] !== null) {
		//console.log(captureWorkers[i]);
		captureWorkers[i].disconnect();
	} else {
		console.log("Worker " + i + " has disappeared!");
	}
}

//
// process.exit(1);
return;

// Connect to the first publicly available relay.
sock.connect('tcp://relay-us-central-1.eve-emdr.com:8050');
// Disable filtering
sock.subscribe('');

sock.on('message', function(msg){
	// Receive raw market JSON strings.
	zlib.inflate(msg, function(err, market_json) {
		// Un-serialize the JSON data.
		var market_data = JSON.parse(market_json);

		// Do something useful
		console.log(market_data);
	});
});
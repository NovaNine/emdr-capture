process.on('disconnected', function() {
	console.log("Disconnected");
	process.send("Got disconnected, killing myself");
	process.kill();
});

process.on('SIGTERM', function() {
	// do stuff
	console.log("SIGTERM", this.id);
	process.exit();
});
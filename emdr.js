var zmq = require('zmq');
var zlib = require('zlib');
var mysql = require('mysql');
var async = require('async');
var moment = require('moment');

var sock = zmq.socket('sub');

var sde = require('eve-sde-mysql');

var phpstr = require('./phpstring.js');
var polyfills = require('./polyfills.js');
polyfills.apply();

var SDE = {
	types: {},
	regions: {},
	systems: {}
};



var columns = {
	price: 0,
	qty: 1,
	range: 2,
	orderId: 3,
	volEntered: 4,
	minVolume: 5,
	bid: 6,
	issueDate: 7,
	duration: 8,
	stationId: 9,
	systemId: 10
};

var mySqlDateTimeFormat = "YYYY-MM-DD HH:mm:ss";

// Exit handler
process.on('exit', function() {
	console.log("Closing SDE mySQL connection");
	dbSDE.end();
	dbEMDR.end();
});

// Create the mySQl connections
dbSDE = SDE.createConnection(dbInfo.SDE);
dbMarket = mysql.createConnection(dbInfo.Market);

// Connect to the SDE database
dbSDE.connect(function(err) {
	if (err) {
		console.error("Error connection to the SDE DB: " + err.stack);
		return;
	}

	console.log("Connected to the SDE DB (" + dbSDE.threadId + ")");
	onSDEDbConnected();
});



onSDEDbConnected = function() {
	// Pre-load some parts of the SDE to memory
	async.parallel([
		function(callback) {
			sde.loadTypes().then(function() {
				SDE.types = sde.sdeData.types;
			})
		},
		sdeLoadRegions,
		sdeLoadSystems
	], function(err, results) {
		console.log("Async 1 done");

		dbMarket.connect(function(err) {
			if (err) {
				console.error("Error connection to the EMDR DB: " + err.stack);
				return;
			}

			console.log("Connected to the EMDR DB (" + dbMarket.threadId + ")");
			onEMDRDbConnected();
		})
	});
};

onEMDRDbConnected = function() {
	// Start monitoring the EMDR feed
	// Connect to the first publicly available relay.
	console.log("Connecting to EMDR relay " + config.EMDRrelay);
	sock.connect(config.EMDRrelay);
	// Disable filtering
	sock.subscribe('');

	// EMDR Message handler
	sock.on('message', function(msg){
		// Receive raw market JSON strings.
		processEMDRMessage(msg);
	});
}

// Unpacks and parses an EMDR message
processEMDRMessage = function(rawMsg) {
	zlib.inflate(rawMsg, function(err, marketText) {
		// Parse JSON
		marketJson = JSON.parse(marketText);

		if (marketJson.resultType == 'orders') {
			processEMDROrders(marketJson);
		} else {
			processEMDRUnknown(marketJson);
		}
		//console.log(marketJson);
	});
}

// Orders-type EMDR message
processEMDROrders = function(data) {
	//console.log(data.columns);
	data.rowsets.forEach(function(rowset, idx, arr) {
		typeId = rowset.typeID;
		regionId = rowset.regionID;

		console.log("ORDERS " + sdeGetRegionNameById(regionId) + " : " + sdeGetTypeNameById(typeId) + " [" + typeId + "]");
		console.log(data);
		//console.log(rowset.rows);
		//dumpRawRows(rowset);
		//dumpMarketRows(rowset);
		storeOrdersSet(data);
	});

	//console.log(data);
}

// Unknown type EMDR message (just in case)
processEMDRUnknown = function(data) {
	console.log("Unknown EMDR resultType `" + data.resultType+ "`");
}

function sdeLoadRegions(callback) {
	dbSDE.query("SELECT * FROM mapregions", function(err, results, fields) {
		results.forEach(function(row, idx, arr) {
			SDE.regions[row.regionID] = row;
		});

		console.log("Loaded " + results.length + " regions from the SDE");
		callback();
	});
}

function sdeLoadSystems(callback) {
	dbSDE.query("SELECT * FROM mapsolarsystems", function(err, results, fields) {
		results.forEach(function(row, idx, arr) {
			SDE.systems[row.solarSystemID] = row;
		});

		console.log("Loaded " + results.length + " systems from the SDE");
		callback();
	});
}

// Retrieves the name of a type
function sdeGetTypeNameById(id) {
	return SDE.types[id].typeName;
}

function sdeGetRegionNameById(id) {
	return SDE.regions[id].regionName;
}

function sdeGetSystemNameById(id) {
	return SDE.systems[id].solarSystemName;
}

function dumpRawRows(rowset) {
	rowset.rows.forEach(function(row, idx, arr) {
		Object.keys(columns).forEach(function(col, idx, arr) {
			console.log(col + ": " + row[columns[col]]);
		});

		console.log("-----");
	})
}

function dumpMarketRows(rowset) {
	var str = '';
	var rowW = 120;
	var typeName = sdeGetTypeNameById(rowset.typeID);

	str = "╔" + phpstr.str_repeat("═", rowW - 2) + "╗\n";
	str += phpstr.sprintf("║ %-83s │ %30s ║\n", typeName, sdeGetRegionNameById(rowset.regionID));
	str += "╠" + "═".repeat(22) + "╤" + "═".repeat(8) + "╤"+ "═".repeat(15) + "╤" + "═".repeat(17) + "╤" + "═".repeat(52) + "╣\n";

	rowset.rows.forEach(function(row, idx, arr) {
		str += phpstr.sprintf(
			"║ %15s  ISK │  %4s  │ %13s │ %15s │ %50s ║\n",
			phpstr.number_format(row[columns.price], 2, ".", ","),
			(row[columns.bid] ? 'Buy' : 'Sell'),
			phpstr.number_format(row[columns.qty], 0, null, ","),
			sdeGetSystemNameById(row[columns.systemId]),
			row[columns.stationId]
		);
		//console.log(rowset.columns);
	});

	str += "╚" + "═".repeat(22) + "╧" + "═".repeat(8) + "╧"+ "═".repeat(15) + "╧" + "═".repeat(17) + "╧" + "═".repeat(52) + "╝";

	console.log(str);
}

function getColumnValue(colName, row, columns) {
	return row[columns.indexOf(colName)];
}

function storeOrdersSet(data) {
	var flatRows = [];

	data.rowsets.forEach(function(rowset, idx, arr) {
		dbMarket.beginTransaction(function(err) {
			if (err) {
				console.log("Could not begin transaction on EMDR DB");
				return;
			}

			genTime = moment(rowset.generatedAt);
			if (!genTime.isValid()) {
				console.log("Invalid generatedAt: " + rowset.generatedAt);
				dbMarket.rollback(function() {

				});
				return;
			}

			dbMarket.query("\
				INSERT INTO `raw-snapshots` (regionId, typeId, generatedAt, recordedAt)\
					VALUES (?, ?, ?, NOW())\
			", [rowset.regionID, rowset.typeID, genTime.utc().format(mySqlDateTimeFormat)], function(err, results) {
				if (err) {
					console.log("Could not insert new raw snapshot", err);
					return dbMarket.rollback(function() {
						// TODO dump the erroneus data packet
					});
				}

				snapId = results.insertId;

				numRows = rowset.rows.length;
				rowsSql = "INSERT INTO `raw-snapshot-rows` (snapshotId, price, qty, initQty, minQty, systemId, stationId, range, bid, orderId, issueDate, duration) VALUES ?";
				//valuesSql = (new Array(numRows)).fill(marketRowValuesSql).join(", ");

				processedRows = [];
				rowset.rows.forEach(function(row, idx, arr) {
					flatRowVals.push([
						snapId,
						getColumnValue('price', row, data.columns),
						getColumnValue('volRemaining', row, data.columns),
						getColumnValue('volEntered', row, data.columns),
						getColumnValue('minVolume', row, data.columns),
						getColumnValue('solarSystemID', row, data.columns),
						getColumnValue('stationID', row, data.columns),
						getColumnValue('range', row, data.columns),
						getColumnValue('bid', row, data.columns),
						getColumnValue('orderID', row, data.columns),
						getColumnValue('issueDate', row, data.columns),
						getColumnValue('duration', row, data.columns)
					]);
				});

				console.log("Flat: ", flatRowVals);
				dbMarket.query(rowsSql, processedRows, function(err, results) {
					if (err) {
						console.log("Could not insert new rows for snapshot " + snapId, err);
						return dbMarket.rollback(function() {
							// TODO dump the erroneus data packet
						});
					}

					dbMarket.commit();
				});
			});	// End of INSERT
		});
	}); // End of rowsets.forEach
}
//var x = Array.from({length: 10}, () => 5);

// Array.fill polyfill
if (typeof Array.prototype.fill === 'undefined') {
	Array.prototype.fill = function(val) {
		for (var i = 0; i < this.length; i++) {
			this[i] = val;
		}

		return this;
	}
}


x = (new Array(2)).fill("q");

console.log(x);
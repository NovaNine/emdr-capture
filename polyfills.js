module.exports = {
	apply: function() {
		// Array.fill polyfill
		if (typeof Array.prototype.fill === 'undefined') {
			Array.prototype.fill = function(val) {
				for (var i = 0; i < this.length; i++) {
					this[i] = val;
				}

				return this;
			}
		}
	}
};
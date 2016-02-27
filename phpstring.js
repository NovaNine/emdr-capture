PHPString = {
	sprintf: function () {
		//  discuss at: http://phpjs.org/functions/sprintf/
		// original by: Ash Searle (http://hexmen.com/blog/)
		// improved by: Michael White (http://getsprink.com)
		// improved by: Jack
		// improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
		// improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
		// improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
		// improved by: Dj
		// improved by: Allidylls
		//    input by: Paulo Freitas
		//    input by: Brett Zamir (http://brett-zamir.me)
		//   example 1: sprintf("%01.2f", 123.1);
		//   returns 1: 123.10
		//   example 2: sprintf("[%10s]", 'monkey');
		//   returns 2: '[    monkey]'
		//   example 3: sprintf("[%'#10s]", 'monkey');
		//   returns 3: '[####monkey]'
		//   example 4: sprintf("%d", 123456789012345);
		//   returns 4: '123456789012345'
		//   example 5: sprintf('%-03s', 'E');
		//   returns 5: 'E00'

		var regex = /%%|%(\d+\$)?([\-+\'#0 ]*)(\*\d+\$|\*|\d+)?(?:\.(\*\d+\$|\*|\d+))?([scboxXuideEfFgG])/g;
		var a = arguments;
		var i = 0;
		var format = a[i++];

		// pad()
		var pad = function(str, len, chr, leftJustify) {
			if (!chr) {
				chr = ' ';
			}
			var padding = (str.length >= len) ? '' : new Array(1 + len - str.length >>> 0)
				.join(chr);
			return leftJustify ? str + padding : padding + str;
		};

		// justify()
		var justify = function(value, prefix, leftJustify, minWidth, zeroPad, customPadChar) {
			var diff = minWidth - value.length;
			if (diff > 0) {
				if (leftJustify || !zeroPad) {
					value = pad(value, minWidth, customPadChar, leftJustify);
				} else {
					value = value.slice(0, prefix.length) + pad('', diff, '0', true) + value.slice(prefix.length);
				}
			}
			return value;
		};

		// formatBaseX()
		var formatBaseX = function(value, base, prefix, leftJustify, minWidth, precision, zeroPad) {
			// Note: casts negative numbers to positive ones
			var number = value >>> 0;
			prefix = (prefix && number && {
				'2'  : '0b',
				'8'  : '0',
				'16' : '0x'
			}[base]) || '';
			value = prefix + pad(number.toString(base), precision || 0, '0', false);
			return justify(value, prefix, leftJustify, minWidth, zeroPad);
		};

		// formatString()
		var formatString = function(value, leftJustify, minWidth, precision, zeroPad, customPadChar) {
			if (precision !== null && precision !== undefined) {
				value = value.slice(0, precision);
			}
			return justify(value, '', leftJustify, minWidth, zeroPad, customPadChar);
		};

		// doFormat()
		var doFormat = function(substring, valueIndex, flags, minWidth, precision, type) {
			var number, prefix, method, textTransform, value;

			if (substring === '%%') {
				return '%';
			}

			// parse flags
			var leftJustify = false;
			var positivePrefix = '';
			var zeroPad = false;
			var prefixBaseX = false;
			var customPadChar = ' ';
			var flagsl = flags.length;
			var j;
			for (j = 0; flags && j < flagsl; j++) {
				switch (flags.charAt(j)) {
					case ' ':
						positivePrefix = ' ';
						break;
					case '+':
						positivePrefix = '+';
						break;
					case '-':
						leftJustify = true;
						break;
					case "'":
						customPadChar = flags.charAt(j + 1);
						break;
					case '0':
						zeroPad = true;
						customPadChar = '0';
						break;
					case '#':
						prefixBaseX = true;
						break;
				}
			}

			// parameters may be null, undefined, empty-string or real valued
			// we want to ignore null, undefined and empty-string values
			if (!minWidth) {
				minWidth = 0;
			} else if (minWidth === '*') {
				minWidth = +a[i++];
			} else if (minWidth.charAt(0) === '*') {
				minWidth = +a[minWidth.slice(1, -1)];
			} else {
				minWidth = +minWidth;
			}

			// Note: undocumented perl feature:
			if (minWidth < 0) {
				minWidth = -minWidth;
				leftJustify = true;
			}

			if (!isFinite(minWidth)) {
				throw new Error('sprintf: (minimum-)width must be finite');
			}

			if (!precision) {
				precision = 'fFeE'.indexOf(type) > -1 ? 6 : (type === 'd') ? 0 : undefined;
			} else if (precision === '*') {
				precision = +a[i++];
			} else if (precision.charAt(0) === '*') {
				precision = +a[precision.slice(1, -1)];
			} else {
				precision = +precision;
			}

			// grab value using valueIndex if required?
			value = valueIndex ? a[valueIndex.slice(0, -1)] : a[i++];

			switch (type) {
				case 's':
					return formatString(String(value), leftJustify, minWidth, precision, zeroPad, customPadChar);
				case 'c':
					return formatString(String.fromCharCode(+value), leftJustify, minWidth, precision, zeroPad);
				case 'b':
					return formatBaseX(value, 2, prefixBaseX, leftJustify, minWidth, precision, zeroPad);
				case 'o':
					return formatBaseX(value, 8, prefixBaseX, leftJustify, minWidth, precision, zeroPad);
				case 'x':
					return formatBaseX(value, 16, prefixBaseX, leftJustify, minWidth, precision, zeroPad);
				case 'X':
					return formatBaseX(value, 16, prefixBaseX, leftJustify, minWidth, precision, zeroPad)
						.toUpperCase();
				case 'u':
					return formatBaseX(value, 10, prefixBaseX, leftJustify, minWidth, precision, zeroPad);
				case 'i':
				case 'd':
					number = +value || 0;
					// Plain Math.round doesn't just truncate
					number = Math.round(number - number % 1);
					prefix = number < 0 ? '-' : positivePrefix;
					value = prefix + pad(String(Math.abs(number)), precision, '0', false);
					return justify(value, prefix, leftJustify, minWidth, zeroPad);
				case 'e':
				case 'E':
				case 'f': // Should handle locales (as per setlocale)
				case 'F':
				case 'g':
				case 'G':
					number = +value;
					prefix = number < 0 ? '-' : positivePrefix;
					method = ['toExponential', 'toFixed', 'toPrecision']['efg'.indexOf(type.toLowerCase())];
					textTransform = ['toString', 'toUpperCase']['eEfFgG'.indexOf(type) % 2];
					value = prefix + Math.abs(number)[method](precision);
					return justify(value, prefix, leftJustify, minWidth, zeroPad)[textTransform]();
				default:
					return substring;
			}
		};

		return format.replace(regex, doFormat);
	},

	str_repeat: function(str, n) {
		n = n || 1;
		return Array(n + 1).join(str);
	},

	number_format: function(number, decimals, dec_point, thousands_sep) {
		//  discuss at: http://phpjs.org/functions/number_format/
		// original by: Jonas Raoni Soares Silva (http://www.jsfromhell.com)
		// improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
		// improved by: davook
		// improved by: Brett Zamir (http://brett-zamir.me)
		// improved by: Brett Zamir (http://brett-zamir.me)
		// improved by: Theriault
		// improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
		// bugfixed by: Michael White (http://getsprink.com)
		// bugfixed by: Benjamin Lupton
		// bugfixed by: Allan Jensen (http://www.winternet.no)
		// bugfixed by: Howard Yeend
		// bugfixed by: Diogo Resende
		// bugfixed by: Rival
		// bugfixed by: Brett Zamir (http://brett-zamir.me)
		//  revised by: Jonas Raoni Soares Silva (http://www.jsfromhell.com)
		//  revised by: Luke Smith (http://lucassmith.name)
		//    input by: Kheang Hok Chin (http://www.distantia.ca/)
		//    input by: Jay Klehr
		//    input by: Amir Habibi (http://www.residence-mixte.com/)
		//    input by: Amirouche
		//   example 1: number_format(1234.56);
		//   returns 1: '1,235'
		//   example 2: number_format(1234.56, 2, ',', ' ');
		//   returns 2: '1 234,56'
		//   example 3: number_format(1234.5678, 2, '.', '');
		//   returns 3: '1234.57'
		//   example 4: number_format(67, 2, ',', '.');
		//   returns 4: '67,00'
		//   example 5: number_format(1000);
		//   returns 5: '1,000'
		//   example 6: number_format(67.311, 2);
		//   returns 6: '67.31'
		//   example 7: number_format(1000.55, 1);
		//   returns 7: '1,000.6'
		//   example 8: number_format(67000, 5, ',', '.');
		//   returns 8: '67.000,00000'
		//   example 9: number_format(0.9, 0);
		//   returns 9: '1'
		//  example 10: number_format('1.20', 2);
		//  returns 10: '1.20'
		//  example 11: number_format('1.20', 4);
		//  returns 11: '1.2000'
		//  example 12: number_format('1.2000', 3);
		//  returns 12: '1.200'
		//  example 13: number_format('1 000,50', 2, '.', ' ');
		//  returns 13: '100 050.00'
		//  example 14: number_format(1e-8, 8, '.', '');
		//  returns 14: '0.00000001'

		number = (number + '')
			.replace(/[^0-9+\-Ee.]/g, '');
		var n = !isFinite(+number) ? 0 : +number,
			prec = !isFinite(+decimals) ? 0 : Math.abs(decimals),
			sep = (typeof thousands_sep === 'undefined') ? ',' : thousands_sep,
			dec = (typeof dec_point === 'undefined') ? '.' : dec_point,
			s = '',
			toFixedFix = function(n, prec) {
				var k = Math.pow(10, prec);
				return '' + (Math.round(n * k) / k)
					.toFixed(prec);
			};
		// Fix for IE parseFloat(0.55).toFixed(0) = 0;
		s = (prec ? toFixedFix(n, prec) : '' + Math.round(n))
			.split('.');
		if (s[0].length > 3) {
			s[0] = s[0].replace(/\B(?=(?:\d{3})+(?!\d))/g, sep);
		}
		if ((s[1] || '')
			.length < prec) {
			s[1] = s[1] || '';
			s[1] += new Array(prec - s[1].length + 1)
				.join('0');
		}
		return s.join(dec);
	}
};

if (typeof String.prototype.repeat === 'undefined') {
	String.prototype.repeat = function(n) {
		return PHPString.str_repeat(this, n);
	}
}

module.exports = PHPString;
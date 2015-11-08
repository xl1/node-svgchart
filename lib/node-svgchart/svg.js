/**
 * Adds VERY basic SVG support to jsdom's simulated browser environment.
 * Font information is taken from metrics.json -- so for new fonts, put
 * them into ../fonts and run build_metrics.php.
 */


//Load libs
var _  = require("underscore");

/*##############
 *# FUNCTIONS
 *##############*/

var getTextMetricsByElement = function(el, text) {
	return {
		width: 0,
		height: 0
	};
};

/**
 * Hacky attempt to calculate more-or-less valid bounding boxes. 
 * Calculates all child-bboxes, takes their translation in consideration and returns the "true" bbox.
 * @param  {[type]} el  [description]
 * @param  {[type]} box [description]
 * @return {[type]}     [description]
 */
function calcBoundingBox(el, box) {
	if(!el.getBBox) {
		return {width: 0, height: 0, x: 0, y: 0};
	}

	box = box || el.getBBox();

	el.childNodes.forEach(function(sel) {
		if(sel.nodeType == 3) return;

		var cbox = calcBoundingBox(sel);
		var transform = sel.getAttribute("transform"),
			match;

		if(transform) {
			if(match = transform.match(/translate\(\s*([\d-.]+)\s*,\s*([\d-.]+)\s*\)/)) {
				cbox.x += match[1] * 1;
				cbox.y += match[2] * 1;
			}
			/*if(match = transform.match(/rotate\(\s*([270]+)\s+([\d-.]+)\s+([\d-.]+)\s*\)/)) {
				console.log("ROTATE");
			}*/
		}

		box.x = Math.min(cbox.x, box.x);
		box.y = Math.min(cbox.y, box.y);
		box.width  = Math.max(cbox.width + cbox.x, box.width);
		box.height = Math.max(cbox.height  + cbox.y, box.height);
	});
	return box;
}



/**
 * Simulate the SVGRect object.
 */
function SVGRect(el) {
	this.x = this.y = this.width = this.height = 0;
	if(el) {
		this.x = el.getAttribute("x") * 1 || 0;
		this.y = el.getAttribute("y") * 1 || 0;

		//el.test();
		if(el.tagName == 'TEXT') {

			var metrics = getTextMetricsByElement(el);
			this.width = metrics.width;
			this.height = metrics.height;

			this.y -= this.height / 2;

			//Correct bounding box.
			switch(el.getAttribute("text-anchor")) {
				case 'middle':
					this.x -= metrics.width / 2;
					break;
				case 'end':
					this.x -= metrics.width;
			}
		} else if(el.tagName == 'G') {
			this.prototype = calcBoundingBox(el, this);
		} else {
			this.width =  el.getAttribute("width") || 0;
			this.height = el.getAttribute("height") || 0;;
		}
	}

}

function emptyFunction() {}

//Dummy matrix.
function SVGMatrix() {
	//Properties
	this.a = 0;
	this.b = 0;
	this.c = 0;
	this.d = 0;
	this.e = 0;
	this.f = 0;


	this.flipX = emptyFunction;
	this.flipY = emptyFunction;
	this.inverse = emptyFunction;
	this.multiply = emptyFunction;
	this.rotate = emptyFunction;
	this.rotateFromVector = emptyFunction;
	this.scale = emptyFunction;
	this.scaleNonUniform = emptyFunction;
	this.skewX = emptyFunction;
	this.skewY = emptyFunction;
	this.translate = emptyFunction;
}
	

/**
 * Assemble a minimal subset of the SVG specs 
 */
var svgEl = {
	getBBox: function() {
		return new SVGRect(this);
	},
	
	getNumberOfChars: function() {
		return this.textContent ? this.textContent.length : 0;
	},
	
	getComputedTextLength: function() {
		return this.getBBox().width;
	},
	
	getSubStringLength: function(charnum, nchars) {
		return this.textContent
			? getTextMetricsByElement(this, this.textContent.substr(charnum, nchars)).width
			: 0
	},
	
	getExtentOfChar: function(charnum) {
		var metrics = getTextMetricsByElement(this, this.textContent.substr(charnum, 1));
		return {
			width: metrics.width
			, height: metrics.height
		};
	},
	createSVGRect: function() {
		return new SVGRect(null);
	},
	createSVGMatrix: function() {
		return new SVGMatrix();
	},
	getScreenCTM: function() {
		return this.createSVGMatrix();
	},
	setAttributeNS: function(ns, name, value) {
		this.setAttribute(name, value);
	}
};

/**
 * Applies our SVG patch to a jsdom-generated window object
 */
exports.patch = function(window) {
	//Act as though we implemented the SVG specs
	window.SVGAngle = true;
	
	//Simulate createElementNS() which is used to create SVG nodes
	window.document.createElementNS = function(ns, name) {
		//In fact, we create an element the same way as always...
		var el = window.document.createElement(name);

		//...but we extend the object with the bundle of SVG nctions we have defined.
		_.extend(el, svgEl);
		el.namespaceURI = ns;

		return el;
	};

	var setAttribute = window.HTMLElement.prototype.setAttribute;
	window.HTMLElement.prototype.setAttribute = function(name, value) {
		//Only allow assignments that make sense (x="" causes problems with rsvg)
		//This might need some rework to suppport attributes (checked, etc).
		if(value !== '') {
			setAttribute.call(this, name, value);
		}
	}

	window.HTMLElement.prototype.__defineGetter__("offsetWidth", function() {
		return this.getAttribute("offsetWidth") || this.width || this.getAttribute("width")  || this.style.width;
	});
	window.HTMLElement.prototype.__defineSetter__("offsetWidth", function(width) {
		this.setAttribute("offsetWidth", width);
	});
	window.HTMLElement.prototype.__defineGetter__("offsetHeight", function() {
		return this.getAttribute("offsetHeight") || this.height || this.getAttribute("height")  || this.style.height;
	});
	window.HTMLElement.prototype.__defineSetter__("offsetHeight", function(height) {
		this.setAttribute("offsetHeight", height);
	});


	return window;
};

exports.clean = function(svg) {

	/*##########################
	*# XML SANITATION
	*########################*/	
	//# Step 1, pull up weeds using jQuery
	// var svgEl = $container.children('svg');
	// svgEl.find("[visibility=hidden]").remove();
	
	//Activate this if you want to have correct clipping (but note that labels will be cut off when they're outside the borders)
	/*//Puts the defs to the right place
	var defs = svgEl.find("defs:first");
	svgEl.find("clippath").appendTo(defs);*/
	

	//# Step 2, correct some tags using RegEx
	svg = svg.replace(/fill: ;/g, '');
					
	return svg;
}

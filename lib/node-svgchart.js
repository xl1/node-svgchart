//Load libs
var jsdom        = require("jsdom")
	, path       = require("path")
	, vm         = require('vm')
	, fs         = require("fs")
	, svgp       = require("./svg/index")
	, domparser  = require("./node-svgchart/domparser")
	, _          = require("underscore")
	, domToHtml  = require("jsdom/lib/jsdom/browser/domtohtml").domToHtml
	, EventEmitter = require("events").EventEmitter;


function NodeChart() {
	EventEmitter.call(this);

	//List of dependencies
	var dependencies = [];

	//Function to set up chart.
	var setup = function(e, callback) {callback()};

	var window = null
	, self = this
	, queue = []
	, width = null
	, height = null
	, safeMode = false
	, autoclean = true;

	function next() {
		queue.shift();
		self.clearTimeouts();

		if(autoclean) {
			self.clean();
		}

		if(queue.length) {
			queue[0]();
		}
	}

	/**
	 * Converts an object to a list of arguments
	 * @param  {object} obj [description]
	 * @return {[type]}
	 */
	function objectToArgs(obj) {
		var args = [];

		if(obj.width || obj.height) {
			args.push('-resize');
			var resize = 'x';
			if(obj.width) {
				resize = obj.width + resize;
			}
			if(obj.height) {
				resize += obj.height;
			}
			args.push(resize);
		}

		return args;
	}

	function updateSize() {

		var chart = window.document.getElementById("chart");
		if(chart) {
			if(height) {
				chart.height = height;
				chart.style.height = height + "px";
			}
			if(width) {
				chart.width  = width;
				chart.style.width = width + "px";
			}
		}
	}

	function getOffsetWidth(element) {
		var res = element.width || element.style.width;
		if (typeof res === "number") {
			return res;
		}
		var match = /(\d+)(.+)/.exec(res);
		if (!match || match.length !== 3) {
			return getOffsetWidth(element.parentElement);
		}
		var num = +match[1];
		var unit = match[2].toLowerCase();
		if (unit === "%") {
			return getOffsetWidth(element.parentElement) * num / 100;
		}
		// TODO other units
		return num;
	}

	function getOffsetHeight(element) {
		var res = element.height || element.style.height;
		if (typeof res === "number") {
			return res;
		}
		var match = /(\d+)(.+)/.exec(res);
		if (!match || match.length !== 3) {
			return 0;
		}
		var num = +match[1];
		var unit = match[2].toLowerCase();
		if (unit === "%") {
			return getOffsetHeight(element.parentElement) * num / 100;
		}
		// TODO other units
		return num;
	}

	this.clean = function() {
		if(window) {
			this.emit("clean", window);
			_.forEach(window.document.body.childNodes, function(node) {
				window.document.body.removeChild(node);
			});
			var chn = window.document.createElement("div");
			chn.id = "chart";
			window.document.body.appendChild(chn);

			updateSize();
		}

		return this;
	}


	/**
	 * Registers a JavaScript File to be loaded when generating a chart.
	 * @param {string} path Path to the lib file
	 */
	this.require = function(dep) {
		if(!(dep instanceof Array)) {
			dep = [dep];
		}


		dep.forEach(function(el) {
			//Store absolute path.
			dependencies.push(path.resolve(el));
		});

		return this;
	}

	/**
	 * Rewrite a font as a different font.
	 * @param {[type]} font    [description]
	 * @param {[type]} rewrite [description]
	 */
	this.setFont = function(font, rewrite) {

		return this;
	}

	this.setSafeMode = function(on) {
		safeMode = on;
		return this;
	}

	this.setAutoClean = function(on) {
		autoclean = on;

		return this;
	}

	/**
	 * Set width and height of the chart container.
	 * @param {int} w Width in pixels
	 * @param {int} h Height in pixels
	 */
	this.setSize = function(w, h) {
		width = w;
		height = h;

		if(window) {
			//Update if necessary.
			updateSize();
		}

		return this;
	}

	/**
	 * Clears all current timeouts in window.
	 * @return {[type]} [description]
	 */
	this.clearTimeouts = function() {
		if(window) {
			window.__stopAllTimers();
		}
	}

	/**
	 * Assign a function that kicks the chart up. The chart has to be written to #chart
	 * @param  {Function} callback Function that set the chart up.
	 */
	this.setup = function(callback) {
		setup = callback;
		return this;
	}

	/**
	 * Sets up the environment. Use this when in a server context.
	 * @return {[type]} [description]
	 */
	this.start = function(callback) {
		callback = callback || function() {};

		if(!window) {
			//Simulate browser.
			jsdom.env({
				//Minimalisic web page
				html: '<html><body><div id="chart"></div></body></html>',
				done: function(err, w) {
					if(err) {
						callback(err);
						return;
					}

					//Apply some patches.
					svgp.patchWindow(w);
					domparser.patch(w);

					w.HTMLElement.prototype.__defineGetter__("offsetWidth", function() {
						return getOffsetWidth(this);
					});
					w.HTMLElement.prototype.__defineGetter__("offsetHeight", function() {
						return getOffsetHeight(this);
					});

					w.console = console;


					/////////////////////////////
					// BUGFIX for Highcharts
					// -> They access "hostname" for some reason, which is not implemented
					//    by jsdom at this point.
					/////////////////////////////
					
					w.location.__defineGetter__("hostname", function() {
						return '';
					});
					w.location.__defineGetter__("host", function() {
						return '';
					});

					w.NodeArray = Array;

					/* PROBLEM
					w.run("function test(arr) {console.log(arr instanceof Array, [] instanceof Array)}");
					w.test([]);
					 */
					//w.Array.prototype.__dummy__array__ = Array.prototype.__dummy__array__ = true;

					var context = vm.createContext(w);
					dependencies.forEach(function(scriptName) {
						//Change the code to make
						//	a instanceof Array
						//	-->
						//	(a instanceof Array || a instanceof NodeArray)
						//Definitely a risky and ugly approach, but didn't find another workaround for this problem.
						//See PROBLEM for an example.
						var script = fs.readFileSync(scriptName).toString();
						if(!safeMode)
							script = script.replace(/([\w.\[\]"']+)\s*instanceof\s*Array/g, "($1 instanceof Array || $1 instanceof NodeArray)");
						console.log(scriptName);
						//fs.writeFile(scriptName + "2", script);
						vm.runInContext(script, context);
					});
					window = w;


					self.emit("ready", window);
					callback(null, window);

				}

			});
		} else {
			callback(null, window);
			self.emit("ready", window);
		}

		return this;
	}

	/**
	 * Tear down the DOM environment.
	 * @return {[type]} [description]
	 */
	this.stop = function() {
		window.dispose();
		window = null;
		queue = [];
	};



	this.create = function(jobName, options, callback) {
		var set = setup;
		queue.push(function() {
			if(!callback) callback = function() {};
			self.start(function(err) {
				if(err) {
					callback(err);
					next();
					return;
				}


				//Create our little DOM-world
				set.call(window, {
					job: jobName,
					window: window
				}, function() {
					//Get generated SVG.
					var svg = window.document.getElementsByTagName("SVG");

					if(svg.length) {
						if(svg.length > 1) {
							console.log("Warning: There are a total of " + svg.length + " SVGs!");
						}
						svg = domToHtml(svg);
						svg = svgp.clean(svg);


						var e = { svg: svg
								, stop: false
								, job: jobName };
						self.emit("svg", e);
						//We got what we need.
						next();
					} else {
						next();
						callback(new Error("No SVG found."));
					}
				});

			});
		});
		
		//Is this the only element in queue?
		if(queue.length == 1) {
			queue[0]();
		}
		return this;
	}
	this.on("ready",updateSize);

}

NodeChart.prototype = Object.create(EventEmitter.prototype);

module.exports = new NodeChart();
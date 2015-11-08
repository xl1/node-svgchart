const http = require("http");
const nodeChart = require("./lib/node-svgchart");

function renderChart(e, callback) {
	//--- Copied from examples/amcharts/index.js ---
	var chartData = [{
		year: 2005,
		income: 23.5
	}, {
		year: 2006,
		income: 26.2
	}, {
		year: 2007,
		income: 30.1
	}, {
		year: 2008,
		income: 29.5
	}, {
		year: 2009,
		income: 24.6
	}];

	var amchart;
	// SERIAL CHART
	amchart = new this.AmCharts.AmSerialChart();
	amchart.dataProvider = chartData;
	amchart.categoryField = "year";
	// this single line makes the chart a bar chart, 
	// try to set it to false - your bars will turn to columns                
	amchart.rotate = true;
	// the following two lines makes chart 3D
	amchart.depth3D = 20;
	amchart.angle = 30;

	// AXES
	// Category
	var categoryAxis = amchart.categoryAxis;
	categoryAxis.gridPosition = "start";
	categoryAxis.axisColor = "#DADADA";
	categoryAxis.fillAlpha = 1;
	categoryAxis.gridAlpha = 0;
	categoryAxis.fillColor = "#FAFAFA";

	// value
	var valueAxis = new this.AmCharts.ValueAxis();
	valueAxis.axisColor = "#DADADA";
	valueAxis.title = "Income in millions, USD";
	valueAxis.gridAlpha = 0.1;
	amchart.addValueAxis(valueAxis);

	// GRAPH
	var graph = new this.AmCharts.AmGraph();
	graph.title = "Income";
	graph.valueField = "income";
	graph.type = "column";
	graph.balloonText = "Income in [[category]]:[[value]]";
	graph.lineAlpha = 0;
	graph.fillColors = "#bf1c25";
	graph.fillAlphas = 1;
	amchart.addGraph(graph);

	// WRITE
	amchart.write("chart");
	callback();
}

function generateChartSVG(name, width, height, options) {
	return new Promise((resolve, reject) => {
		nodeChart
			.require(["./examples/amcharts/lib/amcharts.js"])
			.on("svg", e => {
				resolve(e.svg);
			})
			.setSize(width, height)
			.setup(renderChart)
			.create(name);
	});
}

http.createServer((req, res) => {
	res.writeHead(200, {
		"Content-Type": "text/html"
	});
	generateChartSVG("bar", 600, 400, {})
		.then(svg => res.end(svg))
		.catch(e => console.error(e));
}).listen(8080);

console.log("server started");

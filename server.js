console.log('Server side code running');

var express = require('express');
var app = express();
var port = 8080;
var deps = require('./cell_dependencies');

app.use(express.json({
    limit: '10mb',
    extended: true
})) // for parsing application/json
app.use(express.urlencoded({
    extended: true,
    limit: '10mb',
 })) // for parsing application/x-www-form-urlencoded

// serve filed from the public dir
app.use(express.static('public'));

app.listen(port, () => {
	console.log('listening on 8080');
});

// serve homepage
app.get('/', (req, res) => {
	res.sendFile(__dirname + '/index.html');
});

let cells = [];
let dict = [];

app.post('/input', function(req, res){
    let notebook = req.body.notebook;
    let output = deps.calculateCells(notebook);
    cells = output.cellList;
    dict = output.dict;

    res.send(output);
});

app.post('/calculateDeps', function(req, res){
    let executionCount = req.body.executionCount;
    let selectedCell = dict[executionCount];
    let output = deps.calculateDeps(selectedCell, dict);
    res.send(output.descendants);
});


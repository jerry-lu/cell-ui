console.log('Server side code running');

var express = require('express');
var app = express();
var port = 8080;
var deps = require('./cell_dependencies');
const { State } = require('./state');

app.use(express.json({
    limit: '10mb',
    extended: true
})) // for parsing application/json

app.use(express.urlencoded({
    limit: '10mb',
    extended: true
})) // for parsing application/x-www-form-urlencoded

// serve files from the public dir
app.use(express.static('public'));

app.listen(port, () => {
	console.log('listening on 8080');
});

// serve homepage
app.get('/', (req, res) => {
	res.sendFile(__dirname + '/index.html');
});

let cells = [];
let trueStates = [];
let globalState;
let mostRecent = new Map();

app.post('/input', function(req, res){
    let notebook = req.body.notebook;
    let output = deps.calculateDefUse(notebook);
    cells = output.cellList;
    trueStates = deps.simulateTopDown(cells);
    globalState = new State();
    res.send(output);
});

app.post('/calculateDeps', function(req, res){
    let idx = req.body.idx;
    let output = deps.calculateDepsNeighbors(cells, idx);
    res.send(output.descendants);
});

app.post('/modify', function(req, res){
    let idx = req.body.idx;
    let cell = cells[idx];
    cell.incrementVersion();
    trueStates = deps.simulateTopDown(cells);
    let output = deps.calculateDepsAll(cells, idx);
    res.send({
        invalidCells: output.descendants,
        version: cell.version
    });
});

app.post('/compare', function(req, res) {
    let idx = req.body.index;
    let result = deps.simulateExecutionOrder(cells[idx], globalState);
    Object.entries(result.cellState).forEach(entry => {
        globalState.update(entry[0], entry[1]);
        mostRecent.set(entry[0], idx);
    });
    let blameCells = new Set();
    let currentState = result.cellState;
    let topDownState = trueStates[idx];
    let output = deps.isSameState(topDownState, currentState);
    output.unequal.forEach(variable => {
        blameCells.add(mostRecent.get(variable));
    });
    res.send({
        output: output.bool,
        unequal: output.unequal,
        mostRecent: [...blameCells],
        state: currentState.toString(),
        trueState: trueStates[idx].toString()
    });
});

app.post('/reset', function(){
    globalState = new State();
});

app.post('/resetMods', function(){
    cells.forEach(cell => {
        cell.version = 0;
    });
    trueStates = deps.simulateTopDown(cells);
});
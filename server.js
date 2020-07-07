console.log('Server side code running');

var express = require('express');
var app = express();
var port = 8080;
var deps = require('./cell_dependencies');
const { State, CellOutput } = require('./state');

app.use(express.json({
    limit: '10mb',
    extended: true
})) // for parsing application/json

app.use(express.urlencoded({
    extended: true,
    limit: '10mb',
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
let globalState = new State();

app.post('/input', function(req, res){
    let notebook = req.body.notebook;
    let output = deps.calculateDefUse(notebook);
    cells = output.cellList;
    cells.forEach(cell =>{
        cell.convert();
    });
    trueStates = deps.simulateTopDown(cells);
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
    let output = deps.calculateDepsNeighbors(cells, idx);

    res.send(output.descendants);
});

app.get('/edges', function(req, res){
    if (cells === undefined || cells.length < 1){
        res.status(400).send(new Error('no notebook uploaded yet'));
    }
    let arr = [];
    cells.forEach(cell => {
        let from = cell._idx;
        cell.descendants.forEach(to =>{
            arr.push({from: from, to: to});
        });
    });
    res.send(arr);
});

app.post('/compare', function(req, res) {
    let idx = req.body.index;
    let result = deps.simulateExecutionOrder(cells[idx], globalState);
    globalState = result.globalState;
    let currentState = result.cellState;
    let topDownState = trueStates[idx];
    let output = deps.isSameState(topDownState, currentState);
    res.send({output: output, state: currentState, trueState: trueStates[idx]});
});

app.post('/reset', function(req, res){
    globalState = new State();
});

app.post('/resetMods', function(req, res){
    cells.forEach(cell => {
        cell.version = 0;
    });
    trueStates = deps.simulateTopDown(cells);
});
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

app.post('/input', function(req, res){
    let notebook = req.body.notebook;
    let output = deps.calculateDefUse(notebook);
    cells = output.cellList;
    res.send(output);
});

app.post('/calculateDeps', function(req, res){
    let idx = req.body.idx;
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
        cell._descendants.forEach(to =>{
            arr.push({from: from, to: to});
        });
    });
    res.send(arr);
});

app.post('/compare', function(req, res) {
    let execOrder = req.body.order;
    console.log(execOrder);
    let topDownState = deps.simulateExecutionOrder(cells, undefined, true);
    let otherState = deps.simulateExecutionOrder(cells, execOrder);
    let output = deps.isSameState(topDownState, otherState);
    console.log(output);
    res.send(output);    
});
const deps = require('../cell_dependencies');
const { State } = require('../state');
const { textFromHistory } = require('./create_notebooks');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const name = args[0];

let cells = [];
let trueStates = [];
let globalState;
let mostRecent = new Map();

console.log(name);
input(name);

function readHistory(name) {
    const directoryPath = path.join('../../evaluation/CLEAN', name);
    let txt = fs.readFileSync(path.join(directoryPath, 'HW5.ipyhistory')).toString();
    const json = JSON.parse(txt);
    return json;
}

function createInitialNB(json) {
    let runs = json.runs;

    let initial;
    if (runs[0].checkpointType === 'notebook loaded'){
        initial = runs[0];
    }
    let ipynb = textFromHistory(initial, json, 'targetCells', true);
    let data = JSON.stringify(ipynb,null,2);
    return(data);
}

function input(name){
    let history = readHistory(name);
    let notebook = createInitialNB(history);

    let output = deps.calculateDefUse(notebook);
    cells = output.cellList;
    console.log(cells);
    trueStates = deps.simulateTopDown(cells);
    globalState = new State();
    return(output);
}

function calculateDeps(idx){
    let output = deps.calculateDepsNeighbors(cells, idx);
    return(output.descendants);
}

function modify (idx){
    let cell = cells[idx];
    cell.incrementVersion();
    trueStates = deps.simulateTopDown(cells);
    let output = deps.calculateDepsAll(cells, idx);
    return({
        invalidCells: output.descendants,
        version: cell.version
    });
}

function compare (idx) {
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
    return({
        output: output.bool,
        unequal: output.unequal,
        mostRecent: [...blameCells],
        state: currentState.toString(),
        trueState: trueStates[idx].toString()
    });
}

function reset(){
    globalState = new State();
}

function resetMods(){
    cells.forEach(cell => {
        cell.version = 0;
    });
    trueStates = deps.simulateTopDown(cells);
}
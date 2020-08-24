const path = require('path');
const deps = require('../cell_dependencies');
const { State } = require('../state');
const { textFromHistory } = require('./create_notebooks');
const fs = require('fs');

// given a path, read the ipyhistory file and return it as an object
function readHistory(historyPath, name) {
    const directoryPath = path.join(historyPath, name);
    let txt = fs.readFileSync(path.join(directoryPath, 'HW5.ipyhistory')).toString();
    const json = JSON.parse(txt);
    return json;
}

function unpack(node){
    let arr = node.split('.');
    return {type: arr[0], idx: arr[1], version: arr[2]};
}

function updateSequence(arr){
    let newSeq = new Map();
    let count = 0;
    for (const element of arr){
        let output = unpack(element);
        if (output.type === 'c'){
            newSeq.set(output.idx, count++);
        }
    }
    return newSeq;
}

function createInitialNB(json) {
    let runs = json.runs;
    let initial;
    if (runs[0].checkpointType === 'notebook loaded'){
        initial = runs[0];
    }
    let idx = initial.notebook;
    let text = textFromHistory(json.notebook[idx], json, 'cells');
    let ipynb = text.nb;
    let sequence = updateSequence(text.sequence);
    let data = JSON.stringify(ipynb,null,2);
    return {data: data, sequence: sequence};
}

function createUserHistoryNb(json){
    let list = []
    for (const run of json.runs){
        if (run.checkpointType === 'run'){
            let node = run.targetCells[0].node;
            list.push(node);
        }
    }
    let obj = {'cells': list};
    console.log(obj);
    let ipynb = textFromHistory(obj, json, 'cells').nb;
    let data = JSON.stringify(ipynb,null,2);
    fs.writeFileSync(`fullnb2.ipynb`, data);
}

function input(nb){
    let output = deps.calculateDefUse(nb);
    return {
        cells: output.cellList,
        trueStates: deps.simulateTopDown(output.cellList),
        globalState: new State()
    }
}

function nbFromHistory(json, number) {
    return (textFromHistory(json.notebook[number], json, 'cells'));
}

module.exports = {
    readHistory: readHistory,
    unpack: unpack,
    updateSequence: updateSequence,
    createInitialNB: createInitialNB,
    nbFromHistory: nbFromHistory,
    input: input
}
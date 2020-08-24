const deps = require('../cell_dependencies');
const helper = require('./eval_helpers');
const fs = require('fs');
const util = require('util');

const args = process.argv.slice(2);
let name = args[0];
name = 'P01';

let mostRecent = new Map();
let history = helper.readHistory('../evaluation/CLEAN', name);
let init = helper.createInitialNB(history);
let notebook = init.data;
let sequence = init.sequence;
let cells, trueStates, globalState;

({cells, trueStates, globalState} = helper.input(notebook));
simulateHistory(history, notebook);

function simulateHistory(json, nb){
    let runs = json.runs;
    let nbVersion = 0;
    let currentNb = nb;
    let same = 0;
    let total = 0;

    let i = -1;
    for (run of runs){
        if (run.checkpointType === 'run'){
            i++;
            if (nbVersion !== run.notebook){
                let obj = helper.nbFromHistory(json, run.notebook);
                sequence = helper.updateSequence(obj.sequence);
                currentNb = obj.nb;
                nbVersion = run.notebook;
                try {
                    let nbCells = deps.calculateDefUse(currentNb, true).cellList;
                    trueStates = deps.simulateTopDown(nbCells);
                } catch (err) {
                    console.log('parse error');
                    continue;
                }
            }

            let node = run.targetCells[0].node;
            let output = helper.unpack(node);
            let type = output.type;
            let idx = output.idx;
            if (type === 'c'){
                try{
                    cells = deps.calculateDefUse(currentNb, true).cellList;
                    let result = compare(sequence.get(idx));

                    //get the real output
                    let name = `./generatednbs/P01/P01_${nbVersion}.ipynb`
                    const real = fs.readFileSync(name).toString();
                    const realNb = JSON.parse(real);
                    const validTypes = ['c', 'm', 'o'];
                    let nbRecord = json.notebook[nbVersion].cells;
                    nbRecord = nbRecord.filter(elt => validTypes.includes(elt[0]));

                    let location = nbRecord.findIndex(element => {
                        return (element === node);
                    });
                    let realOutput = realNb.cells[location].outputs;
                    if (realOutput !== undefined) {
                        realOutput = realOutput.filter(elt => elt.name !== 'stderr')
                    }

                    //get the top-down output
                    let simName = `./fullnb.ipynb`;
                    const simulated = fs.readFileSync(simName).toString();
                    const simulatedNb = JSON.parse(simulated);
                    let simOutput = simulatedNb.cells[i].outputs;
                    if (simOutput !== undefined){
                        simOutput = simOutput.filter(elt => elt.name !== 'stderr');
                    }

                    try { 
                        for (const element of realOutput){
                            if (element.hasOwnProperty('execution_count')){
                                delete element.execution_count;
                            }                   
                        }
                    }
                    catch (error){
                        console.log(error);
                        console.log(realOutput);
                    }
                    //check if they are the same
                    const match = util.isDeepStrictEqual(realOutput, simOutput);

                    console.log(node);
                    console.log(`tool gives  ${result.output}`);
                    console.log(`compare nbs ${match}`);

                    /*if (!match) {
                        console.log(JSON.stringify(realOutput, null, 2).slice(0, 1000));
                        console.log(JSON.stringify(simOutput, null, 2).slice(0, 1000));
                    }*/

                    if (match && !result.output){
                        console.dir(result.state, { depth: null });
                        console.dir(result.trueState, { depth: null });
                        fs.writeFileSync(`problem.ipynb`, JSON.stringify(currentNb));
                        break;
                    }

                    if (result.output === match){
                        same++;
                    } total++;
                }
                catch(error) {
                    console.log(error);
                }
            }
        }
    }
    console.log(same/total);
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
        state: currentState,
        trueState: trueStates[idx],
        causingCell: cells[idx].source
    });
}
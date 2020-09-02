const py = require('../../python-program-analysis');
const { Cell } = require('./cells.js');
const { State } = require('./state.js');

// print processed code with line nums for debugging
function showLineNos(text){
    let split = text.split('\n');
    for (const [i, value] of split.entries()) {
        console.log(`${i+1} ${value}`);
    }
}

function checkNodeExists(arr, node) {
    return arr.find(arrVal => 
        arrVal[0] === node[0] && arrVal[1] === node[1] && arrVal[2] == node[2]);
}

function arraysEqual(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (a.length !== b.length) return false;  
    for (var i = 0; i < a.length; ++i) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

function isInBoundaries(lineNo, cellLineNos){
    let first = cellLineNos[0];
    let last = cellLineNos[1];
    return (lineNo >= first && lineNo <= last);
}

function breadthFirstSearch(cells, idx, searchDependents=false){
    let cell = cells[idx];
    let visited = new Set();
    let stack = [cell];
    let neighbors = [];
    while (stack.length > 0){
        let current = stack.pop();
        visited.add(current);
        searchDependents ? neighbors = current.descendants : neighbors = current.ancestors;
        if (neighbors !== undefined){
            neighbors.forEach(neighbor => {
                neighbor = cells[neighbor];
                if (!visited.has(neighbor)) stack.push(neighbor);
            });
        }
    }
    visited.delete(cell);
    return visited;
}

function constructCells(notebook, isJSON){
    const notebookJson = isJSON ? notebook : JSON.parse(notebook);
    if (notebookJson.nbformat < 4){
        console.log(`Error: ${notebook} Notebook version out of date`);
        return;
    }
    let cells = [];
    let count = 0;
    for (const element of notebookJson.cells){
        if (element.cell_type === 'code'){
            let cell = new Cell(element, count++);
            cells.push(cell);
        }
    }
    return cells;
}

function convertToPython(cells){
    let text = "while(True):";
    let currentLine = 2;
    for (let cell of cells){
        let cellLength;
        var sourceCode = "\n\tif (True):\n";
        if (cell.source === undefined || cell.source.length == 0) {
            cellLength = 1;
            sourceCode += '\t\tprint(\'filler text\')';
        } else {
            cellLength = cell.source.length;
            for (let line of cell.source) {
                if (line[0] == '%' || line[0] == '!' || line[0] == '#') {
                    if (cell.source.length === 1){ line = 'print(\'filler text\')'; }
                    else { line = "#" + line; }
                }
                sourceCode += "\t\t" + line;
            }
        }
        if (cellLength > 0){
            text += sourceCode;
            cell.lineNos = [currentLine + 1, currentLine + cellLength];
        }
        currentLine += cellLength + 1;
    }
    return text;
}

module.exports = {
    calculateDefUse: function(notebook, isJSON=false){
        let cells = constructCells(notebook, isJSON);
        if (cells === undefined) return;

        let text = convertToPython(cells);
        let tree = py.parse(text);
        let cfg = new py.ControlFlowGraph(tree);
		let analyzer = new py.DataflowAnalyzer();
		let flows = analyzer.analyze(cfg).dataflows;

        for (const flow of flows.items) {
            let intersection
            if (flow.fromNode.type === 'assign'){
                intersection = [];
                for (const target of flow.fromNode.targets){
                    intersection.push(target.id);
                }
            } else {
                let defs = analyzer.getDefs(flow.fromNode, new py.RefSet()).items.map(x => x.name);
                let uses = analyzer.getUses(flow.toNode).items.map(x => x.name);
                intersection = defs.filter(x => uses.includes(x));    
            }

            for (const name of intersection){
                let fromNodeFirstLine = flow.fromNode.location.first_line;
                let toNodeFirstLine = flow.toNode.location.first_line;
                let defCell;
                let useCell;
                let defNode;
                let useNode;
    
                cells.forEach(cell => {
                    if (cell.lineNos !== undefined){
                        if (isInBoundaries(fromNodeFirstLine, cell.lineNos)){

                            let sources = flow.fromNode.sources;
                            let allLiteral;
                            if (typeof sources === 'undefined'){
                                allLiteral = false
                            } else {
                                allLiteral = sources.every(source => source.type === 'literal');
                            }

                            defCell = cell;
                            if (allLiteral && flow.fromNode.op === undefined){
                                defCell.addDef(name, {id: 'ConstPlaceholder'}, fromNodeFirstLine);
                            } else {
                                defCell.addDef(name, undefined, fromNodeFirstLine);
                                let fromNodeLastLine = flow.fromNode.location.last_line;
                                if (fromNodeFirstLine !== fromNodeLastLine){
                                    fromNodeLastLine -= 1;
                                }
                                let node = [fromNodeFirstLine, fromNodeLastLine, name];

                                let findNode = checkNodeExists(defCell.nodes, node);
                                if (typeof findNode === 'undefined'){
                                    findNode = node;
                                    defCell.nodes.push(node);
                                }
                                defNode = findNode;
                            }
                        }
                        if (isInBoundaries(toNodeFirstLine, cell.lineNos)){
                            useCell = cell;
                            useCell.addUse(name);
                            let toNodeLastLine = flow.toNode.location.last_line;
                            if (toNodeFirstLine !== toNodeLastLine){
                                toNodeLastLine -= 1;
                            }
                            let node = [toNodeFirstLine, toNodeLastLine];
                            let findNode = checkNodeExists(useCell.nodes, node);
                            if (typeof findNode === 'undefined'){
                                findNode = node;
                            }
                            useNode = findNode;
                        }
                    }
                });

                if (defCell !== undefined && useCell !== undefined && !useCell.ancestors.includes(defCell.idx)){
                    if (defCell !== useCell || arraysEqual(defNode, useNode)){
                        useCell.addAncestor(defCell.idx);
                        useCell.relations.push({neighbor: defCell.idx, variable: name});
                        defCell.addDescendant(useCell.idx);
                        defCell.relations.push({neighbor: useCell.idx, variable: name});
                    }
                }    
            }
        }

        //second pass for geting detailed definitions
        for (const flow of flows.items){
            let defs = analyzer.getDefs(flow.fromNode, new py.RefSet()).items.map(x => x.name);
            let uses = analyzer.getUses(flow.toNode).items.map(x => x.name);
            let intersection = defs.filter(x => uses.includes(x));
            for (const name of intersection){
                let useLoc;
                if (flow.toRef === undefined){
                    let type = flow.toNode.type;
                    if (type === 'assign'){
                        useLoc = flow.toNode.sources[0].location.first_line;
                    } else if (type === 'call'){
                        useLoc = flow.toNode.func.location.first_line;
                    }                    
                } else {
                    useLoc = flow.toRef.location.first_line;
                }
                cells.forEach(cell => {
                    cell.nodes.forEach(node =>{
                        if (isInBoundaries(useLoc, node)){
                            // node[2] is the name of the variable defined in the node
                            cell.addDef(node[2], name, useLoc);
                        }
                    });
                });
            }
        }
        return { cellList: cells };
    },

    calculateDepsAll: function(cells, idx){
        return {
            ancestors: this.cellSetToArray(breadthFirstSearch(cells, idx)),
            descendants: this.cellSetToArray(breadthFirstSearch(cells, idx, true))
        };
    },

    calculateDepsNeighbors: function(cells, idx){
        return {
            ancestors: cells[idx].ancestors,
            descendants: cells[idx].descendants
        };
    },

    // cells is a list of cell objects
    // globalState is passed from server.js so we don't have to recalculate
    // everything that was run previously in the sequence
    // idx is the index of the cell that is being run
    simulateExecutionOrder: function(cell, globalState){
        if (globalState === undefined) globalState = new State();
        return cell.apply(globalState);
    },

    simulateTopDown: function(cells){
        let state = new State();
        let outputs = [];
        cells.forEach( cell => {
            if (cell.source !== undefined && cell.source.length > 0){
                let result = cell.apply(state);
                state = result.globalState;
                outputs.push(result.cellState);
            } else {
                outputs.push(new State());
            }
        });
        return outputs;
    },

    isSameState: function(x, y){
        let unequal = new Set();
        Object.entries(x).forEach(entry => {
            const def = entry[0];
            const uses = entry[1];
            const other = y[def];
            if (other === undefined){
                unequal.add(def);
            }
            else if(uses.toString() !== other.toString()){
                // if the variable is defined in terms of other variables,
                // we want to go down one layer to see which inputs
                // do not match the inputs from the top-down order
                if (typeof uses === 'object' && typeof other === 'object'){
                    let a = uses.argsIn;
                    let b = other.argsIn;
                    Object.entries(a).forEach(entry => {
                        let aDef = entry[0];
                        let aUses = entry[1]
                        let bUses = b[aDef];
                        if (bUses === undefined || aUses.toString() !== bUses.toString()){
                            unequal.add(aDef);
                        }
                    });
                } else {
                    unequal.add(def);
                }
            }
        });
        return {
            bool: unequal.size == 0, 
            unequal: [...unequal]
        };
    },

	cellSetToArray: function(cells){
		let array = [];
		cells.forEach(cell => array.push(parseInt(cell._idx)));
		return array.sort((a, b) => a - b)
	}
}
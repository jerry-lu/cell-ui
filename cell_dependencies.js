const py = require("../../python-program-analysis");
const { Cell, Node } = require('./cells.js');
const { State } = require('./state.js');

function showLineNos(text){
    let split = text.split('\n');
    for (const [i, value] of split.entries()) {
        console.log(`${i+1} ${value}`);
    }
}

function checkNodeExists(arr, node) {
    return arr.find(arrVal => 
        arrVal[0] === node[0] && arrVal[1] === node[1]);
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

module.exports = {
    constructCells: function(notebook){
        const notebookJson = JSON.parse(notebook);
        if (notebookJson.nbformat < 4){
            console.log(`Error: ${notebook} Notebook version out of date`);
            return;
        }
        let cells = [];
        let count = 0;
        notebookJson.cells.forEach(element => {
            if (element.cell_type === 'code'){
                let cell = new Cell(element, count++);
                cells.push(cell);
            }
        });
        return cells;
    }, 

    convertToPython: function(cells){
        let text = "while(True):";
        let currentLine = 2;
        for (let cell of cells){
            var sourceCode = "\n\tif (True):\n";
            for (let line of cell.source) {
                if (line[0] == '%' || line[0] == '!') {
                    if (cell.source.length === 1){ line = 'print(\'filler text\')'; }
                    else { line = "#" + line; }
                }
                sourceCode += "\t\t" + line;
            }
            let cellLength = cell.source.length;
            if (cellLength > 0){
                text += sourceCode;
                cell.lineNos = [currentLine + 1, currentLine + cellLength];
            }
            currentLine += cellLength + 1;
        }
        return text;
    },

    calculateDefUse: function(notebook){
        let cells = this.constructCells(notebook);
        if (cells === undefined) return;

        let text = this.convertToPython(cells);
        showLineNos(text);
        let tree = py.parse(text);
		let cfg = new py.ControlFlowGraph(tree);
		let analyzer = new py.DataflowAnalyzer();
		let flows = analyzer.analyze(cfg).dataflows;
        let items = flows.items;
        for (let flow of items) {
            let fromNodeFirstLine = flow.fromNode.location.first_line;
            let toNodeFirstLine = flow.toNode.location.first_line;
            let defCell;
            let useCell;
            let name;
            let defNode;
            let useNode;

            if (flow.fromRef !== undefined && flow.toRef !== undefined){
                name = flow.fromRef.name;

                cells.forEach(cell => {
                    if (cell.lineNos !== undefined){
                        if (isInBoundaries(fromNodeFirstLine, cell.lineNos)){
                            defCell = cell;
                            defCell.addDef(name, undefined, fromNodeFirstLine);
                            let fromNodeLast = flow.fromNode.location.last_line;
                            if (fromNodeFirstLine !== fromNodeLast) fromNodeLast -= 1;
                            let node = [fromNodeFirstLine, fromNodeLast, name];
                            let findNode = checkNodeExists(defCell.nodes, node);
                            if (typeof findNode === 'undefined'){
                                findNode = node;
                                defCell.nodes.push(node);
                            }
                            defNode = findNode;
                        }
                        if (isInBoundaries(toNodeFirstLine, cell.lineNos)){
                            useCell = cell;
                            useCell.addUse(name);
                            let toNodeLast = flow.toNode.location.last_line;
                            if (toNodeFirstLine !== toNodeLast) toNodeLast -= 1;
                            let node = [toNodeFirstLine, toNodeLast];
                            let findNode = checkNodeExists(useCell.nodes, node);
                            if (typeof findNode === 'undefined'){
                                findNode = node;
                                //useCell.nodes.push(node);
                            }
                            useNode = findNode;
                        }
                    }
                });
            }
            /*if (py.printNode(flow.fromNode) !== '1, 1'){
                console.log(py.printNode(flow.fromNode) +  " -> " + py.printNode(flow.toNode));
            }*/
            if (defCell !== undefined && useCell !== undefined && !useCell.ancestors.includes(defCell.idx)){
                if (defCell !== useCell || arraysEqual(defNode, useNode)){
                    useCell.addAncestor(defCell.idx);
                    useCell.relations.push({neighbor: defCell.idx, variable: name});
                    defCell.addDescendant(useCell.idx);
                    defCell.relations.push({neighbor: useCell.idx, variable: name});
                }
            }
        }

        items.forEach(flow =>{
            if (flow.fromRef !== undefined && flow.toRef !== undefined){
                let useLoc = flow.toRef.location.first_line;
                name = flow.fromRef.name;
                cells.forEach(cell => {
                    cell.nodes.forEach(node =>{
                        if (isInBoundaries(useLoc, node)){
                            cell.addDef(node[2], name, useLoc);
                        }
                    });
                });
            }
        });
        return { cellList: cells };
    },

    calculateDepsAll: function(cells, idx){
        return {
            ancestors: this.cellSetToArray(this.breadthFirstSearch(cells, idx)),
            descendants: this.cellSetToArray(this.breadthFirstSearch(cells, idx, true))
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
    // idx is the index of the cell that is currently being run
    simulateExecutionOrder: function(cell, globalState){
        if (globalState === undefined) globalState = new State();
        return cell.apply(globalState);
    },

    simulateTopDown: function(cells){
        let state = new State();
        let outputs = [];
        cells.forEach( cell => {
            let result = cell.apply(state);
            state = result.globalState;
            outputs.push(result.cellState);
        });
        return outputs;
    },

    isSameState: function(x, y){
        return (x.toString() === y.toString());
    },

	breadthFirstSearch: function(cells, idx, searchDependents=false){
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
					if (!visited.has(neighbor)){
						stack.push(neighbor);
					}
				});
			}
		}
		visited.delete(cell);
		return visited;
	},

	cellSetToArray: function(cells){
		let array = [];
		cells.forEach(cell => array.push(parseInt(cell._idx)));
		return array.sort((a, b) => a - b)
	}
}
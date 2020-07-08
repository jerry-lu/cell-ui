const py = require("../../python-program-analysis");
const { Cell } = require('./cells.js');
const { State } = require('./state.js');

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

        let tree = py.parse(this.convertToPython(cells));
		let cfg = new py.ControlFlowGraph(tree);
		let analyzer = new py.DataflowAnalyzer();
		let flows = analyzer.analyze(cfg).dataflows;

        for (let flow of flows.items) {
            let defCell;
            let useCell;
            let def;
            let use;
            let fromNodeLineNo = flow.fromNode.location.first_line;
            let toNodeLineNo = flow.toNode.location.first_line;

            if (flow.fromRef !== undefined && flow.toRef !== undefined){
                def = flow.fromRef.name;
                use = flow.toRef.name;
            }
    
            cells.forEach(cell => {
                if (cell.lineNos !== undefined){
                    if (this.isInCellBoundaries(fromNodeLineNo, cell.lineNos)){
                        defCell = cell;
                        if (def !== undefined){ defCell.addDef(def); }
                    }
                    if (this.isInCellBoundaries(toNodeLineNo, cell.lineNos)){
                        useCell = cell;
                        if (use !== undefined){ useCell.addUse(use); }
                    }
                }
            });

            //console.log(py.printNode(flow.fromNode) +  " -> " + py.printNode(flow.toNode))

            if (defCell !== undefined && useCell !== undefined && !useCell.ancestors.includes(defCell.idx)){
                useCell.addAncestor(defCell.idx);
                defCell.addDescendant(useCell.idx);
            }
        }
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
        if (globalState === undefined){
            globalState = new State();
        }
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

    isInCellBoundaries: function(lineNo, cellLineNos){
	    let first = cellLineNos[0];
	    let last = cellLineNos[1];
	    return (lineNo >= first && lineNo <= last);
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
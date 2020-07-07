const utils = require('./cell_utils.js');
const { Cell } = require('./cells.js');
const { State, CellOutput } = require('./state.js');
const _ = require("lodash");

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

        let text = this.convertToPython(cells)
        let flows = utils.getDefUse(text);

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
                    if (utils.isInCellBoundaries(fromNodeLineNo, cell.lineNos)){
                        defCell = cell;
                        if (def !== undefined){ defCell.addDef(def); }
                    }
                    if (utils.isInCellBoundaries(toNodeLineNo, cell.lineNos)){
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

        return {
            cellList: cells,
        };
    },

    calculateDepsAll: function(cells, idx){
        return {
            ancestors: utils.cellSetToArray(utils.breadthFirstSearch(cells, idx)),
            descendants: utils.cellSetToArray(utils.breadthFirstSearch(cells, idx, true))
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
    }
}
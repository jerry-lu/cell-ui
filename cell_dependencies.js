var utils = require("./cell_utils.js");
var py = require("../../python-program-analysis");
const { Cell } = require("./cells.js");
require('./cells.js');

module.exports = {
    constructCells: function(notebook){
        const notebookJson = JSON.parse(notebook);

        if (notebookJson.nbformat < 4){
            console.log(`Error: ${notebook} Notebook version out of date`);
            return;
        }

        let cells = [];

        notebookJson.cells.map((element, index) => {
            if (element.cell_type === 'code'){
                let cell = new Cell(element, index);
                cells.push(cell)
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
                    line = "#" + line;
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
            let fromNodeLineNo = flow.fromNode.location.first_line;
            let toNodeLineNo = flow.toNode.location.first_line;
    
            cells.forEach(cell => {
                if (cell.lineNos !== undefined){
                    if (utils.isInCellBoundaries(fromNodeLineNo, cell.lineNos)){
                        defCell = cell;
                    }
                    if (utils.isInCellBoundaries(toNodeLineNo, cell.lineNos)){
                        useCell = cell;
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
            ancestors: cells[idx]._ancestors,
            descendants: cells[idx]._descendants
        };
    }
}
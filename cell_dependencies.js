var utils = require("./cell_utils.js");
var py = require("../../python-program-analysis");

module.exports = {
    calculateCells: function(notebook, cellNo){
        const notebookJson = JSON.parse(notebook);
        
        //dict is a dictionary pointing from execution_count to the corresponding cell 
        let dict = new Object();
        let cells = [];
        let text = "while(True):";
        let currentLine = 2;
        
        if (notebookJson.nbformat < 4){
            console.log(`Error: ${notebook} Notebook version out of date`);
            return;
        }

        for (let cell of notebookJson.cells){
            if (cell.cell_type === 'code'){
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
                cell.dependentOn = [];
                cell.dependents = [];
                currentLine += cellLength + 1;
                cells.push(cell);
                dict[cell.execution_count] = cell;
            }
        }

        flows = utils.getDefUse(text);

        for (let flow of flows.items) {
            let defCell;
            let useCell;
            let fromNodeLineNo = flow.fromNode.location.first_line;
            let toNodeLineNo = flow.toNode.location.first_line;
    
            cells.forEach(function(currentCell){
                if (currentCell.lineNos !== undefined){
                    if (utils.isInCellBoundaries(fromNodeLineNo, currentCell.lineNos)){
                        defCell = currentCell;
                    }
                    if (utils.isInCellBoundaries(toNodeLineNo, currentCell.lineNos)){
                        useCell = currentCell;
                    }
                }
            });

            //console.log(py.printNode(flow.fromNode) +  " -> " + py.printNode(flow.toNode))

            if (defCell !== undefined && useCell !== undefined && !useCell.dependentOn.includes(defCell.execution_count)){
                useCell.dependentOn.push(defCell.execution_count);
                defCell.dependents.push(useCell.execution_count);
            }
        }

        return {
            cellList: cells,
            dict: dict
        };
    },

    calculateDeps: function(selectedCell, dict){
        return {
            ancestors: utils.cellSetToArray(utils.breadthFirstSearch(selectedCell, dict)),
            descendants: utils.cellSetToArray(utils.breadthFirstSearch(selectedCell, dict, true))
        };
    }
}
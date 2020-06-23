var utils = require("./cell_utils.js");

function printDependencies(cells, printMode, dict){
    for (let cell of cells){
        cell.dependentOn.forEach(element =>
            console.log(utils.printCell(element, printMode, dict) + " -> " + utils.printCell(cell.execution_count, printMode, dict)));
    }
}


module.exports = {
    calculateCells: function(notebook, cellNo){
        const notebookJson = JSON.parse(notebook);
        
        //dict is a dictionary pointing from execution_count to the corresponding cell 
        let dict = new Object();
        let cells = [];
        let text = "";
        let currentLine = 1;
        
        if (notebookJson.nbformat < 4){
            console.log(`Error: ${notebook} Notebook version out of date`);
            return;
        }

        for (let cell of notebookJson.cells){
            if (cell.cell_type === 'code'){
                var sourceCode = "";
                for (let line of cell.source) {
                    if (line[0] == '%' || line[0] == '!') {
                        line = "#" + line;
                    }
                    sourceCode += line;
                }
                let cellLength = cell.source.length;
                text += sourceCode + "\n";
                cell.lineNos = [currentLine, currentLine + cellLength - 1];
                cell.dependentOn = [];
                cell.dependents = [];
                currentLine += cellLength;
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
    
            cells.forEach(function(item){
                if (utils.isInCellBoundaries(fromNodeLineNo, item.lineNos)){
                    defCell = item;
                } else if (utils.isInCellBoundaries(toNodeLineNo, item.lineNos)){
                    useCell = item;
                }
            })
    
            if (useCell !== undefined && !useCell.dependentOn.includes(defCell.execution_count)){
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
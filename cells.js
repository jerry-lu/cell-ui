const {CellOutput} = require('./state.js');
class Cell {
    constructor(cellJson, idx){
        this.cellType = cellJson.cell_type;
        this.executionCount = cellJson.execution_count;
        this.source = cellJson.source;
        this.ancestors = [];
        this.descendants = [];
        this.defs = new Set();
        this.uses = new Set();
        this.cellFunc = 'f';
        this.idx = idx;
        this.topDownOutput = undefined;
    }
    addAncestor(a){
        this.ancestors.push(a);
    }
    addDescendant(d){
        this.descendants.push(d);
    }
    addDef(d){
        this.defs.add(d);
    }
    addUse(u){
        this.uses.add(u);
    }
    convert(){
        this.defs = [...this.defs];
        this.uses = [...this.uses];
    }
    get topDownOutput(){
        return this._topDownOutput;
    }
    set topDownOutput(topDownOutput){
        this._topDownOutput = topDownOutput;
    }
    get idx(){
        return this._idx;
    }
    set idx(idx){
        this._idx = idx;
    }
    set currentInput(input){
        this._currentInput = input;
    }
    get currentInput(){
        return this._currentInput
    }
    
    nextCellFunc(){
        let code = this.cellFunc.charCodeAt();
        this.cellFunc = String.fromCharCode(code + 1);
    }
    apply(state){
        let globalState;
        let cellState;
        let cellFunc = this.cellFunc;
        let foo = new CellOutput(this._idx, state, this.defs);
        return {globalState: globalState, cellState: cellState}
    }
}

module.exports = { Cell };
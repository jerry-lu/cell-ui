const {CellOutput, State} = require('./state.js');
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
        this.version = 0;
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
    incrementVersion(key='version'){
        this[key] = (this[key] + 1) || 0;
    }
    apply(state){
        let globalState = state;
        let cellState = new State();
        let output = new CellOutput(this._idx, this.version, state, this.defs, this.uses);
        if (output.argsIn === undefined){
            this.defs.forEach(def => {
                cellState.update(def, 'α_' + this.version);
            });
        } else {
            this.defs.forEach(def => {
                cellState.update(def, output);
            });
        }
        for (const [key, value] of Object.entries(cellState)) {
            globalState.update(key, value);
        }
        return {globalState: globalState, cellState: cellState};
    }
}

module.exports = { Cell };
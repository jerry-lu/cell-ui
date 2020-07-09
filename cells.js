const {CellOutput, State} = require('./state.js');

class Cell {
    constructor(cellJson, idx){
        this.cellType = cellJson.cell_type;
        this.executionCount = cellJson.execution_count;
        this.source = cellJson.source;
        this.ancestors = [];
        this.descendants = [];
        this.defs = new Object();
        this.uses = new Set();
        this.cellFunc = 'f';
        this.version = 0;
        this.idx = idx;
        this.topDownOutput = undefined;
        this.relations = [];
        this.nodes = [];
    }
    addAncestor(a){
        this.ancestors.push(a);
    }
    addDescendant(d){
        this.descendants.push(d);
    }
    addDef(def, term){
        let l = this.defs[def];
        if (l === undefined){
            this.defs[def] = [];
        }
        if (typeof term !== 'undefined') {
            if (!this.defs[def].includes(term)){ 
                this.defs[def].push(term)
            }
        }
    }
    addUse(u){
        this.uses.add(u);
    }
    convert(){
        this.defs = Object.entries(this.defs);
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
        this.defs.forEach(entry => {
            const def = entry[0];
            const uses = entry[1];
            let output = new CellOutput(this._idx, this.version, state, uses);
            if (output.argsIn === undefined){
                output = 'α_' + this.version;
            }
            cellState.update(def, output);
            globalState.update(def, output);
        });
        return {globalState: globalState, cellState: cellState};
    }
}

class Node {
    constructor(firstLine, lastLine){
        this.first = firstLine;
        this.last = lastLine;
    }
}

module.exports = { Cell, Node };
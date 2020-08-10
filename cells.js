const {CellOutput, State} = require('./state.js');

class Cell {
    constructor(cellJson, idx){
        this.cellType = cellJson.cell_type;
        this.executionCount = cellJson.execution_count;
        this.source = cellJson.source;
        this.ancestors = [];
        this.descendants = [];
        this.defs = new Object();
        this.uses = [];
        this.version = 0;
        this.idx = idx;
        this.relations = [];
        this.nodes = [];
    }
    addAncestor(a){
        this.ancestors.push(a);
    }
    addDescendant(d){
        this.descendants.push(d);
    }
    addDef(def, term, lineNo){
        if (this.defs[def] === undefined){
            this.defs[def] = {terms: [], lineNo: undefined};
        }
        let l = this.defs[def];
        if (typeof term !== 'undefined' && !l.terms.includes(term)) {
            l.terms.push(term);
        }
        if (typeof lineNo !== 'undefined'){
            l.lineNo = lineNo;
        }
    }
    addUse(u){
        if (!this.uses.includes(u)) this.uses.push(u);
    }
    convert(){
        this.defs = Object.entries(this.defs);
        this.uses = [...this.uses];
    }
    get idx(){
        return this._idx;
    }
    set idx(idx){
        this._idx = idx;
    }
    incrementVersion(key='version'){
        this[key] = (this[key] + 1) || 0;
    }
    apply(state){
        let globalState = state;
        let cellState = new State();
        let entries = Object.entries(this.defs);
        entries.sort((a,b) => (a[1].lineNo > b[1].lineNo) ? 1 : ((b[1].lineNo > a[1].lineNo) ? -1 : 0)); 
        entries.forEach(entry => {
            const def = entry[0];
            let uses = entry[1].terms;
            let output = new CellOutput(this._idx, this.version, state, uses);
            if (output.argsIn === undefined){
                output = `α${this._idx}_${this.version}`;
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
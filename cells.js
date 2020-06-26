class Cell {
    constructor(cellJson, idx){
        this.cellType = cellJson.cell_type;
        this.executionCount = cellJson.execution_count;
        this.metadata = cellJson.metadata;
        this.outputs = cellJson.outputs;
        this.source = cellJson.source;
        this.ancestors = [];
        this.descendants = [];
        this.idx = idx;
    }
    set ancestors(ancestors){
        this._ancestors = ancestors;
    }
    get ancestors(){
        return this._ancestors;
    }
    set descendants(descendants){
        this._descendants = descendants;
    }
    get descendants(){
        return this._descendants;
    }
    addAncestor(a){
        this._ancestors.push(a);
    }
    addDescendant(d){
        this._descendants.push(d);
    }
    get idx(){
        return this._idx;
    }
    set idx(idx){
        this._idx = idx;
    }
}

module.exports = { Cell };
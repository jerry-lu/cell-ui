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
    set currentInput(input){
        this._currentInput = input;
    }
    get currentInput(){
        return this._currentInput
    }
    apply(map){
        let output = new Map();
        let parents = this._ancestors;
        if (parents === undefined || parents.length == 0){
            return "\u03B1";
        } else {
            let or = false
            parents.forEach(parent => {
                if (map.has(parent)){
                    output.set(parent, map.get(parent));
                    or = true;
                } else {
                    output.set(parent, '\u00f8');
                }
            });
            // do something with the 'or' variable to indicate whether this is a valid sequence
            return output;
        }
    }
}

module.exports = { Cell };
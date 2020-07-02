class Cell {
    constructor(cellJson, idx){
        this.cellType = cellJson.cell_type;
        this.executionCount = cellJson.execution_count;
        //this.metadata = cellJson.metadata;
        this.outputs = cellJson.outputs;
        this.source = cellJson.source;
        this.ancestors = [];
        this.descendants = [];
        this.defs = new Set();
        this.uses = new Set();
        this.idx = idx;
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
    old_apply(map){
        let output = new Map();
        let parents = this.ancestors;
        if (parents === undefined || parents.size == 0){
            return "\u03B1";
        } else {
            parents.forEach(parent => {
                if (map.has(parent)){
                    output.set(parent, map.get(parent));
                    or = true;
                } else {
                    output.set(parent, '\u00f8');
                }
            });
            return output;
        }
    }
    apply(map){
        let inputs = new Map();
        let output = new Map();
        if (this.uses === undefined || this.uses.length == 0){
            return "\u03B1"; //alpha 
        } else {
            this.uses.forEach(input => {
                if (map.has(input)){
                    inputs.set(input, map.get(input));
                } else {
                    inputs.set(input, '\u00f8'); //ø
                }
            });

            if (this.defs !== undefined){
                this.defs.forEach(definition => {
                    output.set(definition, inputs);
                });
            }
            return output;
        }

    }
}

module.exports = { Cell };
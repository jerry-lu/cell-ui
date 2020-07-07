class State{
    constructor(){
    }
    update(key, value){
        this[key] = value;
    }
    toString(){
       return JSON.stringify(this);
    }
}

class CellOutput {
    constructor(idx, version, state, defs, uses){
        this.idx = idx;
        this.v = version;
        this.argsIn = new State();
        //get subset of state that we're interested in
        if (uses.length == 0){
            this.argsIn = undefined;
        } else {
            for (const [key, value] of Object.entries(state)) {
                if (uses.includes(key)){
                    this.argsIn.update(key, value);
                }
            }
        }
    }
}

module.exports = {State, CellOutput};
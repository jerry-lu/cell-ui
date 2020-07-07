class State{
    constructor(){
    }
    update(key, value){
        this[key] = value;
    }
    toString(){
       //return Object.entries(this).sort((a, b) => b[0].localeCompare(a[0]));
       return JSON.stringify(this);
    }
}

class CellOutput {
    constructor(idx, state, defs){
        this.idx = idx;
        this.state = new State();
        for (const [key, value] of Object.entries(state)) {
            if (defs.includes(key)){
                this.state.update(key, value);
            }
        }
    }
}

module.exports = {State, CellOutput};
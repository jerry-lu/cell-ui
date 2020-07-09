class State{
    constructor(){
    }
    update(key, value){
        this[key] = value;
    }
    toString(tabLevel){
        let tabs;
        if (tabLevel === undefined){ tabs = 0; } 
        else { tabs = tabLevel;}
        let str = '';
        const tab = ' ';
        let counter = 0;
        let entries = Object.entries(this);
        for (const [key, value] of entries) {
            str += `${tab.repeat(tabs)}${key}: ${value.toString(tabs)}`;
            if (counter++ !== entries.length){
                str += '\n'
            }
        }
        return str;
    }
}

class CellOutput {
    constructor(idx, version, state, uses){
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
    toString(tabLevel){
        let code = 102; // ascii 102 is f
        let glyph = String.fromCharCode(code + this.v);
        let str = `${glyph}_${this.idx}(\n${this.argsIn.toString(tabLevel + 1)})`;
        return str;
    }
}

module.exports = {State, CellOutput};
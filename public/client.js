const header = { 'Accept': 'application/json', 'Content-Type': 'application/json' }
let executionLog = []
let cells;

$("input-file").addEventListener('input', readNotebook);

function readNotebook(event) {
    const input = event.target;
    let file = input.files[0];
    resetModifications();
    readFileContent(file)
        .then(function(result) {
            fetch('/input', {
                method: 'POST',
                headers: header,
                body: JSON.stringify({notebook: result})
            })
                .then(function(response) {
                    if(response.ok) return response.json();
                    throw new Error('Request failed');
                })
                .then(function(data) {
                    clearBox('order', 'Execution Order:');
                    clearBox('svg-canvas');                
                    cells = data.cellList;
                    displayCells(cells);
                    addElement('button', 'displayEdges', 'displayButton',
                        'Show dependency visualization', createGraph, $('button-div'));
                })
                .catch(function(error) {
                    console.log(error);
                });
        });
}

function modifyCell(event) {
    let cell = event.target.parentElement;
    let idx = cell.idx;
    fetch('/modify', {
        method: 'POST',
        headers: header,
        body: JSON.stringify({ idx: idx })
    })
        .then(function(response) {
            if(response.ok) return response.json();
            throw new Error('request failed.');
        })
        .then(function(data) {
            let invalidCells = getCellsfromIndex(data.invalidCells);
            cell.version = data.version;
            cell.invalid = invalidCells;
            cell.classList.add('modified');
            cell.classList.remove('stale', 'unexecuted');
        })
        .catch(function(error) {
            console.log(error);
        });
}

function compareExecOrder(idx, cell) {
    fetch('/compare', {
        method: 'POST',
        headers: header,
        body: JSON.stringify({
            index: idx,
        })
    })
        .then(function(response) {
            if(response.ok) return response.json();
            throw new Error('Request failed');
        })
        .then(function(data) {
            displayCompareResult(data, cell);
        })
        .catch(function(error) {
            console.log(error);
        });
}

function runCell(event) {
    let cell = event.target.parentElement;
    let idx = cell.idx;
    let version = cell.version;
    if (typeof cell.invalid !== 'undefined'){
        setInvalid(cell.invalid);
        cell.invalidCells = undefined;
        cell.classList.remove('stale', 'unexecuted', 'modified');
    }
    updateExecOrder(idx, version);
    compareExecOrder(idx, cell);
}

function addElement(tag, id, cName, innerHTML, func, parent) {
    let element = $(id);
    if (element === null){
        let eltTag = (typeof tag === 'undefined') ? 'div' : tag;
        element = document.createElement(eltTag);
        if (typeof id !== 'undefined') element.id = id;
        if (typeof cName !== 'undefined') element.className = cName;
        if (typeof innerHTML !== 'undefined') element.innerHTML = innerHTML;
        if (typeof func !== 'undefined') element.addEventListener('click', func);
        if (typeof parent !== 'undefined') parent.appendChild(element)
    }
    return element;
}

function readFileContent(file) {
	const reader = new FileReader();
    return new Promise((resolve, reject) => {
        reader.onload = event => resolve(event.target.result)
        reader.onerror = error => reject(error)
        reader.readAsText(file)
    });
}

function displayCells(cells) {
    clearBox('cells-div');
    for (let cell of cells){
        let pre = document.createElement('pre');
        $('cells-div').appendChild(pre);

        let cellBody = addElement('code', undefined, 'cell unexecuted', cell.source.join(''), undefined, pre);
        cellBody.idx = cell._idx;
        cellBody.version = cell.version;

        addElement('button', `runCell${cell._idx}`, 'cellButton', cell._idx, runCell, cellBody);
        addElement('button', `modCell${cell._idx}`, 'modButton', 'Δ', modifyCell, cellBody);
    }
    addElement('button', 'reset', 'resetButton', 'Reset Execution Order',
        resetExecutionOrder, $('order-div'));
    addElement('button', 'modReset', 'modResestButton', 
        'Reset Modifications and Order', resetModifications, $('order-div'));
}

function updateExecOrder(idx, version) {
    let order = $('order');
    if (order === null){
        addElement('h4', 'order', undefined, '', undefined, $('order-div'));
    }
    executionLog.push(`${idx}.${version}`);
    order.innerHTML = 'Execution Order: ' + executionLog.join(', ');
}

function displayCompareResult(data, cell) {
    let pre = cell.parentElement;
    const searchString = 'outputJson' + cell.idx;
    let output = document.getElementById(searchString);
    if (output === null){
        output = addElement('output', searchString, undefined, '', undefined, pre);
    }
    let children = output.parentElement.children;
    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (child.tagName === 'CODE'){
            if ($(`toggle${cell.idx}`) === null) {
                addElement('button', `toggle${cell.idx}`, 'toggle', 'hide', toggleCellOutput, child);
            }
        }
    }
    output.innerHTML = (data.state === '') ? 'output state:\nNone' : 'output state:\n' + data.state;
    let trueOutput = document.getElementById('trueOutput' + cell.idx);
    if (trueOutput === null){
        trueOutput = addElement('output', 'trueOutput' + cell.idx, undefined, '', undefined, pre);
    }
    cell.classList.remove('unexecuted', 'stale');
    if (data.output){ // two states match
        cell.classList.remove('redbox');
        cell.classList.add('greenbox');
        trueOutput.innerHTML = '';
    } else { // states do not match
        cell.classList.remove('greenbox');
        cell.classList.add('redbox');
        trueOutput.innerHTML = 'top-down state:\n' + data.trueState;
        trueOutput.innerHTML += `\nVariables ${data.unequal} do not match top-down, `
            + `most recently modified in cell ${data.mostRecent}`;
    }
}

function resetExecutionOrder() {
    fetch('/reset', {method: 'POST'});
    executionLog = [];
    $('order').innerHTML = 'Execution Order:';
    clearResults();
}

function resetModifications() {
    fetch('/resetMods', {method: 'POST'});
    resetExecutionOrder();
}

function clearResults() {
    Array.from(document.getElementsByClassName('cell')).forEach(element =>{
        element.classList.remove('stale', 'redbox', 'greenbox');
        element.classList.add('unexecuted');
    });
    Array.from(document.getElementsByTagName('output')).forEach(element =>{
        element.innerHTML = '';
        element.style.visibility = 'visible';
        element.style.maxHeight = '';
    });
    Array.from(document.getElementsByClassName('toggle')).forEach( element => {
        element.innerHTML = ' ';
    });
}

// indicate 'invalid' cells. Cells are invalid if a parent cell was modified.
function setInvalid(cells) {
    cells.forEach(element => {
        element.classList.add('stale');
        element.classList.remove('redbox', 'greenbox');
    });
}

function getCellsfromIndex(list) {
    let cells = [];
    Array.from(document.getElementsByClassName('cell')).forEach(element =>{
        if (list.includes(element.idx)) cells.push(element);
    })
    return cells;
}

function clearBox(elementID, text) {
    let newstr = (typeof text === 'undefined') ? '' : text;
    document.getElementById(elementID).innerHTML = newstr;
}

// return whether or not the current element is visible
// if visible after toggling, return true
function toggleVisibility(element) {
    if (element.style.visibility === 'hidden') {
        element.style.visibility = 'visible';
        element.style.maxHeight = '';
        return true;
    } else {
        element.style.visibility = 'hidden';
        element.style.maxHeight = 0;
        return false;
    }
} 

function toggleCellOutput(event) {
    let button = event.target;
    let parent = event.target.parentElement.parentElement;

    let children = parent.children;
    for (let i = 0; i < children.length; i++) {
        let child = children[i];
        if (child.tagName === 'OUTPUT'){
            let result = toggleVisibility(child);
            button.innerHTML = result ? 'hide' : 'show';
        }
    }
}

function $(x) {return document.getElementById(x);} 

function intersection(arr1, arr2) {
    return arr1.filter(x => arr2.includes(x));
}

function createGraph(labelEdges=true) {
    let g = new dagreD3.graphlib.Graph()
        .setGraph({})
        .setDefaultEdgeLabel(function() { return {}; });

    let arr = [];
    cells.forEach(cell => {
        let from = cell._idx;
        cell.descendants.forEach(to =>{
            arr.push({from: from, to: to});
        });
    });
    
    arr.forEach(flow =>{
        let defs = []
        Object.entries(cells[flow.from].defs).forEach(entry => {
            defs.push(entry[0]);
        });
        let uses = cells[flow.to].uses;
        g.setNode(flow.from, {label: String(flow.from)});
        g.setNode(flow.to, {label: String(flow.to)});

        // make edges, include label if labelEdges is true
        if (labelEdges){
            g.setEdge(flow.from, flow.to, {label: intersection(defs, uses).join(' ')});
        } else {
            g.setEdge(flow.from, flow.to);
        }
    });

    g.nodes().forEach(function(v) {
        var node = g.node(v);
        // Round the corners of the nodes
        node.rx = node.ry = 5;
    });

    // Create the renderer
    var render = new dagreD3.render();

    // Set up an SVG group so that we can translate the final graph.
    var svg = d3.select("svg"),
        svgGroup = svg.append("g"),
        inner = svg.select("g");
        
    var zoom = d3.zoom().on("zoom", function() {
        inner.attr("transform", d3.event.transform);
        });
    svg.call(zoom);

    // Run the renderer. This is what draws the final graph.
    render(d3.select("svg g"), g);
    
    // Center the graph
    var xCenterOffset = (svg.attr("width") - g.graph().width) / 2;
    svgGroup.attr("transform", "translate(" + xCenterOffset + ", 20)");

    var initialScale = 0.9;
    svg.call(zoom.transform, d3.zoomIdentity.translate((svg.attr("width")
        - g.graph().width * initialScale) / 2, 20).scale(initialScale));
    svg.attr('height', g.graph().height * initialScale + 40);
}

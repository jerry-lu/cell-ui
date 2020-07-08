const header = {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
}

let executionLog = []
let cells;

$("input-file").addEventListener('change', readNotebook);

function readNotebook(event) {
    const input = event.target;
    let file = input.files[0];
    readFileContent(file)
        .then(function(result){
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
                    cells = data.cellList;
                    displayCells(cells);
                    clearBox('order', 'Execution Order:');
                    clearBox('svg-canvas');
                    clearResults();
                    executionLog = [];
                    addButton('displayEdges', 'Show dependency visualization', showGraph, 'button-div');
                })
                .catch(function(error) {
                    console.log(error);
                });
        });
}

function modifyCell(event){
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
            setInvalid(invalidCells);
            setValid([cell]);
            runCell(event);
        })
        .catch(function(error) {
            console.log(error);
        });
}

function compareExecOrder(idx, cell){
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

function showGraph(){
    fetch('/edges', {method: 'GET'})
        .then(function(response) {
            if(response.ok) return response.json();
            throw new Error('Request failed');
        })
        .then(function(data) {
            createGraph(data);
        })
        .catch(function(error) {
            console.log(error);
        });
}

function runCell(event){
    let cell = event.target.parentElement;
    let idx = cell.idx;
    let version = cell.version;
    updateExecOrder(idx, version);
    compareExecOrder(idx, cell);
}

function addButton(id, innerHTML, func, parent){
    let button = $(id);
    if (button === null){
        let button = document.createElement('button');
        button.id = id;
        button.innerHTML = innerHTML;
        button.addEventListener('click', func);
        $(parent).appendChild(button)
    }
}

function readFileContent(file) {
	const reader = new FileReader();
    return new Promise((resolve, reject) => {
    reader.onload = event => resolve(event.target.result)
    reader.onerror = error => reject(error)
    reader.readAsText(file)
    });
}

function displayCells(cells){
    clearBox('cells-div');
    for (let cell of cells){
        let pre = document.createElement('pre');

        let cellBody = document.createElement('code');
        cellBody.classList.add('cell');
        cellBody.idx = cell._idx;
        cellBody.version = cell.version;
        cellBody.classList.add('unexecuted');
        cellBody.innerHTML = cell.source.join('');

        let execButton = document.createElement('button');
        execButton.className = 'cellButton';
        execButton.innerHTML = cell._idx;
        execButton.addEventListener('click', runCell);

        let modButton = document.createElement('button');
        modButton.className = 'modButton';
        modButton.innerHTML = 'Δ';
        modButton.addEventListener('click', modifyCell);

        cellBody.appendChild(execButton);
        cellBody.appendChild(modButton);
        pre.appendChild(cellBody);
        $('cells-div').appendChild(pre);
    }
}

function setValid(cells){
    cells.forEach(element => {
        element.classList.remove('stale');
        element.classList.remove('unexecuted');
    });
}

function updateExecOrder(idx, version){
    let order = $('order');
    if (order === null){
        let order = document.createElement('h4');
        $('order-div').appendChild(order);
    }
    executionLog.push(`${idx}_v${version}`);
    order.innerHTML = 'Execution Order: ' + executionLog.join(', ');
    addButton('reset', 'Reset Execution Order', resetExecutionOrder, 'order-div');
    addButton('modReset', 'Reset Modifications', resetModifications, 'order-div');
}

function displayCompareResult(data, cell){
    let pre = cell.parentElement;
    const searchString = 'outputJson' + cell.idx;
    let output = document.getElementById(searchString);
    if (output === null){
        output = document.createElement('output');
        output.id = searchString;
        pre.appendChild(output);
    }
    output.innerHTML = 'output state:\n' + data.state;

    let trueOutput = document.getElementById('trueOutput' + cell.idx);
    cell.classList.remove('unexecuted');
    cell.classList.remove('stale');
    if (data.output){
        cell.classList.remove('redbox');
        cell.classList.add('greenbox');
        if (trueOutput !== null){
            trueOutput.innerHTML = '';
        }
    } else {
        cell.classList.remove('greenbox');
        cell.classList.add('redbox');
        if (trueOutput === null){
            trueOutput = document.createElement('output');
            trueOutput.id = 'trueOutput' + cell.idx;
            pre.appendChild(trueOutput);
        }
        trueOutput.innerHTML = 'top-down state:\n' + data.trueState;
    }
}

function resetExecutionOrder(){
    fetch('/reset', {
        method: 'POST',
    });
    executionLog = [];
    $('order').innerHTML = 'Execution Order:';
    clearResults();
}

function resetModifications(){
    fetch('/resetMods', {
        method: 'POST',
    });
    clearResults();
}

function clearResults(){
    Array.from(document.getElementsByClassName('cell')).forEach(element =>{
        element.classList.remove('stale');
        element.classList.remove('redbox');
        element.classList.remove('greenbox');
        element.classList.add('unexecuted');
    });
    Array.from(document.getElementsByTagName('output')).forEach(element =>{
        element.innerHTML = '';
    });
}

// indicate which cells are 'invalid'. Cells are invalid
// if a parent cell was modified.
function setInvalid(cells){
    cells.forEach(element => {
        element.classList.add('stale');
        element.classList.remove('redbox');
        element.classList.remove('greenbox');
    });
}

function getCellsfromIndex(list){
    let cells = [];
    Array.from(document.getElementsByClassName('cell')).forEach(element =>{
        if (list.includes(element.idx)){
            cells.push(element)
        }
    })
    return cells;
}

function clearBox(elementID, text)
{
    let newstr = ''
    if (text !== undefined){
        newstr = text;
    }
    document.getElementById(elementID).innerHTML = newstr;
}

function toggleVisibility(id) {
    var element = $(id);
    if (element.style.visibility === 'hidden') {
        element.style.visibility = 'visible';
    } else {
        element.style.visibility = 'hidden';
    }
} 

function $(x) {return document.getElementById(x);} 

function intersection(arr1, arr2){
    return arr1.filter(x => arr2.includes(x));
}

function createGraph(flows, labelEdges=true){
    let g = new dagreD3.graphlib.Graph()
        .setGraph({})
        .setDefaultEdgeLabel(function() { return {}; });

    flows.forEach(flow =>{
        let defs = cells[flow.from].defs;
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
    svg.call(zoom.transform, d3.zoomIdentity.translate((svg.attr("width") - g.graph().width * initialScale) / 2, 20).scale(initialScale));
    svg.attr('height', g.graph().height * initialScale + 40);
}

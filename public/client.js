const header = {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
}

let executionLog = []
let cells;
const input = document.getElementById("input-file");
input.addEventListener('change', readNotebook);

function readNotebook() {
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
                    displayCells(data.cellList);
                    cells = data.cellList;
                    clearBox('order', 'Execution Order:');
                    clearBox('svg-canvas');
                    clearLog();
                    clearResults();
                    createVisualizationButton();
                })
                .catch(function(error) {
                    console.log(error);
                });
        });
}

function runCell(event){
    let cell = event.target.parentElement;
    let idx = cell.parentElement.idx;
    updateExecOrder(idx);
    compareExecOrder(idx, cell);
}

function modifyCell(event){
    let cell = event.target.parentElement;
    let idx = cell.parentElement.idx;
    fetch('/modify', {
        method: 'POST',
        headers: header,
        body: JSON.stringify({ idx: idx })
    })
        .then(function(response) {
            if(response.ok) return response.json();
            throw new Error('request failed.');
        })
        .then(function(data){
            let invalidCells = getCellsfromIndex(data);
            setInvalid(invalidCells);
            setValid([cell.parentElement]);
            runCell(event);
        })
        .catch(function(error){
            console.log(error);
        });
}


function compareExecOrder(idx, cell){
    fetch('/compare', {
        method: 'POST',
        headers: header,
        body: JSON.stringify({
            index: idx,
            order: executionLog
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
        .then(function(data){
            createGraph(data);
        })
        .catch(function(error){
            console.log(error);
        });
}

function createVisualizationButton(){
    let check = $('displayEdges');
    if (check === null){
        let buttonDiv = $('button-div');
        let button = document.createElement('button');
        button.id = 'displayEdges';
        button.innerHTML = 'Display dependency visualization';
        button.addEventListener('click', showGraph);
        buttonDiv.appendChild(button);
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
        pre.classList.add('cell');
        pre.classList.add('unexecuted');
        pre.idx = cell._idx;

        let cellBody = document.createElement('code');

        let execButton = document.createElement('button');
        execButton.className = 'cellButton';
        execButton.innerHTML = cell._idx;
        execButton.addEventListener('click', runCell);

        let modButton = document.createElement('button');
        modButton.className = 'modButton';
        modButton.innerHTML = 'Δ';
        modButton.addEventListener('click', modifyCell);

        cellBody.innerHTML = cell.source.join('');
        cellBody.appendChild(execButton);
        cellBody.appendChild(modButton);
        pre.appendChild(cellBody);


        document.getElementById('cells-div').appendChild(pre);
    }
}

function setValid(cells){
    cells.forEach(element => {
        element.classList.remove('stale');
        element.classList.remove('unexecuted');
    });
}

function updateExecOrder(idx){
    executionLog.push(idx);
    let order = $('order');
    if (order === null){
        let orderDiv = document.getElementById('order-div');
        let order = document.createElement('h4');
        orderDiv.appendChild(order);
    }
    order.innerHTML = 'Execution Order: ' + executionLog;
    addResetButton();
}

function displayCompareResult(data, cell){
    let pre = cell.parentElement;
    const searchString = 'outputJson' + pre.idx;
    let output = document.getElementById(searchString);
    if (output === null){
        output = document.createElement('output');
        output.id = searchString;
        pre.appendChild(output);
    }
    output.innerHTML = 'output state:' + JSON.stringify(data.state, null, 1);

    let trueOutput = document.getElementById('trueOutput' + pre.idx);
    pre.classList.remove('unexecuted');
    pre.classList.remove('stale');
    if (data.output){
        pre.classList.remove('redbox');
        pre.classList.add('greenbox');
        if (trueOutput !== null){
            trueOutput.innerHTML = '';
        }
    } else {
        pre.classList.remove('greenbox');
        pre.classList.add('redbox');
        if (trueOutput === null){
            trueOutput = document.createElement('output');
            trueOutput.id = 'trueOutput' + pre.idx;
            pre.appendChild(trueOutput);
        }
        trueOutput.innerHTML = 'top-down state:' + JSON.stringify(data.trueState, null, 1);
    }
}

function resetExecutionOrder(){
    fetch('/reset', {
        method: 'POST',
    });
    executionLog = [];
    Array.from(document.getElementsByClassName('cell')).forEach(element =>{
        element.classList.remove('stale');
        element.classList.remove('redbox');
        element.classList.remove('greenbox');
        element.classList.add('unexecuted');
    });

    Array.from(document.getElementsByTagName('output')).forEach(element =>{
        element.innerHTML = '';
    });
    let order = $('order');
    order.innerHTML = 'Execution Order:';
    clearResults();
}

function resetModifications(){
    fetch('/resetMods', {
        method: 'POST',
    });
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

function clearResults(){
    let result = $('result');
    while (result !== null){
        result.remove();
        result = $('result');
    }
}

function addResetButton(){
    let reset = $('reset');
    if (reset === null){
        let reset = document.createElement('button');
        reset.id = 'reset';
        reset.innerHTML = 'Reset Execution Order';
        reset.addEventListener('click', resetExecutionOrder);
        $('order-div').appendChild(reset);
    }

    let modReset = $('modReset');
    if (modReset === null){
        let modReset = document.createElement('button');
        modReset.id = 'modReset';
        modReset.innerHTML = 'Reset Modifications';
        modReset.addEventListener('click', resetModifications);
        $('order-div').appendChild(modReset);
    }

}

// indicate which cells are 'invalid'. Cells are invalid
// if a parent cell was modified.
function setInvalid(cells){
    cells.forEach(element => {
        element.classList.add('stale');
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

function clearLog(){
    executionLog = [];
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

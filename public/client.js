const header = {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
}

let executionLog = []

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
                    clearBox('order', 'Execution order:');
                    clearBox('svg-canvas');
                    clearLog();
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
    fetch('/calculateDeps', {
        method: 'POST',
        headers: header,
        body: JSON.stringify({ idx: idx })
    })
        .then(function(response) {
            if(response.ok) return response.json();
            throw new Error('request failed.');
        })
        .then(function(data){
            let staleCells = getCellsfromIndex(data);
            setInvalid(staleCells);
            setValid([cell.parentElement]);
            updateExecOrder(idx);
        })
        .catch(function(error){
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
        pre.className = 'cell';
        pre.classList.add('unexecuted');

        pre.idx = cell._idx;

        let cellBody = document.createElement('code');
        cellBody.innerHTML = cell.source.join('');

        let execButton = document.createElement('button');
        execButton.className = 'cellButton';
        execButton.innerHTML = cell._idx;
        execButton.addEventListener('click', runCell);

        cellBody.appendChild(execButton);
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

    let compare = $('compare');
    if (compare === null){
        let compare = document.createElement('button');
        compare.id = "compare";
        compare.innerHTML = 'Compare with top-down order';
        compare.addEventListener('click', compareExecOrder);
        $('order-div').appendChild(compare);
    }
    addResetButton();
}

function compareExecOrder(){
    fetch('/compare', {
        method: 'POST',
        headers: header,
        body: JSON.stringify({order: executionLog})
    })
        .then(function(response) {
            if(response.ok) return response.json();
            throw new Error('Request failed');
        })
        .then(function(data) {
            displayCompareResult(data);
        })
        .catch(function(error) {
            console.log(error);
        });
}

function displayCompareResult(data){
    let result = document.createElement('div');
    result.id = 'result';
    if (data === true){
        result.innerHTML = 'Same state as top-down execution';
        result.classList.add('greenbox');
    } else {
        result.innerHTML = 'Current state does not match top-down execution';
        result.classList.add('redbox');
    }
    $('order-div').appendChild(result);
}

function resetExecutionOrder(){
    executionLog = [];
    Array.from(document.getElementsByClassName('cell')).forEach(element =>{
        element.classList.remove('stale');
        element.classList.add('unexecuted');
    });
    let order = $('order');
    order.innerHTML = 'Execution Order:';
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
}

// indicate which cells are 'invalid'. Cells are invalid
// if a parent cell was executed.
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

function createGraph(flows){
    let g = new dagreD3.graphlib.Graph()
        .setGraph({})
        .setDefaultEdgeLabel(function() { return {}; });

    flows.forEach(flow =>{
        g.setNode(flow.from, {label: String(flow.from)});
        g.setNode(flow.to, {label: String(flow.to)});
        g.setEdge(flow.from, flow.to);
    }) 

    // Create the renderer
    var render = new dagreD3.render();

    // Set up an SVG group so that we can translate the final graph.
    var svg = d3.select("svg"),
        svgGroup = svg.append("g");

    // Run the renderer. This is what draws the final graph.
    render(d3.select("svg g"), g);

    // Center the graph
    var xCenterOffset = (svg.attr("width") - g.graph().width) / 2;
    svgGroup.attr("transform", "translate(" + xCenterOffset + ", 20)");
    svg.attr("height", g.graph().height + 40);
}

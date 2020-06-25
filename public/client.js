let dict;

const header = {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
}

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
                    dict = data.dict;
                    displayCells(data.cellList);
                    createVisualizationButton();
                })
                .catch(function(error) {
                    console.log(error);
                });
        });
}

function displayDependencies(event){
    let cell = event.target.parentElement;
    fetch('/calculateDeps', {
        method: 'POST',
        headers: header,
        body: JSON.stringify({ executionCount: cell.parentElement.executionCount })
    })
        .then(function(response) {
            if(response.ok) return response.json();
            throw new Error('request failed.');
        })
        .then(function(data){
            let staleCells = getCellsfromExecCount(data);
            setInvalid(staleCells);
            setValid([cell.parentElement]);
        })
        .catch(function(error){
            console.log(error);
        });
}

function fetchGraph(){
    console.log('click recorded');
    fetch('/edges', {method: 'GET'})
        .then(function(response) {
            if(response.ok) return response.json();
            throw new Error('Request failed');
        })
        .then(function(data){
            renderGraph(data);
        })
        .catch(function(error){
            console.log(error);
        });
}

function createVisualizationButton(){
    let buttonDiv = document.getElementById('button-div');
    let button = document.createElement('button');
    button.id = 'displayEdges';
    button.innerHTML = 'Display dependency visualization';
    button.addEventListener('click', fetchGraph);
    buttonDiv.appendChild(button);
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
        pre.className = 'cell unexecuted';
        pre.executionCount = cell.execution_count;

        let cellBody = document.createElement('code');
        cellBody.innerHTML = cell.source.join('');

        let execCount = document.createElement('button');
        execCount.type = 'button';
        execCount.className = 'cellButton';
        execCount.innerHTML = cell.execution_count;
        execCount.addEventListener('click', displayDependencies);

        cellBody.appendChild(execCount);
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

// indicate which cells are 'invalid'. Cells are invalid
// if a parent cell was executed.
function setInvalid(cells){
    cells.forEach(element => {
        element.classList.add('stale');
    });
}

function getCellsfromExecCount(list){
    let cells = [];
    Array.from(document.getElementsByClassName('cell')).forEach(element =>{
        if (list.includes(element.executionCount)){
            cells.push(element)
        }
    })
    return cells;
}

function clearBox(elementID)
{
    document.getElementById(elementID).innerHTML = '';
}

function renderGraph(flows){
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

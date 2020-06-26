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
                    displayCells(data.cellList);
                    clearBox('order', 'Execution order:');
                    clearBox('svg-canvas');
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
    console.log('click recorded');
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
    let check = document.getElementById('displayEdges');
    if (check === null){
        let buttonDiv = document.getElementById('button-div');
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
        pre.className += ' unexecuted';

        pre.idx = cell._idx;

        let cellBody = document.createElement('code');
        cellBody.innerHTML = cell.source.join('');

        let execButton = document.createElement('button');
        execButton.type = 'button';
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
    let order = document.getElementById('order');
    if (order === null){
        let orderDiv = document.getElementById('order-div');
        let order = document.createElement('h4');
        button.innerHTML = 'Execution Order: ' + idx;
        orderDiv.appendChild(order);
    } else {
        order.innerHTML += '  ' + idx; 
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

console.log('Client-side code running');

const input = document.getElementById("input-file");
let dict;

input.addEventListener('change', function() {
    console.log("input file was changed");
    let file = input.files[0];
    readFileContent(file)
        .then(function(result){
            fetch('/input', {
                method: 'POST',
                headers: {
                  'Accept': 'application/json',
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    notebook: result
                })
            })
                .then(function(response) {
                    if(response.ok) {
                        console.log('input was recorded');
                        return response.json();
                    } else {
                        throw new Error('Request failed');
                    }
                })
                .then(function(data) {
                    dict = data.dict;
                    displayCells(data.cellList);
                })
                .catch(function(error) {
                    console.log(error);
                });
        });
});


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
        //console.log(cell);
        let cellBody = document.createElement('div');
        cellBody.className = 'cell';
        cellBody.innerHTML = cell.source.join('');
        cellBody.dependentOn = cell.dependentOn;
        cellBody.dependents = cell.dependents;
        cellBody.executionCount = cell.execution_count;

        let execCount = document.createElement('button');
        execCount.type = 'button';
        execCount.innerHTML = cell.execution_count;
        execCount.addEventListener('click', displayDependencies);

        cellBody.appendChild(execCount);

        document.getElementById('cells-div').appendChild(cellBody);
    }
}

function displayDependencies(event){
    let cell = event.target.parentElement;
    fetch('/calculateDeps', {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            executionCount: cell.executionCount
        })
    })
        .then(function(response) {
            if(response.ok) return response.json();
            throw new Error('request failed.');
        })
        .then(function(data){
            console.log(data);
            let staleCells = getCellsfromExecCount(data);
            setInvalid(staleCells);
            setValid([cell]);
        });
}

function setValid(cells){
    cells.forEach(element => {
        element.classList.remove('stale');
    });
}

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

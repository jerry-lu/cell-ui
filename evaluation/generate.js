const { textFromHistory } = require('./create_notebooks');
const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'CLEAN');

fs.readdir(directoryPath, function (err, files) {
    console.log('reading ' + directoryPath);

    //handling error
    if (err) {
        return console.log('Unable to scan directory: ' + err);
    } 
    //listing all files using forEach
    files.forEach(function (file) {
        let source = path.join(directoryPath, file);
        //check whether the file is a directory
        if (fs.lstatSync(source).isDirectory()) {
            console.log(`reading from ${file}\n`);
            let tgt = (path.join(__dirname, 'generatednbs', file));
            fs.mkdirSync(tgt, { recursive: true })
            fs.copyFileSync('./helpers.py', path.join(tgt, 'helpers.py'));

            const txt = fs.readFileSync(path.join(source, 'HW5.ipyhistory')).toString();
            const json = JSON.parse(txt);
            const notebooks = json.notebook;  

            let count = 0;
            notebooks.forEach(notebook => {
                let ipynb = textFromHistory(notebook, json, 'cells').nb;
                let data = JSON.stringify(ipynb,null,2);
                fs.writeFileSync(`${tgt}/${file}_${count++}.ipynb`, data);
            });
        }
    });
});
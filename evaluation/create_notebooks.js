const fs = require('fs');
const path = require('path');

const directoryPath = path.join('../../evaluation', 'CLEAN');

function textFromHistory(notebook, json, cellArr, goNode=false){
    let ipynb = {
        "cells": [],
        "metadata": {},
        "nbformat": 4,
        "nbformat_minor": 4
    }
    notebook[cellArr].forEach(cell =>{
        let str = goNode ? cell.node : cell;
        const location = str.split('.');
        const type = location[0];
        const cellNo = location[1];
        const version = location[2];
        if (type === 'c') {
            let target = json.codeCells[cellNo][version];
            let source = [];
            if (target.literal !== undefined){
                source = target.literal.split(/(?<=\n)/);
                if (cellNo > 1) source.splice(0, 0, 'random.seed(36)\n');
            }
            const cell =
            {
                "cell_type" : "code",
                "execution_count": null,
                "metadata" : {},
                "source" : source,
                "outputs": [],
            }
            ipynb.cells.push(cell);
        } else if (type === 'm') {
            let target = json.markdownCells[cellNo][version];
            let mdSource = [];
            if (target.markdown !== undefined){
                mdSource = target.markdown;
            }
            const cell = {
                "cell_type" : "markdown",
                "metadata" : {},
                "source" : mdSource
            }
            ipynb.cells.push(cell);
        }
    });
    return ipynb;
}

function main(directoryPath){
    fs.readdir(directoryPath, function (err, files) {
        console.log('reading from' + directoryPath);

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
                let tgt = (path.join(__dirname, file));
                fs.mkdirSync(tgt, { recursive: true })
                fs.copyFileSync('./helpers.py', path.join(tgt, 'helpers.py'));

                const txt = fs.readFileSync(path.join(source, 'HW5.ipyhistory')).toString();
                const json = JSON.parse(txt);
                const notebooks = json.notebook;  

                let count = 0;
                notebooks.forEach(notebook => {
                    let ipynb = textFromHistory(notebook, json, 'cells');
                    let data = JSON.stringify(ipynb,null,2);
                    fs.writeFileSync(`${tgt}/${file}_${count++}.ipynb`, data);
                });
            }
        });
    });
}

//main(directoryPath);

module.exports = {textFromHistory};
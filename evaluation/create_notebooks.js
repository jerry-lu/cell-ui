function textFromHistory(notebook, json, cellArr, goNode=false){
    let ipynb = {
        "cells": [],
        "metadata": {},
        "nbformat": 4,
        "nbformat_minor": 4
    }
    for (const cell of notebook[cellArr]){
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
                if (cellNo > 1) {
                    source.splice(0, 0, 'random.seed(36)\n')
                } else {
                    source.splice(-1, 0, 'tf.compat.v1.logging.set_verbosity(tf.compat.v1.logging.ERROR)\n');
                }
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
    }
    return {nb: ipynb, sequence: notebook[cellArr]};
}

module.exports = {textFromHistory};

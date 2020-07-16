# cell-ui

## A web-browser based tool for analyzing execution order of computational notebooks

Dependencies are listed in `package.json`. To install this project, clone the repository, then run `npm install` to install the dependencies. Then run `node server.js` (or `nodemon server.js` to reload the project automatically), and navigate to `http://localhost:8080/` in your browser.

## Features

This tool displays the cells in a notebook along with the def-use relations between the cells. These dependencies can be visualized using the `show dependency visualization` button. Using the numbered buttons next to each cell, you can simulate executing each cell and see the abstract output from each cell. The tool will indicate whether the current execution order causes cells to be in a different state from a top-down execution of the notebook. The `∆` button next to each cell simulates modification of the code. Dependent cells that have a stale state due to this modification are indicated with yellow borders.

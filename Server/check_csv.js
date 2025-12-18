// server/check_csv.js
const fs = require('fs');
const csv = require('csv-parser');

const results = [];

fs.createReadStream('steam_metadata.csv')
    .pipe(csv())
    .on('data', (data) => {
        if (results.length < 1) { // Only grab the first row
            results.push(data);
        }
    })
    .on('end', () => {
        console.log("Here is the first row:");
        console.log(results[0]);
    });
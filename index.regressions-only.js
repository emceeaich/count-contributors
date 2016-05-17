var fetch = require('node-fetch');
var buglist;
var results = {};
var scoreboard = {};
var csvWriter = require('csv-write-stream');
var writer = csvWriter();
var versions = ["cf_status_firefox42", "cf_status_firefox43",
         "cf_status_firefox44", "cf_status_firefox45",
         "cf_status_firefox46", "cf_status_firefox47",
         "cf_status_firefox48", "cf_status_firefox49"];

fetch('https://bugzilla.mozilla.org/rest/bug?include_fields=id,creator,summary,status,resolution,keywords,whiteboard,cf_status_firefox42,cf_status_firefox43,cf_status_firefox44,cf_status_firefox45,cf_status_firefox46,cf_status_firefox47,cf_status_firefox48,cf_status_firefox49&chfield=[Bug%20creation]&chfieldfrom=2016-01-01&chfieldto=Now&f1=keywords&f2=status_whiteboard&j_top=OR&o1=substring&o2=substring&product=Firefox&product=Firefox%20for%20Android&product=Firefox%20for%20iOS&product=Toolkit&v1=regression&v2=regression').then(function(res) { return res.json(); }).then(function(json) { buglist = json.bugs; rollup(); getCSV(); });

function rollup() {
    var found; 

    buglist.forEach(function(bug, i) {

        // count unique contributors
        if (typeof results[bug.creator] === 'undefined') {
            results[bug.creator] = {total: 1, unknown: 0};
            versions.forEach(function(version, i) {
                results[bug.creator][version] = 0;
            });
        }  
        else {
            results[bug.creator].total ++;
        }

        // count version where found

        found = false;

        versions.forEach(function(status, i) {
            if (!found && bug[status]) {
                if(['affected', 'wontfix', 'fixed', 'verified'].indexOf(bug[status]) > -1) {
                    found = true;
                    results[bug.creator][status]++;
                } 
            }
         });

        if (!found) {
            results[bug.creator].unknown++; 
        }

    });    
};

function getCSV() {
    var contributors = Object.keys(results);
    writer.pipe(fs.createWriteStream('./out.csv'));
    contributors.forEach(function(contributor, i) {
        results[contributor].name = contributor;
        writer.write(results[contributor]);        
    });
    writer.end();
};



/**
 * Main runnable file.
 */

'use strict';

// Native packages:
const http = require('http');

// External packages:
const express = require('express'),
    octonode = require('octonode'),
    CLIProgressBar = require('cli-progress-bar');

// Settings:
const conf = require('./conf');

const app = express(),
    server = http.createServer(app),
    client = octonode.client(conf.token),
    org = client.org(conf.organisation),
    projectsList = [],
    projectsData = {};

var projectsDone = 0,
    progressBar;

/**
 * Retrieve list of all the organisation's projects (or a page of them).
 *
 * Side-effect: mutates <code>projectsList</code>.
 *
 * @param {Function} cb - callback (expects no parameters).
 */

function fetchListOfProjects(cb, pageNo=1) {

    org.repos(pageNo, conf.pageSize, (err, data, headers) => {

        if (1 === pageNo) {
            progressBar = new CLIProgressBar();
            progressBar.show('Retrieving list of all public repos');
        }
        progressBar.pulse(`page ${pageNo}`);
        if (err) {
            console.log(err);
            progressBar.hide();
            cb();
        } else
            if (!data || data.length < 1) {
                progressBar.hide();
                cb();
            } else {
                projectsList.push(...data.map((x) => { return x.name; }));
                fetchListOfProjects(cb, pageNo + 1);
            }

    });

}

/**
 * Retrieve selected metadata for all projects.
 *
 * Side-effect: mutates <code>projectsData</code>.
 *
 * @param {String} projectName - name of the repository.
 */

function fetchProjectData(projectName) {

    const expected = 6;
    var done = 0;
    projectsData[projectName] = {};

    function updateProgress() {
        if (++done === expected) {
            if (++projectsDone === projectsList.length)
                progressBar.hide();
            else
                progressBar.show(projectName, projectsDone / projectsList.length);
        }
    }

    // get and store
    //   creation date
    // + description
    // + repository Url
    // + website Url
    client.get(`/repos/${conf.organisation}/${projectName}`, {}, function (err, status, body, headers) {
        projectsData[projectName]['github_url'] = 'https://github.com/w3c/' + projectName;
        if(err) {
            console.log(err);
        } else {
            try {
                projectsData[projectName]["created_on"] = body["created_at"];
            } catch (e) {
                console.log(e);
            }
            try {
                projectsData[projectName]["description"] = body["description"];
            } catch (e) {
                console.log(e);
            }
            try {
                projectsData[projectName]['website_url'] = body['homepage'];
            } catch (e) {
                console.log(e);
            }
        }
        updateProgress();
    });

    // get last commit
    client.get(`/repos/${conf.organisation}/${projectName}` + '/commits', {}, function (err, status, body, headers) {
        if(err) {
            console.log(err);
        } else {
            try {
                projectsData[projectName]["last_commit_on"] = body[0]["commit"]["author"]["date"];
            } catch (e) {
                console.log(e);
            }
        }
        updateProgress();
    });

    // get number of issues
    client.get(`/repos/${conf.organisation}/${projectName}` + '/issues', {}, function (err, status, body, headers) {
        if(err) {
            console.log(err);
        } else {
            try {
                projectsData[projectName]["opened_issues"] = body.length;
            } catch (e) {
                console.log(e);
            }
        }
        updateProgress();
    });

    // get number of contributors
    client.get(`/repos/${conf.organisation}/${projectName}` + '/contributors', {}, function (err, status, body, headers) {
        if(err) {
            console.log(err);
        } else {
            try {
                projectsData[projectName]["contributors"] = body.length;
            } catch (e) {
                console.log(e);
            }
        }
        updateProgress();
    });

    // get number of pending pull requests
    client.get(`/repos/${conf.organisation}/${projectName}` + '/pulls', {}, function (err, status, body, headers) {
        if(err) {
            console.log(err);
        } else {
            try {
                projectsData[projectName]["pending_pull_requests"] = body.length;
            } catch (e) {
                console.log(e);
            }
        }
        updateProgress();
    });

    // get last release
    client.get(`/repos/${conf.organisation}/${projectName}` + '/releases', {}, function (err, status, body, headers) {
        if(err) {
            console.log(err);
        } else {
            try {
                projectsData[projectName]["last_release"] = body[0]["tag_name"];
            } catch (e) {
                console.log(e);
                projectsData[projectName]["last_release"] = "";
            }
        }
        updateProgress();
    });

}

fetchListOfProjects(() => {
    projectsList.sort((a, b) => {
        if (a.toLowerCase() < b.toLowerCase())
            return -1;
        else if (a.toLowerCase() > b.toLowerCase())
            return +1;
        else
            return 0;
    });
    console.log(`${conf.organisation}'s ${projectsList.length} public projects:\n${projectsList.join(', ')}`);
    progressBar = new CLIProgressBar();
    projectsList.map(fetchProjectData);
});

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  next();
});

app.get('/projects', function(req,res) {
    res.json(projectsData);
});

app.get('/api/*', function(req, res) {
    if(req.url) {
        console.log(req.url);
        client.get(req.url.split('api')[1], {}, function(err, status, body, headers) {
            res.json(body);
        });
    }
});

server.listen(conf.port, function() {
    console.log(`listening on port ${conf.port}`);
    setInterval(function() {
        projectsList.map(fetchProjectData);
    }, conf.refreshPeriod * 60 * 1000);
});

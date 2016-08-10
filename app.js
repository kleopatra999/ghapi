var express = require("express"),
    app = express(),
    request = require('superagent'),
    github = require('octonode'),
    fs = require('fs'),
    http = require('http').Server(app);

var ghAuthBot = JSON.parse(fs.readFileSync('conf.json', 'utf8'));

var client = github.client(ghAuthBot.token);

var projectsList = [
    'developers',
    'mailing-list-archives',
    'Unitas',
    'wbs-design',
    'design',
    'tr-design',
    'node-w3capi'
];

var projectsData = {};



function fetchProjectData(projectName) {

    const repo = client.repo(`w3c/${projectName}`);

    projectsData[projectName] = {};
    console.log(projectName + ': fetching data...');

    // get and store
    //   creation date
    // + description
    // + repository Url
    // + website Url
    client.get('/repos/w3c/' + projectName, {}, function (err, status, body, headers) {
        projectsData[projectName]['github_url'] = 'https://github.com/w3c/' + projectName;
        if(err) {
            console.log(err);
        } else {
            try {
                projectsData[projectName]["created_on"] = body["created_at"];
                console.log('created on: ' + body["created_at"]);
            } catch (e) {
                console.log(e);
            }
            try {
                projectsData[projectName]["description"] = body["description"];
                console.log('description: ' + body["description"]);
            } catch (e) {
                console.log(e);
            }
            try {
                projectsData[projectName]['website_url'] = body['homepage'];
                console.log('website_url: ' + body['homepage']);
            } catch (e) {
                console.log(e);
            }
        }
    });

    // get last commit
    repo.commits((err, data, headers) => {
        if(err)
            return console.log(err);
        if (data && data.length > 0 && data[0].commit && data[0].commit.author && data[0].commit.author.date)
            projectsData[projectName]['last_commit_on'] = data[0].commit.author.date;
        else
            projectsData[projectName]['last_commit_on'] = '';
        console.log(`last commit on: ${projectsData[projectName]['last_commit_on']}`);
    });

    // get number of issues
    client.get('/repos/w3c/' + projectName + '/issues', {}, function (err, status, body, headers) {
        if(err) {
            console.log(err);
        } else {
            try {
                projectsData[projectName]["opened_issues"] = body.length;
                console.log('number of issues: ' + body.length);
            } catch (e) {
                console.log(e);
            }
        }
    });

    // get number of contributors
    client.get('/repos/w3c/' + projectName + '/contributors', {}, function (err, status, body, headers) {
        if(err) {
            console.log(err);
        } else {
            try {
                projectsData[projectName]["contributors"] = body.length;
                console.log('number of contributors: ' + body.length);
            } catch (e) {
                console.log(e);
            }
        }
    });

    // get number of pending pull requests
    client.get('/repos/w3c/' + projectName + '/pulls', {}, function (err, status, body, headers) {
        if(err) {
            console.log(err);
        } else {
            try {
                projectsData[projectName]["pending_pull_requests"] = body.length;
                console.log('number of pull requests: ' + body.length);
            } catch (e) {
                console.log(e);
            }
        }
    });

    // get last release
    client.get('/repos/w3c/' + projectName + '/releases', {}, function (err, status, body, headers) {
        if(err) {
            console.log(err);
        } else {
            try {
                projectsData[projectName]["last_release"] = body[0]["tag_name"];
                console.log('last release: ' + body[0]["tag_name"]);
            } catch (e) {
                console.log(e);
                projectsData[projectName]["last_release"] = "";
                console.log('last release: ' + '');
            }
        }
    });

}

projectsList.map(fetchProjectData);

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

http.listen(3000, function() {
    console.log('listening on *:3000');
    setInterval(function() {
        projectsList.map(fetchProjectData);
    }, 3600000);
});

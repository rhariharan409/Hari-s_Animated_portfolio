const fs = require('fs');
const https = require('https');

const options = {
  hostname: 'api.github.com',
  path: '/users/rhariharan409/repos?sort=updated&per_page=100',
  method: 'GET',
  headers: {
    'User-Agent': 'Node.js'
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    const repos = JSON.parse(data);
    const projects = repos.map((repo, index) => ({
      id: index + 1,
      name: repo.name,
      description: repo.description || "No description provided.",
      url: repo.html_url,
      language: repo.language || "Various",
      stars: repo.stargazers_count
    }));

    const fileContent = `export const projects = ${JSON.stringify(projects, null, 2)};\n`;
    fs.writeFileSync('data/projects.js', fileContent);
    console.log('data/projects.js created successfully with ' + projects.length + ' projects.');
  });
});

req.on('error', (e) => {
  console.error(e);
});
req.end();

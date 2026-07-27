#!/usr/bin/env node

const http = require('http');
const { execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Helper to run shell commands safely
function runCmd(cmd) {
  try {
    return execSync(cmd, { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
  } catch (error) {
    return null;
  }
}

// 1. Gather git info
const branchName = runCmd('git rev-parse --abbrev-ref HEAD');
if (!branchName) {
  console.error('Error: Not a git repository or no commits yet.');
  process.exit(1);
}

const defaultTitle = runCmd('git log -1 --pretty=%B')?.split('\n')[0] || '';

// Parse remote URLs to get token and details
let remoteUrl = runCmd('git remote get-url fork') || runCmd('git remote get-url origin') || '';
let token = '';
let repoOwner = 'StellarLend'; // fallback upstream owner
let repoName = 'Stellarlend-frontend'; // fallback upstream repo
let userLogin = 'dominiccreates'; // fallback user fork owner

if (remoteUrl) {
  const match = remoteUrl.match(/https:\/\/([^@]+)@github\.com\/([^\/]+)\/([^\.]+)\.git/);
  if (match) {
    token = match[1];
    userLogin = match[2];
    repoName = match[3];
  }
}

// Ensure we have a token
if (!token) {
  console.error('Error: GitHub Personal Access Token not found in remote URL.');
  process.exit(1);
}

const PORT = 9999;
const serverUrl = `http://localhost:${PORT}`;

// Create HTTP server
const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    // Serve the premium HTML/CSS UI
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(getHtmlContent(branchName, defaultTitle, userLogin, repoName));
  } else if (req.method === 'POST' && req.url === '/api/create-pr') {
    let bodyData = '';
    req.on('data', chunk => {
      bodyData += chunk.toString();
    });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(bodyData);
        const { title, description } = payload;

        if (!title || !description) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Title and description are required.' }));
          return;
        }

        // 1. Push the branch to the user's fork
        console.log(`Pushing branch "${branchName}" to fork...`);
        const pushResult = runCmd(`git push -u fork ${branchName}`);
        console.log('Push completed successfully.');

        // 2. Open PR via GitHub API
        console.log('Sending PR request to GitHub...');
        const apiPayload = JSON.stringify({
          title: title,
          body: description,
          head: `${userLogin}:${branchName}`,
          base: 'main'
        });

        // Use built-in https module to avoid external dependencies
        const https = require('https');
        const apiOptions = {
          hostname: 'api.github.com',
          path: `/repos/${repoOwner}/${repoName}/pulls`,
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'PR-Creator-Tool-Local',
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(apiPayload)
          }
        };

        const apiReq = https.request(apiOptions, (apiRes) => {
          let responseData = '';
          apiRes.on('data', chunk => {
            responseData += chunk.toString();
          });
          apiRes.on('end', () => {
            if (apiRes.statusCode >= 200 && apiRes.statusCode < 300) {
              const resJson = JSON.parse(responseData);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ prUrl: resJson.html_url }));
              
              // Gracefully close server after 2 seconds
              setTimeout(() => {
                console.log('PR successfully created. Shutting down server...');
                process.exit(0);
              }, 2000);
            } else {
              console.error(`GitHub API error (${apiRes.statusCode}):`, responseData);
              let errorMsg = 'Failed to create PR via GitHub API.';
              try {
                const parsedErr = JSON.parse(responseData);
                if (parsedErr.errors && parsedErr.errors[0]) {
                  errorMsg = parsedErr.errors[0].message;
                } else if (parsedErr.message) {
                  errorMsg = parsedErr.message;
                }
              } catch (e) {}
              
              res.writeHead(apiRes.statusCode || 500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: errorMsg }));
            }
          });
        });

        apiReq.on('error', (err) => {
          console.error('Request error:', err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        });

        apiReq.write(apiPayload);
        apiReq.end();

      } catch (err) {
        console.error('Server error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

// Start the server
server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 PR Creator Tool running at: ${serverUrl}`);
  console.log(`======================================================\n`);
  
  // Open the default browser on Windows
  exec(`start ${serverUrl}`);
});

// The Premium Glassmorphic Web UI
function getHtmlContent(branch, title, forkOwner, repoName) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Create Pull Request | StellarLend</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-color: #080B11;
      --card-bg: rgba(17, 24, 39, 0.7);
      --card-border: rgba(255, 255, 255, 0.08);
      --primary: #6366f1;
      --primary-hover: #4f46e5;
      --primary-glow: rgba(99, 102, 241, 0.15);
      --success: #10b981;
      --text: #f3f4f6;
      --text-muted: #9ca3af;
      --input-bg: rgba(31, 41, 55, 0.5);
      --input-border: rgba(255, 255, 255, 0.1);
      --input-focus: #818cf8;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background-color: var(--bg-color);
      color: var(--text);
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      overflow-x: hidden;
      position: relative;
    }

    /* Ambient background glows */
    body::before {
      content: '';
      position: absolute;
      width: 500px;
      height: 500px;
      background: radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, rgba(0, 0, 0, 0) 70%);
      top: -150px;
      left: -150px;
      z-index: 0;
    }

    body::after {
      content: '';
      position: absolute;
      width: 600px;
      height: 600px;
      background: radial-gradient(circle, rgba(168, 85, 247, 0.1) 0%, rgba(0, 0, 0, 0) 70%);
      bottom: -200px;
      right: -200px;
      z-index: 0;
    }

    .container {
      width: 100%;
      max-width: 680px;
      padding: 24px;
      z-index: 10;
    }

    .card {
      background: var(--card-bg);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid var(--card-border);
      border-radius: 24px;
      padding: 40px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
      transition: transform 0.3s ease, box-shadow 0.3s ease;
    }

    .header {
      margin-bottom: 32px;
      text-align: center;
    }

    .logo-container {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }

    .logo-icon {
      width: 42px;
      height: 42px;
      background: linear-gradient(135deg, var(--primary), #a855f7);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 700;
      font-size: 22px;
      box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);
    }

    .logo-text {
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.5px;
      background: linear-gradient(to right, #ffffff, #d1d5db);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    h1 {
      font-size: 26px;
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 8px;
    }

    .subtitle {
      font-size: 14px;
      color: var(--text-muted);
    }

    .branch-badge-container {
      display: flex;
      justify-content: center;
      gap: 8px;
      margin-top: 12px;
      flex-wrap: wrap;
    }

    .badge {
      background: rgba(99, 102, 241, 0.1);
      border: 1px solid rgba(99, 102, 241, 0.2);
      color: #a5b4fc;
      padding: 6px 12px;
      border-radius: 99px;
      font-size: 13px;
      font-weight: 500;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .form-group {
      margin-bottom: 24px;
    }

    label {
      display: block;
      font-size: 14px;
      font-weight: 600;
      color: #e5e7eb;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    input[type="text"], textarea {
      width: 100%;
      background: var(--input-bg);
      border: 1px solid var(--input-border);
      border-radius: 12px;
      padding: 14px 16px;
      color: var(--text);
      font-family: inherit;
      font-size: 15px;
      transition: all 0.2s ease;
    }

    input[type="text"]:focus, textarea:focus {
      outline: none;
      border-color: var(--input-focus);
      background: rgba(31, 41, 55, 0.7);
      box-shadow: 0 0 0 4px var(--primary-glow);
    }

    textarea {
      resize: vertical;
      min-height: 150px;
      line-height: 1.6;
    }

    .btn {
      width: 100%;
      background: linear-gradient(135deg, var(--primary) 0%, #7c3aed 100%);
      color: #ffffff;
      border: none;
      padding: 16px;
      border-radius: 14px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      box-shadow: 0 4px 20px rgba(99, 102, 241, 0.3);
      transition: all 0.2s ease;
      position: relative;
      overflow: hidden;
    }

    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(99, 102, 241, 0.45);
    }

    .btn:active {
      transform: translateY(0);
    }

    .btn:disabled {
      background: rgba(156, 163, 175, 0.2);
      color: var(--text-muted);
      cursor: not-allowed;
      box-shadow: none;
      transform: none;
    }

    .btn-success {
      background: linear-gradient(135deg, var(--success) 0%, #059669 100%);
      box-shadow: 0 4px 20px rgba(16, 185, 129, 0.3);
    }

    .btn-success:hover {
      box-shadow: 0 8px 24px rgba(16, 185, 129, 0.45);
    }

    .spinner {
      width: 20px;
      height: 20px;
      border: 3px solid rgba(255, 255, 255, 0.3);
      border-top-color: #ffffff;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      display: none;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .error-card {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.2);
      border-radius: 12px;
      padding: 16px;
      color: #fca5a5;
      font-size: 14px;
      margin-bottom: 24px;
      display: none;
      align-items: center;
      gap: 10px;
    }

    .success-panel {
      text-align: center;
      display: none;
      animation: fadeIn 0.4s ease forwards;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .success-icon {
      width: 72px;
      height: 72px;
      background: rgba(16, 185, 129, 0.1);
      border: 2px solid rgba(16, 185, 129, 0.3);
      border-radius: 50%;
      color: var(--success);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 36px;
      margin: 0 auto 24px auto;
      box-shadow: 0 0 20px rgba(16, 185, 129, 0.2);
    }

    .success-panel h2 {
      font-size: 24px;
      margin-bottom: 12px;
      color: white;
    }

    .success-panel p {
      font-size: 15px;
      color: var(--text-muted);
      margin-bottom: 32px;
      line-height: 1.6;
    }

    .success-actions {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
  </style>
</head>
<body>

  <div class="container">
    <div class="card" id="mainCard">
      <!-- Normal Form Form -->
      <div id="prForm">
        <div class="header">
          <div class="logo-container">
            <div class="logo-icon">S</div>
            <div class="logo-text">StellarLend</div>
          </div>
          <h1>Create Pull Request</h1>
          <p class="subtitle">Push branch & open cross-repository pull request automatically</p>
          <div class="branch-badge-container">
            <span class="badge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="3" x2="6" y2="15"></line><circle cx="18" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><path d="M18 9a9 9 0 0 1-9 9"></path></svg>
              ${branch}
            </span>
            <span class="badge" style="background: rgba(168, 85, 247, 0.1); border-color: rgba(168, 85, 247, 0.2); color: #c084fc;">
              fork: ${forkOwner}/${repoName}
            </span>
          </div>
        </div>

        <div class="error-card" id="errorMsg">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          <span id="errorText">Error message here</span>
        </div>

        <form id="pullRequestForm" onsubmit="submitForm(event)">
          <div class="form-group">
            <label for="prTitle">Pull Request Title</label>
            <input type="text" id="prTitle" value="${title}" required placeholder="e.g. feat: add dynamic validation rules">
          </div>

          <div class="form-group">
            <label for="prDescription">Pull Request Description</label>
            <textarea id="prDescription" required placeholder="Write a short summary of changes, motivation, and context..."></textarea>
          </div>

          <button type="submit" class="btn" id="submitBtn">
            <span class="spinner" id="btnSpinner"></span>
            <span id="btnText">Push & Open Pull Request</span>
          </button>
        </form>
      </div>

      <!-- Success Panel -->
      <div class="success-panel" id="successPanel">
        <div class="success-icon">✓</div>
        <h2>Pull Request Opened Successfully!</h2>
        <p>Your branch has been pushed to your fork repository and your pull request is open in the main repository. This local setup server will now exit.</p>
        
        <div class="success-actions">
          <a id="prLink" href="#" target="_blank" class="btn btn-success" style="text-decoration: none;">
            View PR on GitHub
          </a>
        </div>
      </div>

    </div>
  </div>

  <script>
    async function submitForm(event) {
      event.preventDefault();
      
      const title = document.getElementById('prTitle').value;
      const description = document.getElementById('prDescription').value;
      
      const submitBtn = document.getElementById('submitBtn');
      const btnSpinner = document.getElementById('btnSpinner');
      const btnText = document.getElementById('btnText');
      const errorCard = document.getElementById('errorMsg');
      const errorText = document.getElementById('errorText');
      
      // Reset status
      errorCard.style.display = 'none';
      submitBtn.disabled = true;
      btnSpinner.style.display = 'block';
      btnText.textContent = 'Pushing & Creating PR...';
      
      try {
        const response = await fetch('/api/create-pr', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ title, description })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'An error occurred during PR creation.');
        }
        
        // Show success panel
        document.getElementById('prForm').style.display = 'none';
        document.getElementById('successPanel').style.display = 'block';
        document.getElementById('prLink').href = data.prUrl;
        
      } catch (err) {
        console.error(err);
        errorText.textContent = err.message;
        errorCard.style.display = 'flex';
        
        // Reset button
        submitBtn.disabled = false;
        btnSpinner.style.display = 'none';
        btnText.textContent = 'Push & Open Pull Request';
      }
    }
  </script>
</body>
</html>
`;
}

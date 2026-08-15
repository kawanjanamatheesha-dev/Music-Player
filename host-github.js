/**
 * Aether Music Player - GitHub Pages Deployer
 * 
 * This script allows deploying the Aether Music Player directly to GitHub Pages
 * using Node.js and the GitHub REST API, without requiring the git CLI tool.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const FILES_TO_UPLOAD = ['index.html', 'styles.css', 'app.js', 'manifest.json', 'sw.js'];
const DEFAULT_REPO_NAME = '3d-8d-music-player';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function askQuestion(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
    console.log('\n======================================================');
    console.log('   Aether 3D/8D Music Player - GitHub Pages Deployer');
    console.log('======================================================\n');
    console.log('This script will host your Music Player on GitHub Pages for free.');
    console.log('No git installation is required! We will use the GitHub API.\n');

    console.log('පළමුව, ඔබට GitHub ගිණුමක් (Account) සහ Personal Access Token (PAT) එකක් අවශ්‍ය වේ.');
    console.log('PAT එකක් සකස් කර ගන්නා ආකාරය:');
    console.log('1. Go to: https://github.com/settings/tokens');
    console.log('2. Click "Generate new token (classic)"');
    console.log('3. Select the "repo" scope (this allows uploading files)');
    console.log('4. Generate and copy the token.\n');

    const username = (await askQuestion('Enter your GitHub Username: ')).trim();
    if (!username) {
        console.log('Username cannot be empty. Exiting.');
        rl.close();
        return;
    }

    const token = (await askQuestion('Paste your GitHub Personal Access Token (PAT): ')).trim();
    if (!token) {
        console.log('Token cannot be empty. Exiting.');
        rl.close();
        return;
    }

    let repoName = (await askQuestion(`Enter Repository Name (Default: ${DEFAULT_REPO_NAME}): `)).trim();
    if (!repoName) {
        repoName = DEFAULT_REPO_NAME;
    }

    console.log(`\nInitializing deployment to: https://github.com/${username}/${repoName}`);
    
    const headers = {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'Aether-Music-Player-Deployer'
    };

    try {
        // Step 1: Check if repo exists, if not, create it
        console.log('Checking repository status...');
        const repoCheckRes = await fetch(`https://api.github.com/repos/${username}/${repoName}`, { headers });
        
        if (repoCheckRes.status === 404) {
            console.log(`Repository "${repoName}" not found. Creating a new public repository...`);
            const createRepoRes = await fetch('https://api.github.com/user/repos', {
                method: 'POST',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: repoName,
                    description: 'Aether 3D & 8D Music Player with EQ and DJ Deck',
                    private: false,
                    auto_init: false
                })
            });

            if (!createRepoRes.ok) {
                const errData = await createRepoRes.json();
                throw new Error(`Failed to create repository: ${errData.message || createRepoRes.statusText}`);
            }
            console.log('Repository created successfully.');
        } else if (repoCheckRes.status === 200) {
            console.log(`Repository "${repoName}" already exists. We will push/update files directly.`);
        } else {
            throw new Error(`Error checking repository: ${repoCheckRes.statusText}`);
        }

        // Step 2: Upload files
        for (const filename of FILES_TO_UPLOAD) {
            const filePath = path.join(__dirname, filename);
            if (!fs.existsSync(filePath)) {
                console.warn(`Warning: File "${filename}" not found in current directory. Skipping.`);
                continue;
            }

            console.log(`Uploading ${filename}...`);
            const fileBuffer = fs.readFileSync(filePath);
            const base64Content = fileBuffer.toString('base64');

            // Check if file already exists in repo to get its SHA (needed for updates)
            let existingSha = null;
            const fileCheckRes = await fetch(`https://api.github.com/repos/${username}/${repoName}/contents/${filename}?ref=main`, { headers });
            if (fileCheckRes.status === 200) {
                const fileData = await fileCheckRes.json();
                existingSha = fileData.sha;
            }

            // Upload/Update file
            const uploadRes = await fetch(`https://api.github.com/repos/${username}/${repoName}/contents/${filename}`, {
                method: 'PUT',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: `Upload ${filename} via deployer`,
                    content: base64Content,
                    branch: 'main',
                    sha: existingSha || undefined
                })
            });

            if (!uploadRes.ok) {
                const errData = await uploadRes.json();
                throw new Error(`Failed to upload ${filename}: ${errData.message || uploadRes.statusText}`);
            }
            console.log(`✓ ${filename} uploaded successfully.`);
        }

        // Step 3: Enable GitHub Pages
        console.log('Configuring GitHub Pages...');
        const pagesRes = await fetch(`https://api.github.com/repos/${username}/${repoName}/pages`, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                source: {
                    branch: 'main',
                    path: '/'
                }
            })
        });

        if (pagesRes.status === 201) {
            console.log('✓ GitHub Pages enabled successfully.');
        } else if (pagesRes.status === 409) {
            console.log('GitHub Pages is already configured.');
        } else {
            const errData = await pagesRes.json();
            console.log(`Note about Pages configuration: ${errData.message || pagesRes.statusText}`);
        }

        const liveUrl = `https://${username}.github.io/${repoName}/`;
        console.log('\n======================================================');
        console.log('   🎉 DEPLOYMENT SUCCESSFUL! / සාර්ථකව නිම කරන ලදී!');
        console.log('======================================================');
        console.log(`\nYour music player is now hosting on GitHub Pages!`);
        console.log(`Live Link: ${liveUrl}`);
        console.log(`\nYou can open this link on your phone (Android/iOS) to enjoy 3D & 8D music!`);
        console.log(`Note: It might take 1-2 minutes for GitHub to build and show the page first time.\n`);

    } catch (error) {
        console.error('\n❌ Deployment failed / දෝෂයක් සිදු විය:');
        console.error(error.message);
    } finally {
        rl.close();
    }
}

main();

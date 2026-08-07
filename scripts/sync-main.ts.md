```typescript
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const DEPLOY_DIR = path.resolve('../deploy-main-env');
const WORKSPACE_DIR = process.cwd();

// Helper to copy recursively without explicit exclusion arrays
function copyRecursiveSync(src: string, dest: string) {
  const exists = fs.existsSync(src);
  if (!exists) {
    return;
  }
  const stats = fs.statSync(src);
  if (stats.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach((childItemName) => {
      // Avoid copying git index or external deployment areas
      if (childItemName === 'node_modules' || childItemName === '.git') {
        return;
      }
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

async function main() {
  console.log('Starting sync-main process...');

  // Get current workspace remote url
  const remoteUrl = execSync('git remote get-url origin', { encoding: 'utf-8' }).trim();
  console.log('Current remote URL:', remoteUrl);

  // Retrieve git extraheaders or auth config from workspace before resetting
  let extraHeader = '';
  try {
    extraHeader = execSync('git config --local --get http.https://github.com/.extraheader', { encoding: 'utf-8' }).trim();
  } catch {
    console.log('No git extraheader found via exact path.');
  }

  // Determine the commit message
  let commitMessage = '';
  if (process.env.TRIGGER_COMMIT_MSG) {
    commitMessage = process.env.TRIGGER_COMMIT_MSG.trim();
  }
  if (!commitMessage) {
    try {
      commitMessage = execSync('git log -1 --pretty=%B', { encoding: 'utf-8' }).trim();
    } catch {
      console.warn('Failed to get commit message from git log.');
    }
  }
  if (!commitMessage) {
    commitMessage = 'chore: sync main branch with desktop';
  }
  console.log('Using commit message:', commitMessage);

  // Clean and recreate deployment directory
  if (fs.existsSync(DEPLOY_DIR)) {
    fs.rmSync(DEPLOY_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(DEPLOY_DIR, { recursive: true });

  // Copy files
  console.log('Copying files from workspace to deploy directory...');
  copyRecursiveSync(WORKSPACE_DIR, DEPLOY_DIR);

  // Merge .gitignore and .gitignore-main-append in deploy directory
  const gitignorePath = path.join(DEPLOY_DIR, '.gitignore');
  const appendPath = path.join(DEPLOY_DIR, '.gitignore-main-append');

  if (fs.existsSync(gitignorePath)) {
    let gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
    if (fs.existsSync(appendPath)) {
      const appendContent = fs.readFileSync(appendPath, 'utf-8');
      if (!gitignoreContent.endsWith('\n')) {
        gitignoreContent += '\n';
      }
      gitignoreContent += '\n' + appendContent;
      console.log('Merged .gitignore-main-append into .gitignore with an extra newline.');
    } else {
      if (!gitignoreContent.endsWith('\n')) {
        gitignoreContent += '\n';
      }
      gitignoreContent += '\ndata/\n';
      console.log('Fallback: appended data/ directly to .gitignore');
    }
    fs.writeFileSync(gitignorePath, gitignoreContent);
  } else {
    if (fs.existsSync(appendPath)) {
      fs.copyFileSync(appendPath, gitignorePath);
      console.log('Created .gitignore from .gitignore-main-append.');
    } else {
      fs.writeFileSync(gitignorePath, 'data/\n');
      console.log('Created .gitignore with data/.');
    }
  }

  // Delete the .gitignore-main-append in deploy directory so it doesn't get pushed
  if (fs.existsSync(appendPath)) {
    fs.unlinkSync(appendPath);
  }

  // Initialize new git repository in DEPLOY_DIR
  console.log('Initializing new Git repository...');
  execSync('git init', { cwd: DEPLOY_DIR, stdio: 'inherit' });

  // Restore the extraheader credential to the new git repo configuration
  if (extraHeader) {
    // Write extraheader cleanly and quote properly to avoid git parsing errors
    execSync(`git config --local http.https://github.com/.extraheader "${extraHeader}"`, { cwd: DEPLOY_DIR, stdio: 'inherit' });
    console.log('Restored http.https://github.com/.extraheader');
  }

  // Configure author to RainPPR <PPR2125773894@163.com> and git bot user info
  execSync('git config user.name "RainPPR"', { cwd: DEPLOY_DIR, stdio: 'inherit' });
  execSync('git config user.email "PPR2125773894@163.com"', { cwd: DEPLOY_DIR, stdio: 'inherit' });

  // Track all files
  execSync('git add -A', { cwd: DEPLOY_DIR, stdio: 'inherit' });

  // Formulate the Co-authored-by message
  const coAuthorMsg = '\n\nCo-authored-by: github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>';
  const finalCommitMessage = commitMessage + coAuthorMsg;

  // Commit
  const commitMsgFile = path.join(DEPLOY_DIR, '.git-commit-msg');
  fs.writeFileSync(commitMsgFile, finalCommitMessage, 'utf-8');
  execSync('git commit -F .git-commit-msg', { cwd: DEPLOY_DIR, stdio: 'inherit' });
  fs.unlinkSync(commitMsgFile);

  // Add origin remote
  try {
    execSync(`git remote add origin "${remoteUrl}"`, { cwd: DEPLOY_DIR, stdio: 'inherit' });
  } catch {
    execSync(`git remote set-url origin "${remoteUrl}"`, { cwd: DEPLOY_DIR, stdio: 'inherit' });
  }

  // Force push to main
  console.log('Force pushing to main branch...');
  execSync('git push -f origin HEAD:main', { cwd: DEPLOY_DIR, stdio: 'inherit' });

  console.log('Sync to main completed successfully!');
}

main().catch((err) => {
  console.error('Error during sync-main:', err);
  process.exit(1);
});

```
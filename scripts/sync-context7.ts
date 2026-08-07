import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const DEPLOY_DIR = path.resolve('../deploy-env');
const DIST_DIR = path.resolve('context7-dist');

async function main() {
  console.log('Starting sync-context7 process...');

  // Ensure context7-dist exists; if not, run prepare-context7 script
  if (!fs.existsSync(DIST_DIR)) {
    console.log('context7-dist directory not found, running prepare-context7.ts...');
    execSync('bun scripts/prepare-context7.ts', { stdio: 'inherit' });
  }

  // Clean up any existing stale worktree registrations cleanly
  try {
    execSync(`git worktree remove -f "${DEPLOY_DIR}"`, { stdio: 'ignore' });
  } catch {
    // ignore
  }
  try {
    execSync('git worktree prune', { stdio: 'ignore' });
  } catch {
    // ignore
  }

  // Double check directory cleanup
  if (fs.existsSync(DEPLOY_DIR)) {
    fs.rmSync(DEPLOY_DIR, { recursive: true, force: true });
  }

  try {
    let hasRemoteBranch = false;
    try {
      execSync('git fetch origin context7', { stdio: 'ignore' });
      hasRemoteBranch = true;
    } catch {
      console.log('No remote context7 branch found.');
    }

    if (hasRemoteBranch) {
      console.log('Found remote branch context7, associating worktree...');
      execSync(`git worktree add "${DEPLOY_DIR}" FETCH_HEAD`, { stdio: 'inherit' });
      execSync('git checkout -B context7', { cwd: DEPLOY_DIR, stdio: 'inherit' });
    } else {
      console.log('No remote branch context7 found, creating fresh orphan branch...');
      execSync(`git worktree add "${DEPLOY_DIR}" --detach`, { stdio: 'inherit' });
      execSync('git checkout --orphan context7', { cwd: DEPLOY_DIR, stdio: 'inherit' });
    }

    // Configure Git bot identity locally in the worktree repo, not globally
    execSync('git config --local user.name "github-actions[bot]"', { cwd: DEPLOY_DIR, stdio: 'inherit' });
    execSync('git config --local user.email "41898282+github-actions[bot]@users.noreply.github.com"', { cwd: DEPLOY_DIR, stdio: 'inherit' });

    // Clear old code
    console.log('Cleaning old files...');
    try {
      execSync('git rm -rfq .', { cwd: DEPLOY_DIR, stdio: 'ignore' });
    } catch {
      // ignore
    }

    // Copy new build artifacts
    console.log('Copying build artifacts...');
    const files = fs.readdirSync(DIST_DIR);
    for (const file of files) {
      const srcPath = path.join(DIST_DIR, file);
      const destPath = path.join(DEPLOY_DIR, file);
      if (fs.statSync(srcPath).isDirectory()) {
        fs.mkdirSync(destPath, { recursive: true });
        fs.cpSync(srcPath, destPath, { recursive: true });
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }

    // Commit and Push
    execSync('git add -A', { cwd: DEPLOY_DIR, stdio: 'inherit' });

    let hasChanges = false;
    try {
      execSync('git diff --cached --quiet', { cwd: DEPLOY_DIR });
      hasChanges = false;
    } catch {
      hasChanges = true;
    }

    if (hasChanges) {
      const dateStr = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
      execSync(`git commit -m "chore: deploy context7 artifacts (${dateStr})"`, { cwd: DEPLOY_DIR, stdio: 'inherit' });
      execSync('git push origin context7', { cwd: DEPLOY_DIR, stdio: 'inherit' });
      console.log('Deployment to context7 successful!');
    } else {
      console.log('No changes detected, skipping commit for context7.');
    }
  } finally {
    // Clean up the worktree cleanly before finishing or on error
    try {
      execSync(`git worktree remove -f "${DEPLOY_DIR}"`, { stdio: 'ignore' });
    } catch {
      // ignore
    }
    try {
      execSync('git worktree prune', { stdio: 'ignore' });
    } catch {
      // ignore
    }
  }
}

main().catch((err) => {
  console.error('Error during sync-context7:', err);
  process.exit(1);
});

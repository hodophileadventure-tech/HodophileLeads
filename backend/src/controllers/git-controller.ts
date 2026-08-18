import { Response, NextFunction } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import { AuthenticatedRequest } from '../middleware/auth';

const execAsync = promisify(exec);

export const gitController = {
  async getCommitHistory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      // Get the last 50 commits with detailed info
      const { stdout } = await execAsync(
        `git log --oneline --date=short --format="%H|%h|%an|%ad|%s" -50`,
        { cwd: process.cwd() }
      );

      const commits = stdout
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          const [hash, shortHash, author, date, message] = line.split('|');
          return {
            hash,
            shortHash,
            author,
            date,
            message
          };
        });

      res.json({
        success: true,
        commits,
        total: commits.length
      });
    } catch (error: any) {
      console.error('Failed to get commit history:', error);
      next(error);
    }
  },

  async getCommitDetails(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { hash } = req.params;

      // Validate hash format
      if (!hash || !/^[a-f0-9]+$/.test(hash)) {
        return res.status(400).json({ message: 'Invalid commit hash' });
      }

      // Get commit details
      const { stdout } = await execAsync(
        `git show --stat ${hash}`,
        { cwd: process.cwd() }
      );

      res.json({
        success: true,
        details: stdout
      });
    } catch (error: any) {
      console.error('Failed to get commit details:', error);
      next(error);
    }
  },

  async revertToCommit(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { hash } = req.body;

      // Validate hash format
      if (!hash || !/^[a-f0-9]+$/.test(hash)) {
        return res.status(400).json({ message: 'Invalid commit hash' });
      }

      // Check current git status
      const { stdout: statusOutput } = await execAsync(
        `git status --porcelain`,
        { cwd: process.cwd() }
      );

      if (statusOutput.trim()) {
        return res.status(400).json({ 
          message: 'Cannot revert: You have uncommitted changes. Please commit or stash them first.',
          uncommittedChanges: statusOutput
        });
      }

      // Perform hard reset to the specified commit
      await execAsync(
        `git reset --hard ${hash}`,
        { cwd: process.cwd() }
      );

      // Get the commit info after reset
      const { stdout: commitInfo } = await execAsync(
        `git log -1 --format="%H|%h|%an|%ad|%s" --date=short`,
        { cwd: process.cwd() }
      );

      const [fullHash, shortHash, author, date, message] = commitInfo.trim().split('|');

      res.json({
        success: true,
        message: `Successfully reverted to commit ${shortHash}`,
        commit: {
          hash: fullHash,
          shortHash,
          author,
          date,
          message
        }
      });
    } catch (error: any) {
      console.error('Failed to revert to commit:', error);
      res.status(500).json({ 
        message: error.message || 'Failed to revert to commit',
        error: error.stderr || error.message
      });
    }
  },

  async getCurrentCommit(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { stdout } = await execAsync(
        `git log -1 --format="%H|%h|%an|%ad|%s" --date=short`,
        { cwd: process.cwd() }
      );

      const [hash, shortHash, author, date, message] = stdout.trim().split('|');

      res.json({
        success: true,
        commit: {
          hash,
          shortHash,
          author,
          date,
          message
        }
      });
    } catch (error: any) {
      console.error('Failed to get current commit:', error);
      next(error);
    }
  }
};

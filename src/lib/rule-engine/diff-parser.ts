import type { DiffFile, DiffHunk, DiffLine } from './types';

/**
 * Parse unified diff text into structured DiffFile[]
 */
export function parseDiff(diffText: string): DiffFile[] {
  const files: DiffFile[] = [];
  const lines = diffText.split('\n');

  let currentFile: DiffFile | null = null;
  let currentHunk: DiffHunk | null = null;
  let oldLineCounter = 0;
  let newLineCounter = 0;

  const hunkHeaderRe = /^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/;
  const diffGitRe = /^diff --git\s+a\/(.*)\s+b\/(.*)$/;
  const oldFileRe = /^---\s+(?:a\/)?(.*)$/;
  const newFileRe = /^\+\+\+\s+(?:b\/)?(.*)$/;
  const binaryRe = /^Binary files/;

  function pushHunk() {
    if (currentHunk && currentFile) {
      currentFile.hunks.push(currentHunk);
    }
    currentHunk = null;
  }

  function pushFile() {
    pushHunk();
    if (currentFile) {
      files.push(currentFile);
    }
    currentFile = null;
  }

  for (const rawLine of lines) {
    // diff --git header
    const gitMatch = rawLine.match(diffGitRe);
    if (gitMatch) {
      pushFile();
      currentFile = {
        oldPath: gitMatch[1],
        newPath: gitMatch[2],
        hunks: [],
      };
      continue;
    }

    // Skip index lines, similarity index, etc.
    if (rawLine.startsWith('index ') || rawLine.startsWith('similarity index ')) {
      continue;
    }

    // Binary file notice
    if (binaryRe.test(rawLine)) {
      if (currentFile) {
        currentFile.hunks = []; // empty hunks for binary
      }
      continue;
    }

    // --- a/file
    const oldMatch = rawLine.match(oldFileRe);
    if (oldMatch && currentFile) {
      currentFile.oldPath = oldMatch[1];
      continue;
    }

    // +++ b/file
    const newMatch = rawLine.match(newFileRe);
    if (newMatch && currentFile) {
      currentFile.newPath = newMatch[1];
      continue;
    }

    // Hunk header
    const hunkMatch = rawLine.match(hunkHeaderRe);
    if (hunkMatch && currentFile) {
      pushHunk();
      const oldStart = parseInt(hunkMatch[1], 10);
      const oldCount = hunkMatch[2] ? parseInt(hunkMatch[2], 10) : 1;
      const newStart = parseInt(hunkMatch[3], 10);
      const newCount = hunkMatch[4] ? parseInt(hunkMatch[4], 10) : 1;

      currentHunk = {
        oldStart,
        oldLines: oldCount,
        newStart,
        newLines: newCount,
        content: rawLine,
        lines: [],
      };
      oldLineCounter = oldStart;
      newLineCounter = newStart;
      continue;
    }

    // Inside a hunk
    if (currentHunk && currentFile) {
      let diffLine: DiffLine | null = null;

      if (rawLine.startsWith('+')) {
        diffLine = {
          type: 'add',
          content: rawLine.slice(1),
          newLineNumber: newLineCounter,
        };
        newLineCounter++;
      } else if (rawLine.startsWith('-')) {
        diffLine = {
          type: 'remove',
          content: rawLine.slice(1),
          oldLineNumber: oldLineCounter,
        };
        oldLineCounter++;
      } else if (rawLine.startsWith(' ')) {
        diffLine = {
          type: 'context',
          content: rawLine.slice(1),
          oldLineNumber: oldLineCounter,
          newLineNumber: newLineCounter,
        };
        oldLineCounter++;
        newLineCounter++;
      }
      // Lines that don't start with +, -, or space (e.g. \ No newline at end of file) are ignored

      if (diffLine) {
        currentHunk.lines.push(diffLine);
      }
    }
  }

  pushFile();
  return files;
}

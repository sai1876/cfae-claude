import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach(function(file) {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

describe('Repo Hygiene', () => {
  it('should not have root cleanup scripts', () => {
    const rootPath = path.resolve(__dirname, '../../');
    expect(fs.existsSync(path.join(rootPath, 'clean_tsc.js'))).toBe(false);
    expect(fs.existsSync(path.join(rootPath, 'fix_remaining.js'))).toBe(false);
    expect(fs.existsSync(path.join(rootPath, 'fix_unused_smart.js'))).toBe(false);
  });

  it('should not have Unimplemented stub called in src', () => {
    const srcPath = path.resolve(__dirname, '../');
    const files = getAllFiles(srcPath);
    let found = false;
    
    for (const file of files) {
      if ((file.endsWith('.ts') || file.endsWith('.tsx')) && !file.includes('__tests__')) {
        const content = fs.readFileSync(file, 'utf-8');
        if (content.includes('Unimplemented stub called')) {
          found = true;
          break;
        }
      }
    }
    
    expect(found).toBe(false);
  });

  it('should not have NEXT_PUBLIC_API_SECRET_KEY in order flow files', () => {
    const srcPath = path.resolve(__dirname, '../');
    const files = getAllFiles(srcPath);
    let found = false;
    
    for (const file of files) {
      if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        const lowerFile = file.toLowerCase();
        if (lowerFile.includes('order') || lowerFile.includes('checkout') || lowerFile.includes('api')) {
          const content = fs.readFileSync(file, 'utf-8');
          if (content.includes('NEXT_PUBLIC_API_SECRET_KEY')) {
            found = true;
            break;
          }
        }
      }
    }
    
    expect(found).toBe(false);
  });

  it('should not have cleanup scripts in package.json', () => {
    const pkgPath = path.resolve(__dirname, '../../package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    
    const scripts = JSON.stringify(pkg.scripts || {});
    expect(scripts.includes('clean_tsc.js')).toBe(false);
    expect(scripts.includes('fix_remaining.js')).toBe(false);
    expect(scripts.includes('fix_unused_smart.js')).toBe(false);
  });
});

#!/usr/bin/env python3
"""Identify source copies without reading runtime secrets or build artifacts."""
import argparse
import hashlib
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path

EXCLUDED = {'.git', 'node_modules', '.next', '.turbo', '.uploads', 'generated', 'dist', '__pycache__'}

def fingerprint(root):
    files = []
    for name in ['apps', 'packages', 'scripts', 'deploy']:
        directory = root / name
        if not directory.exists():
            continue
        for path in directory.rglob('*'):
            relative = path.relative_to(root)
            if not path.is_file() or path.is_symlink() or any(part in EXCLUDED for part in relative.parts):
                continue
            if path.name.startswith('.env') or path.suffix in {'.env', '.pem', '.key', '.pyc'} or path.name in {'source-version.json', 'runtime.env', '.DS_Store'}:
                continue
            if name == 'deploy' and ('screenshots' in relative.parts or path.name.startswith('.')):
                continue
            files.append(path)
    files += [root / name for name in ['package.json', 'package-lock.json', 'turbo.json', 'tsconfig.json', '.gitignore'] if (root / name).is_file()]
    digest = hashlib.sha256()
    for path in sorted(files):
        digest.update(path.relative_to(root).as_posix().encode() + b'\0')
        digest.update(hashlib.sha256(path.read_bytes()).digest())
    return digest.hexdigest(), len(files)

def git_value(root, *args):
    try:
        return subprocess.check_output(['git', '-C', str(root), *args], stderr=subprocess.DEVNULL).decode().strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return None

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--provenance-root', type=Path)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    root = args.root.resolve()
    provenance = (args.provenance_root or root).resolve()
    digest, count = fingerprint(root)
    status = git_value(provenance, 'status', '--porcelain')
    manifest = {'gitCommit': git_value(provenance, 'rev-parse', 'HEAD'), 'gitBranch': git_value(provenance, 'branch', '--show-current'), 'dirty': bool(status) if status is not None else None, 'sourceSha256': digest, 'fileCount': count, 'createdAt': datetime.now(timezone.utc).isoformat()}
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps(manifest))

if __name__ == '__main__':
    main()

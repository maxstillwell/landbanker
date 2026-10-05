"""Publish a committed Land Banker source tree when HTTPS Git auth is unavailable.

Uses gh's configured API identity, preserves commit/tree hashes, checks the expected
remote parent, and never force-updates the branch. User authorized public source
and technical docs for this exact independent repository; private data excluded.
"""
import datetime
import json
import re
import subprocess

REPO = 'maxstillwell/landbanker'

def git(*args):
    return subprocess.check_output(['git', *args])

def api(path, payload=None, method='POST'):
    command = ['gh', 'api', 'repos/' + REPO + path]
    if payload is not None:
        command += ['--method', method, '--input', '-']
    result = subprocess.run(command, input=json.dumps(payload) if payload is not None else None,
                            capture_output=True, text=True, check=False)
    if result.returncode:
        raise RuntimeError(result.stderr.strip())
    return json.loads(result.stdout)

def identity(line):
    match = re.fullmatch(r'(?:author|committer) (.*) <(.*)> (\d+) ([+-])(\d{2})(\d{2})', line)
    name, email, stamp, sign, hours, minutes = match.groups()
    offset = (int(hours) * 60 + int(minutes)) * (1 if sign == '+' else -1)
    date = datetime.datetime.fromtimestamp(int(stamp), datetime.timezone(datetime.timedelta(minutes=offset)))
    return {'name': name, 'email': email, 'date': date.isoformat()}

def main():
    assert not git('status', '--porcelain').strip(), 'Commit changes before publication'
    assert git('remote', 'get-url', 'origin').decode().strip() == 'https://github.com/' + REPO + '.git'
    branch = git('branch', '--show-current').decode().strip()
    assert branch == 'main', 'This fallback publishes committed main only; use PR branches for team changes'
    sha = git('rev-parse', 'HEAD').decode().strip()
    remote = api('/git/ref/heads/main')['object']['sha']
    if remote == sha:
        print('Main is already published.'); return
    raw = git('cat-file', 'commit', sha).decode()
    headers, message = raw.split('\n\n', 1)
    lines = headers.splitlines()
    parents = [line.split()[1] for line in lines if line.startswith('parent ')]
    assert parents == [remote], 'Fetch/reconcile remote first; refusing divergent or concurrent update'
    entries = []
    for line in git('ls-tree', '-r', '-z', sha).split(b'\0'):
        if not line: continue
        attrs, path = line.split(b'\t', 1)
        mode, kind, blob = attrs.decode().split()
        path = path.decode()
        assert kind == 'blob' and not any(part in path for part in ['private-imports/', '.env.local', 'infra/local/.env', 'artifacts/', 'node_modules/']), path
        content = git('cat-file', 'blob', blob).decode()
        assert not re.search(r'eyJ[A-Za-z0-9_-]{25,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}', content), path
        assert not re.search(r'sb_secret_[A-Za-z0-9_-]{15,}', content), path
        entries.append({'path': path, 'mode': mode, 'type': 'blob', 'content': content})
    tree = api('/git/trees', {'tree': entries})
    assert tree['sha'] == git('rev-parse', 'HEAD^{tree}').decode().strip(), 'Remote tree mismatch'
    commit = api('/git/commits', {'message': message, 'tree': tree['sha'], 'parents': parents,
        'author': identity(next(line for line in lines if line.startswith('author '))),
        'committer': identity(next(line for line in lines if line.startswith('committer ')))})
    assert commit['sha'] == sha, 'Remote commit mismatch'
    assert api('/git/ref/heads/main')['object']['sha'] == remote, 'Concurrent remote update; refusing overwrite'
    api('/git/refs/heads/main', {'sha': sha, 'force': False}, 'PATCH')
    print('Published verified main:', sha)

if __name__ == '__main__':
    main()

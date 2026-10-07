"""Real two-writer commit ordering, restricted to the disposable RLS test container."""
import json
import os
import re
import select
import subprocess
import sys
import time

container = sys.argv[1]
assert re.fullmatch(r"land-banker-rls-test-\d+", container), "Disposable fixture only"
command = ["docker", "exec", "-i", container, "psql", "-h", "127.0.0.1",
           "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-qAt"]

def query(sql):
    result = subprocess.run(command, input=sql, capture_output=True, text=True, timeout=15)
    assert result.returncode == 0, result.stderr
    return result.stdout.strip().splitlines()[-1]

user = "33333333-3333-4333-8333-333333333333"
workspace = query(f"insert into auth.users(id) values('{user}'); select id from public.workspaces where personal_owner_id='{user}';")
assert re.fullmatch(r"[a-f0-9-]{36}", workspace)
writer_a = "aaaaaaaa-abab-4bab-8bab-abababababab"
writer_b = "bbbbbbbb-abab-4bab-8bab-abababababab"
rolled_back = "cccccccc-abab-4bab-8bab-abababababab"
auth = f"begin;set local role authenticated;select set_config('request.jwt.claim.sub','{user}',true);"
application = f"landos_sync_writer_b_{os.getpid()}"

def ready(process, marker):
    deadline = time.monotonic() + 15
    output = b""
    while marker.encode() not in output:
        remaining = deadline - time.monotonic()
        assert remaining > 0, f"Timed out waiting for {marker}: {output.decode()}"
        if select.select([process.stdout], [], [], min(0.5, remaining))[0]:
            chunk = os.read(process.stdout.fileno(), 4096)
            assert chunk, f"Writer exited early: {output.decode()}"
            output += chunk

processes = []
try:
    a = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, bufsize=0)
    processes.append(a)
    a.stdin.write((auth + f"insert into public.land_parcels(id,workspace_id,title) values('{writer_a}','{workspace}','Commit A');select 'writer-a-ready';\n").encode())
    ready(a, "writer-a-ready")
    b = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, bufsize=0)
    processes.append(b)
    b.stdin.write((f"set application_name='{application}';" + auth + f"insert into public.land_parcels(id,workspace_id,title) values('{writer_b}','{workspace}','Commit B');commit;select 'writer-b-committed';\n").encode())
    b.stdin.close()
    # Prove the second writer actually reached its DB lock; do not rely on sleep order.
    deadline = time.monotonic() + 15
    while query(f"select exists(select 1 from pg_stat_activity where application_name='{application}' and wait_event_type='Lock');") != "t":
        assert time.monotonic() < deadline, "Second writer did not wait for the first transaction"
        assert b.poll() is None, "Second writer committed before the first"
        time.sleep(0.05)
    before = json.loads(query(auth + f"select public.landos_workspace_changes('{workspace}');commit;"))
    assert before["cursor"] == "0" and before["events"] == [], "Uncommitted writer advanced reader cursor"
    a.stdin.write(b"commit;select 'writer-a-committed';\n")
    a.stdin.close()
    ready(a, "writer-a-committed")
    ready(b, "writer-b-committed")
    assert a.wait(timeout=10) == 0 and b.wait(timeout=10) == 0
    after = json.loads(query(auth + f"select public.landos_workspace_changes('{workspace}',0);commit;"))
    assert [event["id"] for event in after["events"]] == [writer_a, writer_b]
    assert after["cursor"] == "2" and not after["has_more"], "Committed writer skipped by cursor"
    query(auth + f"insert into public.land_parcels(id,workspace_id,title) values('{rolled_back}','{workspace}','Rollback');rollback;select 'rolled-back';")
    final = json.loads(query(auth + f"select public.landos_workspace_changes('{workspace}',2);commit;"))
    assert final["cursor"] == "2" and final["events"] == [], "Rollback left cursor/event residue"
    print("PASS: concurrent Workspace writers serialize committed revisions; readers cannot skip an uncommitted writer; rollback leaves no cursor/event residue.")
finally:
    for process in processes:
        if process.poll() is None:
            process.kill()
            process.wait(timeout=5)

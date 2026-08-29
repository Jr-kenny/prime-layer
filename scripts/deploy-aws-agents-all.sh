#!/usr/bin/env bash
# Deploy ALL 9 Prime Layer agents to the AWS instance as systemd services.
# Idempotent: re-runs reset existing services cleanly.
set -e
INSTANCE="$1"
APP_REMOTE="/opt/prime-layer"
BUN_REMOTE="/root/.bun/bin/bun"
cd "$(dirname "$0")/.."  # run python from project root
python3 - "$INSTANCE" "$APP_REMOTE" "$BUN_REMOTE" <<'PYEOF'
import subprocess, sys, base64, json

INSTANCE = sys.argv[1]
APP_REMOTE = sys.argv[2]
BUN_REMOTE = sys.argv[3]
AGENTS = [
  ("prime-signals", 8090),
  ("web-research", 8091),
  ("social-signal", 8092),
  ("project-intel", 8093),
  ("company-intel", 8094),
  ("person-role", 8095),
  ("procurement", 8096),
  ("media-youtube", 8097),
  ("verification", 8098),
  ("synthesis", 8099),
]

# 1. Pull live env — prefer .env.live-turso-backup (local dev now uses file DB)
def get(key):
    for fname in ['.env.live-turso-backup', '.env']:
        out = subprocess.run(['grep', f'^{key}=', fname], capture_output=True, text=True).stdout
        if out:
            return out.split('=', 1)[1].strip().strip('"').strip("'").strip()
    return ''

env = {
  'ZERO_G_NETWORK': 'mainnet',
  'ZERO_G_PRIVATE_KEY': get('ZERO_G_PRIVATE_KEY'),
  'ZERO_G_COMPUTE_API_KEY': get('ZERO_G_COMPUTE_API_KEY'),
  'ZERO_G_COMPUTE_BASE_URL': 'https://router-api.0g.ai/v1',
  'AGENTIC_ID_CONTRACT': get('AGENTIC_ID_CONTRACT'),
  'PRIME_ORCHESTRATOR': 'https://primelayernowlive.vercel.app',
  'DATABASE_URL': get('DATABASE_URL'),
  'DATABASE_AUTH_TOKEN': get('DATABASE_AUTH_TOKEN'),
  'TURSO_PLATFORM_TOKEN': get('TURSO_PLATFORM_TOKEN'),
  'YOUTUBE_API_KEY': get('YOUTUBE_API_KEY'),
}
env_b64 = base64.b64encode(("\n".join(f"{k}={v}" for k, v in env.items() if v) + "\n").encode()).decode()

# 2. Build a single shell script that runs on the box
services = []
for name, port in AGENTS:
    services.append(f"""[Unit]
Description=Prime Layer Agent: {name}
After=network-online.target

[Service]
ExecStart={BUN_REMOTE} run agents/{name}/index.ts
WorkingDirectory={APP_REMOTE}
EnvironmentFile={APP_REMOTE}/.env
Environment=CONNECTOR_PORT={port}
Environment=CONNECTOR_PUBLIC_URL=http://100.61.3.35:{port}
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target""")

# All services concatenated with a separator so we can split on the box
services_blob = "\n---SVC---\n".join(services)
services_b64 = base64.b64encode(services_blob.encode()).decode()

# 3. Single SSM command that does it all
script = f"""
set -e
mkdir -p {APP_REMOTE}

# Ensure the env file is current
echo '{env_b64}' | base64 -d > {APP_REMOTE}/.env
echo "env written: $(wc -c < {APP_REMOTE}/.env) bytes"

# Write each service file
python3 - <<'PY'
import base64
blob = '{services_b64}'
parts = base64.b64decode(blob).decode().split('\\n---SVC---\\n')
names = ['prime-signals','web-research','social-signal','project-intel','company-intel','person-role','procurement','media-youtube','verification','synthesis']
for n, body in zip(names, parts):
    open(f'/etc/systemd/system/prime-agent-{{n}}.service','w').write(body)
PY

systemctl daemon-reload
# Disable the old single-agent service to free port 8090 — replaced by prime-agent-prime-signals
if systemctl list-unit-files prime-signals.service >/dev/null 2>&1; then
  systemctl disable --now prime-signals.service 2>/dev/null || true
fi
for n in prime-signals web-research social-signal project-intel company-intel person-role procurement media-youtube verification synthesis; do
  systemctl enable --now prime-agent-$n.service
  sleep 1
done
sleep 6

echo '--- service status ---'
for n in prime-signals web-research social-signal project-intel company-intel person-role procurement media-youtube verification synthesis; do
  state=$(systemctl is-active prime-agent-$n.service 2>/dev/null || echo unknown)
  echo "$n: $state"
done

echo '--- listening ports ---'
(ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null) | grep -E ':80(9[0-9])' | sort
"""

# 4. Send the script as a base64 blob (avoids quoting issues)
script_b64 = base64.b64encode(script.encode()).decode()
import json as _json
ssm_param_json = _json.dumps({"commands": [f"echo '{script_b64}' | base64 -d | bash"]})
res = subprocess.run([
  'aws','ssm','send-command',
  '--instance-ids', INSTANCE,
  '--document-name', 'AWS-RunShellScript',
  '--parameters', ssm_param_json,
  '--output','json'
], capture_output=True, text=True)
print('STDOUT:', res.stdout[:500])
print('STDERR:', res.stderr[:500])
if not res.stdout.strip():
  print('empty stdout — likely a quoting issue with --parameters')
  raise SystemExit(1)
cmd_id = json.loads(res.stdout)['Command']['CommandId']
print('CMD_ID:', cmd_id)
PYEOF

#!/usr/bin/env bash
# Deploy Prime Signals agent onto the AWS instance via SSM (no secrets in output).
set -e
INSTANCE="i-0018b77942c4452bc"

cd /Users/user/Documents/prime-layer
python3 - <<'PYEOF'
import subprocess

def get(key):
    out = subprocess.run(['grep', f'^{key}=', '.env'], capture_output=True, text=True).stdout
    return out.split('=', 1)[1].strip().strip('"') if out else ''

env = {
    'ZERO_G_NETWORK': 'mainnet',
    'ZERO_G_PRIVATE_KEY': get('ZERO_G_PRIVATE_KEY'),
    'ZERO_G_COMPUTE_API_KEY': get('ZERO_G_COMPUTE_API_KEY'),
    'ZERO_G_COMPUTE_BASE_URL': 'https://router-api.0g.ai/v1',
    'AGENTIC_ID_CONTRACT': get('AGENTIC_ID_CONTRACT'),
    'PRIME_ORCHESTRATOR': 'https://primelayerlive.vercel.app',
    'CONNECTOR_PORT': '8790',
}
lines = [f"{k}={v}" for k, v in env.items() if v]
open('/tmp/agent.env.b64', 'w').write(
    __import__('base64').b64encode(("\n".join(lines) + "\n").encode()).decode()
)
print("env b64 ready:", sum(len(l) for l in lines), "bytes of vars")
PYEOF

B64=$(cat /tmp/agent.env.b64)
CMD_ID=$(aws ssm send-command --instance-ids "$INSTANCE" --document-name "AWS-RunShellScript" \
  --parameters commands="[\"echo $B64 | base64 -d > /opt/prime-layer/.env && echo env-written:\$(wc -c < /opt/prime-layer/.env)\"]" \
  --output json | python3 -c "import json,sys; print(json.load(sys.stdin)['Command']['CommandId'])")
sleep 12
aws ssm get-command-invocation --command-id "$CMD_ID" --instance-id "$INSTANCE" --output json > /tmp/o-env.json
python3 -c "import json; d=json.load(open('/tmp/o-env.json')); print('env:', d['Status'], d['StandardOutputContent'][:80])"

# systemd service for auto-restart + boot persistence
SERVICE='[Unit]
Description=Prime Signals Agent
After=network-online.target

[Service]
ExecStart=/root/.bun/bin/bun run agents/prime-signals/index.ts
WorkingDirectory=/opt/prime-layer
EnvironmentFile=/opt/prime-layer/.env
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target'
SB64=$(printf '%s' "$SERVICE" | base64 | tr -d '\n')
CMD_ID=$(aws ssm send-command --instance-ids "$INSTANCE" --document-name "AWS-RunShellScript" \
  --parameters commands="[\"echo $SB64 | base64 -d > /etc/systemd/system/prime-signals.service && systemctl daemon-reload && systemctl enable --now prime-signals && sleep 3 && systemctl is-active prime-signals\"]" \
  --output json | python3 -c "import json,sys; print(json.load(sys.stdin)['Command']['CommandId'])")
sleep 20
aws ssm get-command-invocation --command-id "$CMD_ID" --instance-id "$INSTANCE" --output json > /tmp/o-svc.json
python3 -c "import json; d=json.load(open('/tmp/o-svc.json')); print('service:', d['Status'], '|', d['StandardOutputContent'][-120:])"

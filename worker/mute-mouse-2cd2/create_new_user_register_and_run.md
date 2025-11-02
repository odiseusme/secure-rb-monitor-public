ADMIN work

1. Start the worker
cd ~/projects/secure-rb-monitor-public/worker/mute-mouse-2cd2
npm exec wrangler -- dev --port 38472 --local

2. Go here and Create new invitation for a local user: 
cd ~/projects/secure-rb-monitor-public/worker/mute-mouse-2cd2
curl -X POST http://localhost:38472/api/admin/create-invite \
  -H "x-admin-key: 9KEn-bWgX-YT4n" \
  -H "Content-Type: application/json" \
  -d '{"count": 1, "expiresInDays": 30}'
  
or for a cloudflare user:
cd ~/projects/secure-rb-monitor-public/worker/mute-mouse-2cd2
curl -X POST https://mute-mouse-2cd2.rbmonitor.workers.dev/api/admin/create-invite \
  -H "x-admin-key: 75bb33ef8de284a0f17e74e17d47db88e3d92218a5ca01b3a34886ddedc7cf6d" \
  -H "Content-Type: application/json" \
  -d '{"count": 1, "expiresInDays": 30}'
  
  
0. new for rbmonitor worker
  curl -X POST http://localhost:38472/api/admin/create-invite \
    -H "x-admin-key: 75bb33ef8de284a0f17e74e17d47db88e3d92218a5ca01b3a34886ddedc7cf6d" \
    -H "Content-Type: application/json" \
    -d '{"count": 1, "expiresInDays": 30}'

1. Open terminal in: cd ~/projects/secure-rb-monitor-public

2. Register the user:
run: BASE_URL=http://localhost:38472 node setup-cloudflare.js

you will see:
Found existing configuration.
Do you want to create a new registration? (y/N):
Enter your invitation code: INVITE-1EABL3-96R6PH

Registering with Cloudflare...

✅ Registration complete. Saved to .cloudflare-config.json

Public ID:     tWGCPODaCLEx6oK2Fu2uiYStY08XrgCD
Write token:   v7S4RaW11NiTG2OqzhqH8iPY0zV6kfUuSLGrxyz9Ae1674hWfC75JqLdF45KA169
Salt (b64):    XPLLTn492Fm4uWkPFZqp1n7yH1MuNo2w
Dashboard URL: http://localhost:38472/d/tWGCPODaCLEx6oK2Fu2uiYStY08XrgCD

5. Then run

BASE_URL=http://localhost:38472 \
WRITE_TOKEN=v7S4RaW11NiTG2OqzhqH8iPY0zV6kfUuSLGrxyz9Ae1674hWfC75JqLdF45KA169 \
DASH_PASSPHRASE=TestPassphrase123! \
DASH_SALT_B64=XPLLTn492Fm4uWkPFZqp1n7yH1MuNo2w \
node cloudflare-sync.js



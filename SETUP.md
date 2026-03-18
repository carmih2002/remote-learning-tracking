# Setup — Push Notifications & Deployment

## Step 1 — Register the VAPID key in Firebase Console (one-time, 30 seconds)

1. Go to: https://console.firebase.google.com/project/remote-learning-tracking/settings/cloudmessaging
2. Scroll to **"Web configuration"** → **"Web Push certificates"**
3. Click **"Import an existing key pair"**
4. Paste the values below and click **Save**:

**Public key:**
```
BGxCtBrzIuY8ehqODAsmSNqe6Xlc8HDsKiYyK99x_VpolrlG7I7Hp_uliIVMl_uNAAXRK7vsTv6_IVaylcogsUk
```

**Private key:**
```
JBexjRCj62dlJOx3gOQHLRiWbr4dhkOL-f0JJCVlFd8
```

> ✅ Key pair already registered in Firebase Console.

---

## Step 2 — Deploy (one-time, ~2 minutes)

Open a terminal in the project folder and run:

```bash
# Login once (opens browser)
firebase login

# Install Cloud Function dependencies
cd functions && npm install && cd ..

# Deploy everything
firebase deploy
```

That's it. After deploy, push notifications will work end-to-end.

---

## How it works

| What | How |
|---|---|
| Student submits report | deviceId stored in localStorage + Firestore |
| Teacher replies | Saved to Firestore, Cloud Function fires |
| Student has app open | Firestore onSnapshot updates UI + shows toast |
| Student has app closed | FCM push notification via service worker |
| Student reopens app | Reply loads from Firestore (fallback) |

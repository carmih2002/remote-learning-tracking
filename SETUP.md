# Setup — Push Notifications & Deployment

## Step 1 — Register the VAPID key in Firebase Console (one-time, 30 seconds)

1. Go to: https://console.firebase.google.com/project/remote-learning-tracking/settings/cloudmessaging
2. Scroll to **"Web configuration"** → **"Web Push certificates"**
3. Click **"Import an existing key pair"**
4. Paste the values below and click **Save**:

**Public key:**
```
BKvH68IGj17PMUt0LLeA1Bxu5ZGE3G1xshwCMrTlk2VIaZtL48pSg04Fzk9qlc7-GdnwoPhebSlgrHOl-3pXTTI
```

**Private key:**
```
mU_kskcyZ4n6Hx8W613u9SCm1Whrr_5D0Iu3oJx1F8Q
```

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

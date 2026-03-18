const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { initializeApp }     = require("firebase-admin/app");
const { getMessaging }      = require("firebase-admin/messaging");

initializeApp();

/**
 * Triggered whenever a daily report document (reports/{date}) is updated.
 *
 * Compares every entry before and after the write.
 * If a teacher reply was newly added or changed for an entry that has a
 * deviceToken, sends a push notification to that specific device.
 */
exports.onTeacherReply = onDocumentUpdated("reports/{date}", async (event) => {
  const before        = event.data.before.data();
  const after         = event.data.after.data();
  const beforeEntries = before?.entries || [];
  const afterEntries  = after?.entries  || [];

  const sendPromises = [];

  afterEntries.forEach((afterEntry, i) => {
    const beforeEntry  = beforeEntries[i] || {};
    const replyAdded   = afterEntry.teacherReply && !beforeEntry.teacherReply;
    const replyChanged = afterEntry.teacherReply
                      && beforeEntry.teacherReply
                      && afterEntry.teacherReply !== beforeEntry.teacherReply;

    if ((replyAdded || replyChanged) && afterEntry.deviceToken) {
      const message = {
        token:        afterEntry.deviceToken,
        notification: {
          title: "המורה הגיב לך 📩",
          body:  "לחץ כדי לראות את התגובה",
        },
        webpush: {
          fcmOptions: { link: "/" },
        },
      };

      sendPromises.push(
        getMessaging()
          .send(message)
          .then(() => console.log(`Push sent to: ${afterEntry.name}`))
          .catch(err => console.error(`Push failed for ${afterEntry.name}:`, err.message))
      );
    }
  });

  await Promise.all(sendPromises);
});

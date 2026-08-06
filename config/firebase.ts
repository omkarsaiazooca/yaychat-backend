import admin from "firebase-admin";

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!admin.apps.length) {
  const credential =
    projectId && clientEmail && privateKey
      ? admin.credential.cert({ projectId, clientEmail, privateKey })
      : admin.credential.applicationDefault();

  admin.initializeApp({ credential });
}

export default admin;

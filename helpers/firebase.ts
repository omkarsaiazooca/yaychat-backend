
import { initializeApp, getApps } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
const firebaseConfig = {
  apiKey: process.env.FIREBASE_WEB_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_WEB_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID,
};

/*
export async function createUserWithEmailAndPasswordForWallet(
  email: string,
  password: string
): Promise<{ success: boolean; user?: any; error?: any }> {
 await initializeApp(firebaseConfig);
  const auth = getAuth();
  console.log("creating walleter uer");
  try {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );
    // The user has been created successfully. You can access userCredential.user for the user information.
    console.log("User has been created:");
    return { success: true, user: userCredential.user };
  } catch (error: any) {
    // Handle any errors that occurred during user creation.
    console.error("Error creating user:", error);
    return { success: false, error: error.message };
  }
} */




export async function createUserWithEmailAndPasswordForWallet(
  email: string,
  password: string
): Promise<{ success: boolean; user?: any; error?: any }> {
  try {
    // Initialize Firebase only once
    if (getApps().length === 0) {
      initializeApp(firebaseConfig);
    }

    const auth = getAuth();

    console.log("Creating wallet user...");
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);

    console.log("User has been created:", userCredential.user.email);
    return { success: true, user: userCredential.user };
  } catch (error: any) {
    console.error("Error creating user:", error);
    return { success: false, error: error.message };
  }
}

import { FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import { Firestore, getFirestore, initializeFirestore } from "firebase/firestore";

export type AppFirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
};

export class FirebaseClientDataAccess {
  private readonly app: FirebaseApp;
  private readonly firestore: Firestore;

  constructor(private readonly config: AppFirebaseConfig) {
    // Reuse the already-initialized app/firestore (e.g. across hot reloads) to
    // avoid the "already exists" / "already initialized" errors.
    const alreadyInitialized = getApps().length > 0;
    this.app = alreadyInitialized ? getApp() : initializeApp(this.config);
    // `ignoreUndefinedProperties` lets us persist partial contexts (e.g. an
    // absent `currentToolCall`) without manually stripping undefined fields.
    this.firestore = alreadyInitialized
      ? getFirestore(this.app)
      : initializeFirestore(this.app, { ignoreUndefinedProperties: true });
  }

  get db(): Firestore {
    return this.firestore;
  }
}

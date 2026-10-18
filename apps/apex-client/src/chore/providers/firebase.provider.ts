import { InjectionToken, Provider } from "@angular/core";
import { AppFirebaseConfig, FirebaseClientDataAccess } from "@org/firebase";

export const FIREBASE_APP_CONFIG = new InjectionToken<AppFirebaseConfig>('FIREBASE_APP_CONFIG');

export function provideFirebase(config: AppFirebaseConfig): Provider[] {
  return [
    { provide: FIREBASE_APP_CONFIG, useValue: config },
    {
      provide: FirebaseClientDataAccess,
      useFactory: (firebaseConfig: AppFirebaseConfig) => new FirebaseClientDataAccess(firebaseConfig),
      deps: [FIREBASE_APP_CONFIG],
    },
  ];
}

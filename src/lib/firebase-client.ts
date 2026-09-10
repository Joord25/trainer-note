"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

let clientAuth: Auth | undefined;

// Explicit references allow Next.js to inline the public Web SDK configuration.
export function getClientAuth(): Auth {
  if (typeof window === "undefined") throw new Error("auth/browser-required");
  if (clientAuth) return clientAuth;
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  };
  if (!config.apiKey || !config.authDomain || !config.projectId || !config.appId) {
    throw new Error("auth/missing-config");
  }
  const app = getApps().some(app => app.name === "[DEFAULT]") ? getApp() : initializeApp(config);
  clientAuth = getAuth(app);
  clientAuth.languageCode = "ko";
  return clientAuth;
}

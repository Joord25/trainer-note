"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

import { initializeAppCheck, ReCaptchaEnterpriseProvider, type AppCheck } from "firebase/app-check";

let clientAppCheck: AppCheck | undefined;
export function getClientAppCheck() { getClientAuth(); return clientAppCheck; }
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
  const siteKey = process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY;
  if (siteKey && !clientAppCheck) {
    // Development token is compiled out of production; never accept it on other hosts.
    if (process.env.NODE_ENV === "development" && ["localhost", "127.0.0.1"].includes(window.location.hostname)) {
      const debugToken = process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN;
      if (debugToken) (self as typeof self & { FIREBASE_APPCHECK_DEBUG_TOKEN?: string }).FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
    }
    clientAppCheck = initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(siteKey), isTokenAutoRefreshEnabled: true });
  }
  clientAuth = getAuth(app);
  clientAuth.languageCode = "ko";
  return clientAuth;
}

import type { Metadata } from "next";
import "./globals.css";
import "./auth.css";
import "./members.css";
import "./files.css";
import "./records.css";
import "./ai.css";
import "./workspace-design.css";
import "./display-theme.css";
import "./demo.css";
export const metadata: Metadata = { title: "트레이너 노트", description: "기록이 다음 수업의 근거가 됩니다." };
export default function Layout({ children }: Readonly<{children: React.ReactNode}>) { return <html lang="ko"><body>{children}</body></html>; }

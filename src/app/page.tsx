"use client";
import { useState } from "react";
import { AuthGate } from "../components/auth-gate";
import { MemberWorkspace } from "../components/member-workspace";
import { DemoWorkspace } from "../components/demo-workspace";
function Workspace() {
  const [demo, setDemo] = useState(false);
  return demo ? <DemoWorkspace onBack={() => setDemo(false)}/> : <MemberWorkspace onDemo={() => setDemo(true)}/>;
}
export default function Home() { return <AuthGate><Workspace/></AuthGate>; }

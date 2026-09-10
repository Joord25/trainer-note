export function authErrorMessage(error: unknown): string {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String(error.code) : error instanceof Error ? error.message : "";
  const messages: Record<string, string> = {
    "auth/popup-closed-by-user": "로그인 창이 닫혔어요. 다시 눌러 계속할 수 있어요.",
    "auth/cancelled-popup-request": "로그인이 이미 진행 중이에요. 열린 로그인 창을 확인해주세요.",
    "auth/popup-blocked": "로그인 팝업이 차단됐어요. 이 사이트의 팝업을 허용한 뒤 다시 눌러주세요.",
    "auth/network-request-failed": "연결이 원활하지 않아요. 인터넷 연결을 확인한 뒤 다시 시도해주세요.",
    "auth/unauthorized-domain": "이 주소에서는 아직 로그인할 수 없어요. 서비스 관리자에게 문의해주세요.",
    "auth/operation-not-allowed": "Google 로그인이 아직 준비되지 않았어요. 잠시 후 다시 시도해주세요.",
    "auth/configuration-not-found": "로그인 서비스를 준비하고 있어요. 잠시 후 다시 시도해주세요.",
    "auth/user-disabled": "사용이 중지된 계정이에요. 서비스 관리자에게 문의해주세요.",
    "auth/too-many-requests": "요청이 많아 잠시 기다려야 해요. 잠시 후 다시 시도해주세요.",
    "auth/web-storage-unsupported": "로그인 유지에 필요한 브라우저 저장소를 사용할 수 없어요. 브라우저 설정을 확인해주세요.",
    "auth/missing-config": "로그인 연결 설정을 준비하고 있어요. 잠시 후 다시 시도해주세요.",
    "auth/invalid-api-key": "로그인 연결 설정을 확인해야 해요. 서비스 관리자에게 문의해주세요.",
    "auth/account-exists-with-different-credential": "이 이메일로 가입한 다른 로그인 방법이 있어요. 기존 방법으로 로그인해주세요.",
  };
  return messages[code] ?? "로그인을 처리하지 못했어요. 다시 시도해주세요.";
}

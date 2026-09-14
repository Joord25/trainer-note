// null disables only the application quota. Numeric values re-enable each cap.
// Costs use micro-USD (1,000,000 = $1). Keep usage accounting enabled in either mode.
export const AI_USAGE_POLICY: {monthlyMicros:number|null;dailyCalls:number|null;globalMonthlyMicros:number|null} = {
 monthlyMicros:null,
 dailyCalls:null,
 globalMonthlyMicros:null,
};
export const aiUsagePolicyLabel = [
 AI_USAGE_POLICY.dailyCalls === null ? '' : `하루 ${AI_USAGE_POLICY.dailyCalls}회`,
 AI_USAGE_POLICY.monthlyMicros === null ? '' : `월 $${(AI_USAGE_POLICY.monthlyMicros/1e6).toFixed(2)}`,
 AI_USAGE_POLICY.globalMonthlyMicros === null ? '' : `서비스 전체 월 $${(AI_USAGE_POLICY.globalMonthlyMicros/1e6).toFixed(2)}`,
].filter(Boolean).join(' · ') || '앱 이용 한도 없음';

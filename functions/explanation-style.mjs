const kinds=new Set(['member-changes','cycle-plan','analysis-and-plan','goal-design','goal-visual','connected-lesson','assessment','assessment-review','assistant-chat','direction-discussion']);
export const EXPLANATION_STYLE='사용자에게 보여주는 한국어 설명·분석·답변의 서술문은 모두 친근하고 차분한 해요체(~해요, ~있어요, ~예요)로 통일한다. ~합니다/~입니다와 혼용하지 않는다. 제목·짧은 항목명·스키마 enum은 그대로 유지한다. 인용문·원문 기록·사용자가 작성한 문장·수치·단위·ID·URL은 문체 때문에 바꾸지 않는다. 불확실성·부정·조건·근거의 의미를 유지한다.';
export function withExplanationStyle(kind,request){return kinds.has(kind)?{...request,system:(request.system??'')+'\n'+EXPLANATION_STYLE}:request;}

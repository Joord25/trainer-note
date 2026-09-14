// Public official-source summaries, reviewed 2026-09-14. Not textbook ingestion or model training.
export const TRAINING_GUIDANCE_VERSION='training-guidance-2026-09-14-v2';
export const TRAINING_GUIDANCE_SOURCES=[
 {id:'ACSM2026',title:'ACSM resistance training position stand · 2026',url:'https://acsm.org/resistance-training-guidelines-update-2026/',scope:'건강한 성인 대상 개정 지침의 공식 요약'},
 {id:'NASM-OPT',title:'NASM official OPT model · 현행 공개 자료',url:'https://www.nasm.org/certified-personal-trainer/the-opt-model',scope:'단계별 프로그래밍 체계. 2026 신판으로 확인한 자료는 아님'},
 {id:'NSCA-load',title:'NSCA Intensity or Resistance · 2018',url:'https://www.nsca.com/education/articles/kinetic-select/intensity-or-resistance/',scope:'목적·훈련 상태별 부하 선택의 공개 교육 자료. 5판 본문 아님'},
];
export const TRAINING_GUIDANCE=`공식 훈련 참고 기준 (${TRAINING_GUIDANCE_VERSION})
이 기준은 일반 참고이며 회원의 측정값·진단·완료한 훈련이 아니다. 실제 목표, 기존 프로그램 구성, 수행 조건, 통증·회복 메모, 트레이너가 확인한 평가를 우선하여 관련 기준만 적용한다. 네 능력을 모두 권하거나 목표를 자동 변경하지 않는다. 기존 출력 스키마와 근거 검증 규칙을 유지한다.
ACSM2026: 건강한 성인에서는 지속 가능한 규칙적 저항훈련과 개인화가 우선. 주요 근육군 주 2회 이상은 일반 참고이며 업로드한 PT 기록만으로 전체 주간 훈련량·부족을 확정하지 않는다. 실패지점 훈련·복잡한 주기화·특정 기구는 일반 성인의 개선에 필수 조건이 아니다.
최대근력: ACSM의 고부하(약 80% 1RM), 운동당 2–3세트는 목적별 참고. 측정한 1RM·가동 범위·기구·휴식·수행 여유가 없으면 kg나 횟수만으로 상대 강도/최대근력을 단정하지 않는다.
근비대: ACSM의 근육군당 주 약 10세트는 참고량이며 의무 하한·개인 목표가 아니다. 총 kg×횟수 증가만으로 근육 성장이나 적정 자극을 확정하지 않는다. 기록 범위·회복·부위별 훈련과 실제 체성분 측정을 구분한다.
파워(순발력): ACSM은 중간 부하(30–70% 1RM)와 빠른 구심성 동작을 강조. 최대근력·파워는 다르며 속도/폭발적 수행 자료 없이 파워 향상을 판정하지 않는다. 수치를 개인 처방으로 자동 적용하지 않는다.
NSCA-load: 근지구력 목적에는 상대적으로 가벼운 부하와 많은 반복을 고려. 목표·경험에 따라 부하를 선택하며 같은 %1RM의 가능한 반복수도 기구에 따라 다를 수 있다. 총 반복수와 단일세트 수행능력은 별개이고 근지구력과 심폐지구력은 같은 평가가 아니다.
NASM-OPT: 안정화 지구력→근력 지구력→근비대→최대근력→파워의 5단계는 조정 가능한 프로그램 틀. 모든 회원에게 순서·고급 기법을 강제하지 않는다. ACSM 일반 지침과 NASM 단계별 예시의 수치가 다르면 평균하거나 단일 정답으로 합치지 않는다.
앱 적용 원칙: 마이마운틴/러닝/로잉 등 유산소는 종목·기구·경사·속도·저항·운동/휴식 시간·중단 사유를 함께 읽는다. 서로 대체 가능해도 평가 기록을 동등하게 환산하지 않는다. 인터벌 구간 수를 라운드로 추정하거나 심폐 기록을 근비대/파워 증거로 쓰지 않는다. bodyPart=유산소는 트레이너 지정 분류로 존중한다. 에어 바이크는 복근 동작과 머신 이름이 겹친다. 코어·맨몸 반복 기록을 유산소로 바꾸지 않고 기구·측정 방식과 지정 부위를 우선한다. 자료가 없는 RPE·RIR·1RM·VO2max를 만들지 않는다. 관련성이 확인된 다음 조정/확인 사항만 간결하게 제안하며 일반 지침을 썼을 때는 근거 문장에 기관명과 연도/자료명을 짧게 밝힌다. 통증이 있는 회원에게 고부하·폭발적 훈련을 자동 처방하지 않는다.
`;
const kinds=new Set(['analysis-and-plan','goal-design','goal-visual','connected-lesson','assessment','assessment-review','assistant-chat']);
export function withTrainingGuidance(kind,request){
 if(!kinds.has(kind))return request;
 return {...request,system:(request.system??'')+'\n'+TRAINING_GUIDANCE+'\n참고 출처: '+TRAINING_GUIDANCE_SOURCES.map(s=>`${s.id} ${s.url}`).join(' | ')};
}
export function trainingGuidanceVersion(kind){return kinds.has(kind)?TRAINING_GUIDANCE_VERSION:null;}

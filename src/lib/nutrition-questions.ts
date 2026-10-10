// Public topics only: never append member goals, diary text or health information.
export const nutritionQuestions=['체지방 감량을 위한 식사 관리','근육 유지를 위한 단백질 섭취','운동 전후 영양과 회복'].map(label=>({label,question:`${label}에 관한 학술 논문과 공신력 있는 기관 가이드를 지금 검색해줘. 등록 회원과 분리한 별도 사례의 일반 영양 질문이에요. 회원 정보나 기존 대화는 사용하지 마세요. 확인한 근거와 출처 링크, 적용 조건, 실제 지도에서 확인할 점 순서로 설명해줘. 식단표나 개인 처방을 바로 만들지 말고 이 주제의 근거부터 설명해줘.`}));

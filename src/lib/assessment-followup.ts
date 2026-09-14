export const FOLLOWUP_ANSWER_LIMIT=2000;
// Keep submitted context separate from the new, unsent answer. Never truncate facts.
export function appendFollowupAnswer(previous:string,answer:string,questions:string[]):string{
 const text=answer.trim();if(!text)return previous;
 const context=questions.length?'확인 질문: '+questions.join(' / ')+'\n':'';
 const combined=[previous.trim(),context+'트레이너 답변: '+text].filter(Boolean).join('\n\n');
 if(combined.length>FOLLOWUP_ANSWER_LIMIT)throw Error('추가 답변이 길어요. 입력한 설명에 핵심 내용을 정리해주세요.');
 return combined;
}
export function followupPlaceholder(questions:string[]):string{
 return questions.length>1?'위 질문 순서대로 답변 입력':'위 질문에 대한 답변 입력';
}

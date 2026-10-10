import {nutritionQuestions} from '../lib/nutrition-questions';
export function NutritionQuestions({disabled,onSearch}:{disabled:boolean;onSearch:(question:string)=>void}){
 return <div className="nutrition-questions" aria-label="영양·회복 추천 질문"><h4>운동과 함께 확인해볼까요?</h4><p>영양·회복에서 궁금한 내용을 누르면 AI 도우미가 근거를 찾아 설명해요.</p><div>{nutritionQuestions.map(item=><button type="button" key={item.label} disabled={disabled} onClick={()=>onSearch(item.question)}>{item.label} ↗</button>)}</div></div>;
}

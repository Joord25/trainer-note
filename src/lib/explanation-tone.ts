/** Display-only compatibility for saved AI prose. Never write this back to records. */
const endings:Record<string,string>={
 '있습니다':'있어요','없습니다':'없어요','아닙니다':'아니에요',
 '보입니다':'보여요','됩니다':'돼요','합니다':'해요',
 '어렵습니다':'어려워요','쉽습니다':'쉬워요','다릅니다':'달라요',
 '높습니다':'높아요','낮습니다':'낮아요','많습니다':'많아요','적습니다':'적어요',
 '좋습니다':'좋아요','같습니다':'같아요','깁니다':'길어요','짧습니다':'짧아요',
 '큽니다':'커요','작습니다':'작아요','빠릅니다':'빨라요','느립니다':'느려요',
 '미칩니다':'미쳐요','바랍니다':'바라요','권합니다':'권해요',
 '드립니다':'드려요','줍니다':'줘요','봅니다':'봐요','따릅니다':'따라요',
 '움직입니다':'움직여요','늘립니다':'늘려요','시킵니다':'시켜요',
 '했습니다':'했어요','됐습니다':'됐어요','였습니다':'였어요','었습니다':'었어요','았습니다':'았어요',
 '겠습니다':'겠어요',
};
const endingPattern=new RegExp('('+Object.keys(endings).join('|')+'|입니다)(?=[.!?。…\\s*|)]|$)','g');
function prose(text:string){return text.replace(endingPattern,(ending:string, _match:string, offset:number)=>{
 if(ending!=='입니다')return endings[ending];
 const previous=text.charCodeAt(offset-1);
 // Noun copula: 받침 → 이에요, no 받침 → 예요. Do not guess foreign-name pronunciation.
 return previous>=0xac00&&previous<=0xd7a3?(previous-0xac00)%28?'이에요':'예요':'이에요';
});}
export function toFriendlyExplanation(text:string):string{
 // Preserve verbatim quotations, code, URLs and Markdown link destinations/titles.
 return text.split(/(```[\s\S]*?```|`[^`\n]*`|“[^”]*”|‘[^’]*’|"[^"\n]*"|'[^'\n]*'|https?:\/\/[^\s]+|\[[^\]\n]*\]\([^\n)]*\))/g)
  .map((part,index)=>index%2?part:prose(part)).join('');
}

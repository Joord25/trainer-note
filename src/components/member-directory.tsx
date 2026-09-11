"use client";
import type {DisplayPreferences} from '../lib/display-preferences';
import {Icon} from './icons';
import type {Member} from '../lib/members';
export function MemberDirectory({members,search,onSearch,onOpen,onCreate,canCreate,preferences,onPreferences}:{members:Member[];search:string;onSearch:(value:string)=>void;onOpen:(id:string)=>void;onCreate:()=>void;canCreate:boolean;preferences:DisplayPreferences;onPreferences:(patch:Partial<DisplayPreferences>)=>void}){
 const sort=preferences.sort;
 const visible=members.filter(m=>m.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
 if(sort==='name')visible.sort((a,b)=>a.name.localeCompare(b.name,'ko'));
 return <section className={"member-directory cards-"+preferences.cardSize} aria-label="회원 홈">
  <div className="directory-heading"><div><span className="section-eyebrow">MY MEMBERS</span><h1>내 회원 <span>{members.length}</span></h1><p>회원을 선택하고, 기록에서 다음 수업까지 이어가세요.</p></div><div className="directory-tools"><div className="segmented directory-size" aria-label="홈 회원 카드 크기">{[['small','작게'],['medium','보통'],['large','크게']].map(([value,label])=><button key={value} className={preferences.cardSize===value?'selected':''} aria-pressed={preferences.cardSize===value} onClick={()=>onPreferences({cardSize:value as DisplayPreferences['cardSize']})}>{label}</button>)}</div><label className="directory-search"><Icon name="search" size={17}/><input aria-label="홈 회원 검색" placeholder="회원 이름 검색" value={search} onChange={e=>onSearch(e.target.value)}/>{search&&<button className="icon-button" aria-label="회원 검색 지우기" onClick={()=>onSearch('')}><Icon name="close" size={14}/></button>}</label><select aria-label="회원 정렬" value={sort} onChange={e=>onPreferences({sort:e.target.value as DisplayPreferences['sort']})}><option value="recent">최근 등록순</option><option value="name">이름순</option></select></div></div>
  <div className="directory-grid">
   <button className="directory-create" disabled={!canCreate} onClick={onCreate}><span><Icon name="plus" size={28}/></span><strong>새 회원 등록</strong><small>새로운 회원의 기록을 시작하세요</small></button>
   {visible.map((member,index)=><button className="directory-card" key={member.id} onClick={()=>onOpen(member.id)} aria-label={`${member.name} 기록 열기`}><div className={'directory-cover tone-'+index%3}><span className="directory-initial">{member.name.slice(0,1)}</span><span className="directory-paper"><Icon name="file" size={29}/><i/><i/><i/></span><span className="directory-enter"><Icon name="arrow" size={19}/></span></div><div className="directory-card-copy"><h2>{member.name}</h2><p>{member.goal||'운동 목표를 설정해주세요'}</p><div className="directory-card-meta"><span><Icon name="file" size={13}/> 일지 {member.fileCount}개</span><span>운동 항목 {member.recordCount}개</span></div>{member.pending&&<small>저장 중…</small>}</div></button>)}
  </div>
  {members.length>0&&!visible.length&&<div className="directory-empty"><h2>검색한 회원이 없어요</h2><p>이름을 다시 확인하거나 새 회원을 등록해주세요.</p><button onClick={()=>onSearch('')}>전체 회원 보기</button></div>}
  {!members.length&&<p className="directory-first">첫 회원을 등록하면 운동일지를 업로드하고 분석을 시작할 수 있어요.</p>}
 </section>;
}

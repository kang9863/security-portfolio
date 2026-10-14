"use strict";
const cards=Array.from(document.querySelectorAll('[data-doc-card]'));
const search=document.querySelector('#report-search');
const counter=document.querySelector('#report-count');
const pageLabel=document.querySelector('#page-label');
const previous=document.querySelector('#page-previous');
const next=document.querySelector('#page-next');
const empty=document.querySelector('#report-empty');
const filters=Array.from(document.querySelectorAll('[data-category-filter]'));
const types=Array.from(document.querySelectorAll('[data-type-filter]'));
const allowed=['all','web','mobile','ad','pwn','reverse','detection','ai','training','meta'];
const params=new URLSearchParams(location.search);
let category=allowed.includes(params.get('category'))?params.get('category'):'all';
let type=['all','report','cheatsheet','guide'].includes(params.get('type'))?params.get('type'):'all';
let page=0;
const pageSize=9;
function update(reset=false,updateUrl=false){
 if(reset)page=0;
 const query=search.value.trim().normalize('NFKC').replace(/\s+/g,' ').toLocaleLowerCase();
 const matched=cards.filter(card=>(category==='all'||card.dataset.tags.split(' ').includes(category))&&(type==='all'||card.dataset.type===type)&&(!query||card.dataset.search.normalize('NFKC').replace(/\s+/g,' ').toLocaleLowerCase().includes(query)));
 const pageCount=Math.max(1,Math.ceil(matched.length/pageSize));page=Math.min(page,pageCount-1);
 const visible=new Set(matched.slice(page*pageSize,(page+1)*pageSize));
 for(const card of cards)card.hidden=!visible.has(card);
 for(const button of filters){const selected=button.dataset.categoryFilter===category;button.classList.toggle('active',selected);button.setAttribute('aria-pressed',String(selected));}
 for(const button of types){const selected=button.dataset.typeFilter===type;button.classList.toggle('active',selected);button.setAttribute('aria-pressed',String(selected));}
 counter.textContent=matched.length+' / '+cards.length+'개 문서';pageLabel.textContent=(page+1)+' / '+pageCount;
 previous.disabled=page===0;next.disabled=page===pageCount-1;empty.hidden=matched.length!==0;
 if(updateUrl){const url=new URL(location.href);category==='all'?url.searchParams.delete('category'):url.searchParams.set('category',category);type==='all'?url.searchParams.delete('type'):url.searchParams.set('type',type);url.hash='reports';history.replaceState(null,'',url);}
}
for(const button of filters)button.addEventListener('click',()=>{category=button.dataset.categoryFilter;update(true,true);});
for(const button of types)button.addEventListener('click',()=>{type=button.dataset.typeFilter;update(true,true);});
search.addEventListener('input',()=>update(true));
document.querySelector('#reset-filters').addEventListener('click',()=>{category='all';type='all';search.value='';update(true,true);});
previous.addEventListener('click',()=>{page--;update();});next.addEventListener('click',()=>{page++;update();});
update();

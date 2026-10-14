"use strict";
const list=document.querySelector('#case-list');let cases=[];let loaded=false;
const validFilters=['all','web','system','ai'];
const initialCategory=new URLSearchParams(location.search).get('category');
let activeFilter=validFilters.includes(initialCategory)?initialCategory:'all';
function el(tag,className,text){const x=document.createElement(tag);if(className)x.className=className;if(text!==undefined)x.textContent=text;return x;}
function render(filter='all'){list.replaceChildren();const selected=cases.filter(c=>filter==='all'||c.category===filter);document.querySelector('#case-count').textContent=`${selected.length}개 사례`;for(const c of selected){const a=el('a','case-row');a.href=`case.html?id=${encodeURIComponent(c.id)}`;a.append(el('span','case-number',c.number));const body=el('div');body.append(el('p','case-label',c.label),el('h3','',c.title),el('p','case-summary',c.summary));a.append(body);const tags=el('div','case-tags');for(const t of c.tags)tags.append(el('span','',t));a.append(tags);const arrow=el('span','case-arrow','↗');arrow.setAttribute('aria-hidden','true');a.append(arrow);list.append(a);}}
function setFilter(filter,updateUrl=false){
  activeFilter=validFilters.includes(filter)?filter:'all';
  for(const button of document.querySelectorAll('[data-filter]')){const selected=button.dataset.filter===activeFilter;button.classList.toggle('active',selected);button.setAttribute('aria-pressed',String(selected));}
  if(updateUrl){const url=new URL(location.href);if(activeFilter==='all')url.searchParams.delete('category');else url.searchParams.set('category',activeFilter);url.hash='work';history.replaceState(null,'',url);}
  if(loaded)render(activeFilter);
}
setFilter(activeFilter);
fetch('data.json').then(r=>{if(!r.ok)throw Error();return r.json();}).then(d=>{cases=d.cases;loaded=true;render(activeFilter);}).catch(()=>{const p=el('p','','사례를 불러오지 못했습니다. 잠시 후 새로고침해 주세요.');list.replaceChildren(p);document.querySelector('#case-count').textContent='불러오기 실패';});
for(const b of document.querySelectorAll('[data-filter]'))b.addEventListener('click',()=>setFilter(b.dataset.filter,true));
for(const a of document.querySelectorAll('[data-category]'))a.addEventListener('click',event=>{event.preventDefault();setFilter(a.dataset.category,true);document.querySelector('#work').scrollIntoView({block:'start'});});
const menu=document.querySelector('.menu-button'),nav=document.querySelector('#site-nav');menu.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));nav.classList.toggle('open',open);});for(const a of nav.querySelectorAll('a'))a.addEventListener('click',()=>{menu.setAttribute('aria-expanded','false');nav.classList.remove('open');});
document.querySelector('#copy-email').addEventListener('click',async()=>{const status=document.querySelector('#copy-status');try{await navigator.clipboard.writeText('kms986334@gmail.com');status.textContent='이메일 주소를 복사했습니다.';}catch{status.textContent='이메일 주소를 선택해 복사해 주세요.';}});

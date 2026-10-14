"use strict";
const docContent=document.querySelector('#document-content');
const docNav=document.querySelector('#document-nav');
const docToc=document.querySelector('#document-toc');
const drawerButton=document.querySelector('#drawer-button');
const drawer=document.querySelector('#reader-sidebar');
const overlay=document.querySelector('#drawer-overlay');
const parameters=new URLSearchParams(location.search);
let catalog=[],currentDoc=null;
const file=parameters.get('file')||'README.md';
function element(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
function documentUrl(path){return 'viewer.html?file='+encodeURIComponent(path);}
function setDrawer(open){drawerButton.setAttribute('aria-expanded',String(open));drawerButton.textContent=open?'목차 닫기':'목차 열기';document.body.classList.toggle('drawer-open',open);overlay.hidden=!open;}
drawerButton.addEventListener('click',()=>setDrawer(drawerButton.getAttribute('aria-expanded')!=='true'));
document.querySelector('#sidebar-close').addEventListener('click',()=>setDrawer(false));
overlay.addEventListener('click',()=>setDrawer(false));
document.addEventListener('keydown',event=>{if(event.key==='Escape')setDrawer(false);});
document.querySelector('#print-document').addEventListener('click',()=>window.print());
function renderNav(query=''){
 const normalized=query.trim().toLocaleLowerCase();docNav.replaceChildren();
 const matched=catalog.filter(doc=>!normalized||(doc.title+' '+doc.tags.join(' ')).toLocaleLowerCase().includes(normalized));
 for(const doc of matched){const link=element('a','doc-nav-link',doc.title);link.href=documentUrl(doc.file);if(doc.file===file)link.setAttribute('aria-current','page');const type=element('span','nav-doc-label',doc.label);link.append(type);docNav.append(link);}
 if(!matched.length)docNav.append(element('p','muted-text','검색 결과가 없습니다.'));
}
document.querySelector('#document-search').addEventListener('input',event=>renderNav(event.target.value));
function buildToc(){
 docToc.replaceChildren();const headings=Array.from(docContent.querySelectorAll('h2,h3'));
 for(const heading of headings){const a=element('a',heading.tagName==='H3'?'toc-sub':'',heading.textContent);a.href='#'+heading.id;docToc.append(a);}
 if(!headings.length)docToc.append(element('p','muted-text','본문의 제목이 없습니다.'));
 docToc.addEventListener('click',e=>{if(e.target.closest('a')&&matchMedia('(max-width:900px)').matches)setDrawer(false);});
}
function decorate(){
 for(const pre of docContent.querySelectorAll('pre')){
  const button=element('button','code-copy','복사');button.type='button';button.setAttribute('aria-label','코드 복사');
  button.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(pre.querySelector('code')?.textContent||'');button.textContent='복사됨';}catch{button.textContent='선택해 복사';}});pre.append(button);
 }
 for(const image of docContent.querySelectorAll('img')){
  const parent=image.parentElement;if(parent.tagName==='A')continue;
  const link=element('a','image-link');link.href=image.getAttribute('src');link.target='_blank';link.rel='noopener';link.setAttribute('aria-label',(image.alt||'이미지')+' 원본 크게 보기');parent.insertBefore(link,image);link.append(image);
 }
}
async function load(){
 try{
  const c=await fetch('catalog.json?v=20261014-library-1');if(!c.ok)throw Error();catalog=(await c.json()).docs;
  currentDoc=catalog.find(doc=>doc.file===file);if(!currentDoc)throw Error();renderNav();
  const response=await fetch(currentDoc.content+'?v=20261014-library-1');if(!response.ok)throw Error();
  // Only pre-rendered, build-sanitized content from the fixed catalog can be inserted.
  docContent.innerHTML=await response.text();
  document.title=currentDoc.title+' | 강문식';
  document.querySelector('#reader-label').textContent=currentDoc.label;
  document.querySelector('#reader-time').textContent='약 '+currentDoc.minutes+'분 읽기';
  document.querySelector('#reader-origin').textContent=currentDoc.origin;
  const note=document.querySelector('#reader-note');note.hidden=!currentDoc.note;note.textContent=currentDoc.note;
  const raw=document.querySelector('#markdown-source');raw.href=currentDoc.file+'?v=20261014-library-1';
  document.querySelector('#current-document-title').textContent=currentDoc.title;
  buildToc();decorate();
  const related=catalog.filter(doc=>doc.type===currentDoc.type&&doc.tags.some(tag=>currentDoc.tags.includes(tag)));
  const index=related.indexOf(currentDoc);const previous=related[index-1],next=related[index+1];
  for(const [id,doc] of [['previous-document',previous],['next-document',next]]){const link=document.querySelector('#'+id);link.hidden=!doc;if(doc){link.href=documentUrl(doc.file);link.textContent=(id==='previous-document'?'← ':'')+doc.title+(id==='next-document'?' →':'');}}
  if(location.hash){const target=document.getElementById(decodeURIComponent(location.hash.slice(1)));if(target)target.scrollIntoView();}
 }catch{
  docContent.replaceChildren(element('h1','','문서를 찾을 수 없습니다.'));const back=element('a','button primary','전체 문서로 돌아가기');back.href='./#reports';docContent.append(back);docNav.replaceChildren();docToc.replaceChildren();document.title='문서를 찾을 수 없습니다 | 강문식';
 }
}
setDrawer(!matchMedia('(max-width:900px)').matches);
load();

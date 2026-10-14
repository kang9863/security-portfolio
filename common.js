"use strict";
const menuButton=document.querySelector('[data-menu-button]');
const siteMenu=document.querySelector('#site-menu');
function closeMenu(){if(!menuButton||!siteMenu)return;menuButton.setAttribute('aria-expanded','false');siteMenu.classList.remove('is-open');}
if(menuButton&&siteMenu){
 menuButton.addEventListener('click',()=>{const open=menuButton.getAttribute('aria-expanded')!=='true';menuButton.setAttribute('aria-expanded',String(open));siteMenu.classList.toggle('is-open',open);});
 siteMenu.addEventListener('click',e=>{if(e.target.closest('a'))closeMenu();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu();});
}
for(const button of document.querySelectorAll('[data-copy-email]'))button.addEventListener('click',async()=>{
 const status=document.querySelector('#copy-status');try{await navigator.clipboard.writeText('kms986334@gmail.com');status.textContent='이메일을 복사했습니다.';}catch{status.textContent='이메일 주소를 선택해 복사해 주세요.';}
});

(() => {
  'use strict';
  const dialog=document.createElement('dialog');
  dialog.className='packaging-detail-dialog';
  dialog.setAttribute('aria-labelledby','packaging-dialog-title');
  dialog.innerHTML='<header class="packaging-dialog-header"><div><p>PACKAGING DETAILS</p><h2 id="packaging-dialog-title"></h2></div><button type="button" data-packaging-dialog-close aria-label="關閉完整規格">×</button></header><div class="packaging-dialog-controls"><button type="button" class="packaging-step" data-dialog-step="-1" aria-label="上一款">←</button><label for="packaging-dialog-choice">選擇款式<select id="packaging-dialog-choice"></select></label><button type="button" class="packaging-step" data-dialog-step="1" aria-label="下一款">→</button></div><p class="packaging-dialog-status" role="status" aria-live="polite"></p><div class="packaging-dialog-body"></div>';
  document.body.append(dialog);
  let active=null,opener=null;
  const dialogChoice=dialog.querySelector('select');
  const renderDialog=()=>{
    if(!active) return;
    const slide=active.slides[active.selected];
    dialog.querySelector('h2').textContent=active.element.dataset.packagingTitle;
    const body=dialog.querySelector('.packaging-dialog-body');
    const scroll=body.scrollTop;
    body.replaceChildren(slide.querySelector('.packaging-product').cloneNode(true));
    const copy=document.createElement('div');copy.className='packaging-dialog-copy';
    const title=document.createElement('h3');title.textContent=slide.querySelector('h4').textContent;copy.append(title);
    const full=slide.querySelector('.packaging-full-record').cloneNode(true);full.className='packaging-dialog-record';copy.append(full);body.append(copy);
    body.scrollTop=scroll;
    dialogChoice.value=String(active.selected);
    dialog.querySelector('.packaging-dialog-status').textContent='第 '+(active.selected+1)+' 款，共 '+active.slides.length+' 款：'+title.textContent;
    dialog.querySelectorAll('[data-dialog-step]').forEach(button=>button.disabled=active.slides.length<2);
  };
  const close=()=>dialog.close();
  dialog.querySelector('[data-packaging-dialog-close]').addEventListener('click',close);
  dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();}});
  dialog.addEventListener('close',()=>{document.documentElement.classList.remove('packaging-dialog-open');opener?.focus({preventScroll:true});active=null;});
  dialogChoice.addEventListener('change',()=>active?.select(Number(dialogChoice.value)));
  dialog.querySelectorAll('[data-dialog-step]').forEach(button=>button.addEventListener('click',()=>active?.select(active.selected+Number(button.dataset.dialogStep))));
  document.querySelectorAll('[data-packaging-gallery]').forEach(element => {
    const slides=[...element.querySelectorAll('[data-packaging-slide]')];if(!slides.length)return;
    const gallery={element,slides,selected:0,select(index,announce=true){
      this.selected=((index%slides.length)+slides.length)%slides.length;
      slides.forEach((slide,i)=>slide.hidden=i!==this.selected);
      if(active===this&&dialog.open)renderDialog();
    }};
    element.classList.add('packaging-gallery-ready');gallery.select(0,false);
    const overview=element.querySelector('.packaging-card-overview');if(overview)overview.hidden=false;
    const fullButton=element.querySelector('[data-packaging-full]');
    if(typeof dialog.showModal==='function'){
      fullButton.hidden=false;
      fullButton.addEventListener('click',()=>{
        opener=fullButton;active=gallery;
        dialogChoice.replaceChildren(...slides.map((slide,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=String(i+1).padStart(2,'0')+'｜'+slide.querySelector('h4').textContent;return option;}));
        dialogChoice.disabled=slides.length<2;
        renderDialog();dialog.querySelector('.packaging-dialog-body').scrollTop=0;
        document.documentElement.classList.add('packaging-dialog-open');dialog.showModal();
      });
    }else{element.classList.add('packaging-no-dialog');}
    const input=element.closest('[data-ingredient-library]')?.querySelector('[data-library-search]');
    input?.addEventListener('input',()=>{const query=input.value.trim().toLocaleLowerCase();if(!query)return;const match=slides.findIndex(slide=>slide.textContent.toLocaleLowerCase().includes(query));if(match>=0)gallery.select(match,false);});
  });
})();

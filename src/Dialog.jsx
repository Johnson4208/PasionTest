import React,{useEffect,useId,useRef} from 'react';
import {createPortal} from 'react-dom';
import {usePreferences} from './Preferences';

export default function Dialog({title,onClose,children,fullScreen=false,className='',headerActions}) {
 const panel=useRef(null),returnFocus=useRef(document.activeElement),titleId=useId();
 const {t}=usePreferences();
 useEffect(()=>{
  const previous=returnFocus.current,previousOverflow=document.body.style.overflow;
  const app=document.getElementById('root'),previousInert=app?.inert;
  document.body.style.overflow='hidden';
  if(app)app.inert=true;
  panel.current.querySelector('button,input,select,textarea,a')?.focus({preventScroll:true});
  return()=>{
   document.body.style.overflow=previousOverflow;
   if(app)app.inert=previousInert;
   // Expanded previews mount again during this commit; restore focus after they exist.
   requestAnimationFrame(()=>{
    if(document.querySelector('.dashboard-dialog'))return;
    const target=previous?.isConnected&&previous!==document.body&&previous!==document.documentElement?previous:document.querySelector('.overview-expand');
    target?.focus({preventScroll:true});
   });
  };
 },[]);
 function keydown(event){
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();onClose();}
  if(event.key==='Tab'){
   const items=[...panel.current.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]')].filter(item=>item.getClientRects().length);
   if(!items.length){event.preventDefault();return;}
   if(event.shiftKey&&document.activeElement===items[0]){event.preventDefault();items.at(-1).focus();}
   else if(!event.shiftKey&&document.activeElement===items.at(-1)){event.preventDefault();items[0].focus();}
  }
 }
 return createPortal(<div className={'dashboard-dialog-backdrop '+(fullScreen?'is-fullscreen':'')} onClick={onClose} onKeyDown={keydown}>
  <section ref={panel} className={'dashboard-dialog '+(fullScreen?'is-fullscreen ':'')+className} role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={event=>event.stopPropagation()}>
   <header><h2 id={titleId}>{title}</h2><div className="dialog-header-actions">{headerActions}<button type="button" className="icon-button" aria-label={t('Close dialog')} title={t('Close dialog')} onClick={onClose}>×</button></div></header>
   <div className="dashboard-dialog-body">{children}</div>
  </section>
 </div>,document.body);
}

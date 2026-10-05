document.querySelectorAll('.rp-exchange').forEach(button=>button.addEventListener('click',()=>button.setAttribute('aria-pressed',button.getAttribute('aria-pressed')==='true'?'false':'true')))
document.querySelectorAll('.rp-expand').forEach(details=>{
  const summary=details.querySelector('summary');let animation=null,expanded=details.open
  summary.setAttribute('aria-expanded',String(expanded))
  summary.addEventListener('click',event=>{
    event.preventDefault();expanded=!expanded;summary.setAttribute('aria-expanded',String(expanded))
    const start=details.getBoundingClientRect().height;animation?.cancel()
    if(matchMedia('(prefers-reduced-motion:reduce)').matches){details.open=expanded;return}
    details.open=true
    const end=expanded?details.scrollHeight:summary.getBoundingClientRect().height+32+2
    const current=details.animate([{height:start+'px',overflow:'hidden'},{height:end+'px',overflow:'hidden'}],{duration:380,easing:'cubic-bezier(.65,0,.35,1)'})
    animation=current;current.onfinish=()=>{if(animation!==current)return;details.open=expanded;animation=null}
  })
})

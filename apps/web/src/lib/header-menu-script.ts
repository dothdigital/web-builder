// Shared by the interactive editor, preview and standalone HTML exports.
export const HEADER_MENU_SCRIPT = `(function(){
  if(window.__awbHeaderMenus)return;
  window.__awbHeaderMenus=true;
  // Keep browser focus/scroll operations inside embeds below sticky headers.
  var root=document.documentElement;
  var originalScrollPadding=root.style.scrollPaddingTop;
  function updateScrollPadding(){
    var height=0;
    document.querySelectorAll('header').forEach(function(header){
      for(var node=header;node&&node!==document.body;node=node.parentElement){
        var style=getComputedStyle(node);
        if((style.position==='sticky'||style.position==='fixed')&&style.top==='0px'){
          height=Math.max(height,node.getBoundingClientRect().height);
        }
      }
    });
    root.style.scrollPaddingTop=height?'max('+originalScrollPaddingFallback+', '+Math.ceil(height+8)+'px)':originalScrollPadding;
  }
  var originalScrollPaddingFallback=getComputedStyle(root).scrollPaddingTop;
  if(originalScrollPaddingFallback==='auto')originalScrollPaddingFallback='0px';
  updateScrollPadding();
  window.addEventListener('resize',updateScrollPadding);
  if(window.ResizeObserver){
    var headerSizeObserver=new ResizeObserver(updateScrollPadding);
    document.querySelectorAll('header').forEach(function(header){headerSizeObserver.observe(header);});
  }
  var selector='header nav[aria-label="Primary"] details,header details.awb-mobile-menu,.wt-layout-dropdown,details.wt-layout-mobile-menu';
  document.addEventListener('toggle',function(event){
    var menu=event.target;
    if(!menu.matches||!menu.matches('.wt-layout-dropdown')||!menu.open)return;
    document.querySelectorAll('.wt-layout-dropdown[open]').forEach(function(other){if(other!==menu&&!other.contains(menu)&&!menu.contains(other))other.open=false;});
  },true);
  document.addEventListener('pointerdown',function(event){
    document.querySelectorAll(selector).forEach(function(menu){
      if(!menu.contains(event.target))menu.open=false;
    });
  },true);
  document.addEventListener('keydown',function(event){
    if(event.key!=='Escape')return;
    document.querySelectorAll(selector).forEach(function(menu){
      if(!menu.open)return;
      menu.open=false;
      if(menu.contains(document.activeElement)){var summary=menu.querySelector('summary');if(summary)summary.focus();}
    });
  },true);
  document.addEventListener('click',function(event){
    var link=event.target.closest&&event.target.closest('a');
    if(!link)return;
    document.querySelectorAll(selector).forEach(function(menu){
      if(menu.contains(link)&&!menu.closest('[data-awb-editor-canvas]'))menu.open=false;
    });
  },true);
})();`

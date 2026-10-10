// Shared by the interactive editor, preview and standalone HTML exports.
export const HEADER_MENU_SCRIPT = `(function(){
  if(window.__awbHeaderMenus)return;
  window.__awbHeaderMenus=true;
  function followLegacyServiceLink(){
    if(!location.hash.startsWith('#service-'))return;
    var card=document.getElementById(location.hash.slice(1));
    var target=card&&card.getAttribute('data-service-href');
    if(target&&target.split('#')[0]!==location.pathname)location.replace(target);
  }
  window.addEventListener('hashchange',followLegacyServiceLink);
  followLegacyServiceLink();
  var selector='header nav[aria-label="Primary"] details,header details.awb-mobile-menu,[data-layout-family="HEADER"] details.wt-layout-dropdown,[data-layout-family="HEADER"] details.wt-layout-mobile-menu';
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

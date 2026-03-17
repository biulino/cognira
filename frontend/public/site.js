// Cognira Intelligence — site.js
(function(){
  'use strict';

  // ── Mobile menu ──────────────────────────────────────────────────────
  function initMobileMenu(){
    var btn = document.getElementById('nav-hamburger');
    var menu = document.getElementById('mobile-menu');
    var close = document.getElementById('mobile-menu-close');
    if(!btn || !menu) return;
    btn.addEventListener('click', function(){
      menu.classList.add('open');
      document.body.style.overflow='hidden';
    });
    if(close){
      close.addEventListener('click', function(){
        menu.classList.remove('open');
        document.body.style.overflow='';
      });
    }
    menu.addEventListener('click', function(e){
      if(e.target === menu){
        menu.classList.remove('open');
        document.body.style.overflow='';
      }
    });
  }

  // ── Scroll animations (IntersectionObserver) ─────────────────────────
  function initAnimations(){
    if(!('IntersectionObserver' in window)) {
      document.querySelectorAll('[data-ao]').forEach(function(el){el.classList.add('revealed');});
      return;
    }
    var obs = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting){
          entry.target.classList.add('revealed');
          obs.unobserve(entry.target);
        }
      });
    }, {threshold:0.08, rootMargin:'0px 0px -32px 0px'});

    document.querySelectorAll('[data-ao]').forEach(function(el){
      obs.observe(el);
    });
  }

  // ── Stagger children ─────────────────────────────────────────────────
  function initStagger(){
    document.querySelectorAll('[data-stagger]').forEach(function(container){
      Array.from(container.children).forEach(function(child, i){
        child.setAttribute('data-ao','');
        child.setAttribute('data-delay', String(i * 80));
      });
    });
  }

  // ── Nav dropdowns ─────────────────────────────────────────────────
  function initDropdowns(){
    var drops = document.querySelectorAll('.nav-drop');
    drops.forEach(function(drop){
      var btn = drop.querySelector('.nav-dropbtn');
      if(!btn) return;
      btn.addEventListener('click', function(e){
        e.stopPropagation();
        var isOpen = drop.classList.contains('open');
        drops.forEach(function(d){ d.classList.remove('open'); });
        if(!isOpen) drop.classList.add('open');
      });
    });
    document.addEventListener('click', function(){
      drops.forEach(function(d){ d.classList.remove('open'); });
    });
    document.addEventListener('keydown', function(e){
      if(e.key === 'Escape') drops.forEach(function(d){ d.classList.remove('open'); });
    });
  }

  // ── Mobile accordion ──────────────────────────────────────────────
  function initMobileAccordion(){
    document.querySelectorAll('.mm-section-btn').forEach(function(btn){
      var targetId = btn.getAttribute('data-target');
      var section = targetId ? document.getElementById(targetId) : null;
      if(!section) return;
      btn.addEventListener('click', function(){
        var isOpen = section.classList.contains('open');
        section.classList.toggle('open', !isOpen);
        btn.classList.toggle('open', !isOpen);
      });
    });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){
      initStagger();
      initMobileMenu();
      initDropdowns();
      initMobileAccordion();
      initAnimations();
    });
  } else {
    initStagger();
    initMobileMenu();
    initDropdowns();
    initMobileAccordion();
    initAnimations();
  }
})();

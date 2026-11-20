/*
 * Desenho da grade. Usado pela overlay do app e pelo gerador de imagens da
 * documentação, para que as ilustrações sejam idênticas ao app real.
 */
(function (global) {
  'use strict';

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{width:number,height:number,dpr?:number,spacing:number,color:string,opacity?:number}} o
   *   width/height em pixels lógicos (CSS); dpr = devicePixelRatio.
   */
  function draw(canvas, o) {
    const dpr = o.dpr || 1;
    const pw = Math.max(1, Math.round(o.width * dpr));
    const ph = Math.max(1, Math.round(o.height * dpr));
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
    canvas.style.width = `${o.width}px`;
    canvas.style.height = `${o.height}px`;
    // A opacidade fica no canvas inteiro para os cruzamentos não ficarem mais escuros.
    canvas.style.opacity = String(o.opacity ?? 1);

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, pw, ph);
    ctx.fillStyle = o.color;

    const step = o.spacing * dpr;
    if (!(step > 0)) return;
    // 1 pixel lógico de espessura, alinhado a pixels físicos para ficar nítido.
    const thickness = Math.max(1, Math.round(dpr));

    for (let i = 0; ; i++) {
      const x = Math.round(i * step);
      if (x >= pw) break;
      ctx.fillRect(x, 0, thickness, ph);
    }
    for (let i = 0; ; i++) {
      const y = Math.round(i * step);
      if (y >= ph) break;
      ctx.fillRect(0, y, pw, thickness);
    }
  }

  global.ScreenRulerGrid = { draw };
})(window);

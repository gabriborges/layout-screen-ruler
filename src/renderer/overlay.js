(function () {
  'use strict';

  const canvas = document.getElementById('grid');
  let state = null;

  function render() {
    if (!state) return;
    window.ScreenRulerGrid.draw(canvas, {
      width: window.innerWidth,
      height: window.innerHeight,
      dpr: window.devicePixelRatio || 1,
      spacing: state.spacing,
      color: state.color,
      opacity: state.opacity,
    });
  }

  window.overlayAPI.onState((next) => {
    state = next;
    render();
  });
  window.overlayAPI.init().then((initial) => {
    state = state || initial;
    render();
  });

  window.addEventListener('resize', render);

  // Redesenha quando a escala do monitor muda (ex.: 100% -> 150%).
  let query = null;
  function watchPixelRatio() {
    query?.removeEventListener('change', onPixelRatioChange);
    query = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    query.addEventListener('change', onPixelRatioChange);
  }
  function onPixelRatioChange() {
    render();
    watchPixelRatio();
  }
  watchPixelRatio();
})();

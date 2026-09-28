// Prosty router oparty o hash, bez frameworka (celowo — appka ma być lekka
// i w pełni działać offline, bez procesu budowania).

const appEl = document.getElementById('app');

function render(html) {
  appEl.innerHTML = html;
}

async function route() {
  const hash = location.hash.slice(1) || '/';
  const parts = hash.split('/').filter(Boolean);

  if (parts.length === 0) {
    return Home.render(appEl);
  }
  if (parts[0] === 'kalibracja' && parts[1] === 'nowa') {
    return Calibrate.render(appEl);
  }
  if (parts[0] === 'teren' && parts[1]) {
    return Field.render(appEl, parts[1]);
  }
  return Home.render(appEl);
}

window.addEventListener('hashchange', route);
window.addEventListener('DOMContentLoaded', route);

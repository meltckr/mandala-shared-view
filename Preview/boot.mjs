try {
  await import('./app.mjs');
} catch(error) {
  const loading=document.getElementById('loading');
  loading.replaceChildren();
  const message=document.createElement('span');message.textContent='Your world could not finish loading. Your saved world is safe.';
  const retry=document.createElement('button');retry.textContent='Try again';retry.onclick=()=>location.reload();
  loading.append(message,retry);loading.hidden=false;
  document.getElementById('save-status').textContent='Connection needs a retry';
  console.error('Mandala startup failed',error);
}

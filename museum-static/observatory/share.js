// Share the permanent HTML page, whose metadata works without JavaScript.
const canonical = document.querySelector('link[rel="canonical"]').href;
const status = document.querySelector('#share-status');
async function copyLink() {
  try {
    await navigator.clipboard.writeText(canonical);
    status.textContent = 'Link copied. This word has its own preview image.';
  } catch {
    const fallback = document.querySelector('#share-fallback');
    fallback.hidden = false;
    fallback.querySelector('input').select();
    status.textContent = 'Select and copy the link below.';
  }
}
document.querySelector('[data-copy-word]')?.addEventListener('click', copyLink);
document.querySelector('[data-share-word]')?.addEventListener('click', async () => {
  if (!navigator.share) return copyLink();
  try {
    await navigator.share({title: document.title, url: canonical});
  } catch (error) {
    if (error.name !== 'AbortError') await copyLink();
  }
});

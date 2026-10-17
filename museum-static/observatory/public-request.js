export const PUBLIC_REQUEST_TITLE = 'Lexical Observatory: approved public change';
export const PUBLIC_REQUEST_PREFIX = '<!-- lexical-observatory-public-change:v1 -->\nI approve publication of the following public lexical change. All included content is intended to be public and retained in history.\n\n';
export const PUBLICATION_WORKFLOW = 'https://github.com/exemptus9/idunnopoetry-museum/actions/workflows/lexical-editor.yml';

/** GitHub authenticates the final submitter. This helper carries no credential. */
export function createPublicationRequest(change) {
  if (!change || typeof change !== 'object' || Array.isArray(change)) throw new TypeError('A public change request object is required.');
  const json = JSON.stringify(change, null, 2);
  const body = `${PUBLIC_REQUEST_PREFIX}\`\`\`json\n${json}\n\`\`\`\n`;
  const target = new URL('https://github.com/exemptus9/idunnopoetry-museum/issues/new');
  target.search = new URLSearchParams({title:PUBLIC_REQUEST_TITLE,body}).toString();
  if (target.href.length > 6000) return {blocked:true,url:'',workflowUrl:PUBLICATION_WORKFLOW,reason:'This change is too large for a prefilled GitHub request. Copy its JSON and use the authenticated workflow instead.',encodedLength:target.href.length};
  return {blocked:false,url:target.href,workflowUrl:PUBLICATION_WORKFLOW,encodedLength:target.href.length};
}

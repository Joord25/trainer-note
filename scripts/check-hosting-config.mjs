import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);
const config=JSON.parse(readFileSync(new URL('firebase.json',root),'utf8'));
const cors=JSON.parse(readFileSync(new URL('storage.cors.json',root),'utf8'));
const site=config.hosting.site;
for(const host of [`${site}.web.app`,`${site}.firebaseapp.com`]){
 assert(config.auth.authorizedDomains.includes(host),`Firebase Auth domain missing: ${host}`);
 assert(cors.some(rule=>rule.method.includes('GET')&&rule.origin.includes(`https://${host}`)),`Storage CORS GET origin missing: ${host}`);
}
assert(!cors.some(rule=>rule.origin.includes('*')),'Use explicit app origins for Storage CORS');
console.log('Hosting/Auth/Storage domain configuration is consistent. Bucket CORS must be applied separately from firebase deploy.');

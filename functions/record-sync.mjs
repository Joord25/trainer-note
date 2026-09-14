const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
export const sameRecordInput=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));

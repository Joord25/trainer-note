import {Schema} from 'firebase/ai';
import {EXTRACTION_SCHEMA} from './workout-extraction';
// Use the SDK's OpenAPI schema, converting nullable unions explicitly.
// Large nested maxItems constraints trigger Gemini 400 errors. Runtime parsing
// still enforces 60 records / 8 sets before any preview or save.
function build(value:Record<string,unknown>):Schema {
 const nullable=Array.isArray(value.type)&&value.type.includes('null');
 const type=Array.isArray(value.type)?value.type.find(v=>v!=='null'):value.type;
 if(type==='object')return Schema.object({properties:Object.fromEntries(Object.entries(value.properties as Record<string,Record<string,unknown>>).map(([key,v])=>[key,build(v)]))});
 if(type==='array')return Schema.array({items:build(value.items as Record<string,unknown>)});
 if(type==='integer')return Schema.integer({nullable});
 if(type==='number')return Schema.number({nullable});
 if(Array.isArray(value.enum))return Schema.enumString({enum:value.enum as string[]});
 return Schema.string({nullable});
}
export const extractionResponseSchema=build(EXTRACTION_SCHEMA);

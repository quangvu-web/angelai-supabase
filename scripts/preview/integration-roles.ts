const required=["PREVIEW_SUPABASE_URL","PREVIEW_ANON_KEY","PREVIEW_NONADMIN_JWT","PREVIEW_ADMIN_JWT","PREVIEW_SERVICE_ROLE_KEY"];
for(const key of required) if(!Deno.env.get(key)) throw new Error(`MISSING_SECRET:${key}`);
const ref=Deno.env.get("PREVIEW_SUPABASE_PROJECT_REF")||"";
const url=Deno.env.get("PREVIEW_SUPABASE_URL")||"";
if(!ref||ref==="ssjoetiitctqzapymtzl"||!url.includes(ref)) throw new Error("PREVIEW_TARGET_GUARD_FAILED");
async function rpc(jwt:string,name:string){return fetch(`${url}/rest/v1/rpc/${name}`,{method:"POST",headers:{apikey:Deno.env.get("PREVIEW_ANON_KEY")!,authorization:`Bearer ${jwt}`,"content-type":"application/json"},body:"{}"});}
const anon=await rpc(Deno.env.get("PREVIEW_ANON_KEY")!,"admin_list_urantia_collections");
const nonadmin=await rpc(Deno.env.get("PREVIEW_NONADMIN_JWT")!,"admin_list_urantia_collections");
const admin=await rpc(Deno.env.get("PREVIEW_ADMIN_JWT")!,"admin_list_urantia_collections");
const service=await fetch(`${url}/rest/v1/knowledge_collections?select=id&limit=1`,{headers:{apikey:Deno.env.get("PREVIEW_SERVICE_ROLE_KEY")!,authorization:`Bearer ${Deno.env.get("PREVIEW_SERVICE_ROLE_KEY")!}`}});
if(anon.ok||nonadmin.ok||!admin.ok||!service.ok) throw new Error("ROLE_MATRIX_FAILED");
console.log("ROLE_MATRIX_PASS");

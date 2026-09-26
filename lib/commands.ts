export function parseCommand(text:string) {
 const t=text.trim();
 if(/^(이대로|지금|현재|완성본을|이미지를|영상을)?\s*(저장해줘|저장해|다운로드해줘|저장)[.!]?$/u.test(t))return {action:'save'};
 if(/^(이대로|지금|현재|이 사진으로|이 문구로)\s*(만들어줘|만들어|제작해줘|완성해줘)[.!]?$/u.test(t))return {action:'create'};
 if(/^(제목|문구)(을|를|은|는)?\s/.test(t)) return {action:'headline',value:t.replace(/^(제목|문구)(을|를|은|는)?\s*/, '').replace(/(으로|로)?\s*(바꿔줘|바꿔|해줘|변경해줘)[.!]?$/, '').replace(/^["“]|["”]$/g,'').trim().slice(0,60)};
 if(/만들|생성/.test(t)) return {action:'brief',value:t.slice(0,2000)};
 if(/(공유|올려|게시)/.test(t)) return {action:'share'};
 if(/(글씨|글자).*(크게|키워)/.test(t)) return {action:'bigger'};
 if(/(글씨|글자).*(작게|줄여)/.test(t)) return {action:'smaller'};
 if(/밝게|밝은/.test(t)) return {action:'style',value:'fresh'};
 if(/고급|차분/.test(t)) return {action:'style',value:'classic'};
 if(/재미|장난|발랄/.test(t)) return {action:'style',value:'pop'};
 return {action:'brief',value:t.slice(0,2000)};
}

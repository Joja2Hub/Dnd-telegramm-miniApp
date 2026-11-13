// Web encodings only; generated artwork is not modified or retouched.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const sharp=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'));
const root=path.resolve(__dirname,'..'),source=process.argv[2];
if(!source)throw new Error('Pass the generated image directory');
const entries=JSON.parse(fs.readFileSync(path.join(root,'docs/profile-banners.json'),'utf8'));
const output=path.join(root,'frontend/assets/profile-banners');
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 for(const item of entries){
  if(fs.existsSync(path.join(output,item.id+'.webp'))&&fs.existsSync(path.join(output,item.id+'-thumb.webp')))continue;
  const input=item.id==='snake-scales'?path.join(output,item.source):path.join(source,item.source);
  await sharp(input).resize({width:1600,withoutEnlargement:true}).webp({quality:86}).toFile(path.join(output,item.id+'.webp'));
  await sharp(input).resize({width:480,withoutEnlargement:true}).webp({quality:78}).toFile(path.join(output,item.id+'-thumb.webp'));
  console.log(item.id,fs.statSync(path.join(output,item.id+'.webp')).size);
 }
})().catch(error=>{console.error(error);process.exitCode=1;});

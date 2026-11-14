import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {createRequire} from 'node:module';
const dependency=createRequire(import.meta.url);
function load(file,mocks={}){const compiledModule={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:compiledModule,exports:compiledModule.exports,require:name=>name in mocks?mocks[name]:dependency(name),URL});return compiledModule.exports;}
const story=load('lib/productStory.ts',{'./productSections':load('lib/productSections.ts')});
const publicImage='https://res.cloudinary.com/studio/image/upload/v1/example.jpg';
test('optional product page content is empty for existing products and strips unknown fields',()=>{
 const empty=story.parseProductStory({});assert.equal(empty.gallery.length,0);assert.equal(empty.description,'');
 const value=story.parseProductStory({tagline:'  A studio tool  ',included:[' First file ','','Second file'],private_download_url:'secret',product_url:'secret'});
 assert.equal(value.tagline,'A studio tool');assert.deepEqual(Array.from(value.included),['First file','Second file']);assert.equal('private_download_url'in value,false);assert.equal('product_url'in value,false);
});
test('public product stories reject private delivery links, active schemes and oversized payloads',()=>{
 for(const url of ['javascript:alert(1)','data:image/svg+xml,hi','//attacker.test/one.jpg','/api/private.jpg','/%61pi/private.jpg','/%2561pi/private.jpg','/\\attacker.test/one.jpg','https://res.cloudinary.com/studio/image/authenticated/v1/private.jpg','https://res.cloudinary.com/studio/raw/upload/private.zip','https://api.cloudinary.com/download?signature=private','https://user:pass@res.cloudinary.com/studio/image/upload/one.jpg'])assert.equal(story.publicProductImage(url),false,url);
 assert.equal(story.publicProductImage(publicImage),true);assert.equal(story.publicProductImage('/homepage-desktop.jpg'),true);
 assert.throws(()=>story.parseProductStory({gallery:[{url:'https://res.cloudinary.com/studio/image/authenticated/private.jpg'}]}));
 assert.throws(()=>story.parseProductStory({included:Array(21).fill('item')}));
 assert.throws(()=>story.parseProductStory({description:'x'.repeat(6001)}));
 assert.throws(()=>story.parseProductStory({comparisons:[{before:publicImage,after:''}]}));
});
test('each product has its own stable, collection-scoped URL independent of its title',()=>{
 assert.equal(story.productPath('photography',{id:1,title:'MELATONE'}),'/photography/shop/products/1-melatone');
 assert.equal(story.productPath('art',{id:2,title:'MELATONE'}),'/art/shop/products/2-melatone');
 assert.equal(story.productIdFromPath('1-old-title'),1);
 for(const value of ['0','-1','../1','2147483648','1?token=x'])assert.equal(story.productIdFromPath(value),null);
});
test('public product projection never returns paid files or private/unsupported cover URLs',()=>{
 const product=story.publicStoreProduct({id:7,title:'Future product',price:'₦30,000',section:'art',image:publicImage,has_delivery_file:true,product_url:'https://private.example/file.zip',creation_key:'secret',storefront:{category:'Guide',formats:['PDF']}});
 assert.equal(product.section,'art');assert.equal(product.has_delivery_file,true);assert.equal(product.storefront.formats[0],'PDF');assert.equal('product_url'in product,false);assert.equal('creation_key'in product,false);
 assert.equal(story.publicStoreProduct({...product,image:'https://res.cloudinary.com/studio/image/authenticated/private.jpg'}).image,'/image-placeholder.svg');
});
test('server product lookup requires active product and matching collection before returning public data',async()=>{
 const calls=[];let row={id:1,title:'MELATONE',price:'₦20,000',image:publicImage,section:'photography',has_delivery_file:true,product_url:'must-not-leak',storefront:{category:'Presets'}};
 const store=load('lib/productStorefront.ts',{'react':{cache:fn=>fn},'./db':{query:async(sql,params)=>{calls.push({sql,params});return {rows:row?[row]:[]};}},'./productStory':story});
 const product=await store.getStoreProduct('photography',1);assert.equal('product_url'in product,false);assert.deepEqual(Array.from(calls[0].params),[1,'photography']);assert.match(calls[0].sql,/section=\$2 AND is_active=TRUE/);row=null;assert.equal(await store.getStoreProduct('art',1),null);
});

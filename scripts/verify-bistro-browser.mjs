/** Independent browser check: real input, no teleport or application-state injection. */
import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
const baseUrl=process.env.ELYRIA_URL||'http://127.0.0.1:4173'
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']})
const page=await browser.newPage({viewport:{width:960,height:720},deviceScaleFactor:0.5,hasTouch:true})
const errors=[], checks=[], path=[]
page.on('pageerror',e=>errors.push(e.message))
page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`)})
await mkdir('artifacts/bistro',{recursive:true})
const position=()=>page.locator('.minimap-button .world-map > circle:last-child').evaluate(e=>({x:Number(e.getAttribute('cx')),z:Number(e.getAttribute('cy'))}))
const blur=()=>page.evaluate(()=>{if(document.activeElement instanceof HTMLElement)document.activeElement.blur()})
const held=new Set()
async function release(){for(const key of held)await page.keyboard.up(key);held.clear()}
let cdp
async function walkTo(x,z,tolerance=.25){
 await blur();const end=Date.now()+180000
 const stick=await page.getByRole('group',{name:'Drag to move'}).boundingBox()
 if(!stick)throw Error('Touch joystick unavailable')
 const center={x:stick.x+stick.width/2,y:stick.y+stick.height/2}
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...center,id:1}]})
 try{
  while(Date.now()<end){
   const p=await position(),dx=x-p.x,dz=z-p.z,dist=Math.hypot(dx,dz)
   if(dist<tolerance){
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...center,id:1}]})
    await page.waitForTimeout(350)
    const settled=await position()
    if(Math.hypot(x-settled.x,z-settled.z)<tolerance+.08){path.push(settled);console.log('Reached waypoint',x,z,JSON.stringify(settled));return}
   }
   const scale=Math.min(1,dist*.15)
   await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:center.x+34*scale*dx/Math.max(dist,.001),y:center.y+34*scale*dz/Math.max(dist,.001),id:1}]})
   await page.waitForTimeout(100)
  }
  throw Error(`Traversal timeout toward ${x},${z}`)
 }finally{await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})}
}
async function keyboardDoor(){
 await blur();await page.keyboard.down('w');held.add('w')
 const end=Date.now()+60000
 try{
  while(Date.now()<end){const p=await position();if(p.z<-6.9){console.log('Keyboard doorway crossed',JSON.stringify(p));return};await page.waitForTimeout(150)}
  throw Error('Keyboard doorway traversal blocked')
 }finally{await release()}
}
try{
 await page.goto(baseUrl+'/?quality=LITE',{waitUntil:'networkidle'})
 await page.getByText('Preparing your little corner…').waitFor({state:'hidden',timeout:60000})
 await page.evaluate(() => new Promise(resolve => { let frames=0; function warm(){ if(++frames>=3)resolve();else requestAnimationFrame(warm) } requestAnimationFrame(warm) }))
 // Orbit yaw starts at .45; a +90px drag sets yaw to 0 for world-axis input.
 await page.mouse.move(480,350);await page.mouse.down();await page.mouse.move(570,350,{steps:10});await page.mouse.up()
 cdp=await page.context().newCDPSession(page)
 await walkTo(-15,12)
 await walkTo(-15,-5.6,.2)
 await page.screenshot({path:'artifacts/bistro/browser-approach.png',timeout:60000})
 await keyboardDoor()
 await walkTo(-15,-8,.2)
 checks.push('Walked through the doorway using keyboard input')
 await walkTo(-14.25,-8.5,.2)
 const pickup=page.getByRole('button',{name:/Take tea cup/i})
 await pickup.waitFor({timeout:15000})
 await blur();await page.keyboard.press('e')
 const cancel=page.getByRole('button',{name:/Cancel.*cup|Put.*cup.*back|Return cup to table/i})
 await cancel.waitFor({timeout:15000})
 await page.screenshot({path:'artifacts/bistro/browser-carry.png',timeout:60000})
 await blur();await page.keyboard.press('q');await pickup.waitFor({timeout:15000})
 checks.push('Pickup and explicit keyboard cancellation')
 await pickup.tap();await cancel.waitFor({timeout:15000});await cancel.tap();await pickup.waitFor({timeout:15000})
 checks.push('Actual touch pickup and labeled cancellation')
 await pickup.tap()
 await walkTo(-15,-8.5,.2)
 await walkTo(-15,-10.9,.2)
 await walkTo(-15.9,-11.3,.2)
 const place=page.getByRole('button',{name:/Place on return tray/i})
 await place.waitFor({timeout:15000});await place.tap()
 const book=page.getByRole('button',{name:'Open Sketchbook',exact:true})
 await book.waitFor({timeout:15000});await book.tap()
 await page.getByRole('dialog').filter({hasText:'The Blossom Regulars'}).waitFor()
 await page.screenshot({path:'artifacts/bistro/browser-sketchbook.png',timeout:60000})
 await page.getByRole('button',{name:'Close dialog'}).tap()
 checks.push('Return tray interaction and accessible sketchbook')
 await page.keyboard.press('F3')
 const telemetry=await page.locator('.debug-panel').innerText()
 await page.reload({waitUntil:'networkidle'})
 await page.getByText('Preparing your little corner…').waitFor({state:'hidden',timeout:60000})
 await book.waitFor({timeout:15000})
 checks.push('Sketchbook completion survives reload')
 if(errors.length)throw Error('Unexpected browser errors: '+errors.join('; '))
 const report={testedAt:new Date().toISOString(),baseUrl,browser:'Chromium headless / SwiftShader',viewport:{width:960,height:720},deviceScaleFactor:0.5,checks,path,telemetry,errors,limitations:['No real-device FPS or skeletal-animation acceptance is implied.']}
 await writeFile('artifacts/bistro/browser-check.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2))
}catch(e){
 await writeFile('artifacts/bistro/browser-failure.json',JSON.stringify({testedAt:new Date().toISOString(),error:e.message,checks,path,errors,body:await page.locator('body').innerText().catch(()=>''),position:await position().catch(()=>null)},null,2))
 await page.screenshot({path:'artifacts/bistro/browser-failure.png',timeout:20000}).catch(()=>{})
 throw e
}finally{await release().catch(()=>{});await browser.close()}

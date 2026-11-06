import * as THREE from './vendor/three.module.js';

// Independent rooms share the proven input/physics loop, not the old room's quests.
export function buildChapter(level, api, flags) {
  const {scene, world, player, anchor, dynamic, interactables, treats, wallBlocks, granny,
    box, sphere, cyl, group, furniture, solid, textSign, addObject, toast, noise, tone, complete} = api;
  for (const child of [...scene.children]) if (!child.isLight && !child.isCamera) scene.remove(child);
  for (const body of [...world.bodies]) if (body !== player && body !== anchor) world.removeBody(body);
  dynamic.length = 0; interactables.length = 0; treats.length = 0; wallBlocks.length = 0;
  scene.add(granny); granny.position.set(level === 3 ? 3 : 4.5,0,-1);
  granny.traverse(m=>{if(m.isMesh)interactables.push(m);});
  const done = Array.from({length:5},(_,i)=>flags?.[i] === true);
  const isKitchen = level === 2, title = isKitchen ? '厨房寻宝' : '院子冒险';
  const labels = isKitchen ? ['打开冰箱找食物','把鱼点心送到小碗','把毛线球投入大锅','登上高台找金鱼','把故事书放回书架'] : ['轻轻碰到三次蝴蝶','滚球撞倒三个木罐','把小玩具送回鸟窝','跳过石台找到金鱼','敲响院子里的风铃'];
  const hints = isKitchen ? ['左前方薄荷色冰箱：走近，对着把手按抓取。','冰箱打开后拿起鱼点心，带到右侧小碗，按抓取放下。','门边橘色球可以抓起投进大锅；也可以走近放进去。','左边三个木台越来越高，跳上去找发光的金鱼。','拿起桌上的故事书，带到右后方书架格子里。'] : ['中间的蝴蝶会停歇，靠近后拍拍它，累计三次。','前方三个木罐，用橘色球滚过去撞倒；靠近拍打也能撞倒。','拿起粉色小玩具，送到左后方鸟窝，按抓取放下。','沿右边石台向上跳，找到最上面的金鱼。','走到左侧树下，对着风铃拍拍或抓取。'];
  const finish = i => {if(done[i])return;done[i]=true;complete('✦ '+labels[i]);};
  const useTargets=[];
  function target(mesh,name,action){const t={type:'chapter',name,action,mesh};mesh.traverse(m=>{if(m.isMesh)m.userData.item=t;});interactables.push(mesh);useTargets.push(t);return t;}
  function sign(text,x,y,z,w=1.8){textSign(text,x,y,z,w,.35,'#65533d','#fff3ce');}
  function bowl(x,z,color){cyl(color,x,.16,z,.58,.22);cyl('#594b3a',x,.28,z,.47,.035);solid(x,.1,z,1,.2,1,false);}
  furniture(isKitchen?'#ead6b2':'#81a972',0,-.15,0,16,.3,12,false);
  if(isKitchen){
    furniture('#85aa7d',-8.1,2,0,.2,4,12);furniture('#f0e5cf',8.1,2,0,.2,4,12);
    furniture('#b8cba0',0,2,-6.1,16,4,.2);furniture('#dbcfb8',0,2,6.1,16,4,.2);
    for(let x=-7;x<8;x++)for(let z=-5;z<6;z++)box((x+z)%2?'#eadfca':'#f3ead9',x,.006,z,.98,.012,.98);
    for(let x of [-3,3]){box('#9bbfc2',x,2.6,-5.97,3.2,1.7,.05);box('#fff4d8',x,2.6,-5.91,.07,1.8,.08);box('#fff4d8',x,2.6,-5.91,3.3,.07,.08);}
    furniture('#c58b4b',0,.53,-4.8,5,1.06,1.5);furniture('#f4e9d0',0,1.1,-4.8,5.2,.12,1.65,false);
    for(let x of [-1.7,0,1.7]){box('#d5a05c',x,.55,-4.03,1.5,.85,.03);box('#d6b06b',x,.85,-3.98,.3,.035,.05);}
    // Decorative layers sit behind the playable space and add no collision cost.
    for (const x of [-3,3]) {
      box('#e6d2a8',x,1.7,-5.86,3.4,.12,.22);
      for (const side of [-1,1]) {
        box('#d2a978',x+side*1.75,2.57,-5.84,.3,1.9,.1);
        for (let i=0;i<5;i++) box(i%2?'#efd2a5':'#e3bd8d',x+side*(1.62+i*.065),2.55,-5.76,.045,1.8,.04);
      }
    }
    for (let x=-2;x<=2;x+=.5) box('#dfc9a8',x,1.5,-5.93,.47,.32,.02);
    for (let x=-2;x<=2;x+=.5) for(let y=1.35;y<=1.65;y+=.3) box('#fff0d7',x,y,-5.89,.46,.018,.025);
    for (const x of [-1.55,-1.15,1.15,1.55]) {cyl('#c79468',x,1.22,-4.75,.12,.22);cyl('#ead1a6',x,1.34,-4.75,.13,.04);}
    sign('橘子的厨房大冒险',0,3.5,-5.93,3.5);
  }else{
    scene.background=new THREE.Color('#82b9d4');scene.fog=new THREE.Fog('#b4d1b3',22,48);
    for(let x=-8;x<=8;x+=.65)for(let z of [-6,6])furniture('#e3c18e',x,.65,z,.12,1.3,.1);
    for(let z=-5.5;z<=5.5;z+=.65)for(let x of [-8,8])furniture('#e3c18e',x,.65,z,.1,1.3,.12);
    for(let z of [-6,6])for(let y of [.5,1])box('#d3ae7e',0,y,z,16,.08,.1);
    for(let x of [-8,8])for(let y of [.5,1])box('#d3ae7e',x,y,0,.1,.08,12);
    for(let [x,z] of [[-6,-4.7],[6,-4.8],[-6,3.7]]){furniture('#9b7858',x,1.4,z,.38,2.8,.38);sphere('#7caa75',x,3,z,1.45,1.25,1.3);sphere('#94b87d',x-.6,3.1,z+.3,.9);}
    for(let i=0;i<18;i++){const x=-7+(i*3.71)%14,z=-5+(i*2.13)%10;cyl('#6f9b6e',x,.1,z,.025,.18);sphere(i%2?'#ecc08b':'#d79ea1',x,.22,z,.10,.06,.10);}
    for(let z=3;z>-5;z-=1.2)box('#d7c6a1',0,.012,z,1.3,.025,.75);
    for (let i=0;i<8;i++) {
      const x=-6.7+i*1.9,z=-4.9+(i%2)*.35;
      sphere(i%2?'#88b786':'#78a77a',x,.3,z,.7,.4,.48);
      for (let j=-1;j<=1;j++) sphere(i%2?'#f3d3a5':'#eac0b5',x+j*.22,.57,z+.12,.09,.07,.09);
    }
    for (const [x,z] of [[-5,2],[3,-4.5]]) {
      cyl('#c6a577',x,.12,z,.4,.24);cyl('#8a694d',x,.25,z,.33,.03);
      for (let j=0;j<4;j++){const a=j*Math.PI/2;cyl('#6c9565',x+Math.cos(a)*.12,.43,z+Math.sin(a)*.12,.025,.35);sphere('#e7b0a5',x+Math.cos(a)*.12,.62,z+Math.sin(a)*.12,.12,.08,.12);}
    }
    sign('阳光院子 · 自由探索',0,1.5,-5.8,3.3);
  }
  const pads=isKitchen?[[-5,0,.32],[-5,-1.3,.65],[-5,-2.6,1.0]]:[[5,1,.32],[5,-.4,.65],[5,-1.8,1.0],[5,-3.2,1.32]];
  pads.forEach(([x,z,h],i)=>{furniture(isKitchen?'#c99d70':'#b0b2a0',x,h/2,z,1.5,h,1.1);sign(String(i+1),x,h+.2,z+.56,.4);});
  const last=pads.at(-1), prize=group(last[0],last[2]+.45,last[1]);
  sphere('#ffd273',0,0,0,.22,.09,.09,prize);const tail=new THREE.Mesh(new THREE.ConeGeometry(.12,.2,3),new THREE.MeshStandardMaterial({color:'#efad4e'}));tail.rotation.z=-Math.PI/2;tail.position.x=-.25;prize.add(tail);sphere('#6e5741',.11,.02,.07,.022,.022,.015,prize);
  let fridge=null, door=null, opened=false, foodRevealed=false, food=null, book=null, butterfly=null, rests=0, butterflyWait=0, butterflyPoint=0;
  const ball=addObject('chapter-ball','橘色毛线球','ball',[1,.27,2.1],.27,'#dc9259');
  let delivery, deliverySpot, goalSpot;
  const pins=[];
  if(isKitchen){
    const f=group(-4,0,-4.8);box('#a9cbb8',0,1.1,0,1.65,2.2,1.2,f);box('#576f64',0,1.05,.61,1.38,1.7,.025,f);
    solid(-4,1.1,-4.8,1.65,2.2,1.2); // A real cabinet, not a passage through the model.
    door=group(-4.83,0,-4.15);box('#c0dac7',.83,1.1,0,1.65,2.2,.1,door);box('#c4a367',1.42,1.1,.08,.055,.5,.07,door);
    food=addObject('fish-snack','鱼点心','snack',[-3.95,.42,-3.9],.22,'#e9bb64');food.mesh.visible=false;world.removeBody(food.body);
    fridge=target(door,'冰箱把手 · 抓取打开',()=>{opened=!opened;if(opened&&!foodRevealed){world.addBody(food.body);food.mesh.visible=true;foodRevealed=true;finish(0);}toast(opened?'冰箱打开啦，下面有鱼点心！':'冰箱关好啦');noise(door.position,10);});
    sign('冰箱：抓取开门',-4,2.65,-4.1,2.2);
    bowl(4,-1.7,'#e8b581');deliverySpot=new THREE.Vector3(4,.3,-1.7);delivery=food;
    const dish=group(4,.3,-1.7);cyl('#f4d998',0,0,0,.58,.06,dish);target(dish,'小猫餐碗 · 放入鱼点心',()=>{});sign('鱼点心放这里',4,.85,-2.3);
    goalSpot=new THREE.Vector3(0,.65,-3.8);cyl('#7b8d8c',0,.37,-3.8,.8,.65);cyl('#3d5656',0,.71,-3.8,.69,.025);solid(0,.3,-3.8,1.4,.6,1.4);
    const pot=group(0,.7,-3.8);cyl('#c1c7ab',0,0,0,.83,.07,pot);target(pot,'大锅 · 把球放进去',()=>{});sign('投球入锅',0,1.3,-4.4);
    furniture('#c39b6c',4.5,.5,-4.7,2,1,1);furniture('#ead1a6',4.5,1.6,-5.05,2,.12,.7,false);
    book=addObject('chapter-book','蓝色故事书','book',[2,.52,.1],.32,'#83aeb8');furniture('#d5b184',2,.25,.1,1.3,.5,.9);
    const shelf=group(4.5,1.15,-4.6);box('#b9d0a0',0,0,0,1.3,.05,.6,shelf);target(shelf,'书架空格 · 放回故事书',()=>{});sign('故事书的家',4.5,1.95,-4.8);
  }else{
    delivery=addObject('bird-toy','粉色小玩具','ball',[-2,.25,2],.23,'#dfa0ae');deliverySpot=new THREE.Vector3(-4,.62,-3.5);
    furniture('#b68f65',-4,.2,-3.5,1.5,.4,1.4);const nest=group(-4,.5,-3.5);cyl('#d9b779',0,0,0,.66,.22,nest);cyl('#f0dbad',0,.13,0,.54,.03,nest);target(nest,'鸟窝 · 送回小玩具',()=>{});sign('小玩具的家',-4,1.1,-4);
    for(let i=0;i<3;i++){const p=addObject('pin'+i,'木罐 '+(i+1),'pin',[-.7+i*.7,.33,-2.3],.28,['#dcaf71','#c39572','#d9ba83'][i]);pins.push(p);}
    sign('滚球撞木罐',0,1.2,-3,2.4);
    const chime=group(-5,1.1,.5);cyl('#a1bdc1',0,.2,0,.25,.1,chime);for(let i=-1;i<=1;i++)cyl('#e1c778',i*.13,0,0,.025,.4,chime);
    target(chime,'树下风铃 · 拍拍它',()=>{finish(4);tone(1100,.5);noise(chime.position,15);toast('叮咚～院子里的风铃响啦');});sign('风铃',-5,1.7,.5,1);
    butterfly=group(0,.8,.4);sphere('#715c69',0,0,0,.025,.12,.025,butterfly);sphere('#e3a5b5',-.13,0,0,.15,.11,.025,butterfly);sphere('#edc88a',.13,0,0,.15,.11,.025,butterfly);
    target(butterfly,'停歇的蝴蝶 · 轻轻拍拍',()=>{if(butterflyWait>0)return;rests++;butterflyWait=1.4;butterflyPoint=(butterflyPoint+1)%3;toast('蝴蝶来和你玩啦！'+Math.min(3,rests)+'/3');tone(800,.12);if(rests>=3)finish(0);});
  }
  function use(t,held){
    if(t?.type!=='chapter')return false;
    if(held){
      const p=held.body.position;
      if(held===delivery && player.position.distanceTo(deliverySpot)<2.4 && /餐碗|鸟窝/.test(t.name)){held.body.position.copy(deliverySpot);held.body.velocity.setZero();held.mesh.position.copy(deliverySpot);finish(isKitchen?1:2);return true;}
      if(isKitchen&&held===ball&&/大锅/.test(t.name)){held.body.position.copy(goalSpot);held.body.velocity.setZero();finish(2);return true;}
      if(isKitchen&&held===book&&/书架/.test(t.name)){held.body.position.set(4.5,1.15,-4.6);held.body.velocity.setZero();finish(4);return true;}
      toast('这里需要'+(/餐碗/.test(t.name)?'鱼点心':/鸟窝/.test(t.name)?'粉色小玩具':/大锅/.test(t.name)?'橘色毛线球':'蓝色故事书'));return false;
    }
    t.action();return true;
  }
  function update(dt,time,held){
    if(food)food.mesh.visible=foodRevealed;
    if(door)door.rotation.y=THREE.MathUtils.damp(door.rotation.y,opened?-1.65:0,8,dt);
    prize.rotation.y+=dt;prize.position.y=last[2]+.45+Math.sin(time*2)*.06;
    if(!done[3]&&player.position.distanceTo(prize.position)<.75){finish(3);scene.remove(prize);}
    if(isKitchen){
      if(opened&&held!==food&&food.body.position.distanceTo(deliverySpot)<.8)finish(1);
      if(held!==ball&&ball.hit&&ball.body.position.distanceTo(goalSpot)<.85)finish(2);
      if(held!==book&&book.body.position.distanceTo(new THREE.Vector3(4.5,1.15,-4.6))<.7)finish(4);
    }else{
      if(pins.filter(p=>(p.body.position.distanceTo(p.initial)>.42 || 1-2*(p.body.quaternion.x**2+p.body.quaternion.z**2)<.6)).length===3)finish(1);
      // A collision from the ball counts too, even if the cat never swatted the pin.
      for(const p of pins)if(p.body.position.distanceTo(p.initial)>.42)p.hit=true;
      if(held!==delivery&&delivery.body.position.distanceTo(deliverySpot)<.8)finish(2);
      butterflyWait=Math.max(0,butterflyWait-dt);const points=[[0,.8,.4],[-2,1,-.3],[1.8,.9,-1]];
      const to=points[butterflyPoint];butterfly.position.lerp(new THREE.Vector3(...to),1-Math.exp(-dt*3));butterfly.children[1].rotation.y=Math.sin(time*12)*.6;butterfly.children[2].rotation.y=-Math.sin(time*12)*.6;
    }
  }
  return {title,labels,done,use,update,targets:useTargets,hint:()=>hints[done.findIndex(x=>!x)]||'五个心愿都完成啦！还可以自由探索，或去另一关。'};
}

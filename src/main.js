import * as THREE from 'three';
import { GamePhysics } from './physics.js';
import { BotAI } from './ai.js';
import { GameVisuals } from './visuals.js';
import { GameUI } from './ui.js';
import { AudioSystem } from './audio.js';
import { InputManager } from './input.js';
import { Match } from './match.js';
import { ChaseCamera } from './camera.js';

const canvas=document.querySelector('#arena');
function fail(error){
  console.error(error);const el=document.createElement('div');el.style.cssText='position:fixed;inset:0;background:#080f20;color:#fff;padding:10vh 8vw;font:18px system-ui;z-index:1000';
  const title=document.createElement('h1');title.textContent='The arena could not start';el.append(title);
  const message=document.createElement('p');message.textContent='NEON STRIKE needs a browser with WebGL 2 and hardware acceleration enabled. Try a current version of Chrome, Edge, Firefox or Safari.';el.append(message);
  const detail=document.createElement('pre');detail.style.whiteSpace='pre-wrap';detail.textContent=String(error?.message||error);el.append(detail);document.body.append(el);
}
try { boot(); } catch(error){fail(error);}

function boot(){
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.setSize(innerWidth,innerHeight);
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(75,innerWidth/innerHeight,.15,400);camera.position.set(62,35,67);
  const physics=new GamePhysics();const visual=new GameVisuals(scene);const chase=new ChaseCamera(camera);const match=new Match();const audio=new AudioSystem();
  let bot=new BotAI(1,'intermediate'),options={mode:'duel',difficulty:'intermediate',duration:300,fov:75,quality:'high',volume:.55,muted:false};
  let input,accumulator=0,elapsed=0,last=performance.now(),lastHud=0,lookX=0,freeBallIdle=0;
  const neutral=()=>({throttle:0,steer:0,pitch:0,yaw:0,roll:0,boost:false,powerslide:false,jump:false});
  function quality(settings){renderer.setPixelRatio(Math.min(devicePixelRatio,settings.quality==='low'?1:1.75));renderer.shadowMap.enabled=settings.quality!=='low';visual.updateQuality?.(settings.quality);audio.setVolume(Number(settings.volume),settings.muted);}
  const ui=new GameUI({
    onStart: settings=>start(settings),onResume:()=>resume(),onPause:()=>pause(),onRestart:()=>start(options),onMenu:()=>menu(),
    onSettings:settings=>{options={...options,...settings};quality(options);},onCamera:()=>chase.toggle()
  });
  options={...options,...ui.settings};quality(options);
  input=new InputManager({pause:()=>{if(ui.overlay){ui.closeModal();return;}match.paused?resume():pause();},camera:()=>chase.toggle(),reset:()=>{if(match.phase==='playing'&&!match.paused){physics.resetCar(0);chase.reset();}},blur:()=>pause()});
  ui.root.addEventListener('click',e=>{if(e.target.closest('button')){audio.unlock();audio.play('menu');}});
  function start(settings){
    options={...options,...settings};audio.unlock();quality(options);physics.reset();bot=new BotAI(1,options.difficulty);
    physics.cars[1].active=options.mode!=='freeplay';
    if(options.mode==='freeplay'){physics.cars[1].body.position.set(0,-100,0);physics.cars[1].body.velocity.set(0,0,0);}
    match.start(options);input.clear();input.enabled=true;accumulator=0;chase.reset();ui.setScreen('playing');audio.play('countdown');
    document.activeElement?.blur();canvas.focus?.();
  }
  function pause(){if(['playing','kickoff','goal'].includes(match.phase)&&!match.paused){match.pause();input.clear();ui.setScreen('pause');audio.update(0,false,false);}}
  function resume(){if(!match.paused)return;match.resume();input.clear();accumulator=0;ui.setScreen('playing');audio.unlock();document.activeElement?.blur();}
  function menu(){match.menu();physics.reset();input.clear();input.enabled=false;ui.setScreen('menu');chase.reset();audio.update(0,false,false);}
  function drain(){
    for(const e of match.events.splice(0)){
      if(e.type==='reset'){physics.reset();if(options.mode==='freeplay')physics.cars[1].body.position.set(0,-100,0);chase.reset();input.jumpPending=false;freeBallIdle=0;}
      if(e.type==='countdown')audio.play('countdown',e.value?1:1.6);
      if(e.type==='go'){ui.announce('GO!',options.mode==='freeplay'?'Your arena. Your rules.':'Make the first move.',800);audio.play('go');}
      if(e.type==='overtime'){ui.announce('OVERTIME','Next goal wins',2600);audio.play('goal',.5);}
      if(e.type==='goal'){
        visual.goal(e.team,physics.ball.position);audio.play('goal');chase.shake=2;
        ui.announce(`${e.team==='blue'?'BLUE':'ORANGE'} SCORES`,`${match.scores[0]}  —  ${match.scores[1]}`,2900);
      }
      if(e.type==='end'){audio.play('end');ui.setScreen('results',{scores:match.scores,winner:e.winner,overtime:match.overtime});input.enabled=false;}
    }
    for(const e of physics.events.splice(0)){
      if(e.type==='impact'){visual.hit(e.position,e.strength);audio.play('impact',e.strength||.3);chase.shake=Math.max(chase.shake,(e.strength||.3)*2);}
      if(e.type==='pickup'&&e.car===0)audio.play('pickup');if(e.type==='jump')audio.play('jump');if(e.type==='wall')audio.play('wall',e.strength||.3);
    }
  }
  const step=1/120;
  function frame(now){
    const dt=Math.min((now-last)/1000,.06);last=now;elapsed+=dt;
    const control=input.read();lookX=control.lookX;
    if(match.phase==='menu'||match.phase==='results'){
      chase.orbit(elapsed,dt);visual.update(physics,dt,elapsed);accumulator=0;
    }else{
      if(!match.paused){
        accumulator+=dt;let jumped=control.jump;
        // An input edge survives render frames shorter than one physics step.
        if(jumped)input.jumpPending=true;
        let iterations=0;
        while(accumulator>=step&&iterations++<9){
          const previous=match.phase;match.tick(step);drain();
          if(match.phase==='playing'){
            control.jump=input.jumpPending;input.jumpPending=false;
            const ai=options.mode==='freeplay'?neutral():bot.update(physics,step,match.phase);
            physics.step(step,[control,ai]);control.jump=false;
            if(options.mode==='freeplay'){
              // Keep the unused opponent outside simulation; regular boost pickups still work.
              physics.cars[1].body.position.set(0,-100,0);physics.cars[1].body.velocity.set(0,0,0);
              freeBallIdle+=step;if(Math.abs(physics.ball.position.z)>54&&freeBallIdle>1)match.checkGoal(physics.ball);
            }else match.checkGoal(physics.ball);
            drain();
          }
          if(previous==='kickoff'&&match.phase==='playing')input.jumpPending=false;
          accumulator-=step;
        }
        visual.update(physics,dt,elapsed);chase.update(physics,dt,{...options,lookX});
      }else accumulator=0;
      const car=physics.cars[0];audio.update(car.body.velocity.length(),car.boosting,!match.paused&&match.phase==='playing');
    }
    if(now-lastHud>40){
      ui.updateHUD({scores:match.scores,time:match.time,boost:physics.cars[0].boost,speed:physics.cars[0].body.velocity.length(),camera:chase.mode,phase:match.phase,countdown:match.countdown,overtime:match.overtime,mode:match.mode});lastHud=now;
      canvas.dataset.phase=match.paused?'paused':match.phase;canvas.dataset.speed=physics.cars[0].body.velocity.length().toFixed(1);canvas.dataset.height=physics.cars[0].body.position.y.toFixed(2);
    }
    renderer.render(scene,camera);requestAnimationFrame(frame);
  }
  window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();pause();ui.announce('GRAPHICS INTERRUPTED','Reload the page to restore the arena.',60000);});
  ui.setScreen('menu');requestAnimationFrame(frame);
}

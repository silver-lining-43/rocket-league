const handled = new Set(['KeyW','KeyA','KeyS','KeyD','Space','ShiftLeft','ShiftRight','ControlLeft','ControlRight','KeyQ','KeyE','KeyC','KeyR','Escape','ArrowUp','ArrowDown','ArrowLeft','ArrowRight']);
export class InputManager {
  constructor(actions={}) {
    this.keys=new Set(); this.jumpPending=false; this.padJump=false; this.padMenu=false;this.padCamera=false; this.actions=actions;this.enabled=false;
    window.addEventListener('keydown', e=>{
      if(!handled.has(e.code)||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;
      e.preventDefault();this.keys.add(e.code);
      if(e.repeat)return;
      if(e.code==='Space')this.jumpPending=true;
      if(e.code==='Escape')actions.pause?.();
      if(e.code==='KeyC')actions.camera?.();
      if(e.code==='KeyR')actions.reset?.();
    });
    window.addEventListener('keyup',e=>{this.keys.delete(e.code);if(handled.has(e.code)&&this.enabled)e.preventDefault();});
    window.addEventListener('blur',()=>{this.clear();actions.blur?.();});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){this.clear();actions.blur?.();}});
  }
  clear(){this.keys.clear();this.jumpPending=false;this.padJump=false;}
  read(){
    const k=this.keys, axis=(positive,negative)=>Number(k.has(positive))-Number(k.has(negative));
    const steer=axis('KeyD','KeyA')||axis('ArrowRight','ArrowLeft');
    const throttle=axis('KeyW','KeyS')||axis('ArrowUp','ArrowDown');
    const c={throttle,steer,pitch:-throttle,yaw:steer,roll:axis('KeyE','KeyQ'),boost:k.has('ShiftLeft')||k.has('ShiftRight'),powerslide:k.has('ControlLeft')||k.has('ControlRight'),jump:this.jumpPending,lookX:0};
    if(c.powerslide){c.roll+=steer;c.yaw=0;}
    this.jumpPending=false;
    let pads=[];try{pads=navigator.getGamepads?.()||[];}catch{}
    const pad=Array.from(pads).find(p=>p?.connected);
    if(pad){
      const dead=v=>Math.abs(v||0)>.13?v:0;
      const down=i=>Boolean(pad.buttons[i]?.pressed);
      const pv=dead(pad.axes[0]);const py=dead(pad.axes[1]);
      c.steer=pv||c.steer;c.yaw=pv||c.yaw;c.pitch=py||c.pitch;c.throttle=(pad.buttons[7]?.value||0)-(pad.buttons[6]?.value||0)||c.throttle;
      c.boost=c.boost||down(1);c.powerslide=c.powerslide||down(2);c.roll+=(down(5)?1:0)-(down(4)?1:0);c.lookX=dead(pad.axes[2]);
      c.jump=c.jump||(down(0)&&!this.padJump);this.padJump=down(0);
      if(down(9)&&!this.padMenu)this.actions.pause?.();this.padMenu=down(9);
      if(down(3)&&!this.padCamera)this.actions.camera?.();this.padCamera=down(3);
    }else{this.padJump=false;this.padMenu=false;this.padCamera=false;}
    return c;
  }
}

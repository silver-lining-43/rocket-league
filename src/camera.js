import * as THREE from 'three';
const up=new THREE.Vector3(0,1,0);
export class ChaseCamera {
  constructor(camera){this.camera=camera;this.mode='BALL';this.target=new THREE.Vector3(0,2,0);this.heading=new THREE.Vector3(0,0,1);this.desired=new THREE.Vector3();this.look=new THREE.Vector3();this.forward=new THREE.Vector3();this.q=new THREE.Quaternion();this.shake=0;this.initialized=false;}
  toggle(){this.mode=this.mode==='BALL'?'CAR':'BALL';}
  reset(){this.initialized=false;}
  update(physics,dt,options={}){
    const {body,boosting}=physics.cars[0];const p=body.position,b=physics.ball.position;
    this.q.copy(body.quaternion);this.forward.set(0,0,1).applyQuaternion(this.q);this.forward.y=0;
    if(this.forward.lengthSq()<.1)this.forward.copy(this.heading);this.forward.normalize();
    const speed=body.velocity.length();const heading=this.forward;
    if(this.mode==='BALL'){
      this.desired.set(b.x-p.x,0,b.z-p.z);const distance=this.desired.length();
      if(distance>4){this.desired.normalize();heading.lerp(this.desired,Math.min(1,(distance-4)/16)).normalize();}
    }
    if(options.lookX)heading.applyAxisAngle(up,-options.lookX*1.5);
    this.heading.lerp(heading,1-Math.exp(-dt*4.8)).normalize();
    const dist=11.5+Math.min(speed*.05,2.3);
    this.desired.set(p.x-this.heading.x*dist,p.y+5.5+Math.min(Math.max(0,b.y-p.y)*.055,2),p.z-this.heading.z*dist);
    this.desired.x=THREE.MathUtils.clamp(this.desired.x,-38,38);this.desired.z=THREE.MathUtils.clamp(this.desired.z,-60,60);this.desired.y=THREE.MathUtils.clamp(this.desired.y,3,20.5);
    this.look.set(p.x+this.heading.x*5,p.y+1.25,p.z+this.heading.z*5);
    if(this.mode==='BALL')this.look.lerp(new THREE.Vector3(b.x,b.y,b.z),.40);
    if(!this.initialized){this.camera.position.copy(this.desired);this.target.copy(this.look);this.initialized=true;}
    this.camera.position.lerp(this.desired,1-Math.exp(-dt*6));this.target.lerp(this.look,1-Math.exp(-dt*7));
    this.shake*=Math.exp(-dt*12);
    if(this.shake>.01){this.camera.position.x+=(Math.random()-.5)*this.shake*.13;this.camera.position.y+=(Math.random()-.5)*this.shake*.1;}
    this.camera.up.copy(up);this.camera.lookAt(this.target);
    const fov=Number(options.fov)||75;this.camera.fov=THREE.MathUtils.lerp(this.camera.fov,fov+(boosting?7:0),1-Math.exp(-dt*3));this.camera.updateProjectionMatrix();
  }
  orbit(time,dt){this.desired.set(Math.sin(time*.055)*64,36,Math.cos(time*.055)*69);this.camera.position.lerp(this.desired,1-Math.exp(-dt*1.7));this.camera.lookAt(0,1,0);}
}

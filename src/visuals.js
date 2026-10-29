import * as THREE from 'three';

const BLUE = 0x37dcff;
const ORANGE = 0xff8b38;
const WHITE = 0xcceef6;
const tmp = new THREE.Vector3();
const forward = new THREE.Vector3();
const up = new THREE.Vector3(0, 1, 0);
const boxGeo = new THREE.BoxGeometry(1, 1, 1);

function material(color, options = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.22, ...options });
}
function glow(color, strength = 1) {
  return material(color, { emissive: color, emissiveIntensity: strength, roughness: 0.3 });
}
function cube(parent, mat, x, y, z, sx, sy, sz) {
  const mesh = new THREE.Mesh(boxGeo, mat);
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  parent.add(mesh);
  return mesh;
}
function beam(parent, a, b, radius, mat, radialSegments = 6) {
  const direction = new THREE.Vector3().subVectors(b, a);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, direction.length(), radialSegments), mat);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(up, direction.normalize());
  parent.add(mesh);
  return mesh;
}
function lines(parent, points, mat, closed = false) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const line = closed ? new THREE.LineLoop(geometry, mat) : new THREE.Line(geometry, mat);
  parent.add(line);
  return line;
}
function fieldLine(parent, points, color = WHITE, opacity = 0.7) {
  return lines(parent, points.map(([x, z]) => new THREE.Vector3(x, 0.045, z)), new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
}
function roundedRect(shape, x, y, w, h, r) {
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r);
  shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
}
function roundedOutline(y = 0, x = 34, z = 52, radius = 8) {
  const points = [];
  const corners = [[x-radius,z-radius,0],[-x+radius,z-radius,Math.PI/2],[-x+radius,-z+radius,Math.PI],[x-radius,-z+radius,Math.PI*1.5]];
  for (const [cx, cz, start] of corners) {
    for (let n = 0; n <= 12; n++) {
      const a = start + n / 12 * Math.PI / 2;
      points.push(new THREE.Vector3(cx + Math.cos(a) * radius, y, cz + Math.sin(a) * radius));
    }
  }
  return points;
}
function labelTexture(text, color, width = 1024, height = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#071321';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(20, height - 8);
  ctx.lineTo(width - 20, height - 8);
  ctx.stroke();
  ctx.font = `italic 900 ${Math.floor(height * 0.54)}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, width / 2, height / 2, width - 50);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
function fieldTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#16464b';
  ctx.fillRect(0, 0, 512, 1024);
  for (let row = 0; row < 16; row++) {
    ctx.fillStyle = row % 2 ? '#1c5156' : '#17474c';
    ctx.fillRect(0, row * 64, 512, 64);
  }
  let seed = 3812;
  for (let i = 0; i < 38000; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const x = seed % 512;
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const y = seed % 1024;
    ctx.fillStyle = i % 2 ? 'rgba(166,222,198,0.04)' : 'rgba(1,13,18,0.08)';
    ctx.fillRect(x, y, 1, 3);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function createCar(color) {
  const group = new THREE.Group();
  const paint = material(color, { metalness: 0.66, roughness: 0.3 });
  const darkPaint = material(0x0b1726, { metalness: 0.6, roughness: 0.34 });
  const carbon = material(0x111922, { metalness: 0.25, roughness: 0.7 });
  const glass = material(0x123a50, { metalness: 0.86, roughness: 0.12, emissive: 0x0a2633, emissiveIntensity: 0.65 });
  const stripe = glow(color, 1.2);
  // Sculpted low bonnet and flared front/rear quarters.
  const vertices = new Float32Array([
    -0.93,-0.35,-1.8, 0.93,-0.35,-1.8, 1.04,-0.35,1.55, 0.72,-0.23,1.96, -0.72,-0.23,1.96, -1.04,-0.35,1.55,
    -0.88,0.16,-1.75, 0.88,0.16,-1.75, 1.0,0.10,1.40, 0.69,-0.02,1.91, -0.69,-0.02,1.91, -1.0,0.10,1.40
  ]);
  const hull = new THREE.BufferGeometry();
  hull.setAttribute('position', new THREE.BufferAttribute(vertices,3));
  hull.setIndex([0,2,1,0,5,2,5,4,3,5,3,2,6,7,8,6,8,11,11,8,9,11,9,10,0,1,7,0,7,6,1,2,8,1,8,7,2,3,9,2,9,8,3,4,10,3,10,9,4,5,11,4,11,10,5,0,6,5,6,11]);
  hull.computeVertexNormals();
  const chassis = new THREE.Mesh(hull,paint);
  chassis.castShadow = true;
  group.add(chassis);
  cube(group,carbon,0,-0.30,0,1.78,0.19,3.52);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.42,0.69,1.55),glass);
  cabin.position.set(0,0.40,-0.40);
  cabin.rotation.x = -0.08;
  group.add(cabin);
  // Sloping windscreen, roof and bonnet stripes define the silhouette.
  const windscreen = cube(group,glass,0,0.39,0.37,1.39,0.68,0.08);
  windscreen.rotation.x = -0.48;
  cube(group,paint,0,0.80,-0.46,1.49,0.10,1.10);
  cube(group,carbon,0,0.22,-1.23,1.51,0.13,0.38);
  for (const x of [-0.56,0.56]) {
    const pillar = cube(group,paint,x,0.42,0.36,0.09,0.78,0.10);
    pillar.rotation.x = -0.48;
  }
  for (const x of [-0.20,0.20]) {
    cube(group,darkPaint,x,0.13,1.12,0.15,0.035,1.24);
    cube(group,stripe,x,0.86,-0.45,0.07,0.02,1.08);
  }
  cube(group,carbon,0,-0.21,1.93,1.54,0.12,0.18);
  cube(group,carbon,0,-0.08,-1.87,1.84,0.30,0.17);
  for (const x of [-0.67,0.67]) {
    cube(group,glow(0xd8f7ff,1.9),x,-0.015,1.83,0.42,0.13,0.10);
    cube(group,glow(0xff314c,1.4),x,0.06,-1.83,0.45,0.11,0.055);
    cube(group,carbon,x,0.36,-1.42,0.10,0.47,0.11);
  }
  cube(group,paint,0,0.59,-1.51,2.15,0.12,0.46);
  cube(group,stripe,0,0.66,-1.56,2.02,0.035,0.09);
  for (const x of [-1.01,1.01]) cube(group,stripe,x,-0.21,0,0.035,0.07,2.12);
  const wheelGeo = new THREE.CylinderGeometry(0.45,0.45,0.32,16);
  wheelGeo.rotateZ(Math.PI/2);
  const rimGeo = new THREE.CylinderGeometry(0.25,0.25,0.335,12);
  rimGeo.rotateZ(Math.PI/2);
  const wheels=[];
  const tire = material(0x090c12,{roughness:0.95,metalness:0.06});
  const rim = material(0xa6c8d8,{metalness:0.8,roughness:0.24});
  for (const x of [-1.02,1.02]) for (const z of [-1.22,1.20]) {
    const pivot=new THREE.Group();
    pivot.position.set(x,-0.23,z);
    const wheel=new THREE.Mesh(wheelGeo,tire);
    wheel.castShadow=true;
    pivot.add(wheel);
    wheel.add(new THREE.Mesh(rimGeo,rim));
    for(let i=0;i<6;i++) {
      const spoke=cube(wheel,carbon,0,0,0,0.35,0.045,0.43);
      spoke.rotation.x=i*Math.PI/3;
    }
    group.add(pivot);
    wheels.push({pivot,wheel,front:z>0});
  }
  const exhaustMaterial=material(0x768596,{metalness:0.9,roughness:0.3});
  for(const x of [-0.40,0.40]) {
    const nozzle=new THREE.Mesh(new THREE.CylinderGeometry(0.19,0.25,0.40,12),exhaustMaterial);
    nozzle.rotation.x=Math.PI/2;
    nozzle.position.set(x,-0.06,-1.98);
    group.add(nozzle);
    const core=new THREE.Mesh(new THREE.CircleGeometry(0.16,12),glow(color,3));
    core.rotation.y=Math.PI;
    core.position.set(x,-0.06,-2.19);
    group.add(core);
  }
  const flame=new THREE.Mesh(new THREE.ConeGeometry(0.35,2.8,8),new THREE.MeshBasicMaterial({color,transparent:true,opacity:0.82,depthWrite:false,blending:THREE.AdditiveBlending}));
  flame.rotation.x=-Math.PI/2;
  flame.position.set(0,-0.06,-3.15);
  flame.visible=false;
  group.add(flame);
  group.userData={wheels,flame,color,wheelAngle:0};
  return group;
}

class ParticlePool {
  constructor(scene,count=650) {
    this.count=count;
    this.cursor=0;
    this.positions=new Float32Array(count*3);
    this.colors=new Float32Array(count*3);
    this.velocities=new Float32Array(count*3);
    this.life=new Float32Array(count);
    this.totalLife=new Float32Array(count);
    this.baseColors=new Float32Array(count*3);
    this.positions.fill(0);
    for(let i=0;i<count;i++) this.positions[i*3+1]=-100;
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(this.positions,3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('color',new THREE.BufferAttribute(this.colors,3).setUsage(THREE.DynamicDrawUsage));
    const canvas=document.createElement('canvas');
    canvas.width=32;canvas.height=32;
    const ctx=canvas.getContext('2d');
    const grad=ctx.createRadialGradient(16,16,0,16,16,16);
    grad.addColorStop(0,'#fff');grad.addColorStop(0.25,'rgba(255,255,255,.85)');grad.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=grad;ctx.fillRect(0,0,32,32);
    this.mesh=new THREE.Points(geometry,new THREE.PointsMaterial({size:0.65,map:new THREE.CanvasTexture(canvas),transparent:true,vertexColors:true,depthWrite:false,blending:THREE.AdditiveBlending}));
    this.mesh.frustumCulled=false;
    scene.add(this.mesh);
  }
  emit(position,velocity,color,life=0.5) {
    const i=this.cursor++%this.count;
    const k=i*3;
    this.positions[k]=position.x;this.positions[k+1]=position.y;this.positions[k+2]=position.z;
    this.velocities[k]=velocity.x;this.velocities[k+1]=velocity.y;this.velocities[k+2]=velocity.z;
    this.life[i]=life;this.totalLife[i]=life;
    const c=new THREE.Color(color);
    this.baseColors[k]=c.r;this.baseColors[k+1]=c.g;this.baseColors[k+2]=c.b;
  }
  update(dt) {
    for(let i=0;i<this.count;i++) {
      if(this.life[i]<=0)continue;
      const k=i*3;
      this.life[i]-=dt;
      if(this.life[i]<=0){this.positions[k+1]=-100;continue;}
      this.positions[k]+=this.velocities[k]*dt;
      this.positions[k+1]+=this.velocities[k+1]*dt;
      this.positions[k+2]+=this.velocities[k+2]*dt;
      this.velocities[k+1]-=3*dt;
      const fade=Math.min(1,this.life[i]/this.totalLife[i]*1.5);
      this.colors[k]=this.baseColors[k]*fade;this.colors[k+1]=this.baseColors[k+1]*fade;this.colors[k+2]=this.baseColors[k+2]*fade;
    }
    this.mesh.geometry.attributes.position.needsUpdate=true;
    this.mesh.geometry.attributes.color.needsUpdate=true;
  }
}

export class GameVisuals {
  constructor(scene,options={}) {
    this.scene=scene;
    this.padMeshes=[];
    this.ribbons=[];
    this.bursts=[];
    this.carMeshes=[];
    this.shadows=[];
    this.effects=new ParticlePool(scene);
    this.emission=0;
    scene.background=new THREE.Color(0x07101f);
    scene.fog=new THREE.Fog(0x07101f,105,225);
    scene.add(new THREE.HemisphereLight(0x9edfff,0x203b37,2.4));
    const sun=new THREE.DirectionalLight(0xc9e7ff,3.5);
    sun.position.set(-35,65,15);
    sun.castShadow=true;
    sun.shadow.mapSize.set(2048,2048);
    Object.assign(sun.shadow.camera,{left:-75,right:75,top:75,bottom:-75,near:1,far:160});
    sun.shadow.normalBias=0.035;
    sun.shadow.bias=-0.00015;
    sun.shadow.radius=3;
    scene.add(sun);
    this.sun=sun;
    const fill=new THREE.DirectionalLight(0xffb781,1.1);fill.position.set(45,30,-35);scene.add(fill);
    this.makeArena();
    this.makeBall();
    for(const color of [BLUE,ORANGE]) {
      const car=createCar(color);
      scene.add(car);this.carMeshes.push(car);
      this.shadows.push(this.makeShadow(2.2,0.5));
    }
    this.ballShadow=this.makeShadow(2.1,0.55);
    this.updateQuality(options.quality||'high');
  }

  makeArena() {
    const scene=this.scene;
    const turf=material(0xffffff,{map:fieldTexture(),roughness:1,metalness:0});
    const shape=new THREE.Shape();
    roundedRect(shape,-34,-52,68,104,8);
    const field=new THREE.Mesh(new THREE.ShapeGeometry(shape,16),turf);
    field.rotation.x=-Math.PI/2;
    field.receiveShadow=true;
    scene.add(field);
    const under=cube(scene,material(0x071722),0,-0.6,0,148,1,180);
    under.receiveShadow=true;
    const wall=material(0x14313e,{metalness:0.55,roughness:0.46});
    const boundary=glow(0x41cce2,1.3);
    const blueMat=glow(BLUE,1.5),orangeMat=glow(ORANGE,1.5);
    // A quarter pipe visually joins the pitch to the driveable side walls.
    for(const sign of [-1,1]) {
      const vertices=[],indices=[];
      for(let i=0;i<=16;i++) {
        const a=i/16*Math.PI/2;
        const x=sign*(30+4*Math.sin(a));
        const y=4-4*Math.cos(a);
        vertices.push(x,y,-44,x,y,44);
        if(i<16){const n=i*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}
      }
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();
      const ramp=new THREE.Mesh(geometry,material(0x1b414a,{side:THREE.DoubleSide,roughness:0.78}));ramp.receiveShadow=true;scene.add(ramp);
      cube(scene,wall,sign*34.2,5,0,0.4,3,88);
      cube(scene,boundary,sign*33.9,6.5,0,0.09,0.12,88);
      for(let z=-40;z<=40;z+=8) cube(scene,z<0?blueMat:orangeMat,sign*33.95,3.15,z,0.1,0.12,3);
    }
    const topOutline=roundedOutline(22);
    lines(scene,topOutline,new THREE.LineBasicMaterial({color:0x355e75,transparent:true,opacity:0.5}),true);
    const lowOutline=roundedOutline(0.14);
    lines(scene,lowOutline,new THREE.LineBasicMaterial({color:0x80ecff,transparent:true,opacity:0.45}),true);
    // Sparse glass supports keep arena limits readable without hiding the play.
    const glass=new THREE.MeshPhysicalMaterial({color:0x3e8ca5,transparent:true,opacity:0.035,roughness:0.1,metalness:0.1,side:THREE.DoubleSide,depthWrite:false});
    for(const sign of [-1,1]) {
      const panel=cube(scene,glass,sign*34.25,14,0,0.05,16,88);
      panel.renderOrder=1;
      for(let z=-44;z<=44;z+=11) {
        cube(scene,material(0x26495d),sign*34.5,13,z,0.13,18,0.13);
      }
    }
    for(const sign of [-1,1]) {
      const teamMat=sign<0?blueMat:orangeMat;
      const color=sign<0?BLUE:ORANGE;
      // Match the physical end-wall quarter pipes while preserving each goal opening.
      for(const side of [-1,1]) {
        const vertices=[],indices=[];
        for(let i=0;i<=16;i++) {
          const a=i/16*Math.PI/2;
          const z=sign*(48+4*Math.sin(a)),y=4-4*Math.cos(a);
          vertices.push(side*9,y,z,side*28,y,z);
          if(i<16){const n=i*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}
        }
        const geometry=new THREE.BufferGeometry();
        geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
        geometry.setIndex(indices);geometry.computeVertexNormals();
        const ramp=new THREE.Mesh(geometry,material(0x1b414a,{side:THREE.DoubleSide,roughness:0.78}));
        ramp.receiveShadow=true;scene.add(ramp);
        // The rounded corner board follows the radius-eight collision boundary.
        const cornerVertices=[],cornerIndices=[],edge=[];
        for(let i=0;i<=16;i++) {
          const a=i/16*Math.PI/2;
          const x=side*(26+8*Math.cos(a)),z=sign*(44+8*Math.sin(a));
          cornerVertices.push(x,4,z,x,6.4,z);
          edge.push(new THREE.Vector3(x,6.5,z));
          if(i<16){const n=i*2;cornerIndices.push(n,n+1,n+2,n+1,n+3,n+2);}
        }
        const cornerGeometry=new THREE.BufferGeometry();
        cornerGeometry.setAttribute('position',new THREE.Float32BufferAttribute(cornerVertices,3));
        cornerGeometry.setIndex(cornerIndices);cornerGeometry.computeVertexNormals();
        scene.add(new THREE.Mesh(cornerGeometry,material(0x14313e,{side:THREE.DoubleSide,metalness:.55,roughness:.46})));
        lines(scene,edge,new THREE.LineBasicMaterial({color,transparent:true,opacity:.85}));
      }
      // End boards leave a real 18 × 7 opening for each goal.
      for(const x of [-21.5,21.5]) {
        cube(scene,wall,x,3,sign*52.2,25,6,0.5);
        cube(scene,teamMat,x,6.1,sign*51.95,25,0.13,0.12);
        for(let i=0;i<4;i++) cube(scene,teamMat,x+(i-1.5)*4.5,2.8,sign*51.9,2.4,0.1,0.1);
      }
      cube(scene,wall,0,8.3,sign*52.2,18,2.5,0.5);
      this.makeGoal(sign,color);
      const penalty=[[-18,sign*51.8],[-18,sign*35],[18,sign*35],[18,sign*51.8]];
      fieldLine(scene,penalty,color,0.75);
      fieldLine(scene,[[-9,sign*51.7],[-9,sign*43],[9,sign*43],[9,sign*51.7]],WHITE,0.45);
      const disk=new THREE.Mesh(new THREE.CircleGeometry(0.25,16),new THREE.MeshBasicMaterial({color:WHITE,transparent:true,opacity:0.65}));disk.rotation.x=-Math.PI/2;disk.position.set(0,0.055,sign*33);scene.add(disk);
      const texture=labelTexture(sign<0?'AZURE  //  HOME':'EMBER  //  AWAY',sign<0?'#47dcff':'#ff9853');
      const billboard=new THREE.Mesh(new THREE.PlaneGeometry(25,3.125),new THREE.MeshBasicMaterial({map:texture}));
      billboard.position.set(0,13.3,sign*58);billboard.rotation.y=sign<0?0:Math.PI;scene.add(billboard);
      const banner=new THREE.Mesh(new THREE.PlaneGeometry(24,2.4),new THREE.MeshBasicMaterial({map:labelTexture('NEON STRIKE   ///   ROCKET CAR SOCCER','#8da5bd',1024,100)}));
      banner.position.set(sign*41,10,0);banner.rotation.y=sign<0?Math.PI/2:-Math.PI/2;scene.add(banner);
    }
    fieldLine(scene,[[-30,0],[30,0]],WHITE,0.8);
    const circle=[];for(let i=0;i<=96;i++){const a=i/96*Math.PI*2;circle.push([Math.cos(a)*9,Math.sin(a)*9]);}
    fieldLine(scene,circle,WHITE,0.8);
    const center=new THREE.Mesh(new THREE.RingGeometry(0.75,1.0,40),new THREE.MeshBasicMaterial({color:0xc2e8ef,transparent:true,opacity:0.8,side:THREE.DoubleSide}));center.rotation.x=-Math.PI/2;center.position.y=0.06;scene.add(center);
    this.makeStands();
    // Illuminated trusses are raised well above chase-camera height.
    const truss=material(0x183345,{metalness:0.72,roughness:0.5});
    const lamp=glow(0xd5efff,2);
    for(const sign of [-1,1]) {
      for(let z=-48;z<=48;z+=24) {
        beam(scene,new THREE.Vector3(sign*47,0,z),new THREE.Vector3(sign*44,33,z),0.25,truss);
        beam(scene,new THREE.Vector3(sign*44,33,z),new THREE.Vector3(sign*29,28,z),0.20,truss);
        cube(scene,lamp,sign*30,28,z,1.8,0.25,4);
      }
      cube(scene,truss,sign*44,33,0,0.55,0.55,120);
      cube(scene,glow(0x3976a5,1.1),sign*43.6,32.7,0,0.09,0.15,117);
    }
    // Distant stars and skyline establish depth outside the stadium.
    const starPositions=[];
    let seed=890;
    for(let i=0;i<260;i++) {
      seed=(seed*1664525+1013904223)>>>0;const angle=seed/4294967296*Math.PI*2;
      seed=(seed*1664525+1013904223)>>>0;const height=35+seed/4294967296*100;
      starPositions.push(Math.cos(angle)*180,height,Math.sin(angle)*180);
    }
    const starGeo=new THREE.BufferGeometry();starGeo.setAttribute('position',new THREE.Float32BufferAttribute(starPositions,3));
    scene.add(new THREE.Points(starGeo,new THREE.PointsMaterial({color:0xb3d4f8,size:0.35,transparent:true,opacity:0.7})));
  }

  makeGoal(sign,color) {
    const scene=this.scene;
    const frame=glow(color,1.3);
    const white=material(0xd6e5ed,{metalness:0.65,roughness:0.3});
    for(const x of [-9,9]) {
      beam(scene,new THREE.Vector3(x,0,sign*52),new THREE.Vector3(x,7,sign*52),0.18,white,10);
      beam(scene,new THREE.Vector3(x,7,sign*52),new THREE.Vector3(x,7,sign*59),0.1,frame);
      beam(scene,new THREE.Vector3(x,0,sign*59),new THREE.Vector3(x,7,sign*59),0.1,frame);
    }
    beam(scene,new THREE.Vector3(-9,7,sign*52),new THREE.Vector3(9,7,sign*52),0.20,white,10);
    beam(scene,new THREE.Vector3(-9,7,sign*59),new THREE.Vector3(9,7,sign*59),0.12,frame);
    const netPoints=[];
    for(let x=-9;x<=9;x+=1.5) netPoints.push(x,0,sign*59,x,7,sign*59,x,7,sign*59,x,7,sign*52);
    for(let y=0;y<=7;y+=1) {
      netPoints.push(-9,y,sign*59,9,y,sign*59);
      for(const x of [-9,9]) netPoints.push(x,y,sign*52,x,y,sign*59);
    }
    for(let z=52;z<=59;z+=1.4) {
      netPoints.push(-9,7,sign*z,9,7,sign*z);
      for(const x of [-9,9]) netPoints.push(x,0,sign*z,x,7,sign*z);
    }
    const netGeo=new THREE.BufferGeometry();netGeo.setAttribute('position',new THREE.Float32BufferAttribute(netPoints,3));
    scene.add(new THREE.LineSegments(netGeo,new THREE.LineBasicMaterial({color,transparent:true,opacity:0.27})));
    const floor=cube(scene,material(sign<0?0x123f52:0x51312c,{emissive:color,emissiveIntensity:0.05,roughness:0.9}),0,-0.12,sign*55.5,18,0.2,7);floor.receiveShadow=true;
    for(const x of [-8.4,8.4])cube(scene,frame,x,0.03,sign*55.5,0.08,0.04,7);
    cube(scene,frame,0,0.04,sign*58.7,16.8,0.05,0.10);
    const light=new THREE.PointLight(color,18,17,2);light.position.set(0,4,sign*55);scene.add(light);
  }

  makeStands() {
    const scene=this.scene;
    const tierMat=material(0x142432,{roughness:0.85,metalness:0.3});
    const darkMat=material(0x0e1b29,{roughness:0.8});
    const seatGeo=new THREE.BoxGeometry(0.65,0.18,0.60);
    const seatMat=material(0x33586d,{metalness:0.1,roughness:0.9});
    const count=2*6*90+2*5*64;
    const seats=new THREE.InstancedMesh(seatGeo,seatMat,count);
    const dummy=new THREE.Object3D();const color=new THREE.Color();
    let idx=0;
    for(const sign of [-1,1]) {
      for(let tier=0;tier<6;tier++) {
        const x=sign*(38+tier*1.55), y=4.3+tier*1.35;
        cube(scene,tierMat,x,y-0.7,0,1.55,1.2,112);
        for(let n=0;n<90;n++) {
          if(n%15===0)continue;
          dummy.position.set(x,y,-54+n*1.2);dummy.rotation.set(0,0,0);dummy.updateMatrix();
          seats.setMatrixAt(idx,dummy.matrix);color.set(n<45?0x276d86:0x865035);color.multiplyScalar(0.55+(n%5)*0.11);seats.setColorAt(idx++,color);
        }
      }
      for(let tier=0;tier<5;tier++) {
        const z=sign*(63+tier*1.55),y=5.6+tier*1.35;
        cube(scene,tierMat,0,y-0.7,z,90,1.2,1.55);
        for(let n=0;n<64;n++) {
          if(n%16===0)continue;
          dummy.position.set(-43+n*1.36,y,z);dummy.rotation.set(0,Math.PI/2,0);dummy.updateMatrix();
          seats.setMatrixAt(idx,dummy.matrix);color.set(sign<0?0x2c687b:0x7c4930);color.multiplyScalar(0.65+(n%3)*0.1);seats.setColorAt(idx++,color);
        }
      }
      cube(scene,darkMat,sign*47,9,0,2,17,125);
      cube(scene,darkMat,0,9,sign*73,96,17,2);
      const led=cube(scene,glow(sign<0?BLUE:ORANGE,1.0),0,13.5,sign*72,92,0.12,0.12);this.ribbons.push(led);
      for(let i=0;i<8;i++) {
        const mat=glow(i%2?BLUE:ORANGE,0.7);
        const strip=cube(scene,mat,sign*46,12.8,-52+i*15,0.1,0.09,10);
        this.ribbons.push(strip);
      }
    }
    seats.count=idx;seats.instanceMatrix.needsUpdate=true;
    if(seats.instanceColor)seats.instanceColor.needsUpdate=true;
    scene.add(seats);
  }

  makeBall() {
    const geometry=new THREE.IcosahedronGeometry(1.8,2);
    const positions=geometry.attributes.position;
    const colors=new Float32Array(positions.count*3);
    const lightPanel=new THREE.Color(0xe5eceb),darkPanel=new THREE.Color(0x123243);
    for(let i=0;i<positions.count;i+=3) {
      const x=(positions.getX(i)+positions.getX(i+1)+positions.getX(i+2))/3;
      const y=(positions.getY(i)+positions.getY(i+1)+positions.getY(i+2))/3;
      const z=(positions.getZ(i)+positions.getZ(i+1)+positions.getZ(i+2))/3;
      const lat=Math.atan2(y,Math.hypot(x,z));
      const lon=Math.atan2(z,x);
      const row=Math.round((lat+Math.PI/2)/Math.PI*5);
      const segment=(lon+Math.PI)*3/Math.PI+(row%2)*0.5;
      const dark=Math.abs(segment-Math.round(segment))<0.23 && Math.abs((lat+Math.PI/2)/Math.PI*5-row)<0.29;
      const c=dark?darkPanel:lightPanel;
      for(let vertex=0;vertex<3;vertex++) {
        const offset=(i+vertex)*3;
        colors[offset]=c.r;colors[offset+1]=c.g;colors[offset+2]=c.b;
      }
    }
    // Per-panel vertex colors keep the entire ball in one material draw call.
    geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
    geometry.clearGroups();
    this.ballMesh=new THREE.Group();
    const ball=new THREE.Mesh(geometry,material(0xffffff,{vertexColors:true,roughness:0.43,metalness:0.32}));
    ball.castShadow=true;this.ballMesh.add(ball);
    const seam=new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(1.805,1)),new THREE.LineBasicMaterial({color:0x3e6679,transparent:true,opacity:0.38}));this.ballMesh.add(seam);
    for(const axis of ['x','z']) {
      const ring=new THREE.Mesh(new THREE.TorusGeometry(1.806,0.014,4,64),glow(0x73ddff,0.6));
      ring.rotation[axis]=Math.PI/2;this.ballMesh.add(ring);
    }
    this.scene.add(this.ballMesh);
  }

  makeShadow(radius,opacity) {
    const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;
    const ctx=canvas.getContext('2d');const gradient=ctx.createRadialGradient(32,32,3,32,32,32);
    gradient.addColorStop(0,`rgba(0,8,15,${opacity})`);gradient.addColorStop(0.45,`rgba(0,8,15,${opacity*0.6})`);gradient.addColorStop(1,'rgba(0,8,15,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(radius*2,radius*2),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(canvas),transparent:true,depthWrite:false}));mesh.rotation.x=-Math.PI/2;mesh.position.y=0.035;this.scene.add(mesh);return mesh;
  }

  createPad(pad) {
    const group=new THREE.Group();
    const large=pad.large;
    const ringMat=glow(0xffbf55,1.4);
    const base=new THREE.Mesh(new THREE.CylinderGeometry(large?1.65:0.85,large?1.8:0.95,0.10,large?12:8),material(0x263b43,{metalness:0.8,roughness:0.32}));base.position.y=0.07;group.add(base);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(large?1.35:0.64,large?0.075:0.045,5,large?36:20),ringMat);ring.rotation.x=Math.PI/2;ring.position.y=0.15;group.add(ring);
    const core=new THREE.Mesh(large?new THREE.OctahedronGeometry(0.58):new THREE.OctahedronGeometry(0.25),glow(0xffdf84,2));core.position.y=large?0.85:0.40;group.add(core);
    if(large) {
      const halo=new THREE.Mesh(new THREE.TorusGeometry(0.75,0.024,4,24),ringMat);halo.rotation.x=Math.PI/2;halo.position.y=0.45;group.add(halo);
    }
    group.position.set(pad.x,0,pad.z);group.userData={core,ring,large,base};this.scene.add(group);this.padMeshes.push(group);
    return group;
  }

  update(physics,dt,time) {
    this.ballMesh.position.copy(physics.ball.position);
    this.ballMesh.quaternion.copy(physics.ball.quaternion);
    this.ballShadow.position.set(physics.ball.position.x,0.036,physics.ball.position.z);
    const height=physics.ball.position.y;
    this.ballShadow.scale.setScalar(1+Math.min(height*0.035,0.65));this.ballShadow.material.opacity=Math.max(0.15,1-height*0.033);
    this.emission+=dt;
    const emit=this.emission>0.018;
    if(emit)this.emission=0;
    for(let i=0;i<physics.cars.length;i++) {
      const car=physics.cars[i],mesh=this.carMeshes[i];if(!mesh)continue;
      mesh.position.copy(car.body.position);mesh.quaternion.copy(car.body.quaternion);
      const speed=car.body.velocity.length();
      forward.set(0,0,1).applyQuaternion(mesh.quaternion);
      const driveSpeed=forward.x*car.body.velocity.x+forward.y*car.body.velocity.y+forward.z*car.body.velocity.z;
      mesh.userData.wheelAngle+=driveSpeed*dt/0.45;
      for(const entry of mesh.userData.wheels) {
        entry.wheel.rotation.x=mesh.userData.wheelAngle;
        entry.pivot.rotation.y=entry.front?(car.steer||0)*0.4:0;
        entry.pivot.position.y=-0.23+(car.onGround?Math.sin(time*18+i)*Math.min(speed*0.001,0.025):0.035);
      }
      const flame=mesh.userData.flame;flame.visible=!!car.boosting;
      if(car.boosting) {
        flame.scale.set(0.85+Math.sin(time*70)*0.15,0.8+Math.random()*0.4,0.85+Math.cos(time*63)*0.15);
        if(emit) {
          forward.set(0,0,-1).applyQuaternion(mesh.quaternion);
          for(let n=0;n<4;n++) {
            tmp.set((Math.random()-.5)*0.55,-0.05,-2.15).applyQuaternion(mesh.quaternion).add(mesh.position);
            this.effects.emit(tmp,{x:forward.x*(10+Math.random()*12)+car.body.velocity.x*.25,y:forward.y*15+Math.random()*1.4,z:forward.z*(10+Math.random()*12)+car.body.velocity.z*.25},mesh.userData.color,0.2+Math.random()*.3);
          }
        }
      }
      const shadow=this.shadows[i];shadow.position.set(car.body.position.x,0.039,car.body.position.z);shadow.material.opacity=Math.max(0.08,0.8-car.body.position.y*.05);shadow.scale.set(1,1.55,1);shadow.rotation.z=-Math.atan2(2*(mesh.quaternion.w*mesh.quaternion.y+mesh.quaternion.x*mesh.quaternion.z),1-2*(mesh.quaternion.y*mesh.quaternion.y+mesh.quaternion.x*mesh.quaternion.x));
      if(emit&&car.onGround&&speed>16&&car.powersliding) {
        tmp.set(0,-0.4,-1.0).applyQuaternion(mesh.quaternion).add(mesh.position);
        this.effects.emit(tmp,{x:(Math.random()-.5)*3,y:1,z:(Math.random()-.5)*3},0x82b3b7,0.45);
      }
    }
    for(let i=0;i<physics.pads.length;i++) {
      const pad=physics.pads[i],mesh=this.padMeshes[i]||this.createPad(pad);
      const active=pad.active!==false&&!(pad.cooldown>0);
      mesh.userData.core.visible=active;mesh.userData.ring.material.emissiveIntensity=active?1.4:0.08;
      mesh.userData.ring.material.color.setHex(active?0xffbf55:0x4a4b3d);
      mesh.userData.core.rotation.y=time*(pad.large?1.8:1.1)+i;
      mesh.userData.core.position.y=(pad.large?.85:.40)+Math.sin(time*3+i)*0.10;
    }
    for(let i=0;i<this.ribbons.length;i++)this.ribbons[i].material.emissiveIntensity=0.65+Math.sin(time*1.3+i*.8)*0.25;
    for(let i=this.bursts.length-1;i>=0;i--) {
      const burst=this.bursts[i];burst.life-=dt;
      const scale=1+(1-burst.life/burst.duration)*14;
      burst.mesh.scale.setScalar(scale);burst.mesh.material.opacity=Math.max(0,burst.life/burst.duration)*.75;
      if(burst.life<=0){this.scene.remove(burst.mesh);burst.mesh.geometry.dispose();burst.mesh.material.dispose();this.bursts.splice(i,1);}
    }
    this.effects.update(dt);
  }

  goal(team,position) {
    const color=team==='blue'?BLUE:ORANGE;
    const center=position||{x:0,y:3,z:team==='blue'?53:-53};
    for(let n=0;n<300;n++) {
      const az=Math.random()*Math.PI*2,el=(Math.random()-.25)*Math.PI,speed=10+Math.random()*24;
      this.effects.emit(center,{x:Math.cos(az)*Math.cos(el)*speed,y:Math.sin(el)*speed+6,z:Math.sin(az)*Math.cos(el)*speed},n%4?color:0xffffff,1+Math.random()*1.5);
    }
    const ring=new THREE.Mesh(new THREE.TorusGeometry(1,0.12,6,64),new THREE.MeshBasicMaterial({color,transparent:true,opacity:0.9,depthWrite:false,blending:THREE.AdditiveBlending}));ring.position.copy(center);this.scene.add(ring);this.bursts.push({mesh:ring,life:1.3,duration:1.3});
  }

  hit(position,strength=1) {
    const count=Math.min(42,Math.round(8+strength*1.8));
    for(let n=0;n<count;n++)this.effects.emit(position,{x:(Math.random()-.5)*(4+strength),y:Math.random()*(3+strength*.3),z:(Math.random()-.5)*(4+strength)},n%3?0xb8efff:0xffdd8b,.15+Math.random()*.35);
  }

  updateQuality(quality) {
    this.sun.castShadow=quality!=='low';
    this.effects.mesh.visible=true;
  }
}

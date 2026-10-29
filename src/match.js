export class Match {
  constructor(){this.mode='duel';this.phase='menu';this.paused=false;this.scores=[0,0];this.time=300;this.duration=300;this.overtime=false;this.countdown=3;this.celebration=0;this.events=[];}
  start({duration=300,mode='duel'}={}){this.mode=mode;this.duration=duration;this.time=duration;this.scores=[0,0];this.overtime=false;this.paused=false;this.phase='kickoff';this.countdown=3;this.events=[{type:'reset'}];}
  pause(){if(['playing','kickoff','goal'].includes(this.phase))this.paused=true;}
  resume(){this.paused=false;}
  menu(){this.phase='menu';this.paused=false;this.events=[];}
  tick(dt){
    if(this.paused)return;
    if(this.phase==='kickoff'){
      const before=Math.ceil(this.countdown);this.countdown=Math.max(0,this.countdown-dt);
      if(Math.ceil(this.countdown)!==before)this.events.push({type:'countdown',value:Math.ceil(this.countdown)});
      if(this.countdown===0){this.phase='playing';this.events.push({type:'go'});}return;
    }
    if(this.phase==='goal'){
      this.celebration-=dt;
      if(this.celebration<=0){
        if(this.overtime||this.time<=0&&this.scores[0]!==this.scores[1]){this.finish();return;}
        if(this.time<=0)this.beginOvertime();
        else{this.phase='kickoff';this.countdown=3;this.events.push({type:'reset'});}
      }return;
    }
    if(this.phase==='playing'&&this.mode!=='freeplay'){
      if(!this.overtime){this.time=Math.max(0,this.time-dt);if(this.time===0){if(this.scores[0]===this.scores[1])this.beginOvertime();else this.finish();}}
      else this.time+=dt;
    }
  }
  beginOvertime(){this.overtime=true;this.time=0;this.phase='kickoff';this.countdown=3;this.events.push({type:'overtime'},{type:'reset'});}
  goal(team){if(this.phase!=='playing'||this.paused)return false;const index=team==='blue'?0:1;this.scores[index]++;this.phase='goal';this.celebration=3.2;this.events.push({type:'goal',team});return true;}
  finish(){this.phase='results';this.events.push({type:'end',winner:this.scores[0]>this.scores[1]?'blue':'orange'});}
  checkGoal(ball){const p=ball.position||ball;if(Math.abs(p.x)>7.2||p.y>5.2||p.y<1.2)return false;if(p.z>53.8)return this.goal('blue');if(p.z< -53.8)return this.goal('orange');return false;}
}

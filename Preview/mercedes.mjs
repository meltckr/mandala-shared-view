import * as THREE from 'three';

// Reference-guided character study; no photo is displayed in the world.
export function createMercedes(){
  const figure=new THREE.Group();
  const skin=new THREE.MeshStandardMaterial({color:'#bc896b',roughness:.86});
  const outfit=new THREE.MeshStandardMaterial({color:'#151b1c',roughness:.92});
  const hair=new THREE.MeshStandardMaterial({color:'#15100e',roughness:.62});
  const shoes=new THREE.MeshStandardMaterial({color:'#c7ec31',roughness:.8});
  const gold=new THREE.MeshStandardMaterial({color:'#c5a366',metalness:.7,roughness:.35});
  const sphere=new THREE.SphereGeometry(1,20,16);
  function oval(mat,p,s){const part=new THREE.Mesh(sphere,mat);part.position.set(...p);part.scale.set(...s);part.castShadow=true;part.receiveShadow=true;figure.add(part);return part;}
  oval(outfit,[0,.96,0],[.19,.31,.15]);oval(outfit,[0,.68,0],[.19,.14,.15]);
  oval(skin,[0,1.29,0],[.07,.11,.07]);oval(skin,[0,1.51,.01],[.17,.21,.15]);
  oval(hair,[0,1.65,-.025],[.18,.13,.16]);oval(hair,[0,1.74,-.10],[.14,.18,.13]);oval(hair,[0,1.48,-.15],[.14,.29,.12]);
  for(let i=0;i<6;i++)oval(hair,[-.125+i*.05,1.62,.13],[.035,.095,.04]);
  const glasses=new THREE.Mesh(new THREE.BoxGeometry(.36,.12,.045),hair);glasses.position.set(0,1.54,.16);figure.add(glasses);
  oval(skin,[0,1.46,.17],[.035,.04,.035]);oval(gold,[0,1.12,.15],[.025,.025,.014]);
  for(const side of [-1,1]){
    oval(outfit,[side*.115,.38,0],[.085,.28,.085]);oval(shoes,[side*.115,.07,.06],[.105,.07,.16]);
    oval(skin,[side*.26,1.03,0],[.075,.20,.07]);oval(skin,[side*.28,.76,.02],[.06,.16,.06]);oval(skin,[side*.28,.59,.025],[.06,.09,.05]);
  }
  return figure;
}

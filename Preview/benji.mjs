import * as THREE from './vendor/three.module.js';

// A provisional sculptural study. Markings follow Mel's description;
// proportions and coat are placeholders until photographic reference arrives.
export function createBenji() {
  const dog = new THREE.Group();
  const coat = new THREE.MeshStandardMaterial({color:'#17191c',roughness:.96});
  const brown = new THREE.MeshStandardMaterial({color:'#99613c',roughness:.94});
  const white = new THREE.MeshStandardMaterial({color:'#eee7db',roughness:.96});
  const nose = new THREE.MeshStandardMaterial({color:'#08090a',roughness:.37});
  const sphere = new THREE.SphereGeometry(1,16,12);
  function oval(name, mat, position, scale, parent=dog) {
    const part = new THREE.Mesh(sphere,mat);part.name=name;
    part.position.set(...position);part.scale.set(...scale);
    part.castShadow=true;part.receiveShadow=true;parent.add(part);return part;
  }
  oval('Black coat',coat,[0,.66,-.08],[.32,.37,.52]);
  for (const x of [-.23,.23]) for (const z of [-.38,.28]) {
    oval('Black leg',coat,[x,.32,z],[.12,.29,.13]);
    oval('White foot',white,[x,.10,z+.035],[.135,.10,.17]);
  }
  oval('White chest',white,[0,.64,.35],[.23,.29,.105]);
  oval('Black head',coat,[0,1.10,.37],[.30,.29,.28]);
  for(const x of [-.29,.29]) {
    const ear=oval('Floppy black ear',coat,[x,.98,.32],[.115,.25,.15]);ear.rotation.z=x>0?-.13:.13;
  }
  oval('Brown muzzle accent',brown,[0,.99,.60],[.21,.13,.15]);
  oval('Black nose',nose,[0,1.035,.735],[.085,.055,.045]);
  for(const x of [-.12,.12]) {
    oval('Eye',nose,[x,1.14,.615],[.038,.04,.023]);
    oval('Brown eyebrow',brown,[x,1.215,.60],[.085,.04,.035]);
    oval('Eye glint',white,[x-.008,1.153,.637],[.009,.01,.005]);
  }
  const tail = new THREE.Group();tail.position.set(0,.75,-.49);dog.add(tail);
  const plume=oval('Black tail',coat,[0,.12,-.20],[.105,.12,.29],tail);plume.rotation.x=.45;
  dog.userData.tail=tail;

  // Instanced curls keep the coat soft without a draw call for every tuft.
  const curls = new THREE.InstancedMesh(new THREE.SphereGeometry(1,8,6),coat,190);
  curls.name='Provisional curly coat';curls.castShadow=true;curls.receiveShadow=true;
  const matrix = new THREE.Matrix4(), rotation = new THREE.Quaternion();
  const position = new THREE.Vector3(), size = new THREE.Vector3();
  for(let i=0;i<190;i++) {
    const head=i>=120, n=head?70:120, j=head?i-120:i;
    const y=1-2*(j+.5)/n, r=Math.sqrt(1-y*y), a=j*2.399963229728653;
    const x=Math.cos(a)*r, z=Math.sin(a)*r;
    position.set(x*(head?.285:.30), (head?1.10:.66)+y*(head?.275:.35), (head?.37:-.08)+z*(head?.26:.50));
    // Keep the face and white bib readable.
    const hidden=z>.65 && (head || y<.6);
    const radius=hidden?.001:.047+(i%4)*.006;
    size.set(radius,radius*.85,radius);matrix.compose(position,rotation,size);curls.setMatrixAt(i,matrix);
  }
  dog.add(curls);
  return dog;
}

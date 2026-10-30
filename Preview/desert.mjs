import * as THREE from 'three';

// A stylized Sonoran Desert setting for the interactive study.
export function addDesert(scene) {
  const group = new THREE.Group();
  const cactus = new THREE.MeshStandardMaterial({color: '#526a43', roughness: .94});
  const rock = new THREE.MeshStandardMaterial({color: '#b9825d', roughness: 1});
  const rib = new THREE.MeshStandardMaterial({color: '#75835a', roughness: 1});
  const part = (g, m, parent, x, y, z) => {
    const mesh = new THREE.Mesh(g, m); mesh.position.set(x, y, z);
    mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  };
  const trunk = new THREE.CapsuleGeometry(.38, 3.7, 5, 12);
  const arm = new THREE.CapsuleGeometry(.19, 1.15, 4, 10);
  const connector = new THREE.CapsuleGeometry(.19, .65, 4, 10);
  const ribGeo = new THREE.CylinderGeometry(.025, .025, 3.65, 5);
  const stoneGeo = new THREE.DodecahedronGeometry(1, 0);
  for (let i = 0; i < 32; i++) {
    const angle = i * 2.39996 + .14;
    const radius = 19 + (i * 13 % 25);
    const x = Math.sin(angle) * radius, z = Math.cos(angle) * radius;
    const plant = new THREE.Group(); plant.position.set(x, -.38, z);
    const size = .65 + (i % 5) * .15; plant.scale.setScalar(size);
    part(trunk, cactus, plant, 0, 2.1, 0);
    for (let j = 0; j < 7; j++) {
      const a = j * Math.PI * 2 / 7;
      part(ribGeo, rib, plant, Math.cos(a)*.375, 2.1, Math.sin(a)*.375);
    }
    if (i % 4 !== 0) {
      const side = i % 2 ? 1 : -1;
      const join = part(connector, cactus, plant, side*.52, 1.8, 0); join.rotation.z = Math.PI/2;
      part(arm, cactus, plant, side*.9, 2.35, 0);
      if (i % 3 === 0) {
        const other = part(connector, cactus, plant, -side*.5, 2.5, 0); other.rotation.z = Math.PI/2;
        part(arm, cactus, plant, -side*.85, 3.05, 0);
      }
    }
    group.add(plant);
    const stone = part(stoneGeo, rock, group, x+2.1, -.2, z-1.2);
    stone.scale.set(1.15 + (i%3)*.25, .35 + (i%2)*.15, .7);
    stone.rotation.y = angle;
  }
  scene.add(group);
}

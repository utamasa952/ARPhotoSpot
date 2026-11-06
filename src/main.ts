import './style.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRM } from '@pixiv/three-vrm';
import { VRMAnimationLoaderPlugin, createVRMAnimationClip } from '@pixiv/three-vrm-animation';
import { MindARThree } from 'mind-ar/dist/mindar-image-three.prod.js';

let currentVrm: VRM | undefined;
let mixer: THREE.AnimationMixer | undefined;

const mindarThree = new MindARThree({
  container: document.querySelector('#ar-container') as HTMLElement,
  imageTargetSrc: 'https://cdn.jsdelivr.net/gh/hiukim/mind-ar-js@1.2.5/examples/image-tracking/assets/card-example/card.mind',
  filterMinCF: 0.0001,
  filterBeta: 0.001,
});
const { renderer, scene, camera } = mindarThree;

const light = new THREE.DirectionalLight(0xffffff, 1.5);
light.position.set(1, 1, 1).normalize();
scene.add(light);
scene.add(new THREE.AmbientLight(0xffffff, 0.8));

const anchor = mindarThree.addAnchor(0);

function loadAndPlayVRMA(vrmaUrl: string) {
  if (!currentVrm || !mixer) return;
  
  const animLoader = new GLTFLoader();
  animLoader.register((parser) => new VRMAnimationLoaderPlugin(parser));
  
  animLoader.load(vrmaUrl, (gltf: any) => {
    const vrmAnimations = gltf.userData.vrmAnimations;
    if (vrmAnimations && vrmAnimations.length > 0) {
      const vrmAnimation = vrmAnimations[0];
      const clip = createVRMAnimationClip(vrmAnimation, currentVrm! as any);
      
      // ★デバッグ：裏側でアニメーションの状態を出力する
      console.log("=== アニメーション読み込み結果 ===");
      console.log("動く骨の数（トラック数）:", clip.tracks.length);
      console.log("全体の長さ（秒）:", clip.duration);

      // 位置の移動を無効化（画面外に飛ぶのを防ぐ）
      clip.tracks = clip.tracks.filter((track: THREE.KeyframeTrack) => !track.name.endsWith('.position'));
      
      mixer?.stopAllAction();
      const action = mixer?.clipAction(clip);
      
      if (action) {
        action.play();
        // ★mocopiのキャリブレーション（最初の静止時間）を3秒飛ばして再生スタート
        action.time = 3.0; 
      }
    }
  });
}
// VRMモデルの読み込み
const loader = new GLTFLoader();
loader.register((parser: any) => new VRMLoaderPlugin(parser));

loader.load(
  '/YKbeta2.vrm',
  (gltf: any) => {
    const vrm = gltf.userData.vrm;
    if (!vrm) return;
    
    currentVrm = vrm;

    if (vrm.springBoneManager) {
      (vrm as any).springBoneManager = null;
    }
    
    vrm.scene.rotation.y = Math.PI; 
    vrm.scene.scale.set(0.5, 0.5, 0.5); 
    vrm.scene.position.set(0, -0.5, 0); 
    
    anchor.group.add(vrm.scene);

// アバター用のアニメーションミキサーを作成（確実に存在する vrm を使う）
    mixer = new THREE.AnimationMixer(vrm.scene);

    // 初期状態としてモーション1を読み込んで再生
    loadAndPlayVRMA('/motion1.vrma');
  },
  (progress: ProgressEvent) => console.log('Loading VRM...', progress.loaded / progress.total),
  (error: unknown) => console.error('Error loading VRM:', error)
);

// --- ボタンのイベント処理（古い setPose は削除しました） ---

document.getElementById('btn-pose1')?.addEventListener('click', () => {
  loadAndPlayVRMA('/motion1.vrma'); 
});

document.getElementById('btn-pose2')?.addEventListener('click', () => {
  // ⚠️ 挙手などの2つ目のポーズを mocopi → bvh2vrma で作成し、
  // 「motion2.vrma」という名前で public フォルダに入れておいてください
  loadAndPlayVRMA('/motion2.vrma'); 
});

// --- 撮影ボタン処理 ---
document.getElementById('btn-capture')?.addEventListener('click', () => {
  const video = document.querySelector('video') as HTMLVideoElement;
  const canvas = document.createElement('canvas');
  canvas.width = renderer.domElement.width;
  canvas.height = renderer.domElement.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  ctx.drawImage(renderer.domElement, 0, 0);
  
  const link = document.createElement('a');
  link.download = 'photo-spot.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
});

// --- レンダリングループ ---
const clock = new THREE.Clock();
const start = async () => {
  await mindarThree.start();
  renderer.setAnimationLoop(() => {
    const delta = clock.getDelta();
    if (currentVrm) currentVrm.update(delta);
    if (mixer) mixer.update(delta); // アニメーションの時間を進める
    renderer.render(scene, camera);
  });
};
start();
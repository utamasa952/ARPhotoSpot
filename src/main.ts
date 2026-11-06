import './style.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRM } from '@pixiv/three-vrm';
import { MindARThree } from 'mind-ar/dist/mindar-image-three.prod.js';

let currentVrm: VRM | undefined;

const mindarThree = new MindARThree({
  container: document.querySelector('#ar-container') as HTMLElement,
  imageTargetSrc: './marker.mind',
  filterMinCF: 0.0001,
  filterBeta: 0.001,
});
const { renderer, scene, camera } = mindarThree;

const light = new THREE.DirectionalLight(0xffffff, 1.5);
light.position.set(1, 1, 1).normalize();
scene.add(light);
scene.add(new THREE.AmbientLight(0xffffff, 0.8));

const anchor = mindarThree.addAnchor(0);

// --- プログラムで直接静止ポーズを作る関数 ---
function setStaticPose(vrm: VRM | undefined, poseType: 'stand' | 'cute') {
  if (!vrm) return;
  
  vrm.humanoid?.resetPose();

  const setRotation = (boneName: string, x: number, y: number, z: number) => {
    const node = vrm.humanoid?.getNormalizedBoneNode(boneName as any);
    if (node) {
      node.rotation.set(
        THREE.MathUtils.degToRad(x),
        THREE.MathUtils.degToRad(y),
        THREE.MathUtils.degToRad(z)
      );
    }
  };

  if (poseType === 'stand') {
    // 【ポーズ1】待機ポーズ
    setRotation('leftUpperArm', 0, 0, 65);
    setRotation('rightUpperArm', 0, 0, -65);
    setRotation('leftLowerArm', 10, 0, 0);
    setRotation('rightLowerArm', 10, 0, 0);
    setRotation('leftHand', 0, 0, 10);
    setRotation('rightHand', 0, 0, -10);
    setRotation('rightShoulder', 0, 0, 0);
    setRotation('leftShoulder', 0, 0, 0);

    setRotation('spine', 0, -10, 5);
    setRotation('head', 0, 10, 10);

    setRotation('leftUpperLeg', 0, 0, -2);
    setRotation('rightUpperLeg', 0, 0, 2);
    setRotation('rightLowerLeg', 0, 0, 0); 
    setRotation('leftLowerLeg', 0, 0, 0);
    setRotation('rightFoot', 0, 0, 0);
    setRotation('leftFoot', 0, 0, 0);

  } else if (poseType === 'cute') {
    // 【ポーズ2】提供画像のポーズ
    setRotation('rightShoulder', 0, 0, 10);
    setRotation('rightUpperArm', -20, 0, 140); 
    setRotation('rightLowerArm', 10, 0, 0);
    setRotation('leftShoulder', 0, 0, -5);
    setRotation('leftUpperArm', 0, 0, 50);
    setRotation('leftLowerArm', -20, 0, 0);
    
    setRotation('spine', 0, -10, 5);
    setRotation('head', 0, 10, 15);
    
    setRotation('leftUpperLeg', 0, 0, 2);
    setRotation('rightUpperLeg', -15, -10, -5);
    setRotation('rightLowerLeg', -70, 0, 0); 
    setRotation('rightFoot', -10, 0, 0);
  }
}

// --- VRMモデルの読み込み ---
const loader = new GLTFLoader();
loader.register((parser: any) => new VRMLoaderPlugin(parser));

loader.load(
  './YKbeta2.vrm',
  (gltf: any) => {
    const vrm = gltf.userData.vrm;
    if (!vrm) return;
    
    currentVrm = vrm;

    if (vrm.springBoneManager) {
      (vrm as any).springBoneManager = null;
    }
    
    vrm.scene.rotation.y = Math.PI; 
    vrm.scene.scale.set(0.5, 0.5, 0.5); 
    // ★ユーザー調整済みの左下位置を適用
    vrm.scene.position.set(-0.65, -0.5, 0.0); 
    
    anchor.group.add(vrm.scene);

    // 最初から「待機ポーズ」にしておく
    setStaticPose(currentVrm, 'stand');
  },
  (progress: ProgressEvent) => console.log('Loading VRM...', progress.loaded / progress.total),
  (error: unknown) => console.error('Error loading VRM:', error)
);

// --- ボタンのイベント処理 ---
document.getElementById('btn-pose1')?.addEventListener('click', () => {
  setStaticPose(currentVrm, 'stand');
});

document.getElementById('btn-pose2')?.addEventListener('click', () => {
  setStaticPose(currentVrm, 'cute');
});

// --- 撮影ボタン処理（高解像度・縦横比修正版） ---
document.getElementById('btn-capture')?.addEventListener('click', () => {
  const video = document.querySelector('video') as HTMLVideoElement;
  if (!video) return;
  
  const canvas = document.createElement('canvas');
  // ★修正: 画面のCSSサイズではなく、3Dキャンバスの「実際の高解像度ピクセル」を使う
  // これにより画質が劇的に向上し、体型が歪む（デブる）現象も解消されます
  canvas.width = renderer.domElement.width;
  canvas.height = renderer.domElement.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  const videoAspect = video.videoWidth / video.videoHeight;
  const canvasAspect = canvas.width / canvas.height;
  
  let drawWidth, drawHeight, offsetX, offsetY;
  
  if (videoAspect > canvasAspect) {
    drawHeight = canvas.height;
    drawWidth = canvas.height * videoAspect;
    offsetX = (canvas.width - drawWidth) / 2;
    offsetY = 0;
  } else {
    drawWidth = canvas.width;
    drawHeight = canvas.width / videoAspect;
    offsetX = 0;
    offsetY = (canvas.height - drawHeight) / 2;
  }
  
  ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);
  renderer.render(scene, camera);
  // 3Dモデルも1:1の正しい比率で書き出す
  ctx.drawImage(renderer.domElement, 0, 0, canvas.width, canvas.height);
  
  const imgData = canvas.toDataURL('image/png');
  
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
  overlay.style.zIndex = '9999';
  overlay.style.display = 'flex';
  overlay.style.flexDirection = 'column';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  
  const img = document.createElement('img');
  img.src = imgData;
  img.style.maxWidth = '85%';
  img.style.maxHeight = '75%';
  img.style.objectFit = 'contain'; 
  img.style.border = '3px solid white';
  img.style.borderRadius = '10px';
  img.style.boxShadow = '0 4px 15px rgba(0,0,0,0.5)';
  
  const text = document.createElement('p');
  text.innerText = '画像を長押しして保存してください\n（画面タップで戻る）';
  text.style.color = 'white';
  text.style.textAlign = 'center';
  text.style.marginTop = '20px';
  text.style.fontWeight = 'bold';
  text.style.lineHeight = '1.5';
  
  overlay.appendChild(img);
  overlay.appendChild(text);
  
  overlay.addEventListener('click', () => {
    document.body.removeChild(overlay);
  });
  
  document.body.appendChild(overlay);
});

// --- レンダリングループ ---
const clock = new THREE.Clock();
const start = async () => {
  await mindarThree.start();
  renderer.setAnimationLoop(() => {
    const delta = clock.getDelta();
    if (currentVrm) currentVrm.update(delta);
    renderer.render(scene, camera);
  });
};
start();
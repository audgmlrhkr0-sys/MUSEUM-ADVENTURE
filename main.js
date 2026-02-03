// Scene, Camera, Renderer 설정
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000); // 어두운 배경 (불이 꺼진 미술관)

const camera = new THREE.PerspectiveCamera(
    50, // FOV를 75에서 50으로 줄여 시야 범위를 좁게 (미로 느낌 강화)
    window.innerWidth / window.innerHeight,
    0.01, // near 값을 더 작게 조정하여 가까운 객체도 보이도록
    1000
);

const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('canvas'), antialias: false, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(1);
renderer.setClearColor(0x000000, 1);
renderer.shadowMap.enabled = false;

camera.position.set(-32, 1.6, -32);
camera.lookAt(-32, 1.6, -34);

// 보행 애니메이션 변수
let walkCycle = 0;
let isMoving = false;
let baseCameraY = 1.6;

const ambientLight = new THREE.AmbientLight(0xffffff, 0.08);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.12);
directionalLight.position.set(10, 10, 5);
directionalLight.castShadow = false;
scene.add(directionalLight);
const flashlightLight = new THREE.SpotLight(0xffffff, 1.5, 25, Math.PI / 6, 0.6, 1);
flashlightLight.castShadow = false;
scene.add(flashlightLight);
scene.add(flashlightLight.target);
const flashlightPointLight = new THREE.PointLight(0xffffff, 0.8, 25, 1);
scene.add(flashlightPointLight);
let flashlightOn = true;
flashlightLight.intensity = 1.5;
flashlightLight.visible = true;
flashlightLight.enabled = true;
flashlightLight.power = 4;
flashlightLight.decay = 1;
flashlightLight.range = 25;
flashlightPointLight.intensity = 0.8;
flashlightPointLight.visible = true;
flashlightPointLight.enabled = true;

// 1인칭 컨트롤 변수
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;

let prevTime = performance.now();
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();

// animate 루프에서 재사용 (매 프레임 객체 생성 방지)
const _horizontalEuler = new THREE.Euler(0, 0, 0, 'XYZ');
const _horizontalQuat = new THREE.Quaternion();
const _moveDir = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _cameraWorldPos = new THREE.Vector3();
const _flashlightOffset = new THREE.Vector3(0.3, -0.2, -0.1);
const _flashlightPos = new THREE.Vector3();
const _cameraDir = new THREE.Vector3();
const _targetPos = new THREE.Vector3();
const _artworkWorldPos = new THREE.Vector3();
const _projectVector = new THREE.Vector3();
const _checkEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const _monsterDir = new THREE.Vector3();
const _testPos = new THREE.Vector3();
const _avoidDir = new THREE.Vector3();
const _avoidPos = new THREE.Vector3();

// 마우스 시점 조작 (리스폰 구역에서 뒤돌아보는 방향으로 시작)
let euler = new THREE.Euler(0, Math.PI, 0, 'YXZ');
// 카메라 초기 각도 설정 — Y축 180° (뒤를 향함)
camera.rotation.set(0, Math.PI, 0);
// 카메라 초기 quaternion 설정 (Z축 회전 없이, YXZ 순서 사용)
camera.quaternion.setFromEuler(euler, 'YXZ');

// Pointer Lock API
let instructions = null;

// canvas 변수는 renderer.domElement를 직접 참조하도록 (안전하게)
let _cachedCanvas = null;
function getCanvas() {
    if (!_cachedCanvas) _cachedCanvas = renderer ? renderer.domElement : document.getElementById('canvas');
    return _cachedCanvas;
}

function resetMovementKeys() {
    moveForward = false;
    moveBackward = false;
    moveLeft = false;
    moveRight = false;
}

function onPointerLockChange() {
    const canvas = getCanvas();
    if (!instructions) instructions = document.getElementById('instructions');
    const pointerLockEl = document.pointerLockElement || document.mozPointerLockElement || document.webkitPointerLockElement;
    const isLocked = pointerLockEl === canvas || pointerLockEl === document.body || pointerLockEl === renderer.domElement;
    if (isLocked) {
        if (instructions) instructions.classList.add('hidden');
        document.body.classList.add('locked');
        document.addEventListener('mousemove', onMouseMove);
        updateInventory();
        startTimer();
        if (backgroundMusic && backgroundMusic.paused) backgroundMusic.play().catch(function() {});
    } else {
        resetMovementKeys();
        if (instructions && !gameOver) instructions.classList.remove('hidden');
        document.body.classList.remove('locked');
        document.removeEventListener('mousemove', onMouseMove);
    }
}

function onPointerLockError() {
    alert('포인터 잠금을 사용할 수 없습니다.\n브라우저 설정을 확인하거나, 다른 브라우저를 시도해보세요.');
}

// 브라우저 호환성을 위한 이벤트 리스너
document.addEventListener('pointerlockchange', onPointerLockChange);
document.addEventListener('mozpointerlockchange', onPointerLockChange);
document.addEventListener('webkitpointerlockchange', onPointerLockChange);
document.addEventListener('pointerlockerror', onPointerLockError);
document.addEventListener('mozpointerlockerror', onPointerLockError);
document.addEventListener('webkitpointerlockerror', onPointerLockError);

// 손전등 켜기/끄기 함수
function toggleFlashlight() {
    flashlightOn = !flashlightOn;
    
    if (flashlightOn) {
        // 손전등 켜기 (플래시가 보이도록 밝게)
        flashlightLight.intensity = 30; // 적절한 밝기
        flashlightLight.visible = true;
        flashlightLight.enabled = true;
        flashlightLight.power = 60;
        flashlightLight.decay = 1;
        flashlightLight.range = 50; // 범위
        flashlightPointLight.intensity = 15;
        flashlightPointLight.visible = true;
        flashlightPointLight.enabled = true;
        // 조명이 씬에 있는지 확인하고 없으면 추가
        if (!scene.children.includes(flashlightLight)) {
            scene.add(flashlightLight);
        }
        if (!scene.children.includes(flashlightPointLight)) {
            scene.add(flashlightPointLight);
        }
        if (!scene.children.includes(flashlightLight.target)) {
            scene.add(flashlightLight.target);
        }
    } else {
        flashlightLight.intensity = 0;
        flashlightLight.visible = false;
        flashlightLight.power = 0;
        flashlightPointLight.intensity = 0;
        flashlightPointLight.visible = false;
    }
}

// 가까운 작품 찾기 함수
function findNearestArtwork() {
    if (artworks.length === 0) {
        return null; // 작품이 없으면 null 반환
    }
    
    const cameraPos = camera.position;
    let nearestArtwork = null;
    let minDistance = 8.0; // 최대 감지 거리 (8미터로 증가)
    
    for (let artwork of artworks) {
        if (!artwork || !artwork.frame) continue;
        artwork.frame.getWorldPosition(_artworkWorldPos);
        const distance = cameraPos.distanceTo(_artworkWorldPos);
        
        if (distance < minDistance) {
            minDistance = distance;
            nearestArtwork = artwork;
        }
    }
    
    return nearestArtwork;
}

// 작품 정보 표시/숨김 함수 (토글)
// RPG 스타일 대화창 상태
let dialogState = 'idle'; // 'idle', 'initial', 'viewing', 'keyFound', 'keyObtained'
let currentArtwork = null;
let selectedChoiceIndex = 0; // 현재 선택된 선택지 인덱스
let isDialogOpen = false; // 대화창이 열려있는지 여부

function openArtworkDialog() {
    resetMovementKeys();
    const dialog = document.getElementById('artworkDialog');
    const nearestArtwork = findNearestArtwork();
    
    if (!nearestArtwork) {
        closeArtworkDialog();
        return;
    }
    
    currentArtwork = nearestArtwork;
    dialogState = 'initial';
    selectedChoiceIndex = 0;
    isDialogOpen = true;
    dialog.classList.remove('hidden');
    
    // 초기 메시지와 선택지 표시
    showDialogMessage('작품이 걸려있다...');
    showDialogChoices(true);
    hideDialogNext();
    updateChoiceSelection();
}

function closeArtworkDialog() {
    const dialog = document.getElementById('artworkDialog');
    dialog.classList.add('hidden');
    dialogState = 'idle';
    currentArtwork = null;
    isDialogOpen = false;
    selectedChoiceIndex = 0;
}

function showDialogMessage(message) {
    const messageEl = document.getElementById('dialogMessage');
    messageEl.textContent = message;
}

function showDialogChoices(show) {
    const choices = document.getElementById('dialogChoices');
    if (show) {
        choices.classList.remove('hidden');
        selectedChoiceIndex = 0;
        updateChoiceSelection();
    } else {
        choices.classList.add('hidden');
    }
}

function updateChoiceSelection() {
    const choices = document.querySelectorAll('.choice-item');
    choices.forEach((choice, index) => {
        if (index === selectedChoiceIndex) {
            choice.classList.add('selected');
        } else {
            choice.classList.remove('selected');
        }
    });
}

function selectChoice() {
    if (!isDialogOpen) return;
    
    if (dialogState === 'initial') {
        // 초기 선택지
        if (selectedChoiceIndex === 0) {
            // "작품을 본다" 선택
            viewArtwork();
        } else {
            // "그만둔다" 선택
            closeArtworkDialog();
        }
    }
}

function moveChoice(direction) {
    if (!isDialogOpen || dialogState !== 'initial') return;
    
    const choices = document.querySelectorAll('.choice-item');
    if (choices.length === 0) return;
    
    if (direction === 'up') {
        selectedChoiceIndex = (selectedChoiceIndex - 1 + choices.length) % choices.length;
    } else if (direction === 'down') {
        selectedChoiceIndex = (selectedChoiceIndex + 1) % choices.length;
    }
    
    updateChoiceSelection();
}

function hideDialogNext() {
    const nextBtn = document.getElementById('dialogNext');
    nextBtn.classList.add('hidden');
}

function showDialogNext() {
    const nextBtn = document.getElementById('dialogNext');
    nextBtn.classList.remove('hidden');
}

function viewArtwork() {
    if (!currentArtwork) return;
    
    const info = currentArtwork.info;
    showDialogChoices(false);
    
    // 무조건 작품 설명 먼저 표시
    dialogState = 'viewing';
    const artworkInfo = `${info.title}\n\n재료: ${info.material}\n크기: ${info.size}\n년도: ${info.year}\n\n${info.description}`;
    showDialogMessage(artworkInfo);
    showDialogNext();
}

function nextDialog() {
    if (!currentArtwork) return;
    
    // 열쇠가 있는 작품인지 확인
    const hasKey = currentArtwork.frame.userData.hasKey && !keys.includes(currentArtwork);
    
    if (dialogState === 'viewing') {
        // 작품 설명 후
        if (hasKey) {
            // 열쇠가 있으면 "무언가가 빛나고 있다" 표시
            dialogState = 'keyFound';
            showDialogMessage('무언가가 빛나고 있다...');
            showDialogNext();
        } else {
            // 열쇠가 없으면 대화창 닫기
            closeArtworkDialog();
        }
    } else if (dialogState === 'keyFound') {
        // 열쇠 획득 처리
        dialogState = 'keyObtained';
        showDialogMessage('열쇠를 얻었다!');
        
        // 열쇠 획득
        keys.push(currentArtwork);
        updateInventory();
        
        // 열쇠 획득 후 작품에서 열쇠 제거
        currentArtwork.frame.userData.hasKey = false;
        
        // 반짝임 효과 및 테두리 빛 제거
        if (currentArtwork.frame.userData.sparkleGroup) {
            currentArtwork.frame.remove(currentArtwork.frame.userData.sparkleGroup);
            currentArtwork.frame.userData.sparkleGroup = null;
        }
        removeKeyFrameGlow(currentArtwork.frame);
        
        showDialogNext();
    } else if (dialogState === 'keyObtained') {
        // 대화창 닫기
        closeArtworkDialog();
    }
}

// 대화창 버튼 이벤트 리스너
document.addEventListener('DOMContentLoaded', () => {
    const dialogNext = document.getElementById('dialogNext');
    
    if (dialogNext) {
        dialogNext.addEventListener('click', () => {
            if (isDialogOpen) {
                nextDialog();
            }
        });
    }
});

// 열쇠 획득 알림 표시
function showKeyNotification() {
    const notification = document.getElementById('keyNotification');
    if (notification) {
        // 항상 "열쇠를 획득했습니다!" 메시지만 표시
        notification.textContent = '열쇠를 획득했습니다!';
        notification.classList.remove('hidden');
        
        // 기존 타이머가 있으면 취소
        if (keyNotificationTimeout) {
            clearTimeout(keyNotificationTimeout);
        }
        
        // 2초 후 숨기기
        keyNotificationTimeout = setTimeout(() => {
            notification.classList.add('hidden');
        }, 2000);
    }
}

var _prevKeyCount = 0;
// 인벤토리 업데이트
function updateInventory() {
    const inventory = document.getElementById('inventory');
    const keySlots = document.querySelectorAll('.key-slot');
    
    if (inventory && keySlots) {
        if (keys.length > _prevKeyCount && typeof getSound !== 'undefined' && getSound) {
            getSound.play().catch(function() {});
        }
        _prevKeyCount = keys.length;
        inventory.classList.remove('hidden');
        
        // 모든 슬롯 업데이트
        keySlots.forEach((slot, index) => {
            if (index < keys.length) {
                slot.classList.add('filled');
            } else {
                slot.classList.remove('filled');
            }
        });
        
        // 열쇠 5개 모두 획득 시 출구 열기
        if (keys.length >= 5 && exitDoor && exitDoor.userData.isLocked) {
            openExit();
        }
    }
}

// 출구 문 객체
let exitDoor = null;
let exitDoorOriginalY = 0;

// 출구 생성 함수
function createExit() {
    const exitGroup = new THREE.Group();
    
    // 출구 철장 (닫힌 문, 열쇠 5개로 열림) - 표시판보다 먼저 만들어서 위에 표시판 배치
    const gateGroup = new THREE.Group();
    const gateMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x444444,
        roughness: 0.2,
        metalness: 0.9,
        emissive: 0x111111
    });
    
    const barCount = 10;
    const gateWidth = 4.0;
    const barHeight = 6.0;
    const barThickness = 0.15;
    
    for (let i = 0; i < barCount; i++) {
        const barX = -gateWidth / 2 + (gateWidth / (barCount - 1)) * i;
        const barGeometry = new THREE.BoxGeometry(barThickness, barHeight, barThickness);
        const bar = new THREE.Mesh(barGeometry, gateMaterial);
        bar.position.set(barX, barHeight / 2, 0);
        bar.castShadow = false;
        bar.receiveShadow = false;
        gateGroup.add(bar);
    }
    
    const horizontalBars = [
        { y: barHeight - 0.25, name: 'top' },
        { y: barHeight * 0.75, name: 'upper' },
        { y: barHeight / 2, name: 'middle' },
        { y: barHeight * 0.25, name: 'lower' },
        { y: 0.25, name: 'bottom' }
    ];
    
    horizontalBars.forEach(bar => {
        const horizontalGeometry = new THREE.BoxGeometry(gateWidth + 0.1, barThickness, barThickness);
        const horizontalBar = new THREE.Mesh(horizontalGeometry, gateMaterial);
        horizontalBar.position.set(0, bar.y, 0);
        horizontalBar.castShadow = false;
        horizontalBar.receiveShadow = false;
        gateGroup.add(horizontalBar);
    });
    
    // 철장을 갤러리 쪽(벽 앞)에 배치해 플레이어가 보이도록 (exitGroup z=35이므로 gate z=-0.8 → 월드 z=34.2)
    gateGroup.position.set(0, 0, -0.8);
    exitGroup.add(gateGroup);

    // 출구 표시 조명 (철장 위, 닫혀있을 때 빨간색)
    const exitLight = new THREE.PointLight(0xff0000, 8, 10);
    exitLight.position.set(0, barHeight + 2, -0.8);
    exitGroup.add(exitLight);

    // 출구 표시판 (철장 위에 배치해 보이도록)
    const signGeometry = new THREE.PlaneGeometry(1.5, 0.8);
    const signMaterial = new THREE.MeshStandardMaterial({
        color: 0xff0000,
        emissive: 0xff0000,
        emissiveIntensity: 0.8,
        side: THREE.DoubleSide
    });
    const sign = new THREE.Mesh(signGeometry, signMaterial);
    sign.position.set(0, barHeight + 1.2, -0.11);
    sign.rotation.y = Math.PI;
    exitGroup.add(sign);

    const exitTextCanvas = document.createElement('canvas');
    exitTextCanvas.width = 256;
    exitTextCanvas.height = 128;
    const exitTextContext = exitTextCanvas.getContext('2d');
    exitTextContext.fillStyle = '#ffffff';
    exitTextContext.font = 'bold 60px Arial';
    exitTextContext.textAlign = 'center';
    exitTextContext.textBaseline = 'middle';
    exitTextContext.fillText('EXIT', 128, 64);
    const exitTextTexture = new THREE.CanvasTexture(exitTextCanvas);
    exitTextTexture.needsUpdate = true;
    const exitTextMaterial = new THREE.MeshStandardMaterial({
        map: exitTextTexture,
        transparent: true,
        emissive: 0xffffff,
        emissiveIntensity: 0.5
    });
    const exitText = new THREE.Mesh(signGeometry, exitTextMaterial);
    exitText.position.set(0, barHeight + 1.2, -0.12);
    exitText.rotation.y = Math.PI;
    exitGroup.add(exitText);
    
    // 출구 철장 뒤에 문 – 단일 평면으로 z-fighting 없이 문처럼 보이게
    const doorWidth = 3.2;
    const doorHeight = 5.5;
    const doorZ = -0.1; // 철장(-0.8)과 벽(0) 사이, 갤러리에서 보이게
    const doorMaterial = new THREE.MeshStandardMaterial({
        color: 0x2c1810,
        roughness: 0.8,
        metalness: 0.1,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1
    });
    const doorPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(doorWidth, doorHeight),
        doorMaterial
    );
    doorPlane.position.set(0, doorHeight / 2, doorZ);
    doorPlane.rotation.y = Math.PI;
    exitGroup.add(doorPlane);
    
    // 출구 문 손잡이 (레버형: 받침대 + 손잡이대)
    var doorHandleGroup = new THREE.Group();
    var handleMat = new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.25, metalness: 0.85 });
    var handleBase = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.12, 0.06, 8),
        handleMat
    );
    handleBase.position.set(0, 0, 0.08);
    doorHandleGroup.add(handleBase);
    var handleBar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.055, 0.55, 8),
        handleMat
    );
    handleBar.rotation.z = Math.PI / 2;
    handleBar.position.set(0, 0, 0.14);
    doorHandleGroup.add(handleBar);
    var handleLever = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 0.12, 6),
        handleMat
    );
    handleLever.rotation.z = Math.PI / 2;
    handleLever.position.set(0.28, 0, 0.14);
    doorHandleGroup.add(handleLever);
    doorHandleGroup.position.set(doorWidth * 0.42, doorHeight / 2, doorZ + 0.12);
    exitGroup.add(doorHandleGroup);
    
    // 출구 위치: 남쪽 외벽 (x=0, z=35)
    exitGroup.position.set(0, 0, 35);
    exitGroup.userData.isLocked = true;
    exitGroup.userData.exitLight = exitLight;
    exitGroup.userData.gate = gateGroup; // 철장 참조 저장
    exitDoorOriginalY = exitGroup.position.y;
    
    scene.add(exitGroup);
    exitDoor = exitGroup;
}

// 출구 열기 함수
function openExit() {
    if (!exitDoor || !exitDoor.userData.isLocked) return;
    
    exitDoor.userData.isLocked = false;
    
    // 조명을 녹색으로 변경
    if (exitDoor.userData.exitLight) {
        exitDoor.userData.exitLight.color.setHex(0x00ff00);
    }
    
    // 철장 제거 (사라지게)
    if (exitDoor.userData.gate) {
        exitDoor.userData.gate.visible = false;
        // 씬에서 완전히 제거
        exitDoor.remove(exitDoor.userData.gate);
        exitDoor.userData.gate = null;
    }
    
    if (doorSound) doorSound.play().catch(function() {});
    // 출구 열림 알림
    const exitNotification = document.createElement('div');
    exitNotification.id = 'exitNotification';
    exitNotification.textContent = '출구가 열렸습니다!';
    exitNotification.style.cssText = `
        position: absolute;
        top: 30%;
        left: 50%;
        transform: translateX(-50%);
        background: transparent;
        color: #fff8dc;
        padding: 32px 58px;
        border-radius: 14px;
        font-size: 2.15em;
        font-weight: bold;
        z-index: 200;
        text-align: center;
        box-shadow: none;
        text-shadow: 0 0 20px rgba(255, 245, 200, 0.95), 0 0 40px rgba(255, 230, 180, 0.7), 0 0 60px rgba(255, 220, 150, 0.5);
        animation: exitNotifyGlow 1.2s ease-in-out infinite;
    `;
    document.body.appendChild(exitNotification);
    
    setTimeout(() => {
        exitNotification.remove();
    }, 3000);
}

function closeArtworkInfo() {
    const infoPanel = document.getElementById('artworkInfo');
    if (infoPanel) {
        infoPanel.classList.add('hidden');
    }
}


function onMouseMove(event) {
    const canvas = getCanvas();
    const lockedElement = document.pointerLockElement || 
                         document.mozPointerLockElement || 
                         document.webkitPointerLockElement;
    
    if (lockedElement === canvas || lockedElement === document.body) {
        const movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
        const movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;

        // 현재 카메라 각도를 euler로 변환 (YXZ 순서로 변경하여 안정성 향상)
        euler.setFromQuaternion(camera.quaternion, 'YXZ');
        
        // 마우스 감도 조정 (시야 조정 속도) - 더 자연스럽게
        const mouseSensitivity = 0.0006;
        
        // 좌우 회전 (Y축) - 360도 자유롭게 회전 가능
        euler.y -= movementX * mouseSensitivity;
        
        // 위아래 회전 (X축) - 바닥은 고정, 위만 볼 수 있도록 제한
        // 좌우 회전과 독립적으로 처리하여 위아래 시야가 유지되도록
        const maxVerticalAngle = 1.2; // 아래를 볼 수 있음 (약 69도)
        const minVerticalAngle = -1.57; // 위를 볼 수 있는 최대 각도 (거의 수직까지 가능, 약 -90도)
        
        // 각도 변경 전 현재 각도 확인
        let newX = euler.x - movementY * mouseSensitivity;
        
        // 각도 제한 적용 (위아래 모두 가능)
        if (newX > maxVerticalAngle) {
            newX = maxVerticalAngle; // 아래로 너무 많이 못 보게 제한
        } else if (newX < minVerticalAngle) {
            newX = minVerticalAngle; // 위로 너무 많이 못 보게 제한
        }
        
        euler.x = newX;
        
        // Z축 회전은 항상 0으로 고정 (화면 뒤집힘 방지)
        euler.z = 0;
        
        // YXZ 순서로 quaternion 변환 (Y축 회전이 먼저, X축 회전이 나중)
        camera.quaternion.setFromEuler(euler, 'YXZ');
        
        camera.quaternion.normalize();
        _checkEuler.setFromQuaternion(camera.quaternion, 'YXZ');
        if (Math.abs(_checkEuler.z) > 1e-5) {
            _checkEuler.z = 0;
            _checkEuler.x = Math.max(minVerticalAngle, Math.min(maxVerticalAngle, _checkEuler.x));
            camera.quaternion.setFromEuler(_checkEuler, 'YXZ');
            camera.quaternion.normalize();
        }
        
        // 카메라의 월드 행렬 업데이트 (이동 방향 계산을 위해)
        camera.updateMatrixWorld(true);
    }
}

// 키보드 입력
const onKeyDown = (event) => {
    // 게임 오버/클리어 시에는 이동·작품 상호작용 등 무시 (다시하기만 가능)
    if (gameOver) return;
    // 키 반복 시 이동 플래그만 설정하지 않음 (keyup 누락 시 계속 이동하는 버그 방지)
    if (event.repeat) {
        if (event.code === 'KeyW' || event.code === 'ArrowUp' || event.code === 'KeyS' || event.code === 'ArrowDown' || event.code === 'KeyA' || event.code === 'ArrowLeft' || event.code === 'KeyD' || event.code === 'ArrowRight') return;
    }
    // Pointer Lock이 활성화된 상태에서만 키 입력 처리
    const locked = document.pointerLockElement || document.mozPointerLockElement || document.webkitPointerLockElement;
    if (!locked) {
        return; // Pointer Lock이 없으면 키 입력 무시
    }
    
    // 대화창이 열려있을 때는 특별 처리 (W=위, S=아래로 보기 선택)
    if (isDialogOpen) {
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW':
                event.preventDefault();
                event.stopPropagation();
                moveChoice('up');
                return;
            case 'ArrowDown':
            case 'KeyS':
                event.preventDefault();
                event.stopPropagation();
                moveChoice('down');
                return;
            case 'Space':
                event.preventDefault();
                event.stopPropagation();
                if (dialogState === 'initial') {
                    selectChoice();
                } else {
                    nextDialog();
                }
                return;
        }
    }
    
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
            moveForward = true;
            break;
        case 'ArrowLeft':
        case 'KeyA':
            moveLeft = true;
            break;
        case 'ArrowDown':
        case 'KeyS':
            moveBackward = true;
            break;
        case 'ArrowRight':
        case 'KeyD':
            moveRight = true;
            break;
        case 'Space':
            // 스페이스바로 작품 상호작용
            event.preventDefault();
            event.stopPropagation();
            if (!isDialogOpen) {
                openArtworkDialog();
            }
            break;
        case 'KeyQ':
            // Q 키로 출구 열기
            event.preventDefault();
            event.stopPropagation();
            if (exitDoor && exitDoor.userData.isLocked) {
                openExit();
            }
            break;
    }
};

const onKeyUp = (event) => {
    if (gameOver) return;
    // 대화창이 열려있으면 이동 키는 무시 (화살표·W·S는 선택용으로 사용)
    if (isDialogOpen && (event.code === 'ArrowUp' || event.code === 'ArrowDown' || event.code === 'KeyW' || event.code === 'KeyS')) {
        return;
    }
    
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
            moveForward = false;
            break;
        case 'ArrowLeft':
        case 'KeyA':
            moveLeft = false;
            break;
        case 'ArrowDown':
        case 'KeyS':
            moveBackward = false;
            break;
        case 'ArrowRight':
        case 'KeyD':
            moveRight = false;
            break;
    }
};

document.addEventListener('keydown', onKeyDown);
document.addEventListener('keyup', onKeyUp);
window.addEventListener('blur', resetMovementKeys);

// 작품 정보 배열
const artworks = [];

// 작품 정보 생성 함수
function createArtworkInfo(title, material, size, year, description) {
    return {
        title: title,
        material: material,
        size: size,
        year: year,
        description: description
    };
}

// 미술관 구조 생성 함수
function createGallery() {
    const galleryGroup = new THREE.Group();
    
    // 바닥 타일 텍스처 생성
    function createTileTexture() {
        const canvas = document.createElement('canvas');
        const tileSize = 128;
        const gridSize = 8; // 8x8 타일
        canvas.width = tileSize * gridSize;
        canvas.height = tileSize * gridSize;
        const context = canvas.getContext('2d');
        
        // 회색 배경
        context.fillStyle = '#808080';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // 타일 경계선 그리기
        context.strokeStyle = '#666666';
        context.lineWidth = 2;
        for (let i = 0; i <= gridSize; i++) {
            // 세로선
            context.beginPath();
            context.moveTo(i * tileSize, 0);
            context.lineTo(i * tileSize, canvas.height);
            context.stroke();
            
            // 가로선
            context.beginPath();
            context.moveTo(0, i * tileSize);
            context.lineTo(canvas.width, i * tileSize);
            context.stroke();
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(gridSize, gridSize);
        texture.needsUpdate = true;
        return texture;
    }
    
    const tileTexture = createTileTexture();
    
    // 재질 정의
    const floorMaterial = new THREE.MeshStandardMaterial({ 
        map: tileTexture,
        color: 0x808080, // 회색
        roughness: 0.3, // 광택 있게
        metalness: 0.5 // 금속성 느낌
    });
    
    const wallMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xf5f5dc, // 아이보리색
        roughness: 0.7,
        metalness: 0.1,
        side: THREE.DoubleSide // 양면 렌더링 (각도마다 보이도록)
    });
    
    const ceilingMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xffffff,
        roughness: 0.9,
        metalness: 0.0
    });

    // 바닥 (미술관 공간 넓게: 70x70)
    const floorSize = 70;
    const halfSize = floorSize / 2; // 35
    const floorGeometry = new THREE.PlaneGeometry(floorSize, floorSize);
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = false;
    galleryGroup.add(floor);

    // 천장 (10m 높이 - 위를 올려다 봐야 할 정도로 높게)
    const ceilingGeometry = new THREE.PlaneGeometry(floorSize, floorSize);
    const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = 10;
    galleryGroup.add(ceiling);

    // 벽 생성 함수 (양면 렌더링으로 각도마다 보이도록)
    function createWall(width, height, position, rotation) {
        const wallGeometry = new THREE.PlaneGeometry(width, height);
        // 양면 렌더링을 위한 재질 복사
        const wallMat = wallMaterial.clone();
        wallMat.side = THREE.DoubleSide; // 양면 렌더링
        const wall = new THREE.Mesh(wallGeometry, wallMat);
        wall.position.set(position.x, position.y, position.z);
        wall.rotation.y = rotation;
        wall.castShadow = false;
        wall.receiveShadow = false;
        return wall;
    }

    // 외벽 (10m 높이 - 전체적으로 보지 못하게 높게)
    const wallHeight = 10;
    const wallSize = floorSize;
    
    // 미니 방 생성 (시작 방)
    const roomSize = 6; // 더 작게
    const roomWallHeight = wallHeight;
    
    // 미니 방 바닥
    const roomFloor = new THREE.Mesh(
        new THREE.PlaneGeometry(roomSize, roomSize),
        floorMaterial
    );
    roomFloor.rotation.x = -Math.PI / 2;
    roomFloor.position.set(-floorSize / 2 + roomSize / 2, 0, -floorSize / 2 + roomSize / 2);
    roomFloor.receiveShadow = false;
    galleryGroup.add(roomFloor);
    
    // 미니 방 천장
    const roomCeiling = new THREE.Mesh(
        new THREE.PlaneGeometry(roomSize, roomSize),
        ceilingMaterial
    );
    roomCeiling.rotation.x = Math.PI / 2;
    roomCeiling.position.set(-floorSize / 2 + roomSize / 2, wallHeight, -floorSize / 2 + roomSize / 2);
    galleryGroup.add(roomCeiling);
    
    // 미니 방 벽들
    const roomCenterX = -floorSize / 2 + roomSize / 2;
    const roomCenterZ = -floorSize / 2 + roomSize / 2;
    
    // 미니 방 북쪽 벽
    galleryGroup.add(createWall(roomSize, roomWallHeight, { x: roomCenterX, y: roomWallHeight / 2, z: roomCenterZ - roomSize / 2 }, 0));
    // 미니 방 남쪽 벽 (문이 있는 벽)
    galleryGroup.add(createWall(roomSize / 2 - 1, roomWallHeight, { x: roomCenterX - roomSize / 4 - 0.5, y: roomWallHeight / 2, z: roomCenterZ + roomSize / 2 }, Math.PI));
    galleryGroup.add(createWall(roomSize / 2 - 1, roomWallHeight, { x: roomCenterX + roomSize / 4 + 0.5, y: roomWallHeight / 2, z: roomCenterZ + roomSize / 2 }, Math.PI));
    // 미니 방 동쪽 벽
    galleryGroup.add(createWall(roomSize, roomWallHeight, { x: roomCenterX + roomSize / 2, y: roomWallHeight / 2, z: roomCenterZ }, Math.PI / 2));
    // 미니 방 서쪽 벽
    galleryGroup.add(createWall(roomSize, roomWallHeight, { x: roomCenterX - roomSize / 2, y: roomWallHeight / 2, z: roomCenterZ }, -Math.PI / 2));
    
    // 외벽 생성 (미로식 구조)
    const outerWallSize = floorSize;
    
    // 북쪽 외벽
    galleryGroup.add(createWall(outerWallSize, wallHeight, { x: 0, y: wallHeight / 2, z: -halfSize }, 0));
    // 남쪽 외벽 (출구 구멍을 위해 세 부분으로 나눔)
    const southWallHalf = (halfSize - 1.5) / 2;
    galleryGroup.add(createWall(halfSize - 1.5, wallHeight, { x: -halfSize + southWallHalf, y: wallHeight / 2, z: halfSize }, Math.PI));
    galleryGroup.add(createWall(halfSize - 1.5, wallHeight, { x: halfSize - southWallHalf, y: wallHeight / 2, z: halfSize }, Math.PI));
    galleryGroup.add(createWall(3, wallHeight, { x: 0, y: wallHeight / 2, z: halfSize }, Math.PI));
    // 동쪽 외벽
    galleryGroup.add(createWall(outerWallSize, wallHeight, { x: halfSize, y: wallHeight / 2, z: 0 }, Math.PI / 2));
    // 서쪽 외벽
    galleryGroup.add(createWall(outerWallSize, wallHeight, { x: -halfSize, y: wallHeight / 2, z: 0 }, -Math.PI / 2));
    
    // 내부 벽: 좌우 날개 + 방 3개 구분 (입구·출구 제외, 미로식)
    galleryGroup.add(createWall(38, wallHeight, { x: -20, y: wallHeight / 2, z: -10 }, Math.PI / 2));
    galleryGroup.add(createWall(38, wallHeight, { x: -20, y: wallHeight / 2, z: 10 }, -Math.PI / 2));
    galleryGroup.add(createWall(38, wallHeight, { x: 20, y: wallHeight / 2, z: -10 }, -Math.PI / 2));
    galleryGroup.add(createWall(38, wallHeight, { x: 20, y: wallHeight / 2, z: 10 }, Math.PI / 2));
    // 방 3개: 북방(z -35~-12) / 중앙방(z -12~12) / 남방(z 12~35). 통로 갭 x = -8~8
    galleryGroup.add(createWall(27, wallHeight, { x: -21.5, y: wallHeight / 2, z: -12 }, 0));
    galleryGroup.add(createWall(27, wallHeight, { x: 21.5, y: wallHeight / 2, z: -12 }, 0));
    galleryGroup.add(createWall(27, wallHeight, { x: -21.5, y: wallHeight / 2, z: 12 }, 0));
    galleryGroup.add(createWall(27, wallHeight, { x: 21.5, y: wallHeight / 2, z: 12 }, 0));

    // 그림 프레임 생성. 이미지 로드 성공 시에만 parentGroup에 추가(주황 액자만 보이지 않도록).
    function createPictureFrame(width, height, position, rotation, imageUrl, artworkInfo, parentGroup, slotIndex) {
        const frameGroup = new THREE.Group();
        if (typeof slotIndex === 'number') frameGroup.userData.slotIndex = slotIndex;
        
        // 액자 테두리: 앞면만 보이도록 4개 Plane 사용 (뒷면 비표시)
        const fw = width + 0.2, fh = height + 0.2, thick = 0.1;
        const frameMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a, side: THREE.FrontSide });
        const top = new THREE.Mesh(new THREE.PlaneGeometry(fw, thick), frameMat);
        top.position.set(0, fh / 2, 0);
        frameGroup.add(top);
        const bottom = new THREE.Mesh(new THREE.PlaneGeometry(fw, thick), frameMat);
        bottom.position.set(0, -fh / 2, 0);
        frameGroup.add(bottom);
        const left = new THREE.Mesh(new THREE.PlaneGeometry(thick, fh), frameMat);
        left.position.set(-fw / 2, 0, 0);
        frameGroup.add(left);
        const right = new THREE.Mesh(new THREE.PlaneGeometry(thick, fh), frameMat);
        right.position.set(fw / 2, 0, 0);
        frameGroup.add(right);
        
        const pictureGeometry = new THREE.PlaneGeometry(width, height);
        let pictureMaterial;
        
        if (imageUrl) {
            const textureLoader = new THREE.TextureLoader();
            textureLoader.setCrossOrigin('anonymous');
            
            function addToScene() {
                if (frameGroup.userData.addedToScene) return;
                var slot12 = frameGroup.userData.slotIndex === 12;
                if (slot12) {
                    for (var d = artworks.length - 1; d >= 0; d--) {
                        if (artworks[d].frame && artworks[d].frame.userData.slotIndex === 12) {
                            if (artworks[d].frame.parent) artworks[d].frame.parent.remove(artworks[d].frame);
                            artworks.splice(d, 1);
                        }
                    }
                    if (parentGroup) {
                        var px = position.x, py = position.y, pz = position.z;
                        for (var c = parentGroup.children.length - 1; c >= 0; c--) {
                            var ch = parentGroup.children[c];
                            if (ch !== frameGroup && ch.position && Math.abs(ch.position.x - px) < 0.02 && Math.abs(ch.position.y - py) < 0.02 && Math.abs(ch.position.z - pz) < 0.02) {
                                parentGroup.remove(ch);
                            }
                        }
                    }
                }
                if (typeof frameGroup.userData.slotIndex === 'number' && artworks.some(function(a) { return a.frame && a.frame.userData.slotIndex === frameGroup.userData.slotIndex; })) return;
                frameGroup.userData.addedToScene = true;
                if (artworks.some(function(a) { return a.frame === frameGroup; })) return;
                var samePos = artworks.some(function(a) {
                    var p = a.position;
                    return Math.abs(p.x - position.x) < 0.01 && Math.abs(p.y - position.y) < 0.01 && Math.abs(p.z - position.z) < 0.01;
                });
                if (samePos) return;
                if (parentGroup && !frameGroup.parent) parentGroup.add(frameGroup);
                if (artworkInfo) {
                    frameGroup.userData.artworkInfo = artworkInfo;
                    frameGroup.userData.isArtwork = true;
                    frameGroup.userData.hasKey = false;
                    artworks.push({ frame: frameGroup, position: position, info: artworkInfo });
                }
            }
            
            const texture = textureLoader.load(
                imageUrl,
                function(loadedTexture) {
                    loadedTexture.needsUpdate = true;
                    loadedTexture.flipY = true;
                    loadedTexture.anisotropy = 1;
                    loadedTexture.wrapS = THREE.ClampToEdgeWrapping;
                    loadedTexture.wrapT = THREE.ClampToEdgeWrapping;
                    loadedTexture.minFilter = THREE.LinearFilter;
                    loadedTexture.magFilter = THREE.LinearFilter;
                    // 9.jpg: -90도 회전하여 세로 비율로 표시
                    if (typeof slotIndex === 'number' && slotIndex === 8) {
                        loadedTexture.rotation = -Math.PI / 2;
                        loadedTexture.center.set(0.5, 0.5);
                    }
                    if (picture && picture.material && picture.material.map !== loadedTexture) {
                        picture.material.map = loadedTexture;
                        picture.material.needsUpdate = true;
                    }
                    addToScene();
                },
                undefined,
                function(error) {
                    const fallbackList = ['1.jpg', '2.jpg', '3.jpg', '4.jpg', '5.jpeg', '6.jpg', '7.png', '8.jpg', '9.jpg', '10.jpg', '11.jpg', '12.jpg'];
                    let tried = 0;
                    function tryNext() {
                        if (tried >= fallbackList.length) {
                            // 모든 로드 실패 시에도 프레임은 씬에 추가 (회색 플레이스홀더, 별빛 아래 등 누락 방지)
                            if (picture && picture.material) {
                                picture.material.dispose();
                                picture.material = new THREE.MeshStandardMaterial({ color: 0x555555, side: THREE.FrontSide, roughness: 0.9, metalness: 0 });
                            }
                            addToScene();
                            return;
                        }
                        const fallbackUrl = fallbackList[tried++];
                        textureLoader.load(
                            fallbackUrl,
                            function(fbTexture) {
                                if (!picture || !picture.material) return;
                                fbTexture.needsUpdate = true;
                                fbTexture.flipY = true;
                                fbTexture.anisotropy = 1;
                                fbTexture.wrapS = THREE.ClampToEdgeWrapping;
                                fbTexture.wrapT = THREE.ClampToEdgeWrapping;
                                fbTexture.minFilter = THREE.LinearFilter;
                                fbTexture.magFilter = THREE.LinearFilter;
                                picture.material.map = fbTexture;
                                picture.material.needsUpdate = true;
                                addToScene();
                            },
                            undefined,
                            tryNext
                        );
                    }
                    tryNext();
                }
            );
            
            texture.flipY = true;
            texture.wrapS = THREE.ClampToEdgeWrapping;
            texture.wrapT = THREE.ClampToEdgeWrapping;
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
            // 9.jpg (슬롯 8 또는 32): -90도 회전 (텍스처 로드 전에도 적용)
            if (typeof slotIndex === 'number' && slotIndex % 24 === 8) {
                texture.rotation = -Math.PI / 2;
                texture.center.set(0.5, 0.5);
            }
            
            pictureMaterial = new THREE.MeshStandardMaterial({ 
                map: texture,
                side: THREE.FrontSide,
                emissive: 0xffffff,
                emissiveIntensity: 0.18,
                roughness: 0.7,
                metalness: 0.0
            });
        } else {
            pictureMaterial = new THREE.MeshStandardMaterial({ 
                color: 0x888888,
                side: THREE.FrontSide
            });
        }
        
        // 작품 이미지 검은색 테두리 (그림보다 살짝 큰 검은 면을 뒤에 배치)
        const borderW = 0.12;
        const borderPlane = new THREE.Mesh(
            new THREE.PlaneGeometry(width + borderW, height + borderW),
            new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.FrontSide })
        );
        borderPlane.position.z = 0.055;
        frameGroup.add(borderPlane);
        const picture = new THREE.Mesh(pictureGeometry, pictureMaterial);
        picture.position.z = 0.06;
        frameGroup.add(picture);
        
        frameGroup.position.set(position.x, position.y, position.z);
        frameGroup.rotation.y = rotation;
        
        if (!imageUrl && artworkInfo) {
            if (!artworks.some(function(a) { return a.frame === frameGroup; })) {
                frameGroup.userData.artworkInfo = artworkInfo;
                frameGroup.userData.isArtwork = true;
                frameGroup.userData.hasKey = false;
                artworks.push({ frame: frameGroup, position: position, info: artworkInfo });
            }
            if (parentGroup && !frameGroup.parent) parentGroup.add(frameGroup);
        }
        
        return frameGroup;
    }

    // 벽에 그림 배치 (가로형 6.5x6.5, 세로형 5.5x7.5)
    const pictureY = 5; // 벽 중앙 높이 (wallHeight / 2 = 10 / 2 = 5)
    const pictureOffset = 0.01; // 벽에 완전히 붙이기 (프레임 두께 고려 최소값)
    
    // 작품 정보 샘플 데이터
    const artworkTitles = [
        "밤하늘의 별들", "도시의 빛", "자연의 선율", "추상의 세계", "시간의 흐름",
        "고요한 호수", "바람의 노래", "색채의 춤", "기억의 조각", "꿈의 여행",
        "고독한 나무", "바다의 파도", "산의 정상", "새벽의 안개", "황혼의 노을",
        "도시의 야경", "숲속의 길", "강의 흐름", "구름의 그림자", "별빛 아래",
        "가을의 낙엽", "겨울의 눈", "봄의 꽃", "여름의 햇살", "계절의 순환",
        "고요한 평원", "거친 바위", "부드러운 모래", "차가운 얼음", "따뜻한 불"
    ];
    const materials = ["유화", "아크릴", "수채화", "파스텔", "연필", "목탄", "잉크", "혼합재료"];
    const sizes = ["50x70cm", "60x80cm", "70x90cm", "80x100cm", "90x120cm", "100x150cm"];
    const years = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
    const descriptions = [
        "작가의 내면 세계를 표현한 추상 작품입니다.",
        "자연의 아름다움을 담은 풍경화입니다.",
        "도시의 일상을 관찰한 작품입니다.",
        "감정의 흐름을 시각화한 표현주의 작품입니다.",
        "시간과 공간의 개념을 탐구한 작품입니다.",
        "색채의 조화를 통해 감성을 전달하는 작품입니다.",
        "빛과 그림자의 대비를 활용한 작품입니다.",
        "형태와 공간의 관계를 탐구한 작품입니다.",
        "기억과 상상의 경계를 넘나드는 작품입니다.",
        "일상 속에서 발견한 아름다움을 담은 작품입니다."
    ];
    
    // 24점: 벽 중간에만 배치. 모서리·벽과 벽 만나는 곳(끝) 피해서 공중에 안 떠 있고 잘리지 않게.
    const imageFiles = ['1.jpg', '2.jpg', '3.jpg', '4.jpg', '5.jpeg', '6.jpg', '7.png', '8.jpg', '9.jpg', '10.jpg', '11.jpg', '12.jpg', '13.jpg', '14.jpg', '15.jpg', '16.jpg', '17.jpg', '18.jpg', '19.jpg', '20.jpg', '21.jpg', '22.jpg', '23.jpg', '24.jpg'];
    const portraitIndices = [2, 4, 6, 8, 20, 22, 23]; // 3.jpg, 5.jpeg, 7.png, 9.jpg(-90°), 21.jpg, 23.jpg, 24.jpg – 세로형
    const positions = [
        { pos: { x: -halfSize - pictureOffset, y: pictureY, z: -18 }, rot: Math.PI / 2 },
        { pos: { x: -halfSize - pictureOffset, y: pictureY, z: 0 }, rot: Math.PI / 2 },
        { pos: { x: -halfSize - pictureOffset, y: pictureY, z: 25 }, rot: Math.PI / 2 },
        { pos: { x: halfSize + pictureOffset, y: pictureY, z: -25 }, rot: -Math.PI / 2 },
        { pos: { x: halfSize + pictureOffset, y: pictureY, z: 0 }, rot: -Math.PI / 2 },
        { pos: { x: halfSize + pictureOffset, y: pictureY, z: 25 }, rot: -Math.PI / 2 },
        { pos: { x: -18, y: pictureY, z: -halfSize - pictureOffset }, rot: 0 },
        { pos: { x: 0, y: pictureY, z: -halfSize - pictureOffset }, rot: 0 },
        { pos: { x: 25, y: pictureY, z: -halfSize - pictureOffset }, rot: 0 },
        { pos: { x: -25, y: pictureY, z: halfSize + pictureOffset }, rot: Math.PI },
        { pos: { x: -12, y: pictureY, z: halfSize + pictureOffset }, rot: Math.PI },
        { pos: { x: 25, y: pictureY, z: halfSize + pictureOffset }, rot: Math.PI },
        { pos: { x: -20 - pictureOffset, y: pictureY, z: -20 }, rot: -Math.PI / 2 },
        { pos: { x: -20 - pictureOffset, y: pictureY, z: 20 }, rot: Math.PI / 2 },
        { pos: { x: 20 + pictureOffset, y: pictureY, z: -20 }, rot: -Math.PI / 2 },
        { pos: { x: 20 + pictureOffset, y: pictureY, z: 20 }, rot: -Math.PI / 2 },
        { pos: { x: -26, y: pictureY, z: -12 - pictureOffset }, rot: 0 },
        { pos: { x: -14, y: pictureY, z: -12 - pictureOffset }, rot: 0 },
        { pos: { x: 14, y: pictureY, z: -12 - pictureOffset }, rot: 0 },
        { pos: { x: 26, y: pictureY, z: -12 - pictureOffset }, rot: 0 },
        { pos: { x: -26, y: pictureY, z: 12 + pictureOffset }, rot: Math.PI },
        { pos: { x: -14, y: pictureY, z: 12 + pictureOffset }, rot: Math.PI },
        { pos: { x: 14, y: pictureY, z: 12 + pictureOffset }, rot: Math.PI },
        { pos: { x: 26, y: pictureY, z: 12 + pictureOffset }, rot: Math.PI }
    ];
    const pictureSizeLandscape = 8;
    const pictureHeightLandscape = 5.5;
    const pictureSizePortrait = 5.5;
    const pictureHeightPortrait = 7.5;
    const totalFrames = positions.length; // 33 (24 + 빈벽 9곳)
    for (let i = 0; i < totalFrames; i++) {
        const p = positions[i];
        const imgIndex = i % 24;
        const isPortrait = portraitIndices.includes(imgIndex);
        const picW = isPortrait ? pictureSizePortrait : pictureSizeLandscape;
        const picH = isPortrait ? pictureHeightPortrait : pictureHeightLandscape;
        const imageUrl = imageFiles[imgIndex];
        const info = createArtworkInfo(
            artworkTitles[i % artworkTitles.length],
            materials[i % materials.length],
            sizes[i % sizes.length],
            years[i % years.length],
            descriptions[i % descriptions.length]
        );
        createPictureFrame(picW, picH, p.pos, p.rot, imageUrl, info, galleryGroup, i);
    }

    function dedupArtworks() {
        var seen = [];
        for (var s = artworks.length - 1; s >= 0; s--) {
            var fr = artworks[s].frame;
            if (!fr || seen.indexOf(fr) !== -1) {
                artworks.splice(s, 1);
                if (fr && fr.parent) fr.parent.remove(fr);
            } else {
                seen.push(fr);
            }
        }
        var seenPos = [];
        for (var s2 = artworks.length - 1; s2 >= 0; s2--) {
            var a = artworks[s2];
            var posKey = a.position.x.toFixed(2) + ',' + a.position.y.toFixed(2) + ',' + a.position.z.toFixed(2);
            if (seenPos.indexOf(posKey) !== -1) {
                if (a.frame.parent) a.frame.parent.remove(a.frame);
                artworks.splice(s2, 1);
            } else seenPos.push(posKey);
        }
        var seenTitle = [];
        for (var s3 = artworks.length - 1; s3 >= 0; s3--) {
            var t = artworks[s3].info && artworks[s3].info.title;
            if (t && seenTitle.indexOf(t) !== -1) {
                if (artworks[s3].frame.parent) artworks[s3].frame.parent.remove(artworks[s3].frame);
                artworks.splice(s3, 1);
            } else if (t) seenTitle.push(t);
        }
        var seenSlot = [];
        for (var s4 = artworks.length - 1; s4 >= 0; s4--) {
            var slot = artworks[s4].frame && artworks[s4].frame.userData.slotIndex;
            if (typeof slot === 'number' && seenSlot.indexOf(slot) !== -1) {
                if (artworks[s4].frame.parent) artworks[s4].frame.parent.remove(artworks[s4].frame);
                artworks.splice(s4, 1);
            } else if (typeof slot === 'number') seenSlot.push(slot);
        }
    }
    dedupArtworks();
    setTimeout(dedupArtworks, 2500);

    return galleryGroup;
}

// 미술관 생성 및 씬에 추가
const gallery = createGallery();
scene.add(gallery);

// 리스폰 지역 표시 (시작 지점)
const respawnMarker = new THREE.Group();
const respawnGeometry = new THREE.CylinderGeometry(1.5, 1.5, 0.1, 16);
const respawnMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x00ff00,
    emissive: 0x00ff00,
    emissiveIntensity: 0.3,
    transparent: true,
    opacity: 0.5
});
const respawnMesh = new THREE.Mesh(respawnGeometry, respawnMaterial);
respawnMesh.rotation.x = -Math.PI / 2;
respawnMesh.position.y = 0.05;
respawnMarker.add(respawnMesh);

// 리스폰 지역 조명
const respawnLight = new THREE.PointLight(0x00ff00, 2, 5);
respawnLight.position.set(0, 2, 0);
respawnMarker.add(respawnLight);

// 리스폰 안내판 (출구 안내판처럼) - 북쪽 벽에 배치
// 리스폰 위치 (-32, 0, -32), 북쪽 벽 z = -35
const respawnSignGeometry = new THREE.PlaneGeometry(1.5, 0.8);
const respawnSignMaterial = new THREE.MeshStandardMaterial({
    color: 0x00ff00,
    emissive: 0x00ff00,
    emissiveIntensity: 0.8,
    side: THREE.DoubleSide
});
const respawnSign = new THREE.Mesh(respawnSignGeometry, respawnSignMaterial);
respawnSign.position.set(0, 4, -3 + 0.11); // 리스폰 마커 기준으로 북쪽 벽 방향 (z = -25에서 -22까지 거리 3)
respawnSign.rotation.y = 0; // 북쪽 벽에 평행하게 (z = -25)
respawnMarker.add(respawnSign);

// "RESPAWN" 텍스트를 위한 스프라이트
const respawnTextCanvas = document.createElement('canvas');
respawnTextCanvas.width = 256;
respawnTextCanvas.height = 128;
const respawnTextContext = respawnTextCanvas.getContext('2d');
respawnTextContext.fillStyle = '#ffffff';
respawnTextContext.font = 'bold 50px Arial';
respawnTextContext.textAlign = 'center';
respawnTextContext.textBaseline = 'middle';
respawnTextContext.fillText('RESPAWN', 128, 64);
const respawnTextTexture = new THREE.CanvasTexture(respawnTextCanvas);
respawnTextTexture.needsUpdate = true;

const respawnTextMaterial = new THREE.MeshStandardMaterial({
    map: respawnTextTexture,
    transparent: true,
    emissive: 0xffffff,
    emissiveIntensity: 0.5
});
const respawnText = new THREE.Mesh(respawnSignGeometry, respawnTextMaterial);
respawnText.position.set(0, 4, -3 + 0.12); // 리스폰 마커 기준으로 북쪽 벽 방향
respawnText.rotation.y = 0; // 북쪽 벽에 평행하게
respawnMarker.add(respawnText);

respawnMarker.position.set(-32, 0, -32);
scene.add(respawnMarker);

// 열쇠 보유 작품 배열
const keyArtworks = [];
// 열쇠 인벤토리
const keys = [];
let keyNotificationTimeout = null;

var _sharedStarTexture = null;
function getStarTexture() {
    if (!_sharedStarTexture) {
        var c = document.createElement('canvas');
        c.width = 64;
        c.height = 64;
        var ctx = c.getContext('2d');
        ctx.clearRect(0, 0, 64, 64);
        var g = ctx.createRadialGradient(32, 32, 0, 32, 32, 28);
        g.addColorStop(0, 'rgba(255, 220, 100, 0.55)');
        g.addColorStop(0.5, 'rgba(255, 200, 60, 0.3)');
        g.addColorStop(1, 'rgba(255, 180, 20, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 64, 64);
        ctx.fillStyle = 'rgba(255, 210, 80, 0.7)';
        ctx.font = 'bold 36px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('*', 32, 32);
        _sharedStarTexture = new THREE.CanvasTexture(c);
        _sharedStarTexture.needsUpdate = true;
    }
    return _sharedStarTexture;
}
function createSparkleGroupForKey() {
    var g = new THREE.Group();
    var n = 4;
    var tex = getStarTexture();
    for (var j = 0; j < n; j++) {
        var mat = new THREE.SpriteMaterial({ map: tex, color: 0xffdd44, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending });
        var s = new THREE.Sprite(mat);
        s.scale.set(0.38, 0.38, 1);
        var a = (Math.PI * 2 / n) * j;
        s.position.set(Math.cos(a) * 3.2, Math.sin(a * 0.5) * 2 + 0.5, Math.sin(a) * 3.2);
        s.userData.phase = (j / n) * Math.PI * 2;
        g.add(s);
    }
    var light = new THREE.PointLight(0xffcc44, 0, 5, 1.8);
    light.position.set(0, 0, 1.5);
    g.add(light);
    return { group: g, keyLight: light };
}
function applyKeyFrameGlow(frameGroup) {
    for (let k = 0; k < 4; k++) {
        const mesh = frameGroup.children[k];
        if (mesh && mesh.isMesh && mesh.material) {
            if (mesh.material.dispose) mesh.material.dispose();
            mesh.material = new THREE.MeshStandardMaterial({
                color: 0x332210,
                emissive: 0xffbb22,
                emissiveIntensity: 0.42,
                side: THREE.FrontSide
            });
        }
    }
}

// 열쇠 작품 액자 테두리 원래 재질로 복원
function removeKeyFrameGlow(frameGroup) {
    for (let k = 0; k < 4; k++) {
        const mesh = frameGroup.children[k];
        if (mesh && mesh.isMesh && mesh.material && mesh.material.emissiveIntensity !== undefined) {
            mesh.material.dispose();
            mesh.material = new THREE.MeshBasicMaterial({ color: 0x1a1a1a, side: THREE.FrontSide });
        }
    }
}

function assignKeysToArtworks() {
    // 씬에 실제로 있는 작품만 열쇠 대상 (이미지 로드 실패로 프레임이 없는 경우 제외)
    var inScene = artworks.filter(function(a) { return a.frame && a.frame.parent; });
    if (inScene.length < 5) return;
    var shuffled = inScene.slice().sort(function() { return Math.random() - 0.5; });
    var n = Math.min(5, shuffled.length);
    for (var i = 0; i < n; i++) {
        shuffled[i].frame.userData.hasKey = true;
        keyArtworks.push(shuffled[i]);
        var o = createSparkleGroupForKey();
        shuffled[i].frame.userData.keyLight = o.keyLight;
        shuffled[i].frame.add(o.group);
        shuffled[i].frame.userData.sparkleGroup = o.group;
        applyKeyFrameGlow(shuffled[i].frame);
    }
}

// 작품 생성 후 열쇠 할당 (20개 이상 로드된 뒤 5개에 열쇠 배치, 지연으로 24점 로드 확률 증가)
let keysAssigned = false;
function tryAssignKeys() {
    if (keysAssigned) return;
    var inScene = artworks.filter(function(a) { return a.frame && a.frame.parent; });
    if (inScene.length >= 20) {
        keysAssigned = true;
        assignKeysToArtworks();
        return;
    }
    if (inScene.length >= 5) {
        // 20개 미만이어도 2.5초 후에는 5개 이상이면 할당 (열쇠 5개 보장)
        setTimeout(function() {
            if (keysAssigned) return;
            var again = artworks.filter(function(a) { return a.frame && a.frame.parent; });
            if (again.length >= 5) {
                keysAssigned = true;
                assignKeysToArtworks();
            }
        }, 2500);
    }
    setTimeout(tryAssignKeys, 500);
}
setTimeout(tryAssignKeys, 2000);

// 출구 생성
createExit();

// 미술관 경비원 (무섭게, 명찰 SECURITY, 손전등 소지)
function createMonster() {
    var guardGroup = new THREE.Group();
    var seg = 10;
    var segLow = 8;
    var uniformColor = 0x0a0a12;
    var uniformMaterial = new THREE.MeshStandardMaterial({ 
        color: uniformColor,
        roughness: 0.6,
        metalness: 0.05
    });
    
    var bodyGeometry = new THREE.CylinderGeometry(0.32, 0.38, 1.05, segLow);
    var body = new THREE.Mesh(bodyGeometry, uniformMaterial);
    body.position.y = 0.52;
    guardGroup.add(body);
    
    var collarMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8, metalness: 0 });
    var collar = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.12, segLow), collarMat);
    collar.position.y = 1.02;
    guardGroup.add(collar);
    
    var headGeometry = new THREE.SphereGeometry(0.28, seg, seg - 4);
    var headMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x3d2c29,
        roughness: 0.9,
        metalness: 0
    });
    var head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 1.22;
    guardGroup.add(head);
    
    var hatColor = 0x050508;
    var hatMat = new THREE.MeshStandardMaterial({ color: hatColor, roughness: 0.5, metalness: 0.15 });
    var hat = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.12, segLow), hatMat);
    hat.position.y = 1.52;
    guardGroup.add(hat);
    var brim = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.03, segLow), hatMat);
    brim.position.y = 1.44;
    guardGroup.add(brim);
    
    // 명찰: 넥타이와 겹치지 않게 작게, 가슴 왼쪽 위에만
    var badgeCanvas = document.createElement('canvas');
    badgeCanvas.width = 256;
    badgeCanvas.height = 128;
    var ctx = badgeCanvas.getContext('2d');
    ctx.fillStyle = '#0d0d12';
    ctx.fillRect(0, 0, 256, 128);
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, 248, 120);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SECURITY', 128, 64);
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;
    ctx.strokeText('SECURITY', 128, 64);
    var badgeTexture = new THREE.CanvasTexture(badgeCanvas);
    badgeTexture.needsUpdate = true;
    var badgeMat = new THREE.MeshStandardMaterial({ 
        map: badgeTexture,
        color: 0xffffff,
        roughness: 0.2,
        metalness: 0.5,
        emissive: 0x334466,
        emissiveIntensity: 0.28,
        side: THREE.DoubleSide
    });
    var badgeGeo = new THREE.PlaneGeometry(0.2, 0.1);
    var badge = new THREE.Mesh(badgeGeo, badgeMat);
    badge.position.set(0.2, 0.84, 0.44);
    badge.rotation.y = -0.1;
    guardGroup.add(badge);
    
    // 넥타이: 가운데, 명찰 아래로만 내려오게
    var tieMat = new THREE.MeshStandardMaterial({ color: 0x1a0505, roughness: 0.6, metalness: 0.1, emissive: 0x220808, emissiveIntensity: 0.08 });
    var tieKnot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.06), tieMat);
    tieKnot.position.set(0, 0.88, 0.48);
    guardGroup.add(tieKnot);
    var tieBody = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.08, 0.45, 6),
        tieMat
    );
    tieBody.position.set(0, 0.58, 0.5);
    tieBody.rotation.x = 0.15;
    guardGroup.add(tieBody);
    
    var eyeColor = 0xcc0000;
    var eyeMat = new THREE.MeshStandardMaterial({ color: eyeColor, emissive: eyeColor, emissiveIntensity: 0.5 });
    var eyeGeometry = new THREE.SphereGeometry(0.035, 6, 4);
    var leftEye = new THREE.Mesh(eyeGeometry, eyeMat);
    leftEye.position.set(-0.09, 1.24, 0.26);
    guardGroup.add(leftEye);
    var rightEye = new THREE.Mesh(eyeGeometry, eyeMat);
    rightEye.position.set(0.09, 1.24, 0.26);
    guardGroup.add(rightEye);
    
    // 콧수염 (코 아래, 왼쪽·오른쪽)
    var mustacheMat = new THREE.MeshStandardMaterial({ color: 0x2a1810, roughness: 0.9, metalness: 0 });
    var mustacheGeo = new THREE.BoxGeometry(0.08, 0.02, 0.04);
    var leftMustache = new THREE.Mesh(mustacheGeo, mustacheMat);
    leftMustache.position.set(-0.06, 1.12, 0.27);
    leftMustache.rotation.z = 0.15;
    guardGroup.add(leftMustache);
    var rightMustache = new THREE.Mesh(mustacheGeo, mustacheMat);
    rightMustache.position.set(0.06, 1.12, 0.27);
    rightMustache.rotation.z = -0.15;
    guardGroup.add(rightMustache);
    
    var armGeometry = new THREE.CylinderGeometry(0.07, 0.09, 0.48, segLow);
    var leftArm = new THREE.Mesh(armGeometry, uniformMaterial);
    leftArm.position.set(-0.38, 0.72, 0);
    leftArm.rotation.z = 0.15;
    guardGroup.add(leftArm);
    
    var rightArmGroup = new THREE.Group();
    rightArmGroup.position.set(0.38, 0.72, 0);
    rightArmGroup.rotation.z = -0.15;
    rightArmGroup.rotation.x = -0.2;
    var rightArm = new THREE.Mesh(armGeometry, uniformMaterial);
    rightArmGroup.add(rightArm);
    var flashlightGroup = new THREE.Group();
    flashlightGroup.position.set(0.32, 0.05, 0.22);
    var flashBody = new THREE.Mesh(
        new THREE.CylinderGeometry(0.065, 0.07, 0.28, 8),
        new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.85, roughness: 0.25 })
    );
    flashBody.rotation.z = Math.PI / 2;
    flashlightGroup.add(flashBody);
    var flashLens = new THREE.Mesh(
        new THREE.CylinderGeometry(0.075, 0.075, 0.04, 8),
        new THREE.MeshStandardMaterial({ color: 0x555555, emissive: 0x444444, emissiveIntensity: 0.4 })
    );
    flashLens.rotation.z = Math.PI / 2;
    flashLens.position.x = 0.16;
    flashlightGroup.add(flashLens);
    rightArmGroup.add(flashlightGroup);
    guardGroup.add(rightArmGroup);
    
    var guardLight = new THREE.PointLight(0xffeedd, 0.4, 8, 1.5);
    guardLight.position.set(0.35, 0.75, 0.5);
    guardGroup.add(guardLight);
    guardGroup.userData.guardLight = guardLight;
    
    var legGeometry = new THREE.CylinderGeometry(0.11, 0.13, 0.58, segLow);
    var legMaterial = new THREE.MeshStandardMaterial({ color: 0x08080c, roughness: 0.6, metalness: 0.05 });
    var leftLeg = new THREE.Mesh(legGeometry, legMaterial);
    leftLeg.position.set(-0.14, -0.28, 0);
    guardGroup.add(leftLeg);
    var rightLeg = new THREE.Mesh(legGeometry, legMaterial);
    rightLeg.position.set(0.14, -0.28, 0);
    guardGroup.add(rightLeg);
    
    return guardGroup;
}

// 몬스터 배열
const monsters = [];

// 경비원별 순찰 구역 (넓게 잡아 난이도 완화, 약간 겹침 허용)
const monsterZones = [
    { minX: -34, maxX: 34, minZ: -34, maxZ: -6 },  // 북쪽 구역 (넓게)
    { minX: -34, maxX: 34, minZ: -14, maxZ: 14 },  // 중앙 구역 (넓게)
    { minX: -34, maxX: 34, minZ: 8, maxZ: 33 }    // 남쪽 구역 (출구 앞 제외)
];

function randomPositionInZone(zone, radius) {
    const r = radius || 0.5;
    for (let tryCount = 0; tryCount < 30; tryCount++) {
        const x = zone.minX + Math.random() * (zone.maxX - zone.minX);
        const z = zone.minZ + Math.random() * (zone.maxZ - zone.minZ);
        const pos = new THREE.Vector3(x, 0, z);
        if (checkMonsterCollision(pos, r)) return pos;
    }
    return new THREE.Vector3(
        (zone.minX + zone.maxX) * 0.5,
        0,
        (zone.minZ + zone.maxZ) * 0.5
    );
}

// 몬스터 초기화 (구역별로 1마리씩, 자유롭게 배회)
function initMonsters() {
    const monsterCount = 3;
    
    for (let i = 0; i < monsterCount; i++) {
        const monster = createMonster();
        const zone = monsterZones[i % monsterZones.length];
        
        const startPos = randomPositionInZone(zone);
        monster.position.copy(startPos);
        
        monster.userData = {
            state: 'wandering',
            targetPosition: new THREE.Vector3(),
            wanderTime: 0,
            speed: 2.0 + Math.random() * 0.8,
            detectionRange: 9.0,
            attackRange: 1.8,
            chaseMemory: 1.2,
            zoneMinX: zone.minX,
            zoneMaxX: zone.maxX,
            zoneMinZ: zone.minZ,
            zoneMaxZ: zone.maxZ
        };
        
        scene.add(monster);
        monsters.push(monster);
    }
}

// 몬스터 초기화
initMonsters();

// 게임오버 상태
let gameOver = false;

// 배경 음악
let backgroundMusic = null;

// 타이머 변수
let gameTimer = null;
let timeRemaining = 180; // 3분 = 180초
let timerInterval = null;

// 배경 음악 초기화
backgroundMusic = new Audio('music.mp3');
backgroundMusic.loop = true;
backgroundMusic.volume = 0.5;
backgroundMusic.preload = 'auto';

// 효과음 (출구 열림 / 열쇠 획득 / 게임 오버)
var doorSound = new Audio('door.mp3');
var getSound = new Audio('get.mp3');
var overSound = new Audio('over.mp3');
var runSound = new Audio('run.mp3');
doorSound.preload = 'auto';
getSound.preload = 'auto';
overSound.preload = 'auto';
runSound.preload = 'auto';

// 충돌 감지를 위한 정확한 벽 체크
function checkCollision(newPosition) {
    const playerRadius = 0.3; // 플레이어 반경
    const wallThickness = 0.1; // 벽 두께 여유
    
    // 외벽 충돌 체크 (벽 위치: ±35, floorSize 70)
    const outerWall = 35;
    // 서쪽 외벽은 출구 구멍이 있으므로 체크 제외 (출구 통과는 animate에서 처리)
    if (newPosition.x > outerWall - playerRadius - wallThickness) {
        return false; // 동쪽 외벽 충돌
    }
    if (newPosition.x < -outerWall + playerRadius + wallThickness) {
        return false; // 서쪽 외벽 충돌
    }
    if (newPosition.z > outerWall - playerRadius - wallThickness) {
        // 남쪽 외벽 체크 (출구 구멍 x = -1.5 ~ 1.5)
        if (newPosition.x < -1.5 - playerRadius - wallThickness || 
            newPosition.x > 1.5 + playerRadius + wallThickness) {
            return false; // 출구 구멍이 아닌 곳은 충돌
        }
        
        // 출구 문이 닫혀있으면 통과 불가
        if (exitDoor && exitDoor.userData.isLocked) {
            // 출구 문 위치: (0, 0, 35), 크기: (2, 4, 0.2)
            const exitX = exitDoor.position.x; // 0
            const exitZ = exitDoor.position.z; // 35
            const doorWidth = 1.0; // 문 폭의 절반
            const doorHeight = 2.0; // 문 높이의 절반
            
            // 플레이어가 출구 문 영역에 있는지 체크
            if (newPosition.x > exitX - doorWidth - playerRadius - wallThickness &&
                newPosition.x < exitX + doorWidth + playerRadius + wallThickness &&
                newPosition.z > exitZ - playerRadius - wallThickness &&
                newPosition.z < exitZ + playerRadius + wallThickness) {
                return false; // 닫힌 문은 통과 불가
            }
        }
    }
    if (newPosition.z < -outerWall + playerRadius + wallThickness) {
        return false; // 북쪽 외벽 충돌
    }
    
    // 미니 방 벽 충돌 체크
    const roomCenterX = -32; // -35 + 3 (floorSize 70)
    const roomCenterZ = -32;
    const roomSize = 6;
    
    // 미니 방 내부면 통과 가능
    if (newPosition.x > roomCenterX - roomSize / 2 + playerRadius + wallThickness &&
        newPosition.x < roomCenterX + roomSize / 2 - playerRadius - wallThickness &&
        newPosition.z > roomCenterZ - roomSize / 2 + playerRadius + wallThickness &&
        newPosition.z < roomCenterZ + roomSize / 2 - playerRadius - wallThickness) {
        // 미니 방 내부는 통과 가능
        return true;
    }
    
    // 미니 방 남쪽 벽 (문이 있는 벽) - 문 통과 허용
    if (Math.abs(newPosition.z - (roomCenterZ + roomSize / 2)) < playerRadius + wallThickness) {
        if (newPosition.x > roomCenterX - 1.5 && newPosition.x < roomCenterX + 1.5) {
            return true; // 문은 통과 가능
        }
        if (newPosition.x > roomCenterX - roomSize / 2 - playerRadius - wallThickness &&
            newPosition.x < roomCenterX + roomSize / 2 + playerRadius + wallThickness) {
            return false; // 문 외부 벽은 충돌
        }
    }
    
    // 미니 방 다른 벽들
    if (Math.abs(newPosition.x - (roomCenterX - roomSize / 2)) < playerRadius + wallThickness) {
        if (newPosition.z > roomCenterZ - roomSize / 2 - playerRadius - wallThickness &&
            newPosition.z < roomCenterZ + roomSize / 2 + playerRadius + wallThickness) {
            return false; // 서쪽 벽 충돌
        }
    }
    if (Math.abs(newPosition.x - (roomCenterX + roomSize / 2)) < playerRadius + wallThickness) {
        if (newPosition.z > roomCenterZ - roomSize / 2 - playerRadius - wallThickness &&
            newPosition.z < roomCenterZ + roomSize / 2 + playerRadius + wallThickness) {
            return false; // 동쪽 벽 충돌
        }
    }
    if (Math.abs(newPosition.z - (roomCenterZ - roomSize / 2)) < playerRadius + wallThickness) {
        if (newPosition.x > roomCenterX - roomSize / 2 - playerRadius - wallThickness &&
            newPosition.x < roomCenterX + roomSize / 2 + playerRadius + wallThickness) {
            return false; // 북쪽 벽 충돌
        }
    }
    
    // 좌측 전시 공간 벽들 (x = -20, 길이 38)
    if (Math.abs(newPosition.x - (-20)) < playerRadius + wallThickness) {
        if (newPosition.z > -29 - playerRadius - wallThickness && newPosition.z < -1 + playerRadius + wallThickness) return false;
        if (newPosition.z > 1 - playerRadius - wallThickness && newPosition.z < 29 + playerRadius + wallThickness) return false;
    }
    // 우측 전시 공간 벽들 (x = 20)
    if (Math.abs(newPosition.x - 20) < playerRadius + wallThickness) {
        if (newPosition.z > -29 - playerRadius - wallThickness && newPosition.z < -1 + playerRadius + wallThickness) return false;
        if (newPosition.z > 1 - playerRadius - wallThickness && newPosition.z < 29 + playerRadius + wallThickness) return false;
    }
    
    // 방 3개 구분 내벽 (가로: z = -12, z = 12, 통로 x = -8~8)
    const roomWallGap = 8;
    if (Math.abs(newPosition.z - (-12)) < playerRadius + wallThickness) {
        if (newPosition.x < -roomWallGap - playerRadius - wallThickness || newPosition.x > roomWallGap + playerRadius + wallThickness) return false;
    }
    if (Math.abs(newPosition.z - 12) < playerRadius + wallThickness) {
        if (newPosition.x < -roomWallGap - playerRadius - wallThickness || newPosition.x > roomWallGap + playerRadius + wallThickness) return false;
    }

    return true; // 충돌 없음
}

// 애니메이션 루프
function animate() {
    requestAnimationFrame(animate);

    const time = performance.now();
    
    // delta 변수를 함수 시작 부분에서 정의 (모든 곳에서 사용 가능하도록)
    const delta = prevTime ? (time - prevTime) / 1000 : 0.016; // 초기 프레임은 60fps 가정
    
    const canvas = getCanvas();
    const lockedElement = document.pointerLockElement || 
                         document.mozPointerLockElement || 
                         document.webkitPointerLockElement;
    
    if (lockedElement === canvas || lockedElement === document.body) {

        // 마찰 적용 (이동 중일 때만)
        if (!isMoving) {
            velocity.x *= Math.pow(0.1, delta * 10.0);
            velocity.z *= Math.pow(0.1, delta * 10.0);
        }
        velocity.y -= 9.8 * 100.0 * delta; // 중력

        // 카메라 방향에 맞춰 이동 방향 계산 (매우 정확하게)
        // 먼저 Z축 회전을 제거하여 안정적인 상태로 만들기
        euler.setFromQuaternion(camera.quaternion, 'YXZ');
        euler.z = 0;
        
        _horizontalEuler.set(0, euler.y, 0, 'XYZ');
        _horizontalQuat.setFromEuler(_horizontalEuler);
        _forward.set(0, 0, -1).applyQuaternion(_horizontalQuat).setY(0);
        if (_forward.length() > 0.001) _forward.normalize();
        _right.set(1, 0, 0).applyQuaternion(_horizontalQuat).setY(0);
        if (_right.length() > 0.001) _right.normalize();
        
        // 카메라의 실제 quaternion은 Z축 회전 제거 후 적용 (YXZ 순서)
        camera.quaternion.setFromEuler(euler, 'YXZ');
        camera.quaternion.normalize();
        
        // 카메라의 월드 행렬을 업데이트하여 최신 상태 반영
        camera.updateMatrixWorld(true);
        
        if (moveForward) _moveDir.add(_forward);
        if (moveBackward) _moveDir.sub(_forward);
        if (moveLeft) _moveDir.sub(_right);
        if (moveRight) _moveDir.add(_right);
        _moveDir.y = 0;
        const moveLength = _moveDir.length();
        
        // 이동 상태 확인
        isMoving = moveForward || moveBackward || moveLeft || moveRight;
        
        if (isMoving && moveLength > 0.001) {
            _moveDir.normalize();
            const targetSpeed = 10.0;
            const acceleration = 8.0;
            const targetVelocityX = _moveDir.x * targetSpeed;
            const targetVelocityZ = _moveDir.z * targetSpeed;
            
            // 부드러운 가속/감속 적용
            velocity.x += (targetVelocityX - velocity.x) * acceleration * delta;
            velocity.z += (targetVelocityZ - velocity.z) * acceleration * delta;
        } else if (!isMoving) {
            // 이동하지 않을 때는 부드럽게 감속
            const deceleration = 10.0;
            velocity.x *= Math.pow(0.1, delta * deceleration);
            velocity.z *= Math.pow(0.1, delta * deceleration);
            
            // 거의 멈췄으면 완전히 0으로
            if (Math.abs(velocity.x) < 0.01) velocity.x = 0;
            if (Math.abs(velocity.z) < 0.01) velocity.z = 0;
        }

        // 충돌 체크 후 위치 업데이트
        const newPosition = camera.position.clone();
        newPosition.x += velocity.x * delta;
        newPosition.z += velocity.z * delta;
        
        if (checkCollision(newPosition)) {
            camera.position.x = newPosition.x;
            camera.position.z = newPosition.z;
            
            // 출구 통과 체크 (남쪽 외벽을 통과하면 클리어)
            if (camera.position.z > 35 && !gameOver && exitDoor && !exitDoor.userData.isLocked) {
                triggerGameClear();
            }
        } else {
            velocity.x = 0;
            velocity.z = 0;
        }

        // 바닥 체크
        if (camera.position.y < 1.6) {
            velocity.y = 0;
            camera.position.y = 1.6;
        }

        if (camera.position.y > 1.6) {
            camera.position.y += velocity.y * delta;
        }
        
        // 보행 애니메이션
        if (isMoving) {
            walkCycle += delta * 8; // 보행 속도
            // 카메라 위아래 흔들림 (보행 효과) - Y축 위치만 변경
            const bobAmount = Math.sin(walkCycle * Math.PI) * 0.03;
            camera.position.y = baseCameraY + bobAmount;
        } else {
            walkCycle = 0;
            camera.position.y = baseCameraY;
        }
        
        // Z축 회전 항상 초기화 (뒤집힘 방지) - 매 프레임마다 강제로 0으로 설정
        // YXZ 순서로 변환하여 안정성 향상
        euler.setFromQuaternion(camera.quaternion, 'YXZ');
        
        // Z축 회전을 완전히 제거하고 X, Y축만 유지
        euler.z = 0;
        
        // X축 회전도 안전 범위 내로 제한 (추가 안전장치) - 위아래 모두 볼 수 있도록
        const maxVerticalAngle = 1.2; // 아래를 볼 수 있음 (약 69도)
        const minVerticalAngle = -1.57; // 위를 볼 수 있는 최대 각도 (거의 수직까지 가능, 약 -90도)
        if (euler.x > maxVerticalAngle) {
            euler.x = maxVerticalAngle; // 아래로 못 보게 제한
        } else if (euler.x < minVerticalAngle) {
            euler.x = minVerticalAngle; // 위로 너무 많이 못 보게 제한
        }
        
        // YXZ 순서로 quaternion 변환
        camera.quaternion.setFromEuler(euler, 'YXZ');
        
        // quaternion 정규화
        camera.quaternion.normalize();
        
        _checkEuler.setFromQuaternion(camera.quaternion, 'YXZ');
        if (Math.abs(_checkEuler.z) > 0.00001 || _checkEuler.x > maxVerticalAngle || _checkEuler.x < minVerticalAngle) {
            _checkEuler.z = 0;
            if (_checkEuler.x > maxVerticalAngle) _checkEuler.x = maxVerticalAngle;
            else if (_checkEuler.x < minVerticalAngle) _checkEuler.x = minVerticalAngle;
            camera.quaternion.setFromEuler(_checkEuler, 'YXZ');
            camera.quaternion.normalize();
            _checkEuler.setFromQuaternion(camera.quaternion, 'YXZ');
            if (Math.abs(_checkEuler.z) > 0.00001) {
                _checkEuler.z = 0;
                if (_checkEuler.x > maxVerticalAngle) _checkEuler.x = maxVerticalAngle;
                else if (_checkEuler.x < minVerticalAngle) _checkEuler.x = minVerticalAngle;
                camera.quaternion.setFromEuler(_checkEuler, 'YXZ');
                camera.quaternion.normalize();
            }
        }
        
        // 카메라의 월드 행렬 업데이트 (다른 계산을 위해)
        camera.updateMatrixWorld(true);
    }
    
    camera.updateMatrixWorld(true);
    camera.getWorldPosition(_cameraWorldPos);
    _flashlightOffset.set(0.3, -0.2, -0.1).applyQuaternion(camera.quaternion);
    _flashlightPos.copy(_cameraWorldPos).add(_flashlightOffset);
    
    // 조명 위치 설정 (카메라에 추가된 경우 로컬 위치 사용)
    // 카메라에 추가된 조명은 자동으로 카메라를 따라가므로 위치 업데이트 불필요
    // 하지만 타겟 설정을 위해 flashlightPos는 유지
    
    if (!flashlightOn) {
        flashlightLight.intensity = 0;
        flashlightLight.power = 0;
        flashlightLight.visible = false;
        flashlightPointLight.intensity = 0;
        flashlightPointLight.visible = false;
    } else {
        flashlightLight.intensity = 1.5;
        flashlightLight.power = 4;
        flashlightLight.visible = true;
        flashlightLight.enabled = true;
        flashlightPointLight.intensity = 0.8;
        flashlightPointLight.visible = true;
        flashlightPointLight.enabled = true;
    }
    flashlightLight.position.copy(_flashlightPos);
    flashlightPointLight.position.copy(_flashlightPos);
    camera.getWorldDirection(_cameraDir);
    _targetPos.copy(_flashlightPos).addScaledVector(_cameraDir, 100);
    flashlightLight.target.position.copy(_targetPos);
    
        if (Math.floor(time * 12) % 5 === 0) {
            var at = time * 0.001;
            for (var ki = 0; ki < keyArtworks.length; ki++) {
                var kw2 = keyArtworks[ki];
                if (!kw2.frame.userData.hasKey || !kw2.frame.userData.sparkleGroup) continue;
                var sg = kw2.frame.userData.sparkleGroup;
                var li = 0, sc = 0;
                for (var ci = 0; ci < sg.children.length; ci++) {
                    var sp = sg.children[ci];
                    if (!sp.isSprite || !sp.material) continue;
                    sc++;
                    var ph = sp.userData.phase + at * 2.2;
                    var sv = Math.sin(ph);
                    var op = 0.2 + (sv > 0 ? sv * sv * 0.32 : 0);
                    sp.material.opacity = op > 0.55 ? 0.55 : op;
                    var scl = 0.22 + op * 0.18;
                    sp.scale.set(scl, scl, 1);
                    li += op;
                }
                var kl = kw2.frame.userData.keyLight;
                if (kl && sc > 0) kl.intensity = 0.25 + (li / sc) * 0.7;
            }
            var near = findNearestArtwork();
            var pe = document.getElementById('artworkPrompt');
            var dg = document.getElementById('artworkDialog');
            if (near && pe && (!dg || dg.classList.contains('hidden')) && near.frame) {
                try {
                    near.frame.getWorldPosition(_artworkWorldPos);
                    _artworkWorldPos.y += 1.5;
                    camera.updateMatrixWorld(true);
                    _projectVector.copy(_artworkWorldPos).project(camera);
                    var px = (_projectVector.x * 0.5 + 0.5) * window.innerWidth;
                    var py = (-_projectVector.y * 0.5 + 0.5) * window.innerHeight;
                    if (_projectVector.z < 1 && isFinite(px) && isFinite(py) && px >= -500 && px <= window.innerWidth + 500 && py >= -500 && py <= window.innerHeight + 500) {
                        pe.style.left = px + 'px';
                        pe.style.top = py + 'px';
                        pe.classList.remove('hidden');
                    } else pe.classList.add('hidden');
                } catch (e) { pe.classList.add('hidden'); }
            } else if (pe) pe.classList.add('hidden');
        }

    // 몬스터 AI 업데이트
    if (!gameOver) {
        updateMonsters(delta);
    }
    
    prevTime = time;
    renderer.render(scene, camera);
}

// 경비원 벽 충돌 체크 함수
function checkMonsterCollision(newPosition, radius) {
    const wallThickness = 0.8; // 충돌 감지 여유 공간 더 증가
    const outerWall = 35; // floorSize 70
    
    // 외벽 충돌 체크 (더 엄격하게 - >, < 사용)
    // 동쪽 외벽 (x = 35)
    if (newPosition.x > outerWall - radius - wallThickness) {
        return false;
    }
    // 서쪽 외벽 (x = -25)
    if (newPosition.x < -outerWall + radius + wallThickness) {
        return false;
    }
    // 북쪽 외벽 (z = -25)
    if (newPosition.z < -outerWall + radius + wallThickness) {
        return false;
    }
    // 남쪽 외벽 (z = 25) - 출구 구멍 체크
    if (newPosition.z > outerWall - radius - wallThickness) {
        // 출구 구멍 체크 (x = -1.5 ~ 1.5)
        if (newPosition.x <= -1.5 - radius - wallThickness || newPosition.x >= 1.5 + radius + wallThickness) {
            return false; // 출구 구멍이 아닌 곳은 충돌
        }
    }
    
    // 미니 방 벽 충돌 체크
    const roomCenterX = -32;
    const roomCenterZ = -32;
    const roomSize = 6;
    const halfRoom = roomSize / 2;
    
    // 미니 방 내부인지 확인
    const isInsideRoom = newPosition.x > roomCenterX - halfRoom + radius + wallThickness &&
                         newPosition.x < roomCenterX + halfRoom - radius - wallThickness &&
                         newPosition.z > roomCenterZ - halfRoom + radius + wallThickness &&
                         newPosition.z < roomCenterZ + halfRoom - radius - wallThickness;
    
    if (isInsideRoom) {
        return true; // 미니 방 내부는 통과 가능
    }
    
    // 미니 방 벽 충돌 체크 (더 엄격하게)
    // 서쪽 벽 (x = -25)
    if (newPosition.x > roomCenterX - halfRoom - radius - wallThickness &&
        newPosition.x < roomCenterX - halfRoom + radius + wallThickness) {
        if (newPosition.z > roomCenterZ - halfRoom - radius - wallThickness &&
            newPosition.z < roomCenterZ + halfRoom + radius + wallThickness) {
            return false;
        }
    }
    // 동쪽 벽 (x = -19)
    if (newPosition.x > roomCenterX + halfRoom - radius - wallThickness &&
        newPosition.x < roomCenterX + halfRoom + radius + wallThickness) {
        if (newPosition.z > roomCenterZ - halfRoom - radius - wallThickness &&
            newPosition.z < roomCenterZ + halfRoom + radius + wallThickness) {
            return false;
        }
    }
    // 북쪽 벽 (z = -25)
    if (newPosition.z > roomCenterZ - halfRoom - radius - wallThickness &&
        newPosition.z < roomCenterZ - halfRoom + radius + wallThickness) {
        if (newPosition.x > roomCenterX - halfRoom - radius - wallThickness &&
            newPosition.x < roomCenterX + halfRoom + radius + wallThickness) {
            return false;
        }
    }
    // 남쪽 벽 (z = -19) - 문이 있는 벽
    if (newPosition.z > roomCenterZ + halfRoom - radius - wallThickness &&
        newPosition.z < roomCenterZ + halfRoom + radius + wallThickness) {
        // 문 구멍 체크 (x = -23 ~ -21)
        if (newPosition.x <= roomCenterX - 1.5 - radius - wallThickness ||
            newPosition.x >= roomCenterX + 1.5 + radius + wallThickness) {
            if (newPosition.x > roomCenterX - halfRoom - radius - wallThickness &&
                newPosition.x < roomCenterX + halfRoom + radius + wallThickness) {
                return false; // 문이 아닌 부분은 충돌
            }
        }
    }
    
    // 좌측 전시 공간 벽들 (x = -20)
    if (newPosition.x > -20 - radius - wallThickness && newPosition.x < -20 + radius + wallThickness) {
        if ((newPosition.z > -29 - radius - wallThickness && newPosition.z < -1 + radius + wallThickness) ||
            (newPosition.z > 1 - radius - wallThickness && newPosition.z < 29 + radius + wallThickness)) return false;
    }
    // 우측 전시 공간 벽들 (x = 20)
    if (newPosition.x > 20 - radius - wallThickness && newPosition.x < 20 + radius + wallThickness) {
        if ((newPosition.z > -29 - radius - wallThickness && newPosition.z < -1 + radius + wallThickness) ||
            (newPosition.z > 1 - radius - wallThickness && newPosition.z < 29 + radius + wallThickness)) return false;
    }
    
    // 방 3개 구분 내벽 (z = -12, z = 12, 통로 x = -8~8)
    const roomWallGap = 8;
    if (Math.abs(newPosition.z - (-12)) < radius + wallThickness) {
        if (newPosition.x < -roomWallGap - radius - wallThickness || newPosition.x > roomWallGap + radius + wallThickness) return false;
    }
    if (Math.abs(newPosition.z - 12) < radius + wallThickness) {
        if (newPosition.x < -roomWallGap - radius - wallThickness || newPosition.x > roomWallGap + radius + wallThickness) return false;
    }

    return true; // 충돌 없음
}

// 구역 내 랜덤 목표 생성 (경비원별로 자기 구역만 사용)
function randomTargetInZone(data) {
    const zMin = data.zoneMinZ != null ? data.zoneMinZ : -34;
    const zMax = data.zoneMaxZ != null ? data.zoneMaxZ : 34;
    const xMin = data.zoneMinX != null ? data.zoneMinX : -34;
    const xMax = data.zoneMaxX != null ? data.zoneMaxX : 34;
    return new THREE.Vector3(
        xMin + Math.random() * (xMax - xMin),
        0,
        zMin + Math.random() * (zMax - zMin)
    );
}

// 경비원 AI 업데이트 함수
function updateMonsters(delta) {
    const playerPos = camera.position;
    
    for (let monster of monsters) {
        if (!monster || !monster.userData) continue;
        
        const data = monster.userData;
        const monsterPos = monster.position;
        
        // 플레이어와의 거리 계산
        const distanceToPlayer = monsterPos.distanceTo(playerPos);
        
        // 플레이어 감지 범위 내에 있으면 추적 (항상 체크)
        if (distanceToPlayer < data.detectionRange) {
            if (data.state !== 'chasing') {
                data.state = 'chasing';
                data.wanderTime = 0;
            }
            data.chaseMemory = 1.2;
            
            _monsterDir.subVectors(playerPos, monsterPos).setY(0);
            const dirLength = _monsterDir.length();
            if (dirLength > 0.001) _monsterDir.normalize();
            else _monsterDir.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
            
            // 경비원 이동 (벽 충돌 체크) - 단계별로 이동하여 충돌 방지
            const moveDistance = data.speed * delta;
            const maxStep = 0.08; // 한 번에 이동할 최대 거리 (더 부드럽게)
            const steps = Math.max(1, Math.ceil(moveDistance / maxStep));
            const stepSize = moveDistance / steps;
            
            let currentPos = monsterPos.clone();
            let moved = false;
            const monsterRadius = data.radius || 0.5; // 기본 반경 0.5
            
            for (let i = 0; i < steps; i++) {
                _testPos.copy(currentPos).addScaledVector(_monsterDir, stepSize);
                if (checkMonsterCollision(_testPos, monsterRadius)) {
                    currentPos.copy(_testPos);
                    moved = true;
                } else {
                    if (distanceToPlayer < data.detectionRange * 1.5) {
                        _avoidDir.copy(_monsterDir).setX(_monsterDir.x + (Math.random() - 0.5) * 0.5).setZ(_monsterDir.z + (Math.random() - 0.5) * 0.5).setY(0).normalize();
                        _avoidPos.copy(currentPos).addScaledVector(_avoidDir, stepSize);
                        if (checkMonsterCollision(_avoidPos, monsterRadius)) {
                            currentPos.copy(_avoidPos);
                            moved = true;
                            continue;
                        }
                    }
                    break;
                }
            }
            if (moved) monster.position.copy(currentPos);
            const angle = Math.atan2(_monsterDir.x, _monsterDir.z);
            monster.rotation.y = angle;
            
            // 공격 범위 내에 있으면 게임오버
            if (distanceToPlayer < data.attackRange) {
                triggerGameOver();
                return;
            }
        } else {
            // 감지 범위 밖이고 추격 유지도 끝남 → 배회
            if (data.state === 'chasing') {
                data.state = 'wandering';
                data.wanderTime = 999;
            }
            data.wanderTime += delta;
            
            // 일정 시간마다 또는 목표에 도달했을 때 새로운 목표 위치 설정 (자기 구역 안에서만)
            if (data.wanderTime > 0.8 || monsterPos.distanceTo(data.targetPosition) < 1.0) {
                let attempts = 0;
                let validPosition = false;
                const zMin = data.zoneMinZ != null ? data.zoneMinZ : -34;
                const zMax = data.zoneMaxZ != null ? data.zoneMaxZ : 34;
                const xMin = data.zoneMinX != null ? data.zoneMinX : -34;
                const xMax = data.zoneMaxX != null ? data.zoneMaxX : 34;
                
                while (!validPosition && attempts < 25) {
                    const newTarget = randomTargetInZone(data);
                    if (newTarget.z > 34 && newTarget.x >= -1.5 && newTarget.x <= 1.5) {
                        attempts++;
                        continue;
                    }
                    if (checkMonsterCollision(newTarget, data.radius || 0.5)) {
                        data.targetPosition.copy(newTarget);
                        validPosition = true;
                    }
                    attempts++;
                }
                
                if (!validPosition) {
                    const smallAngle = Math.random() * Math.PI * 2;
                    const smallDistance = 3 + Math.random() * 5;
                    let tx = monsterPos.x + Math.cos(smallAngle) * smallDistance;
                    let tz = monsterPos.z + Math.sin(smallAngle) * smallDistance;
                    tx = Math.max(xMin, Math.min(xMax, tx));
                    tz = Math.max(zMin, Math.min(zMax, tz));
                    data.targetPosition.set(tx, 0, tz);
                }
                
                data.wanderTime = 0;
            }
            
            // 목표 위치로 이동
            const direction = new THREE.Vector3();
            direction.subVectors(data.targetPosition, monsterPos);
            direction.y = 0;
            const distance = direction.length();
            
            if (distance > 0.5) {
                direction.normalize();
                const moveDistance = data.speed * delta; // 배회 시에도 정상 속도로 이동
                const maxStep = 0.08; // 이동 단계를 약간 크게 (더 부드러운 이동)
                const steps = Math.max(1, Math.ceil(moveDistance / maxStep));
                const stepSize = moveDistance / steps;
                
                let currentPos = monsterPos.clone();
                let moved = false;
                const monsterRadius = data.radius || 0.5;
                
                for (let i = 0; i < steps; i++) {
                    const stepDirection = direction.clone().multiplyScalar(stepSize);
                    const testPosition = currentPos.clone().add(stepDirection);
                    
                    if (checkMonsterCollision(testPosition, monsterRadius)) {
                        currentPos.copy(testPosition);
                        moved = true;
                    } else {
                        // 벽에 부딪혔으면 새로운 목표 설정
                        const avoidAngle = Math.random() * Math.PI * 2;
                        const avoidDistance = 5 + Math.random() * 10;
                        data.targetPosition.set(
                            currentPos.x + Math.cos(avoidAngle) * avoidDistance,
                            0,
                            currentPos.z + Math.sin(avoidAngle) * avoidDistance
                        );
                        data.wanderTime = 0; // 즉시 새로운 목표로 변경
                        break;
                    }
                }
                
                if (moved) {
                    monster.position.copy(currentPos);
                }
                
                // 목표 방향으로 회전 (부드럽게)
                const targetAngle = Math.atan2(direction.x, direction.z);
                const currentAngle = monster.rotation.y;
                let angleDiff = targetAngle - currentAngle;
                
                // 각도 차이를 -π ~ π 범위로 정규화
                while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
                while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
                
                // 부드러운 회전
                monster.rotation.y = currentAngle + angleDiff * 0.1;
            }
        }
        
        // 몬스터가 바닥에 있도록 유지
        monster.position.y = 0.6;
    }
}

// 타이머 함수들
function startTimer() {
    // 타이머가 이미 실행 중이면 중지
    if (timerInterval) {
        clearInterval(timerInterval);
    }
    
    // 타이머 UI 표시
    const timerElement = document.getElementById('timer');
    if (timerElement) {
        timerElement.classList.remove('hidden');
    }
    
    // 타이머 업데이트 시작
    timerInterval = setInterval(updateTimer, 1000); // 1초마다 업데이트
    updateTimer(); // 즉시 한 번 업데이트
}

function updateTimer() {
    if (gameOver) {
        stopTimer();
        return;
    }
    
    const timerElement = document.getElementById('timer');
    const timerText = document.getElementById('timerText');
    
    if (!timerElement || !timerText) return;
    
    // 시간이 0이 되면 게임오버
    if (timeRemaining <= 0) {
        timeRemaining = 0;
        stopTimer();
        triggerGameOver('시간이 다 되었습니다...');
        return;
    }
    
    // 분과 초 계산
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    
    // 시간 표시 (MM:SS 형식)
    timerText.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    
    // 경고 스타일 적용
    if (timeRemaining <= 30) {
        // 30초 이하일 때 위험 스타일
        timerElement.classList.remove('warning');
        timerElement.classList.add('danger');
    } else if (timeRemaining <= 60) {
        // 1분 이하일 때 경고 스타일
        timerElement.classList.remove('danger');
        timerElement.classList.add('warning');
    } else {
        // 정상 스타일
        timerElement.classList.remove('warning', 'danger');
    }
    
    timeRemaining--;
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function resetTimer() {
    stopTimer();
    timeRemaining = 180; // 3분으로 리셋
    
    const timerElement = document.getElementById('timer');
    const timerText = document.getElementById('timerText');
    
    if (timerElement) {
        timerElement.classList.remove('warning', 'danger');
    }
    
    if (timerText) {
        timerText.textContent = '03:00';
    }
}

// 게임오버 트리거
function triggerGameOver(reason) {
    if (gameOver) return; // 이미 게임오버면 중복 실행 방지
    
    gameOver = true;
    resetMovementKeys();
    velocity.set(0, 0, 0);
    
    // 배경 음악 중지, 게임 오버 효과음 재생
    if (backgroundMusic) {
        backgroundMusic.pause();
        backgroundMusic.currentTime = 0;
    }
    if (overSound) overSound.play().catch(function() {});
    
    // 타이머 중지
    stopTimer();
    
    // 포인터 잠금 해제 (플레이 불가, 다시하기만 가능)
    const exitPointerLock = document.exitPointerLock || 
                           document.mozExitPointerLock || 
                           document.webkitExitPointerLock;
    if (exitPointerLock) {
        exitPointerLock.call(document);
    }
    
    // 작품 대화창·프롬프트 숨김 (다시하기만 보이도록)
    closeArtworkDialog();
    const artworkPrompt = document.getElementById('artworkPrompt');
    if (artworkPrompt) artworkPrompt.classList.add('hidden');
    
    // 게임오버 UI 표시
    const gameOverPanel = document.getElementById('gameOver');
    if (gameOverPanel) {
        const reasonText = gameOverPanel.querySelector('p');
        if (reasonText && reason) {
            reasonText.textContent = reason;
        }
        gameOverPanel.classList.remove('hidden');
    }
    
}

// 게임 클리어 트리거
function triggerGameClear() {
    if (gameOver) return; // 이미 게임오버면 클리어 불가
    
    gameOver = true;
    resetMovementKeys();
    velocity.set(0, 0, 0);
    
    // 배경 음악 중지
    if (backgroundMusic) {
        backgroundMusic.pause();
        backgroundMusic.currentTime = 0;
    }
    // 탈출 효과음 한 번 재생
    if (runSound) {
        runSound.currentTime = 0;
        runSound.play().catch(function() {});
    }
    
    // 타이머 중지
    stopTimer();
    
    // 포인터 잠금 해제 (플레이 불가, 다시하기만 가능)
    const exitPointerLock = document.exitPointerLock || 
                           document.mozExitPointerLock || 
                           document.webkitExitPointerLock;
    if (exitPointerLock) {
        exitPointerLock.call(document);
    }
    
    // 작품 대화창·프롬프트 숨김 (다시하기만 보이도록)
    closeArtworkDialog();
    const artworkPrompt = document.getElementById('artworkPrompt');
    if (artworkPrompt) artworkPrompt.classList.add('hidden');
    
    // 게임 클리어 UI 표시
    const gameClearPanel = document.getElementById('gameClear');
    if (gameClearPanel) {
        gameClearPanel.classList.remove('hidden');
    }
    
}

// 게임 다시 시작 함수
function restartGame() {
    // 게임 시작 안내문구 숨김 (재시작 시에는 표시하지 않음)
    if (!instructions) {
        instructions = document.getElementById('instructions');
    }
    if (instructions) {
        instructions.classList.add('hidden');
    }
    
    // 타이머 리셋
    resetTimer();
    
    // 게임오버 상태 리셋
    gameOver = false;
    // 게임 오버 / 탈출 효과음 정지
    if (overSound) {
        overSound.pause();
        overSound.currentTime = 0;
    }
    if (runSound) {
        runSound.pause();
        runSound.currentTime = 0;
    }
    // 배경 음악 재생
    if (backgroundMusic) {
        backgroundMusic.currentTime = 0;
        backgroundMusic.play().catch(function() {});
    }
    
    // 게임오버 UI 숨김
    const gameOverPanel = document.getElementById('gameOver');
    if (gameOverPanel) {
        gameOverPanel.classList.add('hidden');
    }
    
    // 게임 클리어 UI 숨김
    const gameClearPanel = document.getElementById('gameClear');
    if (gameClearPanel) {
        gameClearPanel.classList.add('hidden');
    }
    
    // 1. 열쇠 배열 초기화
    keys.length = 0;
    _prevKeyCount = 0;
    
    // 2. 작품의 열쇠 상태 복원 (모든 작품에서 열쇠 제거 후 keyArtworks에 있는 작품만 복원)
    for (let artwork of artworks) {
        if (artwork && artwork.frame) {
            artwork.frame.userData.hasKey = false;
            if (artwork.frame.userData.sparkleGroup) {
                artwork.frame.remove(artwork.frame.userData.sparkleGroup);
                artwork.frame.userData.sparkleGroup = null;
            }
            removeKeyFrameGlow(artwork.frame);
        }
    }
    
    for (var ka = 0; ka < keyArtworks.length; ka++) {
        var kw = keyArtworks[ka];
        if (!kw || !kw.frame) continue;
        kw.frame.userData.hasKey = true;
        var ro = createSparkleGroupForKey();
        kw.frame.userData.keyLight = ro.keyLight;
        kw.frame.add(ro.group);
        kw.frame.userData.sparkleGroup = ro.group;
        applyKeyFrameGlow(kw.frame);
    }
    
    // 3. 인벤토리 업데이트
    updateInventory();
    
    // 4. 플레이어 위치 리셋 (리스폰 구역에서 뒤돌아보는 방향)
    camera.position.set(-32, 1.6, -32);
    camera.rotation.set(0, Math.PI, 0);
    euler.set(0, Math.PI, 0, 'YXZ');
    camera.quaternion.setFromEuler(euler, 'YXZ');
    
    // 5. 속도 초기화
    velocity.set(0, 0, 0);
    
    // 6. 이동 상태 초기화
    moveForward = false;
    moveBackward = false;
    moveLeft = false;
    moveRight = false;
    
    // 7. 출구 문 상태 초기화
    if (exitDoor) {
        exitDoor.userData.isLocked = true;
        if (exitDoor.userData.exitLight) {
            exitDoor.userData.exitLight.color.setHex(0xff0000);
        }
        // 철장 복원
        if (!exitDoor.userData.gate || !exitDoor.userData.gate.visible) {
            // 기존 철장이 있으면 보이게 하고, 없으면 새로 생성
            if (exitDoor.userData.gate) {
                exitDoor.userData.gate.visible = true;
            } else {
                const gateGroup = new THREE.Group();
                const gateMaterial = new THREE.MeshStandardMaterial({ 
                    color: 0x666666,
                    roughness: 0.3,
                    metalness: 0.8
                });
                
                const barCount = 8;
                const gateWidth = 3.0;
                const barHeight = 4.0;
                const barThickness = 0.1;
                
                for (let i = 0; i < barCount; i++) {
                    const barX = -gateWidth / 2 + (gateWidth / (barCount - 1)) * i;
                    const barGeometry = new THREE.BoxGeometry(barThickness, barHeight, barThickness);
                    const bar = new THREE.Mesh(barGeometry, gateMaterial);
                    bar.position.set(barX, barHeight / 2, 0.1);
                    bar.castShadow = false;
                    bar.receiveShadow = false;
                    gateGroup.add(bar);
                }
                
                const horizontalBars = [
                    { y: barHeight - 0.2, name: 'top' },
                    { y: barHeight / 2, name: 'middle' },
                    { y: 0.2, name: 'bottom' }
                ];
                
                horizontalBars.forEach(bar => {
                    const horizontalGeometry = new THREE.BoxGeometry(gateWidth, barThickness, barThickness);
                    const horizontalBar = new THREE.Mesh(horizontalGeometry, gateMaterial);
                    horizontalBar.position.set(0, bar.y, 0.1);
                    horizontalBar.castShadow = false;
                    horizontalBar.receiveShadow = false;
                    gateGroup.add(horizontalBar);
                });
                
                gateGroup.position.set(0, 0, -0.8);
                exitDoor.add(gateGroup);
                exitDoor.userData.gate = gateGroup;
            }
        }
    }
    
    // 8. 몬스터 위치 리셋 (각자 구역 안에서만 재배치)
    for (let i = 0; i < monsters.length; i++) {
        const monster = monsters[i];
        if (monster && monster.userData) {
            const zone = monsterZones[i % monsterZones.length];
            const startPos = randomPositionInZone(zone);
            monster.position.copy(startPos);
            monster.userData.state = 'wandering';
            monster.userData.wanderTime = 0;
            const next = randomPositionInZone(zone);
            monster.userData.targetPosition.copy(next);
        }
    }
    
    // 9. 대화창 닫기
    closeArtworkDialog();
    
    // 10. 포인터 잠금 다시 요청 (게임 시작 화면 없이 바로 시작)
    const canvas = renderer.domElement;
    if (canvas && canvas.requestPointerLock) {
        // instructions를 숨김 상태로 유지
        if (instructions) {
            instructions.classList.add('hidden');
        }
        canvas.requestPointerLock();
    }
}

// 다시 시작 버튼 이벤트 리스너
const restartButton = document.getElementById('restartButton');
if (restartButton) {
    restartButton.addEventListener('click', restartGame);
}

const restartButton2 = document.getElementById('restartButton2');
if (restartButton2) {
    restartButton2.addEventListener('click', restartGame);
}

// 윈도우 리사이즈 처리
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ESC 키로 포인터 잠금 해제
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        const exitPointerLock = document.exitPointerLock || 
                               document.mozExitPointerLock || 
                               document.webkitExitPointerLock;
        if (exitPointerLock) {
            exitPointerLock.call(document);
        }
    }
});

// 게임 시작 함수
function startGame(event) {
    // 게임 오버/클리어 시에는 다시하기만 가능 (캔버스 클릭으로 재시작 불가)
    if (gameOver) return;
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    // 사용자 클릭 시 즉시 음악 재생 (브라우저 자동 재생 정책 대응)
    if (backgroundMusic) {
        if (backgroundMusic.paused) {
            backgroundMusic.play().catch(function() {});
        }
    }
    
    const canvasEl = getCanvas();
    if (!canvasEl) {
        alert('Canvas를 찾을 수 없습니다. 페이지를 새로고침해주세요.');
        return;
    }
    
    const locked = document.pointerLockElement || document.mozPointerLockElement || document.webkitPointerLockElement;
    if (locked) {
        return;
    }
    
    try {
        if (canvasEl.requestPointerLock) {
            const result = canvasEl.requestPointerLock();
            
            // Promise 기반인 경우
            if (result && typeof result.then === 'function') {
                result.then(() => {
                    setTimeout(() => {
                        onPointerLockChange();
                    }, 100);
                }).catch((err) => {
                    alert('포인터 잠금을 사용할 수 없습니다: ' + err.message);
                });
            }
        } else if (canvasEl.mozRequestPointerLock) {
            canvasEl.mozRequestPointerLock();
        } else if (canvasEl.webkitRequestPointerLock) {
            canvasEl.webkitRequestPointerLock();
        } else {
            alert('이 브라우저는 Pointer Lock API를 지원하지 않습니다.');
        }
    } catch (error) {
        alert('게임을 시작할 수 없습니다: ' + error.message);
    }
}

// 게임 시작 이벤트 등록
window.startGame = startGame;

function setupClickEvents() {
    const startButton = document.getElementById('startButton');
    const canvasEl = getCanvas();
    
    
    if (startButton) {
        startButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            startGame(e);
        });
    } else {
    }
    
    if (canvasEl) {
        canvasEl.onclick = startGame;
        canvasEl.style.cursor = 'pointer';
    }
}

// 타이틀 화면: 마우스 위치에 플래시처럼 밝아지는 효과 (전체 + 게임 설명 패널)
function setupStartScreenFlashlight() {
    var el = document.getElementById('instructions');
    if (!el) return;
    var panel = el.querySelector('.start-screen');
    el.addEventListener('mousemove', function(e) {
        var r = el.getBoundingClientRect();
        var x = ((e.clientX - r.left) / r.width) * 100;
        var y = ((e.clientY - r.top) / r.height) * 100;
        el.style.setProperty('--mouse-x', x + '%');
        el.style.setProperty('--mouse-y', y + '%');
        if (panel) {
            var pr = panel.getBoundingClientRect();
            var px = ((e.clientX - pr.left) / pr.width) * 100;
            var py = ((e.clientY - pr.top) / pr.height) * 100;
            panel.style.setProperty('--panel-mouse-x', px + '%');
            panel.style.setProperty('--panel-mouse-y', py + '%');
        }
    });
    el.addEventListener('mouseleave', function() {
        el.style.setProperty('--mouse-x', '50%');
        el.style.setProperty('--mouse-y', '50%');
        if (panel) {
            panel.style.setProperty('--panel-mouse-x', '50%');
            panel.style.setProperty('--panel-mouse-y', '50%');
        }
    });
}

// 여러 시점에서 이벤트 등록 시도
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        setupClickEvents();
        setupStartScreenFlashlight();
    });
} else {
    setupClickEvents();
    setupStartScreenFlashlight();
}

// 백업으로 window.load에도 등록
window.addEventListener('load', function() {
    setupClickEvents();
    setupStartScreenFlashlight();
});

// 닫기 버튼 이벤트 리스너
const closeButton = document.getElementById('closeArtworkInfo');
if (closeButton) {
    closeButton.addEventListener('click', closeArtworkInfo);
}

// 애니메이션 시작
animate();


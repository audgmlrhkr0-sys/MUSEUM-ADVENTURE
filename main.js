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
        if (!storyRespawnShown) {
            storyRespawnShown = true;
            setTimeout(function() {
                showStoryDialogue('젠장, 문이 잠겼어... 어떻게든 나갈 방법을 찾아야 해.', 3000);
            }, 900);
        }
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
    messageEl.innerHTML = '';
    messageEl.appendChild(document.createTextNode(message));
}

function breakAtPunctuation(text, maxLen) {
    if (!text || text.length <= maxLen) return text;
    var out = '', start = 0;
    var punct = /[,.\u3002\uFF0E]/; // 쉼표, 마침표, 。, ．(전각 마침표)
    while (start < text.length) {
        var chunk = text.slice(start, start + maxLen + 80);
        var breakAt = -1;
        for (var i = Math.min(chunk.length, maxLen); i >= 0; i--) {
            if (punct.test(chunk[i])) {
                breakAt = i + 1;
                break;
            }
        }
        if (breakAt <= 0) breakAt = Math.min(chunk.length, maxLen);
        out += text.slice(start, start + breakAt).trim();
        start += breakAt;
        if (start < text.length) out += '\n';
    }
    return out;
}

function showArtworkContent(caption, description) {
    const messageEl = document.getElementById('dialogMessage');
    messageEl.innerHTML = '';
    var cap = document.createElement('p');
    cap.className = 'artwork-caption';
    cap.textContent = caption || '';
    var desc = document.createElement('p');
    desc.className = 'artwork-description';
    desc.textContent = description || '';
    messageEl.appendChild(cap);
    messageEl.appendChild(desc);
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
    
    // 무조건 작품 설명 먼저 표시 (캡션과 설명 다른 문단으로 구분)
    dialogState = 'viewing';
    const captionLine = info.caption || info.title;
    showArtworkContent(captionLine, info.description || "");
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
        if (keys.length >= 1 && !storyFirstKeyShown) {
            storyFirstKeyShown = true;
            showStoryDialogue('열쇠다! 이제 몇 개 남았지? 아직 더 찾아야 해.', 5000);
        }
        if (keys.length >= 3 && !storyThirdKeyShown) {
            storyThirdKeyShown = true;
            showStoryDialogue('발소리가 가까워.... 도망가, 빨리!', 3000);
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
    if (!storyExitShown) {
        storyExitShown = true;
        showStoryDialogue('문이 열렸어...! 이제 경비원 몰래 출구로 탈출하자.', 3000);
    }
    // 출구 열림 알림
    const exitNotification = document.createElement('div');
    exitNotification.id = 'exitNotification';
    exitNotification.textContent = '출구가 열렸습니다!';
    exitNotification.style.cssText = `
        position: absolute;
        top: 30%;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.75);
        color: #fff8dc;
        padding: 32px 58px;
        border-radius: 14px;
        font-size: 2.15em;
        font-weight: bold;
        z-index: 200;
        text-align: center;
        border: 3px solid rgba(255, 220, 150, 0.9);
        box-shadow: 0 0 20px rgba(0,0,0,0.6), 0 0 40px rgba(255, 220, 150, 0.3), inset 0 0 20px rgba(255,245,200,0.08);
        text-shadow: 0 0 20px rgba(255, 245, 200, 0.95), 0 0 40px rgba(255, 230, 180, 0.7), 0 1px 2px rgba(0,0,0,0.9), 1px 1px 0 rgba(0,0,0,0.8), -1px -1px 0 rgba(0,0,0,0.8);
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
        case 'Enter':
            // Enter 키로 출구 열기
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

// 작품 정보 생성 함수 (캡션=한 줄, 설명=별도)
function createArtworkInfo(title, material, size, year, description, caption) {
    return {
        title: title,
        material: material,
        size: size,
        year: year,
        description: description,
        caption: caption != null ? caption : (title + ", " + year + ", " + material + ", " + size)
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
                    // 9.jpg (슬롯 8 또는 32): -90도 회전하여 세로 비율로 표시
                    if (typeof slotIndex === 'number' && slotIndex % 24 === 8) {
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
                    // 현재 이미지 제외한 나머지 전부 폴백 (17.jpg 등 확장자 차이 시 .jpeg 먼저 시도)
                    const allImages = ['1.jpg', '2.jpg', '3.jpg', '4.jpg', '5.jpeg', '6.jpg', '7.png', '8.jpg', '9.jpg', '10.jpg', '11.jpg', '12.jpg', '13.jpg', '14.jpg', '15.jpg', '16.jpg', '17.jpg', '18.jpg', '19.jpg', '20.jpg', '21.jpg', '22.jpg', '23.jpg', '24.jpg'];
                    var fallbackList = allImages.filter(function(f) { return f !== imageUrl; });
                    var altExt = imageUrl.replace(/\.jpe?g$/i, function(m) { return m.toLowerCase() === '.jpg' ? '.jpeg' : '.jpg'; });
                    if (altExt !== imageUrl && fallbackList.indexOf(altExt) === -1) fallbackList.unshift(altExt);
                    let tried = 0;
                    function tryNext() {
                        if (tried >= fallbackList.length) {
                            // 모든 로드 실패 시에도 프레임은 씬에 추가 (로드 안 된 작품이 더 잘 보이도록 밝은 회색+발광)
                            if (picture && picture.material) {
                                picture.material.dispose();
                                picture.material = new THREE.MeshStandardMaterial({
                                    color: 0xa0a0a0,
                                    emissive: 0x555555,
                                    emissiveIntensity: 0.4,
                                    side: THREE.FrontSide,
                                    roughness: 0.8,
                                    metalness: 0.05
                                });
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
    
    // 작품 정보 (1.jpg~24.jpg 순서)
    const artworkTitles = [
        "김소연, <勢>", "나탈리아 부텐노바, <Moscow, Arbet, Sunday>", "노태범, <現代人을 위한 符>", "라리사 누리(Larissa Noury), <chapel: light of the paddle>",
        "라리사 코샤코바(Larisa Kosyakova), <The square in a small town>", "백진화, <연두>", "솔로몬 이세케이예(Solomon Isekeije), <Iya Agba - Ⅱ>", "스테판 홀트(Steffen Rault), <Global-climate-are-you-cirrus-009>",
        "안나 보그다노바(Anna Bogdanova), <Optical glass>", "이카와 세이료, <Peinture No.7>", "요크 힐버트(Joerg Hilbert), <RITTER ROST: The iron castle>", "이승찬, <무제>",
        "엘레나 수마코바(Elena Shumakova), <아침식사>", "이향, <시간위에>", "장용근, <보이지 않는 노동 #3>", "조경희, <Shadow>",
        "차장섭, <도(道)와 이(理)를 즐기고 완성하다 – 안동 도산서당 완락재>", "최진주, <기지개>", "케세니아 네치텔로, <Sochi>", "호망 지베흐(Romain Gilbert), <Venice series – untited 01>",
        "우주연, <Thousand Hands>", "진 C. 마벨(Jean C. Marvel), <A Tree Grows in Washington>", "조덕연, <회상(回想) - 그리움>", "정용국, <Where is happy?>"
    ];
    const materials = [
        "종이, 혼합재료", "에칭, 동판화", "한지, 먹, 토분", "혼합재료, 오일안료",
        "유화", "혼합재료", "Plastagraphy Relief", "C-print",
        "종이, 파스텔", "유화", "디지털 프린트", "종이에 채색",
        "종이, 아크릴, 종이접기", "종이에 채색", "피그먼트 프린트", "거울, 스타킹",
        "종이에 디지털 피그먼트 프린트", "장지, 먹, 색", "유화", "C-print",
        "디지털 프린트", "혼합재료", "종이, 아크릴", "한지에 수묵"
    ];
    const sizes = [
        "38˟47cm", "24.5˟31.5cm", "170˟130cm", "28.5˟28.5cm",
        "90˟80cm", "60.5˟72cm", "(Plastagraphy Relief)", "120˟173cm",
        "70˟50cm", "34.5˟40.5cm", "34˟60cm", "65.5˟69.5cm",
        "56˟71cm", "59˟72cm", "100˟150cm", "40˟40cm",
        "40˟57cm", "70˟100cm", "70˟90cm", "20˟30cm",
        "81˟60.4cm", "19˟4˟39cm", "68˟50cm", "83˟70cm"
    ];
    const years = [
        2002, 1988, 1990, "연도미상",
        2011, "연도미상", 2014, 2011,
        2009, "연도미상", 2011, 1993,
        "연도미상", 2005, 2016, 2007,
        2016, 2003, 2009, 2009,
        2007, "연도미상", 2001, 2007
    ];
    // 캡션 (한 줄, 크기/재료 라벨 없이)
    const captions = [
        "김소연, <勢>, 2002, 종이, 혼합재료, 38˟47cm",
        "나탈리아 부텐노바, <Moscow, Arbet, Sunday>, 1988, 에칭, 동판화, 24.5˟31.5cm",
        "노태범, <現代人을 위한 符>, 1990, 한지, 먹, 토분, 170˟130cm",
        "라리사 누리(Larissa Noury), <chapel: light of the paddle>, 연도미상, 혼합재료, 오일안료, 28.5˟28.5cm",
        "라리사 코샤코바(Larisa Kosyakova), <The square in a small town>, 2011, 유화, 90˟80cm",
        "백진화, <연두>, 연도미상, 혼합재료, 60.5˟72cm",
        "솔로몬 이세케이예(Solomon Isekeije), <Iya Agba - Ⅱ>, 2014, Plastagraphy Relief",
        "스테판 홀트(Steffen Rault), <Global-climate-are-you-cirrus-009>, 2011, C-print, 120˟173cm",
        "안나 보그다노바(Anna Bogdanova), <Optical glass>, 2009, 종이, 파스텔, 70˟50cm",
        "이카와 세이료, <Peinture No.7>, 연도미상, 종이, 아크릴, 종이접기, 34.5˟40.5cm",
        "요크 힐버트(Joerg Hilbert), <RITTER ROST: The iron castle>, 2011, 디지털 프린트, 34˟60cm",
        "이승찬, <무제>, 1993, 종이에 채색, 65.5˟69.5cm",
        "엘레나 수마코바(Elena Shumakova), <아침식사>, 연도미상, 유화, 56˟71cm",
        "이향, <시간위에>, 2005, 종이에 채색, 59˟72cm",
        "장용근, <보이지 않는 노동 #3>, 2016, 피그먼트 프린트, 100˟150cm",
        "조경희, <Shadow>, 2007, 거울, 스타킹, 40˟40cm",
        "차장섭, <도(道)와 이(理)를 즐기고 완성하다 – 안동 도산서당 완락재>, 2016, 종이에 디지털 피그먼트 프린트, 40˟57cm",
        "최진주, <기지개>, 2003, 장지, 먹, 색, 70˟100cm",
        "케세니아 네치텔로, <Sochi>, 2009, 유화, 70˟90cm",
        "호망 지베흐(Romain Gilbert), <Venice series – untited 01>, 2009, C-print, 20˟30cm",
        "우주연, <Thousand Hands>, 2007, 디지털 프린트, 81˟60.4cm",
        "진 C. 마벨(Jean C. Marvel), <A Tree Grows in Washington>, 연도미상, 혼합재료, 19˟4˟39cm",
        "조덕연, <회상(回想) - 그리움>, 2001, 종이, 아크릴, 68˟50cm",
        "정용국, <Where is happy?>, 2007, 한지에 수묵, 83˟70cm"
    ];
    const descriptions = [
        "김소연은 전통 색채와 자연, 근원에 대한 관심을 바탕으로, 수묵과 청색의 추상적 형상을 통해 기운생동(氣韻生動)을 탐구한다.",
        "나탈리아 부텐노바는 러시아 모스크바 주말의 활기찬 아르바트 거리 풍경을 에칭 기법으로 담아냈다. 동판에 새겨진 빠르고 불규칙한 선이 인물과 공간을 유동적으로 변화시키며 선적 리듬과 생동감을 전한다.",
        "노태범은 부적의 상징성과 무속적 이미지를 현대적으로 재해석한다. 〈현대인을 위한 시〉는 자연과 인간의 공생·상생을 바탕으로 한 무속적 세계관을 보여준다.",
        "라리사 누리는 모스크바 건축가 조합과 스웨덴협회에서 대상을 수상한 작가로, 시공을 초월한 몽환적인 분위기를 표현한다.",
        "라리사 코샤코바는 문학적 신화를 차용하지 않고, 자신의 내면과 삶의 경험이 연결된 나이브 아트(Naive Art)를 선보인다.",
        "백진화는 자연을 관찰하며 생명이 자라나는 과정을 화면에 담는다. 〈연두〉는 진흙 속에서도 꽃을 피우는 강인함과 빗방울에도 흔들리지 않는 모습으로, 최소한의 형상으로 존재의 의연함을 보여준다.",
        "솔로몬 이세케이예는 다양한 문화 간 공통점과 차이점을 탐구하며, 〈Iya Agba - Ⅱ〉은 플라스틱 판에 양각을 새겨 잉크를 묻혀 찍는 볼록판 인쇄 기법으로, 아프리카 모계 중심 사회를 표현한다.",
        "스테판 홀트는 맑고 아름다운 하늘의 이미지 속에 항공기와 산업 활동의 흔적을 담아 환경오염의 현실을 드러낸다.",
        "안나 보그다노바는 깨진 유리와 렌즈를 통해 세상을 왜곡된 형태로 보여주며 다채로운 풍경을 연출한다.",
        "이카와 세이료는 캔버스 대신 종이접기 같은 지지대를 활용해 회화의 경계를 확장하고, 원색과 단순한 형태로 경쾌한 감각과 동심을 표현한다.",
        "요크 힐버트 작가는 일러스트레이션 작업에 그치지 않고 글과 음악을 제작하여 장르를 넘나드는 새로운 형태의 예술을 만들어낸다. <RITTER ROST>는 1994년에 출판된 작가의 첫 번째 시리즈로, 다양한 형태로 출간, 공연되어 독일어권 고전 동화로 인정받았다.",
        "이승찬은 가톨릭 입문을 계기로 동·서양의 철학과 조형성을 접목해 자유롭고 즉흥적인 표현을 탐구한다. 먹과 한지가 만나 자연스럽게 만들어진 형상을 활용하며, 어린아이 같은 천진함과 즐거움이 담는다.",
        "엘레나 수마코바의 〈아침식사〉는 일상의 식재료로 농가의 여유와 삶의 풍요, 그리고 삶의 순환을 드러낸다.",
        "이향은 전통 소재와 수묵담채를 바탕으로 시간과 자연, 수행의 의미를 담아내는 작가로, 절제된 색과 깊은 먹빛이 어우러진 작품 세계를 보여준다.",
        "장용근은 공식적으로 존재하지 않았던 공간인 집창촌 자갈마당의 일상을 사진으로 기록한다. 오랜 시간 주목해 온 도시와 타자, 자본주의와 노동의 문제가 일상의 장면 속에 스며드는 순간을 포착한다.",
        "조경희는 여성의 욕망과 무의식을 주제로, 구두·핸드백·스타킹 같은 일상적 사물을 해체하고 재구성한다. 이를 통해 소비와 욕망, 실제와 이미지 사이의 긴장 관계를 드러낸다.",
        "차장섭은 전국에 산재한 고택을 찾아다니며 한국 고유의 아름다움을 사진에 담는다. '아름다운 사람, 아름다운 집'이라는 말처럼, 사람과 집이 결코 분리될 수 없는 존재임을 보여준다.",
        "최진주는 먹과 물감을 반복해 부유하는 듯한 희미한 형상을 만들며, 자신의 심리와 내면을 드러낸다.",
        "케세니아 네치텔로는 러시아 소치의 풍경을 푸른 색면과 간결한 선으로 표현한다. 중앙의 대리석 건물을 중심으로 한여름의 노을처럼 부드러운 명암과 조화를 이루는 풍경을 담았다.",
        "호망 지베흐는 익숙한 도시풍경 속에서 상투적으로 복제된 오브제들이 우리의 일상과 시각을 잠식하고 있음을 드러낸다.",
        "우주연은 다른 문화 속에서 겪는 이질적인 경험을 수집한다. <Thousand Hands>는 불교사원에서 신자들이 쌀을 봉양하며 타인을 돕고 덕을 쌓는 행위에서 착안하였다. 수많은 손은 나눔의 행위가 개인을 넘어 더 넓은 세계로 퍼져 나간다는 불교적 세계관을 상징한다.",
        "진 C. 마벨은 미국 워싱턴에 거주하는 사람들의 관계, 또는 개인과 집단 사이에 일어나는 일을 나무로 형상화한다.",
        "조덕연은 새를 통해 환경에 대한 관심과 자연 속에서 보낸 유년 시절의 경험을 표현하며, 야생에서 생존하려는 새의 노력을 현대인의 삶에 비유한다.",
        "정용국은 한지와 수묵의 특성을 활용해 현대 도시의 어두운 면을 은유하고, 인간 신체를 풍경처럼 재해석하며 동시대 삶을 탐구한다."
    ];
    
    // 24점: 벽 중간에만 배치. 모서리·벽과 벽 만나는 곳(끝) 피해서 공중에 안 떠 있고 잘리지 않게.
    const imageFiles = ['1.jpg', '2.jpg', '3.jpg', '4.jpg', '5.jpeg', '6.jpg', '7.png', '8.jpg', '9.jpg', '10.jpg', '11.jpg', '12.jpg', '13.jpg', '14.jpg', '15.jpg', '16.jpg', '17.jpg', '18.jpg', '19.jpg', '20.jpg', '21.jpg', '22.jpg', '23.jpg', '24.jpg'];
    const portraitIndices = [2, 4, 6, 8, 20, 22, 23]; // 3.jpg, 5.jpeg, 7.png(솔로몬), 9.jpg(-90°), 21.jpg, 23.jpg, 24.jpg – 세로형
    // 1·10·12·20 다른 곳으로, 17은 보이는 면으로. 통로에서 보이는 벽만 사용.
    const positions = [
        { pos: { x: -18, y: pictureY, z: -halfSize + pictureOffset }, rot: 0 },
        { pos: { x: 14, y: pictureY, z: -halfSize + pictureOffset }, rot: 0 },
        { pos: { x: -halfSize - pictureOffset, y: pictureY, z: 25 }, rot: Math.PI / 2 },
        { pos: { x: halfSize + pictureOffset, y: pictureY, z: -25 }, rot: -Math.PI / 2 },
        { pos: { x: 12, y: pictureY, z: halfSize - pictureOffset }, rot: Math.PI },
        { pos: { x: halfSize + pictureOffset, y: pictureY, z: 25 }, rot: -Math.PI / 2 },
        { pos: { x: -8, y: pictureY, z: -halfSize + pictureOffset }, rot: 0 },
        { pos: { x: 2, y: pictureY, z: -halfSize + pictureOffset }, rot: 0 },
        { pos: { x: 30, y: pictureY, z: -halfSize + pictureOffset }, rot: 0 },
        { pos: { x: -20 - pictureOffset, y: pictureY, z: -20 }, rot: Math.PI / 2 },
        { pos: { x: -12, y: pictureY, z: halfSize - pictureOffset }, rot: Math.PI },
        { pos: { x: 26, y: pictureY, z: 12 + pictureOffset }, rot: 0 },
        { pos: { x: -20 + pictureOffset, y: pictureY, z: -20 }, rot: -Math.PI / 2 },
        { pos: { x: -20 + pictureOffset, y: pictureY, z: 20 }, rot: -Math.PI / 2 },
        { pos: { x: 20 - pictureOffset, y: pictureY, z: -20 }, rot: Math.PI / 2 },
        { pos: { x: 20 + pictureOffset, y: pictureY, z: 20 }, rot: -Math.PI / 2 },
        { pos: { x: 26, y: pictureY, z: -12 - pictureOffset }, rot: Math.PI },
        { pos: { x: -14, y: pictureY, z: -12 + pictureOffset }, rot: 0 },
        { pos: { x: 14, y: pictureY, z: -12 + pictureOffset }, rot: 0 },
        { pos: { x: -24, y: pictureY, z: halfSize - pictureOffset }, rot: Math.PI },
        { pos: { x: 20 + pictureOffset, y: pictureY, z: 0 }, rot: -Math.PI / 2 },
        { pos: { x: -14, y: pictureY, z: 12 - pictureOffset }, rot: Math.PI },
        { pos: { x: 14, y: pictureY, z: 12 - pictureOffset }, rot: Math.PI },
        { pos: { x: 28, y: pictureY, z: halfSize + pictureOffset }, rot: Math.PI }
    ];
    const pictureSizeLandscape = 8;
    const pictureHeightLandscape = 5.5;
    const pictureSizePortrait = 5.5;
    const pictureHeightPortrait = 7.5;
    // 비율 유지, 작품별 크기 다양화 (0.8 ~ 1.2)
    const sizeScale = [1.0, 0.9, 1.1, 0.85, 1.15, 0.95, 1.05, 1.0, 0.9, 1.1, 0.88, 1.12, 0.92, 1.08, 1.0, 0.95, 1.05, 0.9, 1.1, 0.85, 0.82, 0.98, 1.02, 0.92];
    const totalFrames = positions.length; // 33 (24 + 빈벽 9곳)
    for (let i = 0; i < totalFrames; i++) {
        const p = positions[i];
        const imgIndex = i % 24;
        const isPortrait = portraitIndices.includes(imgIndex);
        let picW = isPortrait ? pictureSizePortrait : pictureSizeLandscape;
        let picH = isPortrait ? pictureHeightPortrait : pictureHeightLandscape;
        if (imgIndex === 6) picW = 4.2; // 솔로몬(7.png) 가로 비율 줄임
        const scale = sizeScale[imgIndex] ?? 1;
        picW *= scale;
        picH *= scale;
        const imageUrl = imageFiles[imgIndex];
        const info = createArtworkInfo(
            artworkTitles[imgIndex],
            materials[imgIndex],
            sizes[imgIndex],
            years[imgIndex],
            descriptions[imgIndex],
            captions[imgIndex]
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

// 스토리 대사 (한 번만 표시할 플래그)
let storyRespawnShown = false;
let storyLeftRespawnShown = false;
let storyFirstKeyShown = false;
let storyThirdKeyShown = false;
let storyExitShown = false;
let storyDialogueTimeout = null;
const RESPAWN_X = -32;
const RESPAWN_Z = -32;
const RESPAWN_AREA_RADIUS = 5;
// 리스폰 구역 및 그 앞 (경비원 진입 금지) – 넓게 잡아 근처 진입 방지
const RESPAWN_SAFE_MIN_X = -36;
const RESPAWN_SAFE_MAX_X = -26;
const RESPAWN_SAFE_MIN_Z = -36;
const RESPAWN_SAFE_MAX_Z = -16;

function showStoryDialogue(text, durationMs) {
    const el = document.getElementById('storyDialogue');
    const textEl = document.getElementById('storyDialogueText');
    if (!el || !textEl) return;
    if (storyDialogueTimeout) clearTimeout(storyDialogueTimeout);
    textEl.textContent = text;
    el.classList.remove('hidden');
    storyDialogueTimeout = setTimeout(function() {
        el.classList.add('hidden');
        storyDialogueTimeout = null;
    }, durationMs || 3000);
}

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
    { minX: -19, maxX: 19, minZ: -34, maxZ: -6 },  // 북쪽 구역 (전시 쪽 복도만, 뒷벽 제외)
    { minX: -19, maxX: 19, minZ: -14, maxZ: 14 },  // 중앙 구역 (전시 쪽 복도만)
    { minX: -34, maxX: 34, minZ: 8, maxZ: 33 }    // 남쪽 구역 (출구 앞 제외)
];

function isInRespawnSafeZone(x, z, r) {
    const margin = (r || 0.5) + 0.5;
    return x >= RESPAWN_SAFE_MIN_X - margin && x <= RESPAWN_SAFE_MAX_X + margin &&
           z >= RESPAWN_SAFE_MIN_Z - margin && z <= RESPAWN_SAFE_MAX_Z + margin;
}

function randomPositionInZone(zone, radius) {
    const r = radius || 0.5;
    for (let tryCount = 0; tryCount < 30; tryCount++) {
        const x = zone.minX + Math.random() * (zone.maxX - zone.minX);
        const z = zone.minZ + Math.random() * (zone.maxZ - zone.minZ);
        if (isInRespawnSafeZone(x, z, r)) continue; // 리스폰 구역 및 앞 제외
        const pos = new THREE.Vector3(x, 0, z);
        if (checkMonsterCollision(pos, r)) return pos;
    }
    // 폴백: 플레이어가 다닐 수 있는 통로 중심 등으로
    let fx = (zone.minX + zone.maxX) * 0.5;
    let fz = (zone.minZ + zone.maxZ) * 0.5;
    if (isInRespawnSafeZone(fx, fz, r)) {
        fx = 0;
        fz = Math.max(-10, Math.min(10, fz));
    }
    const fallback = new THREE.Vector3(fx, 0, fz);
    if (checkMonsterCollision(fallback, r)) return fallback;
    return new THREE.Vector3(0, 0, 0); // 통로 중심은 항상 이동 가능
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
        // 경비원을 최초로 봤을 때 스토리 대사 (게임 시작 대사 이후에만)
        if (!storyLeftRespawnShown && storyRespawnShown && _cameraDir) {
            for (let i = 0; i < monsters.length; i++) {
                const monster = monsters[i];
                if (!monster || !monster.userData) continue;
                _monsterDir.subVectors(monster.position, camera.position).setY(0);
                const dist = _monsterDir.length();
                if (dist > 0.5 && dist < 18) {
                    _monsterDir.normalize();
                    if (_cameraDir.dot(_monsterDir) > 0.3) {
                        storyLeftRespawnShown = true;
                        showStoryDialogue('쉿! 경비원이 있어. 들키지 않도록 조심하자.', 5000);
                        break;
                    }
                }
            }
        }
    }
    
    prevTime = time;
    renderer.render(scene, camera);
}

// 경비원 벽 충돌 체크 함수 — 플레이어와 동일 통과 조건 + 작품 없는 뒷벽 복도 진입 금지 (갇힘 방지)
function checkMonsterCollision(newPosition, radius) {
    // 리스폰 구역만 경비원 진입 불가
    if (newPosition.x >= RESPAWN_SAFE_MIN_X - radius && newPosition.x <= RESPAWN_SAFE_MAX_X + radius &&
        newPosition.z >= RESPAWN_SAFE_MIN_Z - radius && newPosition.z <= RESPAWN_SAFE_MAX_Z + radius) {
        return false;
    }
    // 작품이 걸려 있지 않은 뒷벽 복도(전시 벽 뒤 좁은 공간) — 경비 진입 금지, 여기 들어가면 갇힘
    const wallX = 20;
    const backZLo = -29, backZHi = -1, backZLo2 = 1, backZHi2 = 29;
    const margin = radius + 0.2;
    if (newPosition.x < -wallX + margin && newPosition.x > -35 + margin) {
        if ((newPosition.z >= backZLo - margin && newPosition.z <= backZHi + margin) ||
            (newPosition.z >= backZLo2 - margin && newPosition.z <= backZHi2 + margin)) {
            return false; // 좌측 전시 벽 뒷복도
        }
    }
    if (newPosition.x > wallX - margin && newPosition.x < 35 - margin) {
        if ((newPosition.z >= backZLo - margin && newPosition.z <= backZHi + margin) ||
            (newPosition.z >= backZLo2 - margin && newPosition.z <= backZHi2 + margin)) {
            return false; // 우측 전시 벽 뒷복도
        }
    }
    // 플레이어가 설 수 있는 곳이면 경비원도 이동 가능 (미니 방·통로·전시 쪽 복도만)
    const playerPos = { x: newPosition.x, y: 1.6, z: newPosition.z };
    return checkCollision(playerPos);
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
                    _testPos.set(tx, 0, tz);
                    if (checkMonsterCollision(_testPos, data.radius || 0.5)) {
                        data.targetPosition.set(tx, 0, tz);
                    }
                    // 이동 불가 위치면 기존 target 유지 (다음 프레임에서 재시도)
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

    // 스토리 대사 플래그 초기화 (다시하기 시 대사 재생)
    storyRespawnShown = false;
    storyLeftRespawnShown = false;
    storyFirstKeyShown = false;
    storyThirdKeyShown = false;
    storyExitShown = false;
    
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


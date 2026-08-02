import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DecoratedTorusKnot4a } from 'three/examples/jsm/curves/CurveExtras.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
const loader = new GLTFLoader();
const renderer = new THREE.WebGLRenderer();
const canvas = renderer.domElement;
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

scene.background = new THREE.Color('orange')
const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 2.0);
directionalLight.position.set(5, 5, 5);
scene.add(directionalLight);

camera.position.z = 12;

const pickPosition = {x: 0, y: 0};
clearPickPosition();

let mouse_posX;
let mouse_posY;

class PickHelper {
  constructor() {
    this.raycaster = new THREE.Raycaster();
    this.pickedGroup = null;
    this.savedEmissives = new Map();
  }

  pick(normalizedPosition, scene, camera, time) {
    if (this.pickedGroup) {
      this.pickedGroup.traverse((child) => {
        if (child.isMesh && child.material && this.savedEmissives.has(child)) {
          child.material.emissive.setHex(this.savedEmissives.get(child));
        }
      });
      this.savedEmissives.clear();
      this.pickedGroup = null;
    }

    this.raycaster.setFromCamera(normalizedPosition, camera);
    const intersectedObjects = this.raycaster.intersectObjects(scene.children, true);

    if (intersectedObjects.length > 0) {
      let topObject = intersectedObjects[0].object;

      while (topObject.parent && topObject.parent !== scene) {
        topObject = topObject.parent;
      }

      this.pickedGroup = topObject;
      const isYellow = (time * 8) % 2 > 1;
      const highlightColor = isYellow ? 0xFFFF00 : 0xFF0000;

      this.pickedGroup.traverse((child) => {
        if (child.isMesh && child.material && child.material.emissive) {
          this.savedEmissives.set(child, child.material.emissive.getHex());
          child.material.emissive.setHex(highlightColor);
        }
      });
    }
  }
}

function getCanvasRelativePosition(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * canvas.width  / rect.width,
    y: (event.clientY - rect.top ) * canvas.height / rect.height,
  };
}
 
function setPickPosition(event) {
  const pos = getCanvasRelativePosition(event);
  pickPosition.x = (pos.x / canvas.width ) *  2 - 1;
  pickPosition.y = (pos.y / canvas.height) * -2 + 1;  // note we flip Y
}
 
function clearPickPosition() {
  // unlike the mouse which always has a position
  // if the user stops touching the screen we want
  // to stop picking. For now we just pick a value
  // unlikely to pick something
  pickPosition.x = -100000;
  pickPosition.y = -100000;
}
const pickHelper = new PickHelper();
window.addEventListener('mousemove',setPickPosition);
window.addEventListener('mousemove', () => {
    mouse_posX = Event.clientX;
    mouse_posY = Event.clientY;
});
window.addEventListener('mouseout', clearPickPosition);
window.addEventListener('mouseleave', clearPickPosition);

//let Name = '';
let names = [];
let ms = [];
let adddates = [];
let user_notes = [];
let rei_model;
let rps = 0.002;
let reiCount = 0;

let xTarget = camera.position.x;
let zTarget = camera.position.z;
const namehtml = document.getElementById('Name');
const timehtml = document.getElementById('Timestamp');
const notehtml = document.getElementById('Note');

namehtml.style.visibility = 'hidden';
timehtml.style.visibility = 'hidden';
notehtml.style.visibility = 'hidden';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function spawnReiModel(name, note, dateStr) {
  if (!rei_model) return;
  const m = rei_model.clone();

  m.traverse((child) => {
    if (child.isMesh && child.material) {
      child.material = child.material.clone();
    }
  });

  m.position.x = getRandomInt(-15, 15);
  m.position.y = getRandomInt(-8, 8);
  m.position.z = getRandomInt(-3, 0);

  set_rotation(m, getRandomInt(0, 360), getRandomInt(0, 360), getRandomInt(0, 360));
  scene.add(m);

  names.push(name);
  adddates.push(dateStr);
  user_notes.push(note);
  ms.push(m);
}

async function loadSavedReis() {
  const { data, error } = await supabase.from('reis').select('*');
  if (error) {
    console.error('Error fetching from Supabase:', error);
    return;
  }
  data.forEach((row) => {
    spawnReiModel(row.name, row.note, row.created_at);
  });
}

loader.load('public/Untitled.glb', function (gltf) {
  rei_model = gltf.scene;
  loadSavedReis(); 
}, undefined, function (error) {
  console.error(error);
});

window.add_rei = async function () {
  const lastAddedDate = localStorage.getItem('last_rei_date');
  const todayDate = new Date().toDateString();

  if (lastAddedDate === todayDate) {
    alert("You've already added a Rei today");
    return;
  }

  const Name = document.getElementById("inputfield").value || 'Anonymous';
  const Note = document.getElementById("notefield").value || '';
  const date = new Date();
  const formattedDate = date.toString().replace(/\s*\([^)]*\)$/, '');

  // Save entry to Supabase table
  const { data, error } = await supabase.from('reis').insert([
    { name: Name, note: Note, created_at: formattedDate }
  ]);

  if (error) {
    console.error('Failed to save to Supabase:', error);
    alert('Failed to save. Check console for details.');
    return;
  }

  spawnReiModel(Name, Note, formattedDate);
  localStorage.setItem('last_rei_date', todayDate);
};


function animate( time ) {
    time *= 0.001;
    ms.forEach(m => {
        m.rotation.y += rps;
        m.rotation.z += rps;
        m.rotation.x += rps;
    });
    window.addEventListener('keydown',function(event){
        if (event.code === "KeyA") {
          xTarget = camera.position.x - 2;
        }
        if (event.code === "KeyD") {
          xTarget = camera.position.x + 2;
        }
        if (event.code === "KeyW") {
          zTarget = camera.position.z - 2;
        }
        if (event.code === "KeyS") {
          zTarget = camera.position.z + 2;
        }
    });
    camera.position.x = lerp(camera.position.x, xTarget, .25);
    camera.position.z = lerp(camera.position.z,zTarget,.25)

    pickHelper.pick(pickPosition, scene, camera, time);
    renderer.render( scene, camera );
}
renderer.setAnimationLoop( animate );

function getRandomInt(min, max) {
  const minCeiled = Math.ceil(min);
  const maxFloored = Math.floor(max);
  return Math.floor(Math.random() * (maxFloored - minCeiled) + minCeiled);
}

function set_rotation(arg, x,y,z){
    arg.rotation.x = x;
    arg.rotation.y = y;
    arg.rotation.z = z;
}

window.addEventListener('click', () => {
    const name_text = document.getElementById('Name')
    if (pickHelper.pickedGroup){
        name_text.style.visibility = 'visible';
        timehtml.style.visibility = 'visible';
        notehtml.style.visibility = 'visible';
        var i = ms.indexOf(pickHelper.pickedGroup);
        name_text.innerHTML = names[i];
        timehtml.innerHTML = adddates[i];
        notehtml.innerHTML = user_notes[i];
        const screenPos = getScreenPosition(pickHelper.pickedGroup, camera);
        setDivPosition(name_text, screenPos.x, screenPos.y);  
        setDivPosition(timehtml, screenPos.x, screenPos.y+40); 
        setDivPosition(notehtml, screenPos.x, screenPos.y+110); 
        //console.log(i, names[i], pickHelper.pickedGroup.position, name_text.style.transform);
    }else{
      name_text.style.visibility = 'hidden';
      timehtml.style.visibility = 'hidden';
      notehtml.style.visibility = 'hidden';
    }
});

function setDivPosition(element, x, y) {
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
    
}

function getScreenPosition(object, camera) {
    if (!object || typeof object.getWorldPosition !== 'function') {
        return { x: 0, y: 0, isBehindCamera: true };
    }

    const vector = new THREE.Vector3();
    object.getWorldPosition(vector);
    vector.project(camera);

    const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-vector.y * 0.5 + 0.5) * window.innerHeight;

    return { 
        x: x, 
        y: y, 
        isBehindCamera: vector.z > 1 
}};
function lerp(start, end, alpha) {
    return start + (end - start) * alpha;
}

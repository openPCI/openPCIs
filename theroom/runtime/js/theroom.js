var urlPath = '../models/';

var moveables = [];

var scene = new THREE.Scene();
var raycaster = new THREE.Raycaster();
var hudRaycaster = new THREE.Raycaster();
var renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.setClearColor( 0xeeeeee );
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

document.body.appendChild( renderer.domElement );
//
// TODO:
// - [X] Camera movement
// - [-] Item placement
// - [ ] Wall sticky objects
// - [X] Item Rotation
// - [ ] Scoring
// - [ ] Settings
// - [ ] Postprocessing (outline selected prop) https://threejs.org/examples/webgl_postprocessing_outline.html

// Currently loaded room scene
var room;

// Plane used for mouse hit detection
var movePlane;

// 3DObject with camera
var lookObject;

// 3DObject Camera object
var cameraObject;

// The scene camera
var camera;

// Mouse coordinates -1 - 1
var mouse = new THREE.Vector2();

// Mouse movement delta
var mouseDelta = new THREE.Vector2();

// Last mouse position
var lastMouse = new THREE.Vector2();

// Left mouse down
var mouseDown = false;

// Currently moving / dragging object
var movingObject;

// Offset relative to mouse coord.
var movingObjectOffset;

// List of objects which should be collidable with the moving object
var collisionObjects = [];

// Initialize game HUD
var hud = new GameHud();

/**
 * Load a GLTF resource from path
 **/
function loadGLtf(path, callback){
  // Instantiate a loader
  var loader = new THREE.GLTFLoader();

  // Optional: Provide a DRACOLoader instance to decode compressed mesh data
  // THREE.DRACOLoader.setDecoderPath( '/examples/js/libs/draco' );
  // loader.setDRACOLoader( new THREE.DRACOLoader() );

  // Load a glTF resource
  loader.load(
  	// resource URL
  	urlPath + path,
  	// called when the resource is loaded
  	callback,
  	// called while loading is progressing
  	function ( xhr ) {

  		console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' );

  	},
  	// called when loading has errors
  	function ( error ) {
      console.log(error);
  		console.log( 'An error happened' );

  	}
  );
}


/**
 * addLighting - Adds default lighting to scene
 *
 * @param  {THREE.Scene} scene THREEJS Scene object
 * @return {undefined}
 */
function addLighting(scene){
  // Add global light
  var globalLight = new THREE.AmbientLight( 0xffffff, 0.7 );
  scene.add( globalLight );

  // Add DirectionalLight for shadows
  var sunLight = new THREE.DirectionalLight( 0xffffff, 0.3 );
  sunLight.castShadow = true;

  sunLight.target = scene.children[0];
  sunLight.position.y = 30;
  sunLight.position.x = 30;
  sunLight.position.z = 20;

  // Shadow stuff
  sunLight.shadow = new THREE.LightShadow( new THREE.PerspectiveCamera( 50, 1, 1, 100 ) );
  sunLight.shadow.mapSize.x = 512;
  sunLight.shadow.mapSize.y = 512;
  sunLight.shadow.bias = 0.0001;

  scene.add(sunLight);
};


/**
 * clearThree - Clears all children form a threejs object (scene / 3dObject). Also disposes gemoetries, textures and materials
 *
 * @param  {THREE.3DObject} obj The object t oclear
 * @return {type}     description
 */
function clearThree(obj){
  while(obj.children.length > 0){
    clearThree(obj.children[0])
    obj.remove(obj.children[0]);
  }
  if(obj.geometry) obj.geometry.dispose()
  if(obj.material) obj.material.dispose()
  if(obj.texture) obj.texture.dispose()
}


/**
 * loadScene - load a scene and adds it to collision testing
 *
 * @param  {type} file GLTF scene to load
 * @return {undefined}
 */
function loadScene(file){
  clearThree(scene);
  collisionObjects = [];

  loadGLtf(file, function(gltf){

    movePlane = new THREE.Mesh(new THREE.PlaneBufferGeometry(500, 500, 2, 2),
       new THREE.MeshBasicMaterial( {
           color: 0x248f24, alphaTest: 0, visible: false
    }));
    movePlane.rotation.x = -Math.PI/2;
    scene.add(movePlane);

    gltf.scene.traverse(function(o){
      if(o instanceof THREE.Mesh){
        o.receiveShadow = true;
        o.castShadow = true;
      }
    });
    gltf.scene.collisionStatic = true;
    collisionObjects.push(gltf.scene);
    scene.add(gltf.scene)
    room = gltf.scene;

    addLighting(scene);
    addCameraHelper();
    animate();
  });
}



function setMaterialProps(obj, props){
  console.log(obj);
  if(obj.matPropsSet) return;
  obj.matPropsSet = true;
  obj.traverse(function(o){
    if(!o.material) return;
    var mat = o.material;
    for(var prop in props){
      var value = props[prop];
      if(!mat.defaultProps) mat.defaultProps = {};
      if(typeof mat.defaultProps[prop] === "undefined"){
        if(mat[prop].clone) mat.defaultProps[prop] = mat[prop].clone();
        else mat.defaultProps[prop] = mat[prop] ;
      }
      if(mat[prop].set) mat[prop].set(value);
      else mat[prop] = value;
    }
  });
}

function resetMaterial(obj){
  if(!obj.matPropsSet) return
  obj.matPropsSet = false;
  obj.traverse(function(o){
    if(!o.material) return;
    var mat = o.material;
    if(!mat.defaultProps) return;
    for(var prop in mat.defaultProps){
      if(mat[prop].set) mat[prop].set(mat.defaultProps[prop]);
      else mat[prop] = mat.defaultProps[prop];
    }
  });
}


/**
 * wallSnapObject - Handle snapping objects.
 *
 * @param  {type} object description
 * @return {type}        description
 */
function wallSnapObject(object){
  var snappers = [];
  var targetObjects = [];
  var snapped = false;
  room.traverse(function(o){
    if(o instanceof THREE.Mesh){
      targetObjects.push(o);
    }
  });

  object.traverse(function(o){
    if(/snap/.test(o.name)){
      snappers.push(o);
    }
  });
  var rotation = new THREE.Quaternion();
  snappers.forEach(function(snapper){
    snapper.getWorldQuaternion(rotation);
    var v = new THREE.Vector3(0,1,0);
    v.applyQuaternion(rotation);
    var snapperPos = snapper.getWorldPosition( new THREE.Vector3() );
    var raycaster = new THREE.Raycaster( snapperPos, v, -0.4, 0.4);
    var result = raycaster.intersectObjects(targetObjects);
    if(result.length){
      snapperPos.sub(result[0].point);
      object.position.sub(snapperPos);
      snapped = true;
    }
  });
  return snapped;
}


/**
 * collisionTest - Test collision between two objects by raytracing from the vertex "normals".
 *
 * @param  {type} test   Object A
 * @param  {type} target Object B
 * @return {type}        list of collision points
 */
function collisionTest(test, target){
  var testObjects = [];
  var targetObjects = [];
  test.traverse(function(o){
    if(o instanceof THREE.Mesh){
      testObjects.push(o);
    }
  });

  target.traverse(function(o){
    if(o instanceof THREE.Mesh){
      targetObjects.push(o);
    }
  });
  return testObjects.map(function(o){
    return getCollisions(o, targetObjects);
  });
}


/**
 * getCollisions - Test collision between  a THREE.Mesh and a list of THREE.Mesh
 *
 * @param  {type} object        description
 * @param  {type} targetObjects description
 * @return {type}               description
 */
function getCollisions(object, targetObjects){
    var results = [];
    var geometry = object.geometry instanceof THREE.BufferGeometry ? new THREE.Geometry().fromBufferGeometry( object.geometry ) : object.geometry;
    if(geometry.vertices.length < 25)
    for (var vertexIndex = 0; vertexIndex < geometry.vertices.length; vertexIndex++)
    {

        var localVertex = geometry.vertices[vertexIndex].clone();
        globalVertex = localVertex;
        var obj = object;
        while(obj){
          globalVertex = globalVertex.applyMatrix4(obj.matrix);
          obj=obj.parent;
        }

        var directionVector = globalVertex.sub( object.getWorldPosition( new THREE.Vector3()) );
        var ray = new THREE.Raycaster( object.getWorldPosition( new THREE.Vector3()), directionVector.clone().normalize());
        var collisionResults = ray.intersectObjects( targetObjects );
        collisionResults.forEach(function(res){
          if ( res.distance < directionVector.length() )
          {
            results.push(res);
          }
        });
    }
    return results;
}


/**
 * testCollisionObjects - on frame handler for collision testing moving object.
 *
 * @return {type}  description
 */
function testCollisionObjects(){
  if(!movingObject) return;

  [movingObject].forEach(function(obj, i){
    if(obj.collisionStatic) return;

    var objHit = false;

    collisionObjects.forEach(function(other){
      if(other === obj) return;
      var test = collisionTest(obj, other);
      test.forEach(function(r){
       v = new THREE.Vector3();
       var hit = false;
       r.forEach(function(t){
         v.add(t.point.clone().sub(obj.position));
         hit = true;
       });
       if(other.collisionStatic){
         v.y=0;
         v.normalize();
         v.multiplyScalar(0.03);
         obj.position.sub(v);
         obj.updateMatrix();
         obj.updateMatrixWorld(true);
        } else {
          if(hit) objHit = true;
        }
      });
    });

    if(objHit){
      setMaterialProps(obj, {opacity: 0.3, color: 0xff0000})
    } else {
      resetMaterial(obj);
    }
  });
}



/**
 * addCameraHelper - Adds the camera helper objects to the scene.
 *
 * @return {type}  description
 */
function addCameraHelper(){
  camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
  camera.position.z = 10;

  lookObject = new THREE.Object3D();
  cameraObject = new THREE.Object3D();
  cameraObject.position.z = 10;
  lookObject.rotation.x = 5;
  lookObject.add(cameraObject);
  cameraObject.add(camera);
  scene.add(lookObject);

}


/**
 * addMoveable - add a moveable object to the scene
 *
 * @param  {type} group description
 * @return {type}       description
 */
function addMoveable(group){
  // Clone materials.
  group.traverse(function(o){
    if(o instanceof THREE.Mesh){
      o.material = o.material.clone();
    }
  });

  scene.add(group);
  moveables.push(group);
  collisionObjects.push(group);
}


/**
 * loadMoveable - Load a GLTF model and put it in the GUI
 *
 * @param  {type} asset description
 * @return {type}       description
 */
function loadMoveable(asset){
  loadGLtf(asset, function(gltf){
    gltf.scene.traverse(function(o){
      if(o instanceof THREE.Mesh){
        if(o.name && /glass/.test(o.name)) return;
        if(o.name && /^snap/.test(o.name)){
          gltf.scene.userData.wallSnap = true;
          o.visible = false;
        }
        if(o.name && /obj_snap/.test(o.name)){
          gltf.scene.userData.objSnap = true;
          o.visible = false;
        }

        o.receiveShadow = true;
        o.castShadow = true;
      }

    });

    hud.addDroppable(gltf);
  });

}

function setupInputListeners(){
  window.addEventListener( 'mousedown', function(event){
    mouseDown = true;
    movingObject = null;

    for(var i = 0; i < hud.droppables.length; i++){
      var intersects = hudRaycaster.intersectObjects( hud.droppables[i].prop.children );
      if(intersects.length){
        //console.log(intersects);
        var prop = hud.droppables[i].gltf.scene.clone();
        addMoveable(prop);
        movingObject = prop;
        return;
      }
    }

    for(var i = 0; i < moveables.length; i++){
      var intersects = raycaster.intersectObjects( moveables[i].children );
      if(intersects.length){
        movingObject = moveables[i];
        return;
      }
    }
  }, false);

  window.addEventListener( 'mouseup', function(event){
    mouseDown = false;
    movingObjectOffset = null;
  }, false);

  window.addEventListener( 'mousewheel', function(event){

    cameraObject.position.z += event.deltaY/100;
    event.preventDefault();
  });

  window.addEventListener( 'mousemove', function ( event ) {
    lastMouse.copy(mouse);
  	// calculate mouse position in normalized device coordinates
  	// (-1 to +1) for both components
  	mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
  	mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;

    mouseDelta.copy(mouse);
    mouseDelta.sub(lastMouse);
  }, false );

  window.addEventListener( 'keydown', function( event) {
    if(!movingObject) return;
    if(event.key == "ArrowRight"){
      movingObject.rotation.y -= Math.PI / 2;
    }
    if(event.key == "ArrowLeft"){
      movingObject.rotation.y += Math.PI / 2;
    }
  }, false)
}

var animate = function () {

  // update the picking ray with the camera and mouse position
	raycaster.setFromCamera( mouse, camera );
  hudRaycaster.setFromCamera( mouse, hud.camera );
  hudRaycaster.far = 100;
  hudRaycaster.near = -100

  testCollisionObjects();

  // calculate objects intersecting the picking ray
	var intersects = raycaster.intersectObjects( [movePlane] );
  if(intersects.length && mouseDown){

    if(movingObject){
      if(!movingObjectOffset) movingObjectOffset = intersects[0].point.clone().sub(movingObject.position);

      var test = collisionTest(movingObject, room);
      var hit = false;
      test.forEach(function(r){
        r.forEach(function(t){
          hit = true;
        });
      });
      if(!hit || movingObject.userData.wallSnap){
        var v = movingObject.position.clone().sub(intersects[0].point.clone().sub(movingObjectOffset));
        var dist = v.length();
        v.normalize();
        v.multiplyScalar(dist*0.1);
        v.y = 0;
        movingObject.position.sub(v);
        movingObject.updateMatrix();
        movingObject.updateMatrixWorld(true);
      }

      if(movingObject.userData.wallSnap){
        if(wallSnapObject(movingObject)){
          resetMaterial(movingObject);
        } else {
          setMaterialProps(movingObject, {opacity: 0.3, transparent: true})
        }
      }
    } else {
      lookObject.position.x -= mouseDelta.x * 10;
      lookObject.position.z += mouseDelta.y * 10;
      mouseDelta.set(0,0);
    }

  }

  hud.render();

	requestAnimationFrame( animate );
	renderer.render( scene, camera );
};

setupInputListeners();

loadScene('room1.gltf');

loadMoveable('montre.gltf');
loadMoveable('montre2.gltf');
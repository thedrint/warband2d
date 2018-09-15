"use strict";

import {Event} from "./../Game.js";
import {KeyboardState} from "./../KeyboardState.js";

import * as THREE from "three";
import * as TWEEN from "es6-tween";

export class ThreeEngine {
	constructor () {
		// scene objects
		this.objects = new Map();
		this.playerGameObject = null;
		this.tweens = new Map();
		// scene, camera and renderer
		this.tools = {};
		// apply handlers on future events
		this.setupEventsHandlers();
	}

	setupScene () {
		console.log('ThreeEngine.setupScene');

		// simple scene
		let scene = new THREE.Scene();
		let camera = new THREE.PerspectiveCamera( 45, window.innerWidth/window.innerHeight, 1, 1000 );

		// setup and apply renderer to document
		let renderer = new THREE.WebGLRenderer({ antialias: true });
		renderer.setSize( window.innerWidth*0.9, window.innerHeight*0.9 );
		document.body.appendChild( renderer.domElement );

		let Axes = new THREE.AxesHelper(10);
        scene.add(Axes);

        // camera view position
		camera.position.set(0, 0, 50);
		camera.lookAt(0, 0, 0);

        let floorTexture = new THREE.TextureLoader().load( './img/checkerboard.jpg' );
        floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping;
        floorTexture.repeat.set( 5, 5 );
        let floorMaterial = new THREE.MeshBasicMaterial( { map: floorTexture, side: THREE.DoubleSide } );
        let floorGeometry = new THREE.PlaneGeometry(25, 25, 10, 10);
        let floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.position.z = -0.5;
        // floor.rotation.x = Math.PI / 2;
        scene.add(floor);

		let kbd = new KeyboardState();

		// freeze tools for speedup
		this.tools = Object.freeze({ scene, camera, renderer, kbd});

		// Test object and center of the scene
		this.addObject({color:'white'}, {x:0, y: 0}, true);

		// Start clock sync
		this.clock = new THREE.Clock(true);
		// start animation loop
		this.animate();
	}

	// recursive function
	animate() {
		requestAnimationFrame( this.animate.bind(this) );// bind help us: "this" everytime is ThreeEngine object
		this.render();
	}

	render () {
		let { scene, camera, renderer } = this.tools;
		this.delta = this.clock.getDelta();
		//TEST: rotation is only for testing
		this.objectsRotation();
		this.objectsTweens();
		this.movePlayer();
		this.rotatePlayer();

		renderer.render( scene, camera );
	}

	//TEST: this is test function - it rotate all objects a little each frame
	objectsRotation () {
		// let timer = this.timer;
		this.objects.forEach( (object) => {
				// object.rotation.x += this.delta;
				// object.rotation.y += this.delta;
				// object.rotation.z += this.delta;
		});
	}

	objectsTweens () {
		// TWEEN.update();
		this.tweens.forEach( (tweens, object) => {
			tweens.forEach( (tween ) => {tween.update()});
		});
	}

	addObject (gameObject, position, staticObjectFlag = false) {
		console.log('ThreeEngine.addObject', gameObject, position);
		let { scene, camera } = this.tools;


		let geometry = new THREE.BoxGeometry( 1, 1, 1 );
		let material = new THREE.MeshBasicMaterial( { color: gameObject.color } );
        let object = new THREE.Mesh(geometry, material);

        if( gameObject.isPlayer && gameObject.isPlayer === true ) {
            this.playerGameObject = gameObject;
            camera.position.z = 25;
            camera.position.y = -15;
            // Attach camera to player
            object.add(camera);
            camera.lookAt(object.position);
        }

        if (staticObjectFlag === true) {
            object.matrixAutoUpdate = false;
        }
    	else {
            object
                .translateX(position.x)
                .translateY(position.y);
        }
		scene
			.add(object);

		this.objects.set(gameObject, object);
	}

	moveGameObjectTo (gameObject, targetPosition) {
		console.log('ThreeEngine.moveObjectTo', gameObject, targetPosition);
		let object = this.objects.get(gameObject);
		let currentPosition = object.position;
		let distance = currentPosition.distanceTo(targetPosition);
		let speed = distance / this.delta;
		let tween = new TWEEN.Tween(currentPosition).to(targetPosition, speed);
		tween.easing(TWEEN.Easing.Elastic.InOut);
		tween.start();

		if( !this.tweens.has(object) )
			this.tweens.set(object, new Set());
		this.tweens.get(object).add(tween);
	}

	movePlayer () {
        if( this.playerGameObject === null )
            return false;

        let {kbd} = this.tools;
        kbd.update();
        let movingPressed = (kbd.pressed("W") || kbd.pressed("A") || kbd.pressed("S") || kbd.pressed("D") );
        if( !movingPressed )
        	return false;

        let playerObject = this.objects.get(this.playerGameObject);
        let playerCurrentTweens = this.tweens.get(playerObject);
        if( playerCurrentTweens )
            playerCurrentTweens.forEach( (tween ) => {tween.stop()});
        // let direction = playerObject.getWorldPosition();

        // calculate distance for single player move
		//TODO: It related to outfit weight, agility and other player stats
        let speed = 0.9;// distance that object take per delta

        // calculate move vector
        let x = 0, y = 0, z = 0;
        if( kbd.pressed("W") ) y = 1;
        if( kbd.pressed("A") ) x = -1;
        if( kbd.pressed("S") ) y = -1;
        if( kbd.pressed("D") ) x = 1;

        // let moveForwardMatrix = new THREE.Matrix4().makeTranslation(x, y, z);
        // console.log(moveForwardMatrix);
        // playerObject.translateOnAxis({x, y, z}, distance);
        // console.log(playerObject.position);
        // let moveMatrix = playerObject.matrix.multiplyMatrices(moveForwardMatrix, playerObject.matrix);
        // playerObject.applyMatrix();

		let startPosition = new THREE.Vector3(0,0,0);
		let endPosition = new THREE.Vector3(x,y,z);
        let tween = new TWEEN.Tween(startPosition).to(endPosition, this.delta);
        tween.easing(TWEEN.Easing.Elastic.Out);
        tween.start();
        let obj = this;
        // Every tick this function calls
        tween.on('update', function(coords){
        	// console.log(playerObject);
            playerObject.translateOnAxis(coords, obj.delta*10);
		});
        tween.on('complete', function(){
        	console.log('step!');
		})

        if( !this.tweens.has(playerObject) )
            this.tweens.set(playerObject, new Set());
        this.tweens.get(playerObject).add(tween);
	}

    rotatePlayer () {
        if( this.playerGameObject === null )
            return false;

        let {kbd} = this.tools;
        kbd.update();
        let rotatePressed = (kbd.pressed("left") || kbd.pressed("right") || kbd.pressed("up") || kbd.pressed("down") );
        if( !rotatePressed )
            return false;

        let playerObject = this.objects.get(this.playerGameObject);
        let angle = 0.01;
        if( kbd.pressed("left") )
            playerObject.rotateZ(Math.PI*angle);
        if ( kbd.pressed("right") )
            playerObject.rotateZ(-Math.PI*angle);
        // if(  kbd.pressed("up") )
        //     playerObject.rotateX(Math.PI*angle);
        // if(  kbd.pressed("down") )
        //     playerObject.rotateX(-Math.PI*angle);
	}

	setupEventsHandlers () {
		// console.log('Engine handlers definition');
		let obj = this;
		Event.on('GameScene.Init', function(gameScene){
			console.log('ThreeEngine.on.GameScene.Init', gameScene);
			obj.setupScene();
		});
		Event.on('GameScene.addObject', function(gameScene, gameObject, position){
			console.log('ThreeEngine.on.GameScene.addObject', gameScene, gameObject, position)
			obj.addObject(gameObject, position);
		});
		Event.on('GameScene.moveObjectTo', function(gameObject, targetPosition){
			console.log('ThreeEngine.on.GameScene.moveObjectTo', gameObject, targetPosition)
			obj.moveObjectTo(gameObject, targetPosition);
		});
        document.addEventListener( 'keypress', obj.onKeyPress, false );
    }
}

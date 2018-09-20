"use strict";

import {Event} from "./../Game.js";
import {KeyboardHelper as KeyboardState} from "./../KeyboardHelper.js";
import Input from "./../Input.js";
import img from "./../img/Tile_Floor_texture.png";
import Canvas2Image from "./../tools/canvas2image.js";

import * as THREE from "three";
import GLTFLoader from "three-gltf-loader";

import Troop from './Troop.js';
import Player from './Player.js';

export class ThreeEngine {
	constructor() {
		// scene objects
		this.objects = new Map();
		// scene, camera and renderer
		this.tools = {};

		// Player tools
		this.playerGameObject = null;

		// Helpers
		this.helpersActive = true;
		this.helpers = new Set();

		this.pointerLockRequested = false;
		this.initLoading();
		this.initTools();
		// apply handlers on future events
		this.setupEventsHandlers();
	}

	initLoading () {
		this.loading = {};

		let RESOURCES_LOADED = false, screen, manager;

		screen = {
			scene: new THREE.Scene(),
			camera: new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.1, 100),
			box: new THREE.Mesh(
				new THREE.BoxGeometry(0.5,0.5,0.5),
				new THREE.MeshBasicMaterial({ color:0x4444ff })
			)
		};
		screen.box.position.set(0,0,5);
		screen.camera.lookAt(screen.box.position);
		screen.scene.add(screen.box);

		manager = new THREE.LoadingManager();
		//loadingManager.onStart = ( url, itemsLoaded, itemsTotal ) =>
		// 	console.log( 'Started loading file: ' + url + '.\nLoaded ' + itemsLoaded + ' of ' + itemsTotal + ' files.' );
		//loadingManager.onProgress = (item, loaded, total) =>
		// 	console.log('Loading file', item, '\nLoaded', loaded, 'of', total);
		manager.onError = item =>
			console.log( 'There was an error loading item', item);
		manager.onLoad = () => {
			console.log("loaded all resources");
			this.loading.RESOURCES_LOADED = true;
		};

		this.loading = {RESOURCES_LOADED, screen, manager};
	}

	initTools () {
		let renderer, scene, camera, kbd;
		kbd = new KeyboardState();
		scene = new THREE.Scene();
		camera = new THREE.PerspectiveCamera();
		renderer = new THREE.WebGLRenderer({
			antialias: true,
			powerPreference: 'high-performance',
			preserveDrawingBuffer: true,// for screenshots by pressing R
		});
		this.tools = Object.freeze({renderer, scene, camera, kbd});
	}

	showLoadingScreen () {
		if( this.loading.RESOURCES_LOADED === true )
			return false;

		let {renderer} = this.tools;
		let {screen} = this.loading;


		screen.box.position.x -= 0.05;
		if( screen.box.position.x < -10 ) screen.box.position.x = 10;
		screen.box.position.y = Math.sin(screen.box.position.x);

		renderer.render(screen.scene, screen.camera);
		requestAnimationFrame(this.animate.bind(this));
		return true; // Stop the function here.
	}

	setupScene(gameScene) {
		console.log('ThreeEngine.setupScene', gameScene);
		let {renderer, scene, camera} = this.tools;

		// simple scene
		scene.background = new THREE.Color(0x333333);
		//scene.fog = new THREE.Fog(0x000000, 250, 1400);

		let dirLight = new THREE.DirectionalLight(0xffffff, 0.125);
		dirLight.position.set(0, 0, 1).normalize();
		scene.add(dirLight);
		//
		let pointLight = new THREE.PointLight(0xffffff, 1.5);
		pointLight.position.set(0, 100, 90);
		scene.add(pointLight);

		camera.fov = 45;
		camera.aspect = window.innerWidth / window.innerHeight;
		camera.near = 1;
		camera.far = 10000;
		camera.updateProjectionMatrix();

		// setup and apply renderer to document
		renderer.setPixelRatio(window.devicePixelRatio);
		renderer.setSize(window.innerWidth, window.innerHeight);
		document.body.appendChild( renderer.domElement );
		Event.trigger('ThreeEngine.requestPointerLock', this);
		renderer.domElement.addEventListener('click', () => this.requestPointerLock() );

		if( this.helpersActive ) {
			let Axes = new THREE.AxesHelper(20);
			// noinspection JSUndefinedPropertyAssignment
			Axes.name = 'Helper';
			this.helpers.add(Axes);
			scene.add(Axes);
		}

		// camera view position
		// camera.position.set(-10, 50, -10);
		// camera.lookAt(0, 0, 0);

		let floor = this.loadFloor(gameScene);
		scene.add(floor);

		// Start clock sync
		this.clock = new THREE.Clock(true);
		// start animation loop
		this.animate();
	}


	// ANIMATION LOOP - recursive function
	animate() {
		// Пока не завершена загрузка данных - показываем загрузчик
		if( this.showLoadingScreen() )
			return;

		requestAnimationFrame(this.animate.bind(this));// bind help us: "this" everytime is ThreeEngine object
		this.render();
	}

	// Maybe main function of this engine - render on each frame
	render() {
		let {scene, camera, renderer, kbd} = this.tools;
		this.delta = this.clock.getDelta();
		kbd.update();

		this.objects.forEach( (engineObject) => {
			engineObject.update();
		});
		// this.animatePlayer();
		// this.movePlayer();

		renderer.render(scene, camera);
	}

	getObject (gameObject) {
		return this.objects.get(gameObject);
	}

	addObject(gameObject, position, staticObjectFlag = false) {
		console.log('ThreeEngine.addObject', gameObject, position, staticObjectFlag);

		if (gameObject.isPlayer && gameObject.isPlayer === true)
			return this.loadPlayerModel(gameObject, position);
		else
			return this.loadTroopModel(gameObject, position);
	}

	addBoundingBoxHelper (model, object) {
		let box = new THREE.Box3().setFromObject( model );
		let helper = new THREE.Box3Helper(box, 0xffff00);
		// noinspection JSUndefinedPropertyAssignment
		helper.name = 'Helper';
		object.add(helper);

		if( !this.helpersActive )
			{ // noinspection JSUndefinedPropertyAssignment
				helper.visible = false;
			}
		this.helpers.add(helper);

	}

	loadFloor (gameScene) {
		const textureLoader = new THREE.TextureLoader(this.loading.manager);

		let texture = textureLoader.load(img, texture => {
			texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
			texture.offset.set( 0, 0 );
			texture.repeat.set( 10, 10 );
		});
		let floor = new THREE.Mesh(
			new THREE.PlaneBufferGeometry(gameScene.width, gameScene.depth),
			new THREE.MeshBasicMaterial({map:texture, color: 0xffffff, opacity: 0.5, transparent: true})
		);
		floor.position.y = -0.5;
		floor.rotation.x = -Math.PI / 2;

		return floor;
	}

	loadTroopModel (gameObject, position) {
		const model = './src/game/models/spider/spider.glb';
		const loader = new GLTFLoader(this.loading.manager);
		loader.load(model,
			importedObject => this.addTroopModel2Scene(importedObject, gameObject, position),
			xhr => console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' ),
			error => console.log( 'An error happened while loading', error )
		);

		return true;
	}

	addTroopModel2Scene (model, gameObject, position) {
		console.log('addTroopModel2Scene', model, gameObject, position);
		let {scene} = this.tools;

		let troop = new Troop(this);
		troop.initObject3dFromGltfModel(model)
			.initPosition(position)
			.initAni(model)
		;

		this.addBoundingBoxHelper(troop.model, troop.object);

		troop.object.name = gameObject.title;

		scene.add(troop.object);
		this.objects.set(gameObject, troop);

		return true;
	}

	loadPlayerModel (gameObject, position) {
		// const model = './src/game/models/t-rex/T-Rex.glb';
		// const loader = new GLTFLoader(this.loadingManager);
		// noinspection SpellCheckingInspection
		const model = './src/game/models/marine/marine_anims_core.json';
		const loader = new THREE.ObjectLoader(this.loading.manager);
		loader.load(model,
			importedObject => {
				let mesh = null;
				importedObject.traverse( function ( child ) {
					if ( child instanceof THREE.SkinnedMesh ) {
						mesh = child;
					}
				} );
				if( mesh )
					this.addPlayerModel2Scene(mesh, gameObject, position)
			},
			xhr => console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' ),
			error => console.log( 'An error happened while loading', error )
		);

		return true;
	}

	addPlayerModel2Scene (model, gameObject, position) {
		console.log('addPlayerModel2Scene', model, gameObject, position);
		let {scene, camera} = this.tools;
		this.playerGameObject = gameObject;

		let player = new Player(this);

		player.initObject3dFromJsonModel(model)
			.initPosition(position)
			.bindCamera(camera)
			.initAni(model);

		//TODO: It doesnt work by some reason
		this.addBoundingBoxHelper(player.model, player.object);

		player.object.name = gameObject.title;

		scene.add(player.object);
		this.objects.set(gameObject, player);

		return true;
	}

	setupEventsHandlers() {
		console.log('Engine handlers definition');

		// Game events
		Event.on( 'GameScene.Init', gameScene => this.setupScene(gameScene) );
		Event.on( 'GameScene.addObject', (gameObject, position) => this.addObject(gameObject, position) );

		// Browser events
		window.addEventListener('resize', () => this.resizeGame() );
		document.addEventListener('pointerlockchange', () => this.togglePointerLock(), false);

		// Dirty hacks for removeEventListener
		// this.rotateByMouseHandler = Input.onMouseMove;
		// this.eventKeyDownHandler = Input.onKeyDown;
		this.takeScreenshotHandler = this.takeScreenshot.bind(this);
		this.toggleHelpersHandler = this.toggleHelpers.bind(this);
	}

	/////////////////////////////////////////////////////////////////////////////
	// STUFF                                                                   //
	/////////////////////////////////////////////////////////////////////////////

	resizeGame () {
		let {renderer, camera} = this.tools;

		let aspectRatio = window.innerWidth / window.innerHeight;

		renderer.setSize(window.innerWidth, window.innerHeight);
		camera.aspect = aspectRatio;
		camera.updateProjectionMatrix();
	}

	requestPointerLock () {
		if( this.pointerLockRequested )
			return true;

		let {renderer} = this.tools;
		renderer.domElement.requestPointerLock()
	}

	togglePointerLock () {
		let {renderer} = this.tools;

		if( document.pointerLockElement === renderer.domElement ) {
			console.log('Pointer has locked by game');
			// Enable interacting with Game world
			Input.enable(renderer);
			document.addEventListener("keydown",  this.takeScreenshotHandler, true);
			document.addEventListener("keydown",  this.toggleHelpersHandler, true);

			// this.Keyboard('w, a, s, d', 'gameScene', this.animatePlayerHandler);
			// this.Keyboard('w, a, s, d', 'gameScene', this.movePlayerHandler);

			this.pointerLockRequested = true;
		}
		else {
			console.log('Pointer released');
			// Disable interacting with Game world
			Input.disable(renderer);
			document.removeEventListener("keydown",  this.takeScreenshotHandler, true);
			document.removeEventListener("keydown",  this.toggleHelpersHandler, true);

			// this.Keyboard.deleteScope('gameScene');
			this.pointerLockRequested = false;
		}
	}

	// press R to make screenshot
	takeScreenshot (event) {
		if( event.code !== 'KeyR' )
			return true;

		let {renderer} = this.tools;
		let screenshoter = new Canvas2Image();
		screenshoter.saveAsPNG(renderer.domElement);
	}
	// press H to toggle helpers
	toggleHelpers (event) {
		if( event.code !== 'KeyH' )
			return true;

		this.helpersActive = !this.helpersActive;
		this.helpers.forEach( object3D => object3D.visible = this.helpersActive );
	}
}

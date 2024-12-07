(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('three')) :
	typeof define === 'function' && define.amd ? define(['exports', 'three'], factory) :
	(global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.Editor3js = {}, global.THREE));
})(this, (function (exports, three) { 'use strict';

	const _raycaster = new three.Raycaster();

	const _tempVector = new three.Vector3();
	const _tempVector2 = new three.Vector3();
	const _tempQuaternion = new three.Quaternion();
	const _unit = {
		X: new three.Vector3( 1, 0, 0 ),
		Y: new three.Vector3( 0, 1, 0 ),
		Z: new three.Vector3( 0, 0, 1 )
	};

	const _changeEvent = { type: 'change' };
	const _mouseDownEvent = { type: 'mouseDown', mode: null };
	const _mouseUpEvent = { type: 'mouseUp', mode: null };
	const _objectChangeEvent = { type: 'objectChange' };

	class TransformControls extends three.Controls {

		constructor( camera, domElement = null ) {

			super( undefined, domElement );

			const root = new TransformControlsRoot( this );
			this._root = root;

			const gizmo = new TransformControlsGizmo();
			this._gizmo = gizmo;
			root.add( gizmo );

			const plane = new TransformControlsPlane();
			this._plane = plane;
			root.add( plane );

			const scope = this;

			// Defined getter, setter and store for a property
			function defineProperty( propName, defaultValue ) {

				let propValue = defaultValue;

				Object.defineProperty( scope, propName, {

					get: function () {

						return propValue !== undefined ? propValue : defaultValue;

					},

					set: function ( value ) {

						if ( propValue !== value ) {

							propValue = value;
							plane[ propName ] = value;
							gizmo[ propName ] = value;

							scope.dispatchEvent( { type: propName + '-changed', value: value } );
							scope.dispatchEvent( _changeEvent );

						}

					}

				} );

				scope[ propName ] = defaultValue;
				plane[ propName ] = defaultValue;
				gizmo[ propName ] = defaultValue;

			}

			// Define properties with getters/setter
			// Setting the defined property will automatically trigger change event
			// Defined properties are passed down to gizmo and plane

			defineProperty( 'camera', camera );
			defineProperty( 'object', undefined );
			defineProperty( 'enabled', true );
			defineProperty( 'axis', null );
			defineProperty( 'mode', 'translate' );
			defineProperty( 'translationSnap', null );
			defineProperty( 'rotationSnap', null );
			defineProperty( 'scaleSnap', null );
			defineProperty( 'space', 'world' );
			defineProperty( 'size', 1 );
			defineProperty( 'dragging', false );
			defineProperty( 'showX', true );
			defineProperty( 'showY', true );
			defineProperty( 'showZ', true );
			defineProperty( 'minX', - Infinity );
			defineProperty( 'maxX', Infinity );
			defineProperty( 'minY', - Infinity );
			defineProperty( 'maxY', Infinity );
			defineProperty( 'minZ', - Infinity );
			defineProperty( 'maxZ', Infinity );

			// Reusable utility variables

			const worldPosition = new three.Vector3();
			const worldPositionStart = new three.Vector3();
			const worldQuaternion = new three.Quaternion();
			const worldQuaternionStart = new three.Quaternion();
			const cameraPosition = new three.Vector3();
			const cameraQuaternion = new three.Quaternion();
			const pointStart = new three.Vector3();
			const pointEnd = new three.Vector3();
			const rotationAxis = new three.Vector3();
			const rotationAngle = 0;
			const eye = new three.Vector3();

			// TODO: remove properties unused in plane and gizmo

			defineProperty( 'worldPosition', worldPosition );
			defineProperty( 'worldPositionStart', worldPositionStart );
			defineProperty( 'worldQuaternion', worldQuaternion );
			defineProperty( 'worldQuaternionStart', worldQuaternionStart );
			defineProperty( 'cameraPosition', cameraPosition );
			defineProperty( 'cameraQuaternion', cameraQuaternion );
			defineProperty( 'pointStart', pointStart );
			defineProperty( 'pointEnd', pointEnd );
			defineProperty( 'rotationAxis', rotationAxis );
			defineProperty( 'rotationAngle', rotationAngle );
			defineProperty( 'eye', eye );

			this._offset = new three.Vector3();
			this._startNorm = new three.Vector3();
			this._endNorm = new three.Vector3();
			this._cameraScale = new three.Vector3();

			this._parentPosition = new three.Vector3();
			this._parentQuaternion = new three.Quaternion();
			this._parentQuaternionInv = new three.Quaternion();
			this._parentScale = new three.Vector3();

			this._worldScaleStart = new three.Vector3();
			this._worldQuaternionInv = new three.Quaternion();
			this._worldScale = new three.Vector3();

			this._positionStart = new three.Vector3();
			this._quaternionStart = new three.Quaternion();
			this._scaleStart = new three.Vector3();

			this._getPointer = getPointer.bind( this );
			this._onPointerDown = onPointerDown.bind( this );
			this._onPointerHover = onPointerHover.bind( this );
			this._onPointerMove = onPointerMove.bind( this );
			this._onPointerUp = onPointerUp.bind( this );

			if ( domElement !== null ) {

				this.connect();

			}

		}

		connect() {

			this.domElement.addEventListener( 'pointerdown', this._onPointerDown );
			this.domElement.addEventListener( 'pointermove', this._onPointerHover );
			this.domElement.addEventListener( 'pointerup', this._onPointerUp );

			this.domElement.style.touchAction = 'none'; // disable touch scroll

		}

		disconnect() {

			this.domElement.removeEventListener( 'pointerdown', this._onPointerDown );
			this.domElement.removeEventListener( 'pointermove', this._onPointerHover );
			this.domElement.removeEventListener( 'pointermove', this._onPointerMove );
			this.domElement.removeEventListener( 'pointerup', this._onPointerUp );

			this.domElement.style.touchAction = 'auto';

		}

		getHelper() {

			return this._root;

		}

		pointerHover( pointer ) {

			if ( this.object === undefined || this.dragging === true ) return;

			if ( pointer !== null ) _raycaster.setFromCamera( pointer, this.camera );

			const intersect = intersectObjectWithRay( this._gizmo.picker[ this.mode ], _raycaster );

			if ( intersect ) {

				this.axis = intersect.object.name;

			} else {

				this.axis = null;

			}

		}

		pointerDown( pointer ) {

			if ( this.object === undefined || this.dragging === true || ( pointer != null && pointer.button !== 0 ) ) return;

			if ( this.axis !== null ) {

				if ( pointer !== null ) _raycaster.setFromCamera( pointer, this.camera );

				const planeIntersect = intersectObjectWithRay( this._plane, _raycaster, true );

				if ( planeIntersect ) {

					this.object.updateMatrixWorld();
					this.object.parent.updateMatrixWorld();

					this._positionStart.copy( this.object.position );
					this._quaternionStart.copy( this.object.quaternion );
					this._scaleStart.copy( this.object.scale );

					this.object.matrixWorld.decompose( this.worldPositionStart, this.worldQuaternionStart, this._worldScaleStart );

					this.pointStart.copy( planeIntersect.point ).sub( this.worldPositionStart );

				}

				this.dragging = true;
				_mouseDownEvent.mode = this.mode;
				this.dispatchEvent( _mouseDownEvent );

			}

		}

		pointerMove( pointer ) {

			const axis = this.axis;
			const mode = this.mode;
			const object = this.object;
			let space = this.space;

			if ( mode === 'scale' ) {

				space = 'local';

			} else if ( axis === 'E' || axis === 'XYZE' || axis === 'XYZ' ) {

				space = 'world';

			}

			if ( object === undefined || axis === null || this.dragging === false || ( pointer !== null && pointer.button !== - 1 ) ) return;

			if ( pointer !== null ) _raycaster.setFromCamera( pointer, this.camera );

			const planeIntersect = intersectObjectWithRay( this._plane, _raycaster, true );

			if ( ! planeIntersect ) return;

			this.pointEnd.copy( planeIntersect.point ).sub( this.worldPositionStart );

			if ( mode === 'translate' ) {

				// Apply translate

				this._offset.copy( this.pointEnd ).sub( this.pointStart );

				if ( space === 'local' && axis !== 'XYZ' ) {

					this._offset.applyQuaternion( this._worldQuaternionInv );

				}

				if ( axis.indexOf( 'X' ) === - 1 ) this._offset.x = 0;
				if ( axis.indexOf( 'Y' ) === - 1 ) this._offset.y = 0;
				if ( axis.indexOf( 'Z' ) === - 1 ) this._offset.z = 0;

				if ( space === 'local' && axis !== 'XYZ' ) {

					this._offset.applyQuaternion( this._quaternionStart ).divide( this._parentScale );

				} else {

					this._offset.applyQuaternion( this._parentQuaternionInv ).divide( this._parentScale );

				}

				object.position.copy( this._offset ).add( this._positionStart );

				// Apply translation snap

				if ( this.translationSnap ) {

					if ( space === 'local' ) {

						object.position.applyQuaternion( _tempQuaternion.copy( this._quaternionStart ).invert() );

						if ( axis.search( 'X' ) !== - 1 ) {

							object.position.x = Math.round( object.position.x / this.translationSnap ) * this.translationSnap;

						}

						if ( axis.search( 'Y' ) !== - 1 ) {

							object.position.y = Math.round( object.position.y / this.translationSnap ) * this.translationSnap;

						}

						if ( axis.search( 'Z' ) !== - 1 ) {

							object.position.z = Math.round( object.position.z / this.translationSnap ) * this.translationSnap;

						}

						object.position.applyQuaternion( this._quaternionStart );

					}

					if ( space === 'world' ) {

						if ( object.parent ) {

							object.position.add( _tempVector.setFromMatrixPosition( object.parent.matrixWorld ) );

						}

						if ( axis.search( 'X' ) !== - 1 ) {

							object.position.x = Math.round( object.position.x / this.translationSnap ) * this.translationSnap;

						}

						if ( axis.search( 'Y' ) !== - 1 ) {

							object.position.y = Math.round( object.position.y / this.translationSnap ) * this.translationSnap;

						}

						if ( axis.search( 'Z' ) !== - 1 ) {

							object.position.z = Math.round( object.position.z / this.translationSnap ) * this.translationSnap;

						}

						if ( object.parent ) {

							object.position.sub( _tempVector.setFromMatrixPosition( object.parent.matrixWorld ) );

						}

					}

				}

				object.position.x = Math.max( this.minX, Math.min( this.maxX, object.position.x ) );
				object.position.y = Math.max( this.minY, Math.min( this.maxY, object.position.y ) );
				object.position.z = Math.max( this.minZ, Math.min( this.maxZ, object.position.z ) );

			} else if ( mode === 'scale' ) {

				if ( axis.search( 'XYZ' ) !== - 1 ) {

					let d = this.pointEnd.length() / this.pointStart.length();

					if ( this.pointEnd.dot( this.pointStart ) < 0 ) d *= - 1;

					_tempVector2.set( d, d, d );

				} else {

					_tempVector.copy( this.pointStart );
					_tempVector2.copy( this.pointEnd );

					_tempVector.applyQuaternion( this._worldQuaternionInv );
					_tempVector2.applyQuaternion( this._worldQuaternionInv );

					_tempVector2.divide( _tempVector );

					if ( axis.search( 'X' ) === - 1 ) {

						_tempVector2.x = 1;

					}

					if ( axis.search( 'Y' ) === - 1 ) {

						_tempVector2.y = 1;

					}

					if ( axis.search( 'Z' ) === - 1 ) {

						_tempVector2.z = 1;

					}

				}

				// Apply scale

				object.scale.copy( this._scaleStart ).multiply( _tempVector2 );

				if ( this.scaleSnap ) {

					if ( axis.search( 'X' ) !== - 1 ) {

						object.scale.x = Math.round( object.scale.x / this.scaleSnap ) * this.scaleSnap || this.scaleSnap;

					}

					if ( axis.search( 'Y' ) !== - 1 ) {

						object.scale.y = Math.round( object.scale.y / this.scaleSnap ) * this.scaleSnap || this.scaleSnap;

					}

					if ( axis.search( 'Z' ) !== - 1 ) {

						object.scale.z = Math.round( object.scale.z / this.scaleSnap ) * this.scaleSnap || this.scaleSnap;

					}

				}

			} else if ( mode === 'rotate' ) {

				this._offset.copy( this.pointEnd ).sub( this.pointStart );

				const ROTATION_SPEED = 20 / this.worldPosition.distanceTo( _tempVector.setFromMatrixPosition( this.camera.matrixWorld ) );

				let _inPlaneRotation = false;

				if ( axis === 'XYZE' ) {

					this.rotationAxis.copy( this._offset ).cross( this.eye ).normalize();
					this.rotationAngle = this._offset.dot( _tempVector.copy( this.rotationAxis ).cross( this.eye ) ) * ROTATION_SPEED;

				} else if ( axis === 'X' || axis === 'Y' || axis === 'Z' ) {

					this.rotationAxis.copy( _unit[ axis ] );

					_tempVector.copy( _unit[ axis ] );

					if ( space === 'local' ) {

						_tempVector.applyQuaternion( this.worldQuaternion );

					}

					_tempVector.cross( this.eye );

					// When _tempVector is 0 after cross with this.eye the vectors are parallel and should use in-plane rotation logic.
					if ( _tempVector.length() === 0 ) {

						_inPlaneRotation = true;

					} else {

						this.rotationAngle = this._offset.dot( _tempVector.normalize() ) * ROTATION_SPEED;

					}


				}

				if ( axis === 'E' || _inPlaneRotation ) {

					this.rotationAxis.copy( this.eye );
					this.rotationAngle = this.pointEnd.angleTo( this.pointStart );

					this._startNorm.copy( this.pointStart ).normalize();
					this._endNorm.copy( this.pointEnd ).normalize();

					this.rotationAngle *= ( this._endNorm.cross( this._startNorm ).dot( this.eye ) < 0 ? 1 : - 1 );

				}

				// Apply rotation snap

				if ( this.rotationSnap ) this.rotationAngle = Math.round( this.rotationAngle / this.rotationSnap ) * this.rotationSnap;

				// Apply rotate
				if ( space === 'local' && axis !== 'E' && axis !== 'XYZE' ) {

					object.quaternion.copy( this._quaternionStart );
					object.quaternion.multiply( _tempQuaternion.setFromAxisAngle( this.rotationAxis, this.rotationAngle ) ).normalize();

				} else {

					this.rotationAxis.applyQuaternion( this._parentQuaternionInv );
					object.quaternion.copy( _tempQuaternion.setFromAxisAngle( this.rotationAxis, this.rotationAngle ) );
					object.quaternion.multiply( this._quaternionStart ).normalize();

				}

			}

			this.dispatchEvent( _changeEvent );
			this.dispatchEvent( _objectChangeEvent );

		}

		pointerUp( pointer ) {

			if ( pointer !== null && pointer.button !== 0 ) return;

			if ( this.dragging && ( this.axis !== null ) ) {

				_mouseUpEvent.mode = this.mode;
				this.dispatchEvent( _mouseUpEvent );

			}

			this.dragging = false;
			this.axis = null;

		}

		dispose() {

			this.disconnect();

			this._root.dispose();

		}

		// Set current object
		attach( object ) {

			this.object = object;
			this._root.visible = true;

			return this;

		}

		// Detach from object
		detach() {

			this.object = undefined;
			this.axis = null;

			this._root.visible = false;

			return this;

		}

		reset() {

			if ( ! this.enabled ) return;

			if ( this.dragging ) {

				this.object.position.copy( this._positionStart );
				this.object.quaternion.copy( this._quaternionStart );
				this.object.scale.copy( this._scaleStart );

				this.dispatchEvent( _changeEvent );
				this.dispatchEvent( _objectChangeEvent );

				this.pointStart.copy( this.pointEnd );

			}

		}

		getRaycaster() {

			return _raycaster;

		}

		// TODO: deprecate

		getMode() {

			return this.mode;

		}

		setMode( mode ) {

			this.mode = mode;

		}

		setTranslationSnap( translationSnap ) {

			this.translationSnap = translationSnap;

		}

		setRotationSnap( rotationSnap ) {

			this.rotationSnap = rotationSnap;

		}

		setScaleSnap( scaleSnap ) {

			this.scaleSnap = scaleSnap;

		}

		setSize( size ) {

			this.size = size;

		}

		setSpace( space ) {

			this.space = space;

		}

	}

	// mouse / touch event handlers

	function getPointer( event ) {

		if ( this.domElement.ownerDocument.pointerLockElement ) {

			return {
				x: 0,
				y: 0,
				button: event.button
			};

		} else {

			const rect = this.domElement.getBoundingClientRect();

			return {
				x: ( event.clientX - rect.left ) / rect.width * 2 - 1,
				y: - ( event.clientY - rect.top ) / rect.height * 2 + 1,
				button: event.button
			};

		}

	}

	function onPointerHover( event ) {

		if ( ! this.enabled ) return;

		switch ( event.pointerType ) {

			case 'mouse':
			case 'pen':
				this.pointerHover( this._getPointer( event ) );
				break;

		}

	}

	function onPointerDown( event ) {

		if ( ! this.enabled ) return;

		if ( ! document.pointerLockElement ) {

			this.domElement.setPointerCapture( event.pointerId );

		}

		this.domElement.addEventListener( 'pointermove', this._onPointerMove );

		this.pointerHover( this._getPointer( event ) );
		this.pointerDown( this._getPointer( event ) );

	}

	function onPointerMove( event ) {

		if ( ! this.enabled ) return;

		this.pointerMove( this._getPointer( event ) );

	}

	function onPointerUp( event ) {

		if ( ! this.enabled ) return;

		this.domElement.releasePointerCapture( event.pointerId );

		this.domElement.removeEventListener( 'pointermove', this._onPointerMove );

		this.pointerUp( this._getPointer( event ) );

	}

	function intersectObjectWithRay( object, raycaster, includeInvisible ) {

		const allIntersections = raycaster.intersectObject( object, true );

		for ( let i = 0; i < allIntersections.length; i ++ ) {

			if ( allIntersections[ i ].object.visible || includeInvisible ) {

				return allIntersections[ i ];

			}

		}

		return false;

	}

	//

	// Reusable utility variables

	const _tempEuler = new three.Euler();
	const _alignVector = new three.Vector3( 0, 1, 0 );
	const _zeroVector = new three.Vector3( 0, 0, 0 );
	const _lookAtMatrix = new three.Matrix4();
	const _tempQuaternion2 = new three.Quaternion();
	const _identityQuaternion = new three.Quaternion();
	const _dirVector = new three.Vector3();
	const _tempMatrix = new three.Matrix4();

	const _unitX = new three.Vector3( 1, 0, 0 );
	const _unitY = new three.Vector3( 0, 1, 0 );
	const _unitZ = new three.Vector3( 0, 0, 1 );

	const _v1 = new three.Vector3();
	const _v2 = new three.Vector3();
	const _v3 = new three.Vector3();

	class TransformControlsRoot extends three.Object3D {

		constructor( controls ) {

			super();

			this.isTransformControlsRoot = true;

			this.controls = controls;
			this.visible = false;

		}

		// updateMatrixWorld updates key transformation variables
		updateMatrixWorld( force ) {

			const controls = this.controls;

			if ( controls.object !== undefined ) {

				controls.object.updateMatrixWorld();

				if ( controls.object.parent === null ) {

					console.error( 'TransformControls: The attached 3D object must be a part of the scene graph.' );

				} else {

					controls.object.parent.matrixWorld.decompose( controls._parentPosition, controls._parentQuaternion, controls._parentScale );

				}

				controls.object.matrixWorld.decompose( controls.worldPosition, controls.worldQuaternion, controls._worldScale );

				controls._parentQuaternionInv.copy( controls._parentQuaternion ).invert();
				controls._worldQuaternionInv.copy( controls.worldQuaternion ).invert();

			}

			controls.camera.updateMatrixWorld();
			controls.camera.matrixWorld.decompose( controls.cameraPosition, controls.cameraQuaternion, controls._cameraScale );

			if ( controls.camera.isOrthographicCamera ) {

				controls.camera.getWorldDirection( controls.eye ).negate();

			} else {

				controls.eye.copy( controls.cameraPosition ).sub( controls.worldPosition ).normalize();

			}

			super.updateMatrixWorld( force );

		}

		dispose() {

			this.traverse( function ( child ) {

				if ( child.geometry ) child.geometry.dispose();
				if ( child.material ) child.material.dispose();

			} );

		}

	}

	class TransformControlsGizmo extends three.Object3D {

		constructor() {

			super();

			this.isTransformControlsGizmo = true;

			this.type = 'TransformControlsGizmo';

			// shared materials

			const gizmoMaterial = new three.MeshBasicMaterial( {
				depthTest: false,
				depthWrite: false,
				fog: false,
				toneMapped: false,
				transparent: true
			} );

			const gizmoLineMaterial = new three.LineBasicMaterial( {
				depthTest: false,
				depthWrite: false,
				fog: false,
				toneMapped: false,
				transparent: true
			} );

			// Make unique material for each axis/color

			const matInvisible = gizmoMaterial.clone();
			matInvisible.opacity = 0.15;

			const matHelper = gizmoLineMaterial.clone();
			matHelper.opacity = 0.5;

			const matRed = gizmoMaterial.clone();
			matRed.color.setHex( 0xff0000 );

			const matGreen = gizmoMaterial.clone();
			matGreen.color.setHex( 0x00ff00 );

			const matBlue = gizmoMaterial.clone();
			matBlue.color.setHex( 0x0000ff );

			const matRedTransparent = gizmoMaterial.clone();
			matRedTransparent.color.setHex( 0xff0000 );
			matRedTransparent.opacity = 0.5;

			const matGreenTransparent = gizmoMaterial.clone();
			matGreenTransparent.color.setHex( 0x00ff00 );
			matGreenTransparent.opacity = 0.5;

			const matBlueTransparent = gizmoMaterial.clone();
			matBlueTransparent.color.setHex( 0x0000ff );
			matBlueTransparent.opacity = 0.5;

			const matWhiteTransparent = gizmoMaterial.clone();
			matWhiteTransparent.opacity = 0.25;

			const matYellowTransparent = gizmoMaterial.clone();
			matYellowTransparent.color.setHex( 0xffff00 );
			matYellowTransparent.opacity = 0.25;

			const matYellow = gizmoMaterial.clone();
			matYellow.color.setHex( 0xffff00 );

			const matGray = gizmoMaterial.clone();
			matGray.color.setHex( 0x787878 );

			// reusable geometry

			const arrowGeometry = new three.CylinderGeometry( 0, 0.04, 0.1, 12 );
			arrowGeometry.translate( 0, 0.05, 0 );

			const scaleHandleGeometry = new three.BoxGeometry( 0.08, 0.08, 0.08 );
			scaleHandleGeometry.translate( 0, 0.04, 0 );

			const lineGeometry = new three.BufferGeometry();
			lineGeometry.setAttribute( 'position', new three.Float32BufferAttribute( [ 0, 0, 0,	1, 0, 0 ], 3 ) );

			const lineGeometry2 = new three.CylinderGeometry( 0.0075, 0.0075, 0.5, 3 );
			lineGeometry2.translate( 0, 0.25, 0 );

			function CircleGeometry( radius, arc ) {

				const geometry = new three.TorusGeometry( radius, 0.0075, 3, 64, arc * Math.PI * 2 );
				geometry.rotateY( Math.PI / 2 );
				geometry.rotateX( Math.PI / 2 );
				return geometry;

			}

			// Special geometry for transform helper. If scaled with position vector it spans from [0,0,0] to position

			function TranslateHelperGeometry() {

				const geometry = new three.BufferGeometry();

				geometry.setAttribute( 'position', new three.Float32BufferAttribute( [ 0, 0, 0, 1, 1, 1 ], 3 ) );

				return geometry;

			}

			// Gizmo definitions - custom hierarchy definitions for setupGizmo() function

			const gizmoTranslate = {
				X: [
					[ new three.Mesh( arrowGeometry, matRed ), [ 0.5, 0, 0 ], [ 0, 0, - Math.PI / 2 ]],
					[ new three.Mesh( arrowGeometry, matRed ), [ - 0.5, 0, 0 ], [ 0, 0, Math.PI / 2 ]],
					[ new three.Mesh( lineGeometry2, matRed ), [ 0, 0, 0 ], [ 0, 0, - Math.PI / 2 ]]
				],
				Y: [
					[ new three.Mesh( arrowGeometry, matGreen ), [ 0, 0.5, 0 ]],
					[ new three.Mesh( arrowGeometry, matGreen ), [ 0, - 0.5, 0 ], [ Math.PI, 0, 0 ]],
					[ new three.Mesh( lineGeometry2, matGreen ) ]
				],
				Z: [
					[ new three.Mesh( arrowGeometry, matBlue ), [ 0, 0, 0.5 ], [ Math.PI / 2, 0, 0 ]],
					[ new three.Mesh( arrowGeometry, matBlue ), [ 0, 0, - 0.5 ], [ - Math.PI / 2, 0, 0 ]],
					[ new three.Mesh( lineGeometry2, matBlue ), null, [ Math.PI / 2, 0, 0 ]]
				],
				XYZ: [
					[ new three.Mesh( new three.OctahedronGeometry( 0.1, 0 ), matWhiteTransparent.clone() ), [ 0, 0, 0 ]]
				],
				XY: [
					[ new three.Mesh( new three.BoxGeometry( 0.15, 0.15, 0.01 ), matBlueTransparent.clone() ), [ 0.15, 0.15, 0 ]]
				],
				YZ: [
					[ new three.Mesh( new three.BoxGeometry( 0.15, 0.15, 0.01 ), matRedTransparent.clone() ), [ 0, 0.15, 0.15 ], [ 0, Math.PI / 2, 0 ]]
				],
				XZ: [
					[ new three.Mesh( new three.BoxGeometry( 0.15, 0.15, 0.01 ), matGreenTransparent.clone() ), [ 0.15, 0, 0.15 ], [ - Math.PI / 2, 0, 0 ]]
				]
			};

			const pickerTranslate = {
				X: [
					[ new three.Mesh( new three.CylinderGeometry( 0.2, 0, 0.6, 4 ), matInvisible ), [ 0.3, 0, 0 ], [ 0, 0, - Math.PI / 2 ]],
					[ new three.Mesh( new three.CylinderGeometry( 0.2, 0, 0.6, 4 ), matInvisible ), [ - 0.3, 0, 0 ], [ 0, 0, Math.PI / 2 ]]
				],
				Y: [
					[ new three.Mesh( new three.CylinderGeometry( 0.2, 0, 0.6, 4 ), matInvisible ), [ 0, 0.3, 0 ]],
					[ new three.Mesh( new three.CylinderGeometry( 0.2, 0, 0.6, 4 ), matInvisible ), [ 0, - 0.3, 0 ], [ 0, 0, Math.PI ]]
				],
				Z: [
					[ new three.Mesh( new three.CylinderGeometry( 0.2, 0, 0.6, 4 ), matInvisible ), [ 0, 0, 0.3 ], [ Math.PI / 2, 0, 0 ]],
					[ new three.Mesh( new three.CylinderGeometry( 0.2, 0, 0.6, 4 ), matInvisible ), [ 0, 0, - 0.3 ], [ - Math.PI / 2, 0, 0 ]]
				],
				XYZ: [
					[ new three.Mesh( new three.OctahedronGeometry( 0.2, 0 ), matInvisible ) ]
				],
				XY: [
					[ new three.Mesh( new three.BoxGeometry( 0.2, 0.2, 0.01 ), matInvisible ), [ 0.15, 0.15, 0 ]]
				],
				YZ: [
					[ new three.Mesh( new three.BoxGeometry( 0.2, 0.2, 0.01 ), matInvisible ), [ 0, 0.15, 0.15 ], [ 0, Math.PI / 2, 0 ]]
				],
				XZ: [
					[ new three.Mesh( new three.BoxGeometry( 0.2, 0.2, 0.01 ), matInvisible ), [ 0.15, 0, 0.15 ], [ - Math.PI / 2, 0, 0 ]]
				]
			};

			const helperTranslate = {
				START: [
					[ new three.Mesh( new three.OctahedronGeometry( 0.01, 2 ), matHelper ), null, null, null, 'helper' ]
				],
				END: [
					[ new three.Mesh( new three.OctahedronGeometry( 0.01, 2 ), matHelper ), null, null, null, 'helper' ]
				],
				DELTA: [
					[ new three.Line( TranslateHelperGeometry(), matHelper ), null, null, null, 'helper' ]
				],
				X: [
					[ new three.Line( lineGeometry, matHelper.clone() ), [ - 1e3, 0, 0 ], null, [ 1e6, 1, 1 ], 'helper' ]
				],
				Y: [
					[ new three.Line( lineGeometry, matHelper.clone() ), [ 0, - 1e3, 0 ], [ 0, 0, Math.PI / 2 ], [ 1e6, 1, 1 ], 'helper' ]
				],
				Z: [
					[ new three.Line( lineGeometry, matHelper.clone() ), [ 0, 0, - 1e3 ], [ 0, - Math.PI / 2, 0 ], [ 1e6, 1, 1 ], 'helper' ]
				]
			};

			const gizmoRotate = {
				XYZE: [
					[ new three.Mesh( CircleGeometry( 0.5, 1 ), matGray ), null, [ 0, Math.PI / 2, 0 ]]
				],
				X: [
					[ new three.Mesh( CircleGeometry( 0.5, 0.5 ), matRed ) ]
				],
				Y: [
					[ new three.Mesh( CircleGeometry( 0.5, 0.5 ), matGreen ), null, [ 0, 0, - Math.PI / 2 ]]
				],
				Z: [
					[ new three.Mesh( CircleGeometry( 0.5, 0.5 ), matBlue ), null, [ 0, Math.PI / 2, 0 ]]
				],
				E: [
					[ new three.Mesh( CircleGeometry( 0.75, 1 ), matYellowTransparent ), null, [ 0, Math.PI / 2, 0 ]]
				]
			};

			const helperRotate = {
				AXIS: [
					[ new three.Line( lineGeometry, matHelper.clone() ), [ - 1e3, 0, 0 ], null, [ 1e6, 1, 1 ], 'helper' ]
				]
			};

			const pickerRotate = {
				XYZE: [
					[ new three.Mesh( new three.SphereGeometry( 0.25, 10, 8 ), matInvisible ) ]
				],
				X: [
					[ new three.Mesh( new three.TorusGeometry( 0.5, 0.1, 4, 24 ), matInvisible ), [ 0, 0, 0 ], [ 0, - Math.PI / 2, - Math.PI / 2 ]],
				],
				Y: [
					[ new three.Mesh( new three.TorusGeometry( 0.5, 0.1, 4, 24 ), matInvisible ), [ 0, 0, 0 ], [ Math.PI / 2, 0, 0 ]],
				],
				Z: [
					[ new three.Mesh( new three.TorusGeometry( 0.5, 0.1, 4, 24 ), matInvisible ), [ 0, 0, 0 ], [ 0, 0, - Math.PI / 2 ]],
				],
				E: [
					[ new three.Mesh( new three.TorusGeometry( 0.75, 0.1, 2, 24 ), matInvisible ) ]
				]
			};

			const gizmoScale = {
				X: [
					[ new three.Mesh( scaleHandleGeometry, matRed ), [ 0.5, 0, 0 ], [ 0, 0, - Math.PI / 2 ]],
					[ new three.Mesh( lineGeometry2, matRed ), [ 0, 0, 0 ], [ 0, 0, - Math.PI / 2 ]],
					[ new three.Mesh( scaleHandleGeometry, matRed ), [ - 0.5, 0, 0 ], [ 0, 0, Math.PI / 2 ]],
				],
				Y: [
					[ new three.Mesh( scaleHandleGeometry, matGreen ), [ 0, 0.5, 0 ]],
					[ new three.Mesh( lineGeometry2, matGreen ) ],
					[ new three.Mesh( scaleHandleGeometry, matGreen ), [ 0, - 0.5, 0 ], [ 0, 0, Math.PI ]],
				],
				Z: [
					[ new three.Mesh( scaleHandleGeometry, matBlue ), [ 0, 0, 0.5 ], [ Math.PI / 2, 0, 0 ]],
					[ new three.Mesh( lineGeometry2, matBlue ), [ 0, 0, 0 ], [ Math.PI / 2, 0, 0 ]],
					[ new three.Mesh( scaleHandleGeometry, matBlue ), [ 0, 0, - 0.5 ], [ - Math.PI / 2, 0, 0 ]]
				],
				XY: [
					[ new three.Mesh( new three.BoxGeometry( 0.15, 0.15, 0.01 ), matBlueTransparent ), [ 0.15, 0.15, 0 ]]
				],
				YZ: [
					[ new three.Mesh( new three.BoxGeometry( 0.15, 0.15, 0.01 ), matRedTransparent ), [ 0, 0.15, 0.15 ], [ 0, Math.PI / 2, 0 ]]
				],
				XZ: [
					[ new three.Mesh( new three.BoxGeometry( 0.15, 0.15, 0.01 ), matGreenTransparent ), [ 0.15, 0, 0.15 ], [ - Math.PI / 2, 0, 0 ]]
				],
				XYZ: [
					[ new three.Mesh( new three.BoxGeometry( 0.1, 0.1, 0.1 ), matWhiteTransparent.clone() ) ],
				]
			};

			const pickerScale = {
				X: [
					[ new three.Mesh( new three.CylinderGeometry( 0.2, 0, 0.6, 4 ), matInvisible ), [ 0.3, 0, 0 ], [ 0, 0, - Math.PI / 2 ]],
					[ new three.Mesh( new three.CylinderGeometry( 0.2, 0, 0.6, 4 ), matInvisible ), [ - 0.3, 0, 0 ], [ 0, 0, Math.PI / 2 ]]
				],
				Y: [
					[ new three.Mesh( new three.CylinderGeometry( 0.2, 0, 0.6, 4 ), matInvisible ), [ 0, 0.3, 0 ]],
					[ new three.Mesh( new three.CylinderGeometry( 0.2, 0, 0.6, 4 ), matInvisible ), [ 0, - 0.3, 0 ], [ 0, 0, Math.PI ]]
				],
				Z: [
					[ new three.Mesh( new three.CylinderGeometry( 0.2, 0, 0.6, 4 ), matInvisible ), [ 0, 0, 0.3 ], [ Math.PI / 2, 0, 0 ]],
					[ new three.Mesh( new three.CylinderGeometry( 0.2, 0, 0.6, 4 ), matInvisible ), [ 0, 0, - 0.3 ], [ - Math.PI / 2, 0, 0 ]]
				],
				XY: [
					[ new three.Mesh( new three.BoxGeometry( 0.2, 0.2, 0.01 ), matInvisible ), [ 0.15, 0.15, 0 ]],
				],
				YZ: [
					[ new three.Mesh( new three.BoxGeometry( 0.2, 0.2, 0.01 ), matInvisible ), [ 0, 0.15, 0.15 ], [ 0, Math.PI / 2, 0 ]],
				],
				XZ: [
					[ new three.Mesh( new three.BoxGeometry( 0.2, 0.2, 0.01 ), matInvisible ), [ 0.15, 0, 0.15 ], [ - Math.PI / 2, 0, 0 ]],
				],
				XYZ: [
					[ new three.Mesh( new three.BoxGeometry( 0.2, 0.2, 0.2 ), matInvisible ), [ 0, 0, 0 ]],
				]
			};

			const helperScale = {
				X: [
					[ new three.Line( lineGeometry, matHelper.clone() ), [ - 1e3, 0, 0 ], null, [ 1e6, 1, 1 ], 'helper' ]
				],
				Y: [
					[ new three.Line( lineGeometry, matHelper.clone() ), [ 0, - 1e3, 0 ], [ 0, 0, Math.PI / 2 ], [ 1e6, 1, 1 ], 'helper' ]
				],
				Z: [
					[ new three.Line( lineGeometry, matHelper.clone() ), [ 0, 0, - 1e3 ], [ 0, - Math.PI / 2, 0 ], [ 1e6, 1, 1 ], 'helper' ]
				]
			};

			// Creates an Object3D with gizmos described in custom hierarchy definition.

			function setupGizmo( gizmoMap ) {

				const gizmo = new three.Object3D();

				for ( const name in gizmoMap ) {

					for ( let i = gizmoMap[ name ].length; i --; ) {

						const object = gizmoMap[ name ][ i ][ 0 ].clone();
						const position = gizmoMap[ name ][ i ][ 1 ];
						const rotation = gizmoMap[ name ][ i ][ 2 ];
						const scale = gizmoMap[ name ][ i ][ 3 ];
						const tag = gizmoMap[ name ][ i ][ 4 ];

						// name and tag properties are essential for picking and updating logic.
						object.name = name;
						object.tag = tag;

						if ( position ) {

							object.position.set( position[ 0 ], position[ 1 ], position[ 2 ] );

						}

						if ( rotation ) {

							object.rotation.set( rotation[ 0 ], rotation[ 1 ], rotation[ 2 ] );

						}

						if ( scale ) {

							object.scale.set( scale[ 0 ], scale[ 1 ], scale[ 2 ] );

						}

						object.updateMatrix();

						const tempGeometry = object.geometry.clone();
						tempGeometry.applyMatrix4( object.matrix );
						object.geometry = tempGeometry;
						object.renderOrder = Infinity;

						object.position.set( 0, 0, 0 );
						object.rotation.set( 0, 0, 0 );
						object.scale.set( 1, 1, 1 );

						gizmo.add( object );

					}

				}

				return gizmo;

			}

			// Gizmo creation

			this.gizmo = {};
			this.picker = {};
			this.helper = {};

			this.add( this.gizmo[ 'translate' ] = setupGizmo( gizmoTranslate ) );
			this.add( this.gizmo[ 'rotate' ] = setupGizmo( gizmoRotate ) );
			this.add( this.gizmo[ 'scale' ] = setupGizmo( gizmoScale ) );
			this.add( this.picker[ 'translate' ] = setupGizmo( pickerTranslate ) );
			this.add( this.picker[ 'rotate' ] = setupGizmo( pickerRotate ) );
			this.add( this.picker[ 'scale' ] = setupGizmo( pickerScale ) );
			this.add( this.helper[ 'translate' ] = setupGizmo( helperTranslate ) );
			this.add( this.helper[ 'rotate' ] = setupGizmo( helperRotate ) );
			this.add( this.helper[ 'scale' ] = setupGizmo( helperScale ) );

			// Pickers should be hidden always

			this.picker[ 'translate' ].visible = false;
			this.picker[ 'rotate' ].visible = false;
			this.picker[ 'scale' ].visible = false;

		}

		// updateMatrixWorld will update transformations and appearance of individual handles

		updateMatrixWorld( force ) {

			const space = ( this.mode === 'scale' ) ? 'local' : this.space; // scale always oriented to local rotation

			const quaternion = ( space === 'local' ) ? this.worldQuaternion : _identityQuaternion;

			// Show only gizmos for current transform mode

			this.gizmo[ 'translate' ].visible = this.mode === 'translate';
			this.gizmo[ 'rotate' ].visible = this.mode === 'rotate';
			this.gizmo[ 'scale' ].visible = this.mode === 'scale';

			this.helper[ 'translate' ].visible = this.mode === 'translate';
			this.helper[ 'rotate' ].visible = this.mode === 'rotate';
			this.helper[ 'scale' ].visible = this.mode === 'scale';


			let handles = [];
			handles = handles.concat( this.picker[ this.mode ].children );
			handles = handles.concat( this.gizmo[ this.mode ].children );
			handles = handles.concat( this.helper[ this.mode ].children );

			for ( let i = 0; i < handles.length; i ++ ) {

				const handle = handles[ i ];

				// hide aligned to camera

				handle.visible = true;
				handle.rotation.set( 0, 0, 0 );
				handle.position.copy( this.worldPosition );

				let factor;

				if ( this.camera.isOrthographicCamera ) {

					factor = ( this.camera.top - this.camera.bottom ) / this.camera.zoom;

				} else {

					factor = this.worldPosition.distanceTo( this.cameraPosition ) * Math.min( 1.9 * Math.tan( Math.PI * this.camera.fov / 360 ) / this.camera.zoom, 7 );

				}

				handle.scale.set( 1, 1, 1 ).multiplyScalar( factor * this.size / 4 );

				// TODO: simplify helpers and consider decoupling from gizmo

				if ( handle.tag === 'helper' ) {

					handle.visible = false;

					if ( handle.name === 'AXIS' ) {

						handle.visible = !! this.axis;

						if ( this.axis === 'X' ) {

							_tempQuaternion.setFromEuler( _tempEuler.set( 0, 0, 0 ) );
							handle.quaternion.copy( quaternion ).multiply( _tempQuaternion );

							if ( Math.abs( _alignVector.copy( _unitX ).applyQuaternion( quaternion ).dot( this.eye ) ) > 0.9 ) {

								handle.visible = false;

							}

						}

						if ( this.axis === 'Y' ) {

							_tempQuaternion.setFromEuler( _tempEuler.set( 0, 0, Math.PI / 2 ) );
							handle.quaternion.copy( quaternion ).multiply( _tempQuaternion );

							if ( Math.abs( _alignVector.copy( _unitY ).applyQuaternion( quaternion ).dot( this.eye ) ) > 0.9 ) {

								handle.visible = false;

							}

						}

						if ( this.axis === 'Z' ) {

							_tempQuaternion.setFromEuler( _tempEuler.set( 0, Math.PI / 2, 0 ) );
							handle.quaternion.copy( quaternion ).multiply( _tempQuaternion );

							if ( Math.abs( _alignVector.copy( _unitZ ).applyQuaternion( quaternion ).dot( this.eye ) ) > 0.9 ) {

								handle.visible = false;

							}

						}

						if ( this.axis === 'XYZE' ) {

							_tempQuaternion.setFromEuler( _tempEuler.set( 0, Math.PI / 2, 0 ) );
							_alignVector.copy( this.rotationAxis );
							handle.quaternion.setFromRotationMatrix( _lookAtMatrix.lookAt( _zeroVector, _alignVector, _unitY ) );
							handle.quaternion.multiply( _tempQuaternion );
							handle.visible = this.dragging;

						}

						if ( this.axis === 'E' ) {

							handle.visible = false;

						}


					} else if ( handle.name === 'START' ) {

						handle.position.copy( this.worldPositionStart );
						handle.visible = this.dragging;

					} else if ( handle.name === 'END' ) {

						handle.position.copy( this.worldPosition );
						handle.visible = this.dragging;

					} else if ( handle.name === 'DELTA' ) {

						handle.position.copy( this.worldPositionStart );
						handle.quaternion.copy( this.worldQuaternionStart );
						_tempVector.set( 1e-10, 1e-10, 1e-10 ).add( this.worldPositionStart ).sub( this.worldPosition ).multiplyScalar( - 1 );
						_tempVector.applyQuaternion( this.worldQuaternionStart.clone().invert() );
						handle.scale.copy( _tempVector );
						handle.visible = this.dragging;

					} else {

						handle.quaternion.copy( quaternion );

						if ( this.dragging ) {

							handle.position.copy( this.worldPositionStart );

						} else {

							handle.position.copy( this.worldPosition );

						}

						if ( this.axis ) {

							handle.visible = this.axis.search( handle.name ) !== - 1;

						}

					}

					// If updating helper, skip rest of the loop
					continue;

				}

				// Align handles to current local or world rotation

				handle.quaternion.copy( quaternion );

				if ( this.mode === 'translate' || this.mode === 'scale' ) {

					// Hide translate and scale axis facing the camera

					const AXIS_HIDE_THRESHOLD = 0.99;
					const PLANE_HIDE_THRESHOLD = 0.2;

					if ( handle.name === 'X' ) {

						if ( Math.abs( _alignVector.copy( _unitX ).applyQuaternion( quaternion ).dot( this.eye ) ) > AXIS_HIDE_THRESHOLD ) {

							handle.scale.set( 1e-10, 1e-10, 1e-10 );
							handle.visible = false;

						}

					}

					if ( handle.name === 'Y' ) {

						if ( Math.abs( _alignVector.copy( _unitY ).applyQuaternion( quaternion ).dot( this.eye ) ) > AXIS_HIDE_THRESHOLD ) {

							handle.scale.set( 1e-10, 1e-10, 1e-10 );
							handle.visible = false;

						}

					}

					if ( handle.name === 'Z' ) {

						if ( Math.abs( _alignVector.copy( _unitZ ).applyQuaternion( quaternion ).dot( this.eye ) ) > AXIS_HIDE_THRESHOLD ) {

							handle.scale.set( 1e-10, 1e-10, 1e-10 );
							handle.visible = false;

						}

					}

					if ( handle.name === 'XY' ) {

						if ( Math.abs( _alignVector.copy( _unitZ ).applyQuaternion( quaternion ).dot( this.eye ) ) < PLANE_HIDE_THRESHOLD ) {

							handle.scale.set( 1e-10, 1e-10, 1e-10 );
							handle.visible = false;

						}

					}

					if ( handle.name === 'YZ' ) {

						if ( Math.abs( _alignVector.copy( _unitX ).applyQuaternion( quaternion ).dot( this.eye ) ) < PLANE_HIDE_THRESHOLD ) {

							handle.scale.set( 1e-10, 1e-10, 1e-10 );
							handle.visible = false;

						}

					}

					if ( handle.name === 'XZ' ) {

						if ( Math.abs( _alignVector.copy( _unitY ).applyQuaternion( quaternion ).dot( this.eye ) ) < PLANE_HIDE_THRESHOLD ) {

							handle.scale.set( 1e-10, 1e-10, 1e-10 );
							handle.visible = false;

						}

					}

				} else if ( this.mode === 'rotate' ) {

					// Align handles to current local or world rotation

					_tempQuaternion2.copy( quaternion );
					_alignVector.copy( this.eye ).applyQuaternion( _tempQuaternion.copy( quaternion ).invert() );

					if ( handle.name.search( 'E' ) !== - 1 ) {

						handle.quaternion.setFromRotationMatrix( _lookAtMatrix.lookAt( this.eye, _zeroVector, _unitY ) );

					}

					if ( handle.name === 'X' ) {

						_tempQuaternion.setFromAxisAngle( _unitX, Math.atan2( - _alignVector.y, _alignVector.z ) );
						_tempQuaternion.multiplyQuaternions( _tempQuaternion2, _tempQuaternion );
						handle.quaternion.copy( _tempQuaternion );

					}

					if ( handle.name === 'Y' ) {

						_tempQuaternion.setFromAxisAngle( _unitY, Math.atan2( _alignVector.x, _alignVector.z ) );
						_tempQuaternion.multiplyQuaternions( _tempQuaternion2, _tempQuaternion );
						handle.quaternion.copy( _tempQuaternion );

					}

					if ( handle.name === 'Z' ) {

						_tempQuaternion.setFromAxisAngle( _unitZ, Math.atan2( _alignVector.y, _alignVector.x ) );
						_tempQuaternion.multiplyQuaternions( _tempQuaternion2, _tempQuaternion );
						handle.quaternion.copy( _tempQuaternion );

					}

				}

				// Hide disabled axes
				handle.visible = handle.visible && ( handle.name.indexOf( 'X' ) === - 1 || this.showX );
				handle.visible = handle.visible && ( handle.name.indexOf( 'Y' ) === - 1 || this.showY );
				handle.visible = handle.visible && ( handle.name.indexOf( 'Z' ) === - 1 || this.showZ );
				handle.visible = handle.visible && ( handle.name.indexOf( 'E' ) === - 1 || ( this.showX && this.showY && this.showZ ) );

				// highlight selected axis

				handle.material._color = handle.material._color || handle.material.color.clone();
				handle.material._opacity = handle.material._opacity || handle.material.opacity;

				handle.material.color.copy( handle.material._color );
				handle.material.opacity = handle.material._opacity;

				if ( this.enabled && this.axis ) {

					if ( handle.name === this.axis ) {

						handle.material.color.setHex( 0xffff00 );
						handle.material.opacity = 1.0;

					} else if ( this.axis.split( '' ).some( function ( a ) {

						return handle.name === a;

					} ) ) {

						handle.material.color.setHex( 0xffff00 );
						handle.material.opacity = 1.0;

					}

				}

			}

			super.updateMatrixWorld( force );

		}

	}

	//

	class TransformControlsPlane extends three.Mesh {

		constructor() {

			super(
				new three.PlaneGeometry( 100000, 100000, 2, 2 ),
				new three.MeshBasicMaterial( { visible: false, wireframe: true, side: three.DoubleSide, transparent: true, opacity: 0.1, toneMapped: false } )
			);

			this.isTransformControlsPlane = true;

			this.type = 'TransformControlsPlane';

		}

		updateMatrixWorld( force ) {

			let space = this.space;

			this.position.copy( this.worldPosition );

			if ( this.mode === 'scale' ) space = 'local'; // scale always oriented to local rotation

			_v1.copy( _unitX ).applyQuaternion( space === 'local' ? this.worldQuaternion : _identityQuaternion );
			_v2.copy( _unitY ).applyQuaternion( space === 'local' ? this.worldQuaternion : _identityQuaternion );
			_v3.copy( _unitZ ).applyQuaternion( space === 'local' ? this.worldQuaternion : _identityQuaternion );

			// Align the plane for current transform mode, axis and space.

			_alignVector.copy( _v2 );

			switch ( this.mode ) {

				case 'translate':
				case 'scale':
					switch ( this.axis ) {

						case 'X':
							_alignVector.copy( this.eye ).cross( _v1 );
							_dirVector.copy( _v1 ).cross( _alignVector );
							break;
						case 'Y':
							_alignVector.copy( this.eye ).cross( _v2 );
							_dirVector.copy( _v2 ).cross( _alignVector );
							break;
						case 'Z':
							_alignVector.copy( this.eye ).cross( _v3 );
							_dirVector.copy( _v3 ).cross( _alignVector );
							break;
						case 'XY':
							_dirVector.copy( _v3 );
							break;
						case 'YZ':
							_dirVector.copy( _v1 );
							break;
						case 'XZ':
							_alignVector.copy( _v3 );
							_dirVector.copy( _v2 );
							break;
						case 'XYZ':
						case 'E':
							_dirVector.set( 0, 0, 0 );
							break;

					}

					break;
				case 'rotate':
				default:
					// special case for rotate
					_dirVector.set( 0, 0, 0 );

			}

			if ( _dirVector.length() === 0 ) {

				// If in rotate mode, make the plane parallel to camera
				this.quaternion.copy( this.cameraQuaternion );

			} else {

				_tempMatrix.lookAt( _tempVector.set( 0, 0, 0 ), _dirVector, _alignVector );

				this.quaternion.setFromRotationMatrix( _tempMatrix );

			}

			super.updateMatrixWorld( force );

		}

	}

	/**
	 * lil-gui
	 * https://lil-gui.georgealways.com
	 * @version 0.17.0
	 * @author George Michael Brower
	 * @license MIT
	 */
	class t{constructor(i,e,s,n,l="div"){this.parent=i,this.object=e,this.property=s,this._disabled=!1,this._hidden=!1,this.initialValue=this.getValue(),this.domElement=document.createElement("div"),this.domElement.classList.add("controller"),this.domElement.classList.add(n),this.$name=document.createElement("div"),this.$name.classList.add("name"),t.nextNameID=t.nextNameID||0,this.$name.id="lil-gui-name-"+ ++t.nextNameID,this.$widget=document.createElement(l),this.$widget.classList.add("widget"),this.$disable=this.$widget,this.domElement.appendChild(this.$name),this.domElement.appendChild(this.$widget),this.parent.children.push(this),this.parent.controllers.push(this),this.parent.$children.appendChild(this.domElement),this._listenCallback=this._listenCallback.bind(this),this.name(s);}name(t){return this._name=t,this.$name.innerHTML=t,this}onChange(t){return this._onChange=t,this}_callOnChange(){this.parent._callOnChange(this),void 0!==this._onChange&&this._onChange.call(this,this.getValue()),this._changed=!0;}onFinishChange(t){return this._onFinishChange=t,this}_callOnFinishChange(){this._changed&&(this.parent._callOnFinishChange(this),void 0!==this._onFinishChange&&this._onFinishChange.call(this,this.getValue())),this._changed=!1;}reset(){return this.setValue(this.initialValue),this._callOnFinishChange(),this}enable(t=!0){return this.disable(!t)}disable(t=!0){return t===this._disabled||(this._disabled=t,this.domElement.classList.toggle("disabled",t),this.$disable.toggleAttribute("disabled",t)),this}show(t=!0){return this._hidden=!t,this.domElement.style.display=this._hidden?"none":"",this}hide(){return this.show(!1)}options(t){const i=this.parent.add(this.object,this.property,t);return i.name(this._name),this.destroy(),i}min(t){return this}max(t){return this}step(t){return this}decimals(t){return this}listen(t=!0){return this._listening=t,void 0!==this._listenCallbackID&&(cancelAnimationFrame(this._listenCallbackID),this._listenCallbackID=void 0),this._listening&&this._listenCallback(),this}_listenCallback(){this._listenCallbackID=requestAnimationFrame(this._listenCallback);const t=this.save();t!==this._listenPrevValue&&this.updateDisplay(),this._listenPrevValue=t;}getValue(){return this.object[this.property]}setValue(t){return this.object[this.property]=t,this._callOnChange(),this.updateDisplay(),this}updateDisplay(){return this}load(t){return this.setValue(t),this._callOnFinishChange(),this}save(){return this.getValue()}destroy(){this.listen(!1),this.parent.children.splice(this.parent.children.indexOf(this),1),this.parent.controllers.splice(this.parent.controllers.indexOf(this),1),this.parent.$children.removeChild(this.domElement);}}class i extends t{constructor(t,i,e){super(t,i,e,"boolean","label"),this.$input=document.createElement("input"),this.$input.setAttribute("type","checkbox"),this.$input.setAttribute("aria-labelledby",this.$name.id),this.$widget.appendChild(this.$input),this.$input.addEventListener("change",()=>{this.setValue(this.$input.checked),this._callOnFinishChange();}),this.$disable=this.$input,this.updateDisplay();}updateDisplay(){return this.$input.checked=this.getValue(),this}}function e(t){let i,e;return (i=t.match(/(#|0x)?([a-f0-9]{6})/i))?e=i[2]:(i=t.match(/rgb\(\s*(\d*)\s*,\s*(\d*)\s*,\s*(\d*)\s*\)/))?e=parseInt(i[1]).toString(16).padStart(2,0)+parseInt(i[2]).toString(16).padStart(2,0)+parseInt(i[3]).toString(16).padStart(2,0):(i=t.match(/^#?([a-f0-9])([a-f0-9])([a-f0-9])$/i))&&(e=i[1]+i[1]+i[2]+i[2]+i[3]+i[3]),!!e&&"#"+e}const s={isPrimitive:!0,match:t=>"string"==typeof t,fromHexString:e,toHexString:e},n={isPrimitive:!0,match:t=>"number"==typeof t,fromHexString:t=>parseInt(t.substring(1),16),toHexString:t=>"#"+t.toString(16).padStart(6,0)},l={isPrimitive:!1,match:Array.isArray,fromHexString(t,i,e=1){const s=n.fromHexString(t);i[0]=(s>>16&255)/255*e,i[1]=(s>>8&255)/255*e,i[2]=(255&s)/255*e;},toHexString:([t,i,e],s=1)=>n.toHexString(t*(s=255/s)<<16^i*s<<8^e*s<<0)},r={isPrimitive:!1,match:t=>Object(t)===t,fromHexString(t,i,e=1){const s=n.fromHexString(t);i.r=(s>>16&255)/255*e,i.g=(s>>8&255)/255*e,i.b=(255&s)/255*e;},toHexString:({r:t,g:i,b:e},s=1)=>n.toHexString(t*(s=255/s)<<16^i*s<<8^e*s<<0)},o=[s,n,l,r];class a extends t{constructor(t,i,s,n){var l;super(t,i,s,"color"),this.$input=document.createElement("input"),this.$input.setAttribute("type","color"),this.$input.setAttribute("tabindex",-1),this.$input.setAttribute("aria-labelledby",this.$name.id),this.$text=document.createElement("input"),this.$text.setAttribute("type","text"),this.$text.setAttribute("spellcheck","false"),this.$text.setAttribute("aria-labelledby",this.$name.id),this.$display=document.createElement("div"),this.$display.classList.add("display"),this.$display.appendChild(this.$input),this.$widget.appendChild(this.$display),this.$widget.appendChild(this.$text),this._format=(l=this.initialValue,o.find(t=>t.match(l))),this._rgbScale=n,this._initialValueHexString=this.save(),this._textFocused=!1,this.$input.addEventListener("input",()=>{this._setValueFromHexString(this.$input.value);}),this.$input.addEventListener("blur",()=>{this._callOnFinishChange();}),this.$text.addEventListener("input",()=>{const t=e(this.$text.value);t&&this._setValueFromHexString(t);}),this.$text.addEventListener("focus",()=>{this._textFocused=!0,this.$text.select();}),this.$text.addEventListener("blur",()=>{this._textFocused=!1,this.updateDisplay(),this._callOnFinishChange();}),this.$disable=this.$text,this.updateDisplay();}reset(){return this._setValueFromHexString(this._initialValueHexString),this}_setValueFromHexString(t){if(this._format.isPrimitive){const i=this._format.fromHexString(t);this.setValue(i);}else this._format.fromHexString(t,this.getValue(),this._rgbScale),this._callOnChange(),this.updateDisplay();}save(){return this._format.toHexString(this.getValue(),this._rgbScale)}load(t){return this._setValueFromHexString(t),this._callOnFinishChange(),this}updateDisplay(){return this.$input.value=this._format.toHexString(this.getValue(),this._rgbScale),this._textFocused||(this.$text.value=this.$input.value.substring(1)),this.$display.style.backgroundColor=this.$input.value,this}}class h extends t{constructor(t,i,e){super(t,i,e,"function"),this.$button=document.createElement("button"),this.$button.appendChild(this.$name),this.$widget.appendChild(this.$button),this.$button.addEventListener("click",t=>{t.preventDefault(),this.getValue().call(this.object);}),this.$button.addEventListener("touchstart",()=>{},{passive:!0}),this.$disable=this.$button;}}class d extends t{constructor(t,i,e,s,n,l){super(t,i,e,"number"),this._initInput(),this.min(s),this.max(n);const r=void 0!==l;this.step(r?l:this._getImplicitStep(),r),this.updateDisplay();}decimals(t){return this._decimals=t,this.updateDisplay(),this}min(t){return this._min=t,this._onUpdateMinMax(),this}max(t){return this._max=t,this._onUpdateMinMax(),this}step(t,i=!0){return this._step=t,this._stepExplicit=i,this}updateDisplay(){const t=this.getValue();if(this._hasSlider){let i=(t-this._min)/(this._max-this._min);i=Math.max(0,Math.min(i,1)),this.$fill.style.width=100*i+"%";}return this._inputFocused||(this.$input.value=void 0===this._decimals?t:t.toFixed(this._decimals)),this}_initInput(){this.$input=document.createElement("input"),this.$input.setAttribute("type","number"),this.$input.setAttribute("step","any"),this.$input.setAttribute("aria-labelledby",this.$name.id),this.$widget.appendChild(this.$input),this.$disable=this.$input;const t=t=>{const i=parseFloat(this.$input.value);isNaN(i)||(this._snapClampSetValue(i+t),this.$input.value=this.getValue());};let i,e,s,n,l,r=!1;const o=t=>{if(r){const s=t.clientX-i,n=t.clientY-e;Math.abs(n)>5?(t.preventDefault(),this.$input.blur(),r=!1,this._setDraggingStyle(!0,"vertical")):Math.abs(s)>5&&a();}if(!r){const i=t.clientY-s;l-=i*this._step*this._arrowKeyMultiplier(t),n+l>this._max?l=this._max-n:n+l<this._min&&(l=this._min-n),this._snapClampSetValue(n+l);}s=t.clientY;},a=()=>{this._setDraggingStyle(!1,"vertical"),this._callOnFinishChange(),window.removeEventListener("mousemove",o),window.removeEventListener("mouseup",a);};this.$input.addEventListener("input",()=>{let t=parseFloat(this.$input.value);isNaN(t)||(this._stepExplicit&&(t=this._snap(t)),this.setValue(this._clamp(t)));}),this.$input.addEventListener("keydown",i=>{"Enter"===i.code&&this.$input.blur(),"ArrowUp"===i.code&&(i.preventDefault(),t(this._step*this._arrowKeyMultiplier(i))),"ArrowDown"===i.code&&(i.preventDefault(),t(this._step*this._arrowKeyMultiplier(i)*-1));}),this.$input.addEventListener("wheel",i=>{this._inputFocused&&(i.preventDefault(),t(this._step*this._normalizeMouseWheel(i)));},{passive:!1}),this.$input.addEventListener("mousedown",t=>{i=t.clientX,e=s=t.clientY,r=!0,n=this.getValue(),l=0,window.addEventListener("mousemove",o),window.addEventListener("mouseup",a);}),this.$input.addEventListener("focus",()=>{this._inputFocused=!0;}),this.$input.addEventListener("blur",()=>{this._inputFocused=!1,this.updateDisplay(),this._callOnFinishChange();});}_initSlider(){this._hasSlider=!0,this.$slider=document.createElement("div"),this.$slider.classList.add("slider"),this.$fill=document.createElement("div"),this.$fill.classList.add("fill"),this.$slider.appendChild(this.$fill),this.$widget.insertBefore(this.$slider,this.$input),this.domElement.classList.add("hasSlider");const t=t=>{const i=this.$slider.getBoundingClientRect();let e=(s=t,n=i.left,l=i.right,r=this._min,o=this._max,(s-n)/(l-n)*(o-r)+r);var s,n,l,r,o;this._snapClampSetValue(e);},i=i=>{t(i.clientX);},e=()=>{this._callOnFinishChange(),this._setDraggingStyle(!1),window.removeEventListener("mousemove",i),window.removeEventListener("mouseup",e);};let s,n,l=!1;const r=i=>{i.preventDefault(),this._setDraggingStyle(!0),t(i.touches[0].clientX),l=!1;},o=i=>{if(l){const t=i.touches[0].clientX-s,e=i.touches[0].clientY-n;Math.abs(t)>Math.abs(e)?r(i):(window.removeEventListener("touchmove",o),window.removeEventListener("touchend",a));}else i.preventDefault(),t(i.touches[0].clientX);},a=()=>{this._callOnFinishChange(),this._setDraggingStyle(!1),window.removeEventListener("touchmove",o),window.removeEventListener("touchend",a);},h=this._callOnFinishChange.bind(this);let d;this.$slider.addEventListener("mousedown",s=>{this._setDraggingStyle(!0),t(s.clientX),window.addEventListener("mousemove",i),window.addEventListener("mouseup",e);}),this.$slider.addEventListener("touchstart",t=>{t.touches.length>1||(this._hasScrollBar?(s=t.touches[0].clientX,n=t.touches[0].clientY,l=!0):r(t),window.addEventListener("touchmove",o,{passive:!1}),window.addEventListener("touchend",a));},{passive:!1}),this.$slider.addEventListener("wheel",t=>{if(Math.abs(t.deltaX)<Math.abs(t.deltaY)&&this._hasScrollBar)return;t.preventDefault();const i=this._normalizeMouseWheel(t)*this._step;this._snapClampSetValue(this.getValue()+i),this.$input.value=this.getValue(),clearTimeout(d),d=setTimeout(h,400);},{passive:!1});}_setDraggingStyle(t,i="horizontal"){this.$slider&&this.$slider.classList.toggle("active",t),document.body.classList.toggle("lil-gui-dragging",t),document.body.classList.toggle("lil-gui-"+i,t);}_getImplicitStep(){return this._hasMin&&this._hasMax?(this._max-this._min)/1e3:.1}_onUpdateMinMax(){!this._hasSlider&&this._hasMin&&this._hasMax&&(this._stepExplicit||this.step(this._getImplicitStep(),!1),this._initSlider(),this.updateDisplay());}_normalizeMouseWheel(t){let{deltaX:i,deltaY:e}=t;Math.floor(t.deltaY)!==t.deltaY&&t.wheelDelta&&(i=0,e=-t.wheelDelta/120,e*=this._stepExplicit?1:10);return i+-e}_arrowKeyMultiplier(t){let i=this._stepExplicit?1:10;return t.shiftKey?i*=10:t.altKey&&(i/=10),i}_snap(t){const i=Math.round(t/this._step)*this._step;return parseFloat(i.toPrecision(15))}_clamp(t){return t<this._min&&(t=this._min),t>this._max&&(t=this._max),t}_snapClampSetValue(t){this.setValue(this._clamp(this._snap(t)));}get _hasScrollBar(){const t=this.parent.root.$children;return t.scrollHeight>t.clientHeight}get _hasMin(){return void 0!==this._min}get _hasMax(){return void 0!==this._max}}class c extends t{constructor(t,i,e,s){super(t,i,e,"option"),this.$select=document.createElement("select"),this.$select.setAttribute("aria-labelledby",this.$name.id),this.$display=document.createElement("div"),this.$display.classList.add("display"),this._values=Array.isArray(s)?s:Object.values(s),this._names=Array.isArray(s)?s:Object.keys(s),this._names.forEach(t=>{const i=document.createElement("option");i.innerHTML=t,this.$select.appendChild(i);}),this.$select.addEventListener("change",()=>{this.setValue(this._values[this.$select.selectedIndex]),this._callOnFinishChange();}),this.$select.addEventListener("focus",()=>{this.$display.classList.add("focus");}),this.$select.addEventListener("blur",()=>{this.$display.classList.remove("focus");}),this.$widget.appendChild(this.$select),this.$widget.appendChild(this.$display),this.$disable=this.$select,this.updateDisplay();}updateDisplay(){const t=this.getValue(),i=this._values.indexOf(t);return this.$select.selectedIndex=i,this.$display.innerHTML=-1===i?t:this._names[i],this}}class u extends t{constructor(t,i,e){super(t,i,e,"string"),this.$input=document.createElement("input"),this.$input.setAttribute("type","text"),this.$input.setAttribute("aria-labelledby",this.$name.id),this.$input.addEventListener("input",()=>{this.setValue(this.$input.value);}),this.$input.addEventListener("keydown",t=>{"Enter"===t.code&&this.$input.blur();}),this.$input.addEventListener("blur",()=>{this._callOnFinishChange();}),this.$widget.appendChild(this.$input),this.$disable=this.$input,this.updateDisplay();}updateDisplay(){return this.$input.value=this.getValue(),this}}let p=!1;class g{constructor({parent:t,autoPlace:i=void 0===t,container:e,width:s,title:n="Controls",injectStyles:l=!0,touchStyles:r=!0}={}){if(this.parent=t,this.root=t?t.root:this,this.children=[],this.controllers=[],this.folders=[],this._closed=!1,this._hidden=!1,this.domElement=document.createElement("div"),this.domElement.classList.add("lil-gui"),this.$title=document.createElement("div"),this.$title.classList.add("title"),this.$title.setAttribute("role","button"),this.$title.setAttribute("aria-expanded",!0),this.$title.setAttribute("tabindex",0),this.$title.addEventListener("click",()=>this.openAnimated(this._closed)),this.$title.addEventListener("keydown",t=>{"Enter"!==t.code&&"Space"!==t.code||(t.preventDefault(),this.$title.click());}),this.$title.addEventListener("touchstart",()=>{},{passive:!0}),this.$children=document.createElement("div"),this.$children.classList.add("children"),this.domElement.appendChild(this.$title),this.domElement.appendChild(this.$children),this.title(n),r&&this.domElement.classList.add("allow-touch-styles"),this.parent)return this.parent.children.push(this),this.parent.folders.push(this),void this.parent.$children.appendChild(this.domElement);this.domElement.classList.add("root"),!p&&l&&(!function(t){const i=document.createElement("style");i.innerHTML=t;const e=document.querySelector("head link[rel=stylesheet], head style");e?document.head.insertBefore(i,e):document.head.appendChild(i);}('.lil-gui{--background-color:#1f1f1f;--text-color:#ebebeb;--title-background-color:#111;--title-text-color:#ebebeb;--widget-color:#424242;--hover-color:#4f4f4f;--focus-color:#595959;--number-color:#2cc9ff;--string-color:#a2db3c;--font-size:11px;--input-font-size:11px;--font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;--font-family-mono:Menlo,Monaco,Consolas,"Droid Sans Mono",monospace;--padding:4px;--spacing:4px;--widget-height:20px;--name-width:45%;--slider-knob-width:2px;--slider-input-width:27%;--color-input-width:27%;--slider-input-min-width:45px;--color-input-min-width:45px;--folder-indent:7px;--widget-padding:0 0 0 3px;--widget-border-radius:2px;--checkbox-size:calc(var(--widget-height)*0.75);--scrollbar-width:5px;background-color:var(--background-color);color:var(--text-color);font-family:var(--font-family);font-size:var(--font-size);font-style:normal;font-weight:400;line-height:1;text-align:left;touch-action:manipulation;user-select:none;-webkit-user-select:none}.lil-gui,.lil-gui *{box-sizing:border-box;margin:0;padding:0}.lil-gui.root{display:flex;flex-direction:column;width:var(--width,245px)}.lil-gui.root>.title{background:var(--title-background-color);color:var(--title-text-color)}.lil-gui.root>.children{overflow-x:hidden;overflow-y:auto}.lil-gui.root>.children::-webkit-scrollbar{background:var(--background-color);height:var(--scrollbar-width);width:var(--scrollbar-width)}.lil-gui.root>.children::-webkit-scrollbar-thumb{background:var(--focus-color);border-radius:var(--scrollbar-width)}.lil-gui.force-touch-styles{--widget-height:28px;--padding:6px;--spacing:6px;--font-size:13px;--input-font-size:16px;--folder-indent:10px;--scrollbar-width:7px;--slider-input-min-width:50px;--color-input-min-width:65px}.lil-gui.autoPlace{max-height:100%;position:fixed;right:15px;top:0;z-index:1001}.lil-gui .controller{align-items:center;display:flex;margin:var(--spacing) 0;padding:0 var(--padding)}.lil-gui .controller.disabled{opacity:.5}.lil-gui .controller.disabled,.lil-gui .controller.disabled *{pointer-events:none!important}.lil-gui .controller>.name{flex-shrink:0;line-height:var(--widget-height);min-width:var(--name-width);padding-right:var(--spacing);white-space:pre}.lil-gui .controller .widget{align-items:center;display:flex;min-height:var(--widget-height);position:relative;width:100%}.lil-gui .controller.string input{color:var(--string-color)}.lil-gui .controller.boolean .widget{cursor:pointer}.lil-gui .controller.color .display{border-radius:var(--widget-border-radius);height:var(--widget-height);position:relative;width:100%}.lil-gui .controller.color input[type=color]{cursor:pointer;height:100%;opacity:0;width:100%}.lil-gui .controller.color input[type=text]{flex-shrink:0;font-family:var(--font-family-mono);margin-left:var(--spacing);min-width:var(--color-input-min-width);width:var(--color-input-width)}.lil-gui .controller.option select{max-width:100%;opacity:0;position:absolute;width:100%}.lil-gui .controller.option .display{background:var(--widget-color);border-radius:var(--widget-border-radius);height:var(--widget-height);line-height:var(--widget-height);max-width:100%;overflow:hidden;padding-left:.55em;padding-right:1.75em;pointer-events:none;position:relative;word-break:break-all}.lil-gui .controller.option .display.active{background:var(--focus-color)}.lil-gui .controller.option .display:after{bottom:0;content:"↕";font-family:lil-gui;padding-right:.375em;position:absolute;right:0;top:0}.lil-gui .controller.option .widget,.lil-gui .controller.option select{cursor:pointer}.lil-gui .controller.number input{color:var(--number-color)}.lil-gui .controller.number.hasSlider input{flex-shrink:0;margin-left:var(--spacing);min-width:var(--slider-input-min-width);width:var(--slider-input-width)}.lil-gui .controller.number .slider{background-color:var(--widget-color);border-radius:var(--widget-border-radius);cursor:ew-resize;height:var(--widget-height);overflow:hidden;padding-right:var(--slider-knob-width);touch-action:pan-y;width:100%}.lil-gui .controller.number .slider.active{background-color:var(--focus-color)}.lil-gui .controller.number .slider.active .fill{opacity:.95}.lil-gui .controller.number .fill{border-right:var(--slider-knob-width) solid var(--number-color);box-sizing:content-box;height:100%}.lil-gui-dragging .lil-gui{--hover-color:var(--widget-color)}.lil-gui-dragging *{cursor:ew-resize!important}.lil-gui-dragging.lil-gui-vertical *{cursor:ns-resize!important}.lil-gui .title{--title-height:calc(var(--widget-height) + var(--spacing)*1.25);-webkit-tap-highlight-color:transparent;text-decoration-skip:objects;cursor:pointer;font-weight:600;height:var(--title-height);line-height:calc(var(--title-height) - 4px);outline:none;padding:0 var(--padding)}.lil-gui .title:before{content:"▾";display:inline-block;font-family:lil-gui;padding-right:2px}.lil-gui .title:active{background:var(--title-background-color);opacity:.75}.lil-gui.root>.title:focus{text-decoration:none!important}.lil-gui.closed>.title:before{content:"▸"}.lil-gui.closed>.children{opacity:0;transform:translateY(-7px)}.lil-gui.closed:not(.transition)>.children{display:none}.lil-gui.transition>.children{overflow:hidden;pointer-events:none;transition-duration:.3s;transition-property:height,opacity,transform;transition-timing-function:cubic-bezier(.2,.6,.35,1)}.lil-gui .children:empty:before{content:"Empty";display:block;font-style:italic;height:var(--widget-height);line-height:var(--widget-height);margin:var(--spacing) 0;opacity:.5;padding:0 var(--padding)}.lil-gui.root>.children>.lil-gui>.title{border-width:0;border-bottom:1px solid var(--widget-color);border-left:0 solid var(--widget-color);border-right:0 solid var(--widget-color);border-top:1px solid var(--widget-color);transition:border-color .3s}.lil-gui.root>.children>.lil-gui.closed>.title{border-bottom-color:transparent}.lil-gui+.controller{border-top:1px solid var(--widget-color);margin-top:0;padding-top:var(--spacing)}.lil-gui .lil-gui .lil-gui>.title{border:none}.lil-gui .lil-gui .lil-gui>.children{border:none;border-left:2px solid var(--widget-color);margin-left:var(--folder-indent)}.lil-gui .lil-gui .controller{border:none}.lil-gui input{-webkit-tap-highlight-color:transparent;background:var(--widget-color);border:0;border-radius:var(--widget-border-radius);color:var(--text-color);font-family:var(--font-family);font-size:var(--input-font-size);height:var(--widget-height);outline:none;width:100%}.lil-gui input:disabled{opacity:1}.lil-gui input[type=number],.lil-gui input[type=text]{padding:var(--widget-padding)}.lil-gui input[type=number]:focus,.lil-gui input[type=text]:focus{background:var(--focus-color)}.lil-gui input::-webkit-inner-spin-button,.lil-gui input::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}.lil-gui input[type=number]{-moz-appearance:textfield}.lil-gui input[type=checkbox]{appearance:none;-webkit-appearance:none;border-radius:var(--widget-border-radius);cursor:pointer;height:var(--checkbox-size);text-align:center;width:var(--checkbox-size)}.lil-gui input[type=checkbox]:checked:before{content:"✓";font-family:lil-gui;font-size:var(--checkbox-size);line-height:var(--checkbox-size)}.lil-gui button{-webkit-tap-highlight-color:transparent;background:var(--widget-color);border:1px solid var(--widget-color);border-radius:var(--widget-border-radius);color:var(--text-color);cursor:pointer;font-family:var(--font-family);font-size:var(--font-size);height:var(--widget-height);line-height:calc(var(--widget-height) - 4px);outline:none;text-align:center;text-transform:none;width:100%}.lil-gui button:active{background:var(--focus-color)}@font-face{font-family:lil-gui;src:url("data:application/font-woff;charset=utf-8;base64,d09GRgABAAAAAAUsAAsAAAAACJwAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAABHU1VCAAABCAAAAH4AAADAImwmYE9TLzIAAAGIAAAAPwAAAGBKqH5SY21hcAAAAcgAAAD0AAACrukyyJBnbHlmAAACvAAAAF8AAACEIZpWH2hlYWQAAAMcAAAAJwAAADZfcj2zaGhlYQAAA0QAAAAYAAAAJAC5AHhobXR4AAADXAAAABAAAABMAZAAAGxvY2EAAANsAAAAFAAAACgCEgIybWF4cAAAA4AAAAAeAAAAIAEfABJuYW1lAAADoAAAASIAAAIK9SUU/XBvc3QAAATEAAAAZgAAAJCTcMc2eJxVjbEOgjAURU+hFRBK1dGRL+ALnAiToyMLEzFpnPz/eAshwSa97517c/MwwJmeB9kwPl+0cf5+uGPZXsqPu4nvZabcSZldZ6kfyWnomFY/eScKqZNWupKJO6kXN3K9uCVoL7iInPr1X5baXs3tjuMqCtzEuagm/AAlzQgPAAB4nGNgYRBlnMDAysDAYM/gBiT5oLQBAwuDJAMDEwMrMwNWEJDmmsJwgCFeXZghBcjlZMgFCzOiKOIFAB71Bb8AeJy1kjFuwkAQRZ+DwRAwBtNQRUGKQ8OdKCAWUhAgKLhIuAsVSpWz5Bbkj3dEgYiUIszqWdpZe+Z7/wB1oCYmIoboiwiLT2WjKl/jscrHfGg/pKdMkyklC5Zs2LEfHYpjcRoPzme9MWWmk3dWbK9ObkWkikOetJ554fWyoEsmdSlt+uR0pCJR34b6t/TVg1SY3sYvdf8vuiKrpyaDXDISiegp17p7579Gp3p++y7HPAiY9pmTibljrr85qSidtlg4+l25GLCaS8e6rRxNBmsnERunKbaOObRz7N72ju5vdAjYpBXHgJylOAVsMseDAPEP8LYoUHicY2BiAAEfhiAGJgZWBgZ7RnFRdnVJELCQlBSRlATJMoLV2DK4glSYs6ubq5vbKrJLSbGrgEmovDuDJVhe3VzcXFwNLCOILB/C4IuQ1xTn5FPilBTj5FPmBAB4WwoqAHicY2BkYGAA4sk1sR/j+W2+MnAzpDBgAyEMQUCSg4EJxAEAwUgFHgB4nGNgZGBgSGFggJMhDIwMqEAYAByHATJ4nGNgAIIUNEwmAABl3AGReJxjYAACIQYlBiMGJ3wQAEcQBEV4nGNgZGBgEGZgY2BiAAEQyQWEDAz/wXwGAAsPATIAAHicXdBNSsNAHAXwl35iA0UQXYnMShfS9GPZA7T7LgIu03SSpkwzYTIt1BN4Ak/gKTyAeCxfw39jZkjymzcvAwmAW/wgwHUEGDb36+jQQ3GXGot79L24jxCP4gHzF/EIr4jEIe7wxhOC3g2TMYy4Q7+Lu/SHuEd/ivt4wJd4wPxbPEKMX3GI5+DJFGaSn4qNzk8mcbKSR6xdXdhSzaOZJGtdapd4vVPbi6rP+cL7TGXOHtXKll4bY1Xl7EGnPtp7Xy2n00zyKLVHfkHBa4IcJ2oD3cgggWvt/V/FbDrUlEUJhTn/0azVWbNTNr0Ens8de1tceK9xZmfB1CPjOmPH4kitmvOubcNpmVTN3oFJyjzCvnmrwhJTzqzVj9jiSX911FjeAAB4nG3HMRKCMBBA0f0giiKi4DU8k0V2GWbIZDOh4PoWWvq6J5V8If9NVNQcaDhyouXMhY4rPTcG7jwYmXhKq8Wz+p762aNaeYXom2n3m2dLTVgsrCgFJ7OTmIkYbwIbC6vIB7WmFfAAAA==") format("woff")}@media (pointer:coarse){.lil-gui.allow-touch-styles{--widget-height:28px;--padding:6px;--spacing:6px;--font-size:13px;--input-font-size:16px;--folder-indent:10px;--scrollbar-width:7px;--slider-input-min-width:50px;--color-input-min-width:65px}}@media (hover:hover){.lil-gui .controller.color .display:hover:before{border:1px solid #fff9;border-radius:var(--widget-border-radius);bottom:0;content:" ";display:block;left:0;position:absolute;right:0;top:0}.lil-gui .controller.option .display.focus{background:var(--focus-color)}.lil-gui .controller.option .widget:hover .display{background:var(--hover-color)}.lil-gui .controller.number .slider:hover{background-color:var(--hover-color)}body:not(.lil-gui-dragging) .lil-gui .title:hover{background:var(--title-background-color);opacity:.85}.lil-gui .title:focus{text-decoration:underline var(--focus-color)}.lil-gui input:hover{background:var(--hover-color)}.lil-gui input:active{background:var(--focus-color)}.lil-gui input[type=checkbox]:focus{box-shadow:inset 0 0 0 1px var(--focus-color)}.lil-gui button:hover{background:var(--hover-color);border-color:var(--hover-color)}.lil-gui button:focus{border-color:var(--focus-color)}}'),p=!0),e?e.appendChild(this.domElement):i&&(this.domElement.classList.add("autoPlace"),document.body.appendChild(this.domElement)),s&&this.domElement.style.setProperty("--width",s+"px"),this.domElement.addEventListener("keydown",t=>t.stopPropagation()),this.domElement.addEventListener("keyup",t=>t.stopPropagation());}add(t,e,s,n,l){if(Object(s)===s)return new c(this,t,e,s);const r=t[e];switch(typeof r){case"number":return new d(this,t,e,s,n,l);case"boolean":return new i(this,t,e);case"string":return new u(this,t,e);case"function":return new h(this,t,e)}console.error("gui.add failed\n\tproperty:",e,"\n\tobject:",t,"\n\tvalue:",r);}addColor(t,i,e=1){return new a(this,t,i,e)}addFolder(t){return new g({parent:this,title:t})}load(t,i=!0){return t.controllers&&this.controllers.forEach(i=>{i instanceof h||i._name in t.controllers&&i.load(t.controllers[i._name]);}),i&&t.folders&&this.folders.forEach(i=>{i._title in t.folders&&i.load(t.folders[i._title]);}),this}save(t=!0){const i={controllers:{},folders:{}};return this.controllers.forEach(t=>{if(!(t instanceof h)){if(t._name in i.controllers)throw new Error(`Cannot save GUI with duplicate property "${t._name}"`);i.controllers[t._name]=t.save();}}),t&&this.folders.forEach(t=>{if(t._title in i.folders)throw new Error(`Cannot save GUI with duplicate folder "${t._title}"`);i.folders[t._title]=t.save();}),i}open(t=!0){return this._closed=!t,this.$title.setAttribute("aria-expanded",!this._closed),this.domElement.classList.toggle("closed",this._closed),this}close(){return this.open(!1)}show(t=!0){return this._hidden=!t,this.domElement.style.display=this._hidden?"none":"",this}hide(){return this.show(!1)}openAnimated(t=!0){return this._closed=!t,this.$title.setAttribute("aria-expanded",!this._closed),requestAnimationFrame(()=>{const i=this.$children.clientHeight;this.$children.style.height=i+"px",this.domElement.classList.add("transition");const e=t=>{t.target===this.$children&&(this.$children.style.height="",this.domElement.classList.remove("transition"),this.$children.removeEventListener("transitionend",e));};this.$children.addEventListener("transitionend",e);const s=t?this.$children.scrollHeight:0;this.domElement.classList.toggle("closed",!t),requestAnimationFrame(()=>{this.$children.style.height=s+"px";});}),this}title(t){return this._title=t,this.$title.innerHTML=t,this}reset(t=!0){return (t?this.controllersRecursive():this.controllers).forEach(t=>t.reset()),this}onChange(t){return this._onChange=t,this}_callOnChange(t){this.parent&&this.parent._callOnChange(t),void 0!==this._onChange&&this._onChange.call(this,{object:t.object,property:t.property,value:t.getValue(),controller:t});}onFinishChange(t){return this._onFinishChange=t,this}_callOnFinishChange(t){this.parent&&this.parent._callOnFinishChange(t),void 0!==this._onFinishChange&&this._onFinishChange.call(this,{object:t.object,property:t.property,value:t.getValue(),controller:t});}destroy(){this.parent&&(this.parent.children.splice(this.parent.children.indexOf(this),1),this.parent.folders.splice(this.parent.folders.indexOf(this),1)),this.domElement.parentElement&&this.domElement.parentElement.removeChild(this.domElement),Array.from(this.children).forEach(t=>t.destroy());}controllersRecursive(){let t=Array.from(this.controllers);return this.folders.forEach(i=>{t=t.concat(i.controllersRecursive());}),t}foldersRecursive(){let t=Array.from(this.folders);return this.folders.forEach(i=>{t=t.concat(i.foldersRecursive());}),t}}

	class Listener {
	    _eventListeners = {}; // events 事件
	    _eventListenerNames = [
	        // TODO add keyboard events
	        'mouse-down', // alias of 'mouse-down-left'
	        'mouse-down-left',
	        'mouse-down-middle',
	        'mouse-down-right',
	        'mouse-move',
	        'mouse-up',
	        'mouse-click', // alias of 'mouse-click-left'
	        'mouse-click-left',
	        'mouse-click-middle',
	        'mouse-click-right',
	        'mouse-drag-end',
	        'pointer-down', // alias of 'pointer-down-left'
	        'pointer-down-left', // 按下未抬起
	        'pointer-down-middle',
	        'pointer-down-right',
	        'pointer-move',
	        'pointer-up',
	        'pointer-click', // alias of 'pointer-click-left' //PointClick是鼠标完成一次点击时调用（按下抬起）
	        'pointer-click-left',
	        'pointer-click-middle',
	        'pointer-click-right',
	        'pointer-drag-end',
	        'touch-start',
	        'touch-move',
	        'touch-end',
	        'touch-click',
	        'touch-drag-end',
	        'xr-touchpad-touch-start',
	        'xr-touchpad-touch-end',
	        'xr-touchpad-press-start',
	        'xr-touchpad-press-end',
	        'xr-trigger-press-start',
	        'xr-trigger-press-end',
	    ];
	    constructor(canvas){
	        this.canvas = canvas;
	        this._initCursorListeners(this.canvas, 'mouse'); // legacy support
	        this._initCursorListeners(this.canvas, 'pointer');
	        this._initTouchListeners(this.canvas);
	        // this._raycaster = new THREE.Raycaster();
	    }
	    // deprecated; for compat only
	    setEventListener(eventName, listener) { this.on(eventName, listener); }
	    
	    on(eventName, listener) {
	        if (this._eventListenerNames.includes(eventName)) {
	            // aliases
	            if (eventName === 'mouse-down') eventName = 'mouse-down-left';
	            if (eventName === 'mouse-click') eventName = 'mouse-click-left';
	            if (eventName === 'pointer-down') eventName = 'pointer-down-left';
	            if (eventName === 'pointer-click') eventName = 'pointer-click-left';

	            const listeners = eventName.startsWith('xr-') ?
	                this._vrcHelper._eventListeners : this._eventListeners;
	            listeners[eventName] = listener;
	        } else {
	            console.error('@@ on(): unsupported eventName:', eventName);
	            if (eventName.startsWith('vr-')) {
	                console.info(`${eventName} is deprecated; use 'xr-' instead`);
	            }
	        }
	    }

	    _callIfDefined(name, coords) {
	        const fn = this._eventListeners[name];
	        if (fn) fn(...coords);
	    }

	    _initCursorListeners(canvas, type) { // `type`: either 'mouse' or 'pointer'
	        // https://stackoverflow.com/questions/6042202/how-to-distinguish-mouse-click-and-drag
	        let isDragging = false;
	        canvas.addEventListener(`${type}down`, e => {
	            isDragging = false;
	            const coords = Listener.getInputCoords(e, canvas);
	            if (e.button === 0) {
	                this._callIfDefined(`${type}-down-left`, coords);
	            } else if (e.button === 1) {
	                this._callIfDefined(`${type}-down-middle`, coords);
	            } else if (e.button === 2) {
	                this._callIfDefined(`${type}-down-right`, coords);
	            }
	        }, false);
	        canvas.addEventListener(`${type}move`, e => {
	            isDragging = true;
	            const coords = Listener.getInputCoords(e, canvas);
	            this._callIfDefined(`${type}-move`, coords);
	        }, false);
	        canvas.addEventListener(`${type}up`, e => {
	            const coords = Listener.getInputCoords(e, canvas);
	            this._callIfDefined(`${type}-up`, coords);

	            if (isDragging) {
	                this._callIfDefined(`${type}-drag-end`, coords);
	            } else {
	                console.log(`${type}up: click`);
	                if (e.button === 0) {
	                    this._callIfDefined(`${type}-click-left`, coords);
	                } else if (e.button === 1) {
	                    this._callIfDefined(`${type}-click-middle`, coords);
	                } else if (e.button === 2) {
	                    this._callIfDefined(`${type}-click-right`, coords);
	                }
	            }
	        }, false);
	    }
	    _initTouchListeners(canvas) {
	        let isDragging = false;
	        canvas.addEventListener("touchstart", e => {
	            isDragging = false;
	            const coords = Listener.getInputCoords(e, canvas);
	            // console.log('@@ touch start:', ...coords);
	            this._callIfDefined('touch-start', coords);
	        }, false);
	        canvas.addEventListener("touchmove", e => {
	            isDragging = true;
	            const coords = Listener.getInputCoords(e, canvas);
	            // console.log('@@ touch move:', ...coords);
	            this._callIfDefined('touch-move', coords);
	        }, false);
	        canvas.addEventListener("touchend", e => {
	            const coords = Listener.getInputCoords(e, canvas);

	            // console.log('@@ touch end:', ...coords);
	            this._callIfDefined('touch-end', coords);

	            if (isDragging) {
	                console.log("touchup: drag");
	                this._callIfDefined('touch-drag-end', coords);
	            } else {
	                console.log("touchup: click");
	                this._callIfDefined('touch-click', coords);
	            }
	        }, false);
	    }

	    // highlevel utils for binding input device events
	    setupMouseInterface(cbs) { this._setupInputInterface('mouse', cbs); }
	    setupPointerInterface(cbs) { this._setupInputInterface('pointer', cbs); }
	    setupTouchInterface(cbs) { this._setupInputInterface('touch', cbs); }
	    _setupInputInterface(device, callbacks) {
	        const { onClick, onDrag, onDragStart, onDragEnd } = callbacks;
	        let _isDragging = false;

	        const downEventName = `${device}-${device === 'touch' ? 'start' : 'down'}`;
	        this.on(downEventName, (mx, my) => {
	            _isDragging = true;
	            // console.log('@@ ifce down:', device, mx, my);
	            if (onDragStart) onDragStart(mx, my);
	        });

	        this.on(`${device}-move`, (mx, my) => {
	            if (onDrag && _isDragging) onDrag(mx, my);
	        });
	        this.on(`${device}-drag-end`, (mx, my) => {
	            _isDragging = false;
	            // console.log('@@ ifce drag end:', device, mx, my);
	            if (onDragEnd) onDragEnd(mx, my);
	        });
	        this.on(`${device}-click`, (mx, my) => {
	            _isDragging = false;
	            // console.log('@@ ifce click:', device, mx, my);
	            if (onClick) onClick(mx, my);
	            if (onDragEnd) onDragEnd(mx, my);
	        });
	    }

	    static getInputCoords(e, canvas) {
	        // console.log('@@ e:', e, e.type);
	        // https://developer.mozilla.org/en-US/docs/Web/API/Touch/clientX
	        let x, y;
	        if (e.type === 'touchend') {
	            [x, y] = [e.changedTouches[0].clientX, e.changedTouches[0].clientY];
	        } else if (e.type === 'touchstart' || e.type === 'touchmove') {
	            [x, y] = [e.touches[0].clientX, e.touches[0].clientY];
	        } else {
	            [x, y] = [e.clientX, e.clientY];
	        }
	        // console.log('getInputCoords(): x, y:', x, y);

	        // https://stackoverflow.com/questions/55677/how-do-i-get-the-coordinates-of-a-mouse-click-on-a-canvas-element/18053642#18053642
	        const rect = canvas.getBoundingClientRect();
	        const [mx, my] = [x - rect.left, y - rect.top];
	        // console.log('getInputCoords():', mx, my, canvas.width, canvas.height);
	        return [mx, my];
	    }
	}

	class MeshControls {
	    constructor(layer) {
	        this.canvas = layer.canvas;
	        this.camera = layer.camera;
	        this.renderer = layer.renderer;
	        this.scene = layer.scene;
	        this.orbitControls = layer.controls;
	        this.listener = new Listener(this.canvas);
	        this.raycaster = new three.Raycaster();
	        this.controls = new TransformControls(this.camera, this.renderer.domElement);
	        // this.controls.addEventListener( 'change', render);
	        this.controls.addEventListener('dragging-changed', (event) => {
	            this.orbitControls.enabled = !event.value;
	        });
	        const gizmo = this.controls.getHelper();
			this.scene.add( gizmo );
	        let that = this;
	        // that.caterGroup = this.scene;
	        const texture = new three.TextureLoader().load( 'https://threejs.org/examples/textures/crate.gif' );
	        
	        texture.colorSpace = three.SRGBColorSpace;
	        texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
	        const geometry = new three.BoxGeometry();
	        const material = new three.MeshLambertMaterial( { map: texture } );
	        const mesh = new three.Mesh( geometry, material );
	        mesh.scale.set( 100000, 100000, 100000);
	        let group = new three.Group();
	        group.add(mesh);
	        this.scene.add(group);
	        that.caterGroup = group;
	        this.initGui();
	        // this.controls.attach(mesh);
	        this.listener.on('mouse-click', (mx,my) => {
	            let isect = this.raycastFromMouse(mx,my, that.caterGroup.children, true);
	            if(isect){
	                that.midifytarget = isect.object;
	                // that.callback();
	                this.controls.attach(isect.object);
	            }
	        });
	        window.addEventListener('keydown', (event) => {
	           switch (event.key) {
	            case 'w':
	                this.controls.setMode( 'translate' );
	                break;

	            case 'e':
	                this.controls.setMode( 'rotate' );
	                break;

	            case 'r':
	                this.controls.setMode( 'scale' );
	                break;
	            case '+':
	            case '=':
	                this.controls.setSize( this.controls.size + 0.1 );
	                break;

	            case '-':
	            case '_':
	                this.controls.setSize( Math.max( this.controls.size - 0.1, 0.1 ) );
	                break;

	            case 'x':
	                this.controls.showX = ! this.controls.showX;
	                break;

	            case 'y':
	                this.controls.showY = ! this.controls.showY;
	                break;

	            case 'z':
	                this.controls.showZ = ! this.controls.showZ;
	                break;

	            case ' ':
	                this.controls.enabled = ! this.controls.enabled;
	                break;

	            case 'Escape':
	                this.controls.detach();
	                break;
	           }
	        });
	    }

	    callback() {
	        this.controls.attach(this.midifytarget);
	    }
	    // 拾取功能，根据鼠标位置获取物体
	    // 高亮mesh
	    // 编辑mesh
	    initGui(){
	        this.gui = new g();
	        //改变交互界面style属性
	        this.gui.domElement.style.left = '0px';
	        this.gui.domElement.style.top = '80px';
	        this.gui.domElement.style.width = '300px';
	        let controls = this.gui.addFolder('Scene');
	        let childrens = this.scene.children;
	        
	        for(let child of childrens){
	            if(child instanceof three.Group){
	                let groupControls = controls.addFolder(child.name);
	                let g_children = child.children;
	                for(let g_child of g_children){
	                    let mesh = groupControls.addFolder(g_child.name);
	                    mesh.add(g_child.position, 'x').name('px');
	                    mesh.add(g_child.position, 'y').name('py');
	                    mesh.add(g_child.position, 'z').name('pz');
	                    mesh.add(g_child.rotation, 'x').name('rx');
	                    mesh.add(g_child.rotation, 'y').name('ry');
	                    mesh.add(g_child.rotation, 'z').name('rz');
	                    mesh.add(g_child.scale, 'x').name('sx');
	                    mesh.add(g_child.scale, 'y').name('sy');
	                    mesh.add(g_child.scale, 'z').name('sz');
	                }
	            }
	        }
	        
	    }
	    _raycast(meshes, recursive, faceExclude) {
	        const isects = this.raycaster.intersectObjects(meshes, recursive);
	        if (faceExclude) {
	            for (let i = 0; i < isects.length; i++) {
	                if (isects[i].face !== faceExclude) {
	                    return isects[i];
	                }
	            }
	            return null;
	        }
	        return isects.length > 0 ? isects[0] : null;
	    }

	    _raycastFromMouse(mx, my, width, height, cam, meshes, recursive=false) {
	        const mouse = new three.Vector2( // normalized (-1 to +1)
	            (mx / width) * 2 - 1,
	            - (my / height) * 2 + 1);
	        // https://threejs.org/docs/#api/core/Raycaster
	        // update the picking ray with the camera and mouse position
	        this.raycaster.setFromCamera(mouse, cam);
	        return this._raycast(meshes, recursive, null);
	    }

	    /**
	     * 
	     * @param {*} mx 屏幕坐标x
	     * @param {*} my 屏幕坐标y
	     * @param {boolean} recursive 是否检查子节点，true 递归检查
	     * @returns mesh
	     */
	    raycastFromMouse(mx, my, group, recursive=false) {
	        //---- NG: 2x when starting with Chrome's inspector mobile
	        // const {width, height} = this.renderer.domElement;
	        // const {width, height} = this.canvas;
	        //---- OK
	        const {clientWidth, clientHeight} = this.canvas;
	        // this.mapView.children
	        // this.scene.children
	        return this._raycastFromMouse(
	            mx, my, clientWidth, clientHeight, this.camera,
	            group, recursive);
	    }
	}

	exports.MeshControls = MeshControls;

}));

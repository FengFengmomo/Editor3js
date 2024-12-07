import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { Group, Raycaster, Vector2,Scene ,TextureLoader, BoxGeometry, MeshLambertMaterial,SRGBColorSpace, Mesh} from 'three';
import {GUI} from 'three/examples/jsm/libs/lil-gui.module.min.js'
import { Listener } from './listener';

export class MeshControls {
    constructor(layer) {
        this.canvas = layer.canvas;
        this.camera = layer.camera;
        this.renderer = layer.renderer;
        this.scene = layer.scene;
        this.orbitControls = layer.controls;
        this.listener = new Listener(this.canvas);
        this.raycaster = new Raycaster();
        this.controls = new TransformControls(this.camera, this.renderer.domElement);
        function render() {
            that.renderer.render(that.scene, that.camera);
        }
        // this.controls.addEventListener( 'change', render);
        this.controls.addEventListener('dragging-changed', (event) => {
            this.orbitControls.enabled = !event.value;
        });
        const gizmo = this.controls.getHelper();
		this.scene.add( gizmo );
        let that = this;
        // that.caterGroup = this.scene;
        const texture = new TextureLoader().load( 'https://threejs.org/examples/textures/crate.gif' );
        
        texture.colorSpace = SRGBColorSpace;
        texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        const geometry = new BoxGeometry();
        const material = new MeshLambertMaterial( { map: texture } );
        const mesh = new Mesh( geometry, material );
        mesh.scale.set( 100000, 100000, 100000);
        let group = new Group();
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
        this.gui = new GUI();
        //改变交互界面style属性
        this.gui.domElement.style.left = '0px';
        this.gui.domElement.style.top = '80px';
        this.gui.domElement.style.width = '300px';
        let controls = this.gui.addFolder('Scene');
        let childrens = this.scene.children;
        
        for(let child of childrens){
            if(child instanceof Group){
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
        const mouse = new Vector2( // normalized (-1 to +1)
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
import{v as De,V as P,S as nt,B as wt,U as Ce,M as L,a as ce,O as Se,R as vt,E as St,b as Xe,Q as J,C as ye,c as ot,D as at,L as bt,d as se,e as _e,F as we,f as W,P as de,g as he,h as Mt,T as Me,I as jt,i as Te,j as me,W as Et,k as Ye,l as rt,m as $e,n as lt,o as ge,p as Pt,q as It,r as v,u as le,_ as be,s as _t,t as e,w as Lt,x as At,y as Qe,z as Ve,A as Re,G as ie,H as Ue,J as Ie,K as ve,N as zt,X as Gt,Y as Oe,Z as ct,$ as Be,a0 as Ct,a1 as Tt,a2 as qe,a3 as ht,a4 as dt,a5 as Rt,a6 as Ot}from"./index-CAOljmCJ.js";const ut=De>=125?"uv1":"uv2";var Dt=Object.defineProperty,Xt=(s,o,a)=>o in s?Dt(s,o,{enumerable:!0,configurable:!0,writable:!0,value:a}):s[o]=a,Ne=(s,o,a)=>(Xt(s,typeof o!="symbol"?o+"":o,a),a);const Yt=(()=>{const s={uniforms:{turbidity:{value:2},rayleigh:{value:1},mieCoefficient:{value:.005},mieDirectionalG:{value:.8},sunPosition:{value:new P},up:{value:new P(0,1,0)}},vertexShader:`
      uniform vec3 sunPosition;
      uniform float rayleigh;
      uniform float turbidity;
      uniform float mieCoefficient;
      uniform vec3 up;

      varying vec3 vWorldPosition;
      varying vec3 vSunDirection;
      varying float vSunfade;
      varying vec3 vBetaR;
      varying vec3 vBetaM;
      varying float vSunE;

      // constants for atmospheric scattering
      const float e = 2.71828182845904523536028747135266249775724709369995957;
      const float pi = 3.141592653589793238462643383279502884197169;

      // wavelength of used primaries, according to preetham
      const vec3 lambda = vec3( 680E-9, 550E-9, 450E-9 );
      // this pre-calcuation replaces older TotalRayleigh(vec3 lambda) function:
      // (8.0 * pow(pi, 3.0) * pow(pow(n, 2.0) - 1.0, 2.0) * (6.0 + 3.0 * pn)) / (3.0 * N * pow(lambda, vec3(4.0)) * (6.0 - 7.0 * pn))
      const vec3 totalRayleigh = vec3( 5.804542996261093E-6, 1.3562911419845635E-5, 3.0265902468824876E-5 );

      // mie stuff
      // K coefficient for the primaries
      const float v = 4.0;
      const vec3 K = vec3( 0.686, 0.678, 0.666 );
      // MieConst = pi * pow( ( 2.0 * pi ) / lambda, vec3( v - 2.0 ) ) * K
      const vec3 MieConst = vec3( 1.8399918514433978E14, 2.7798023919660528E14, 4.0790479543861094E14 );

      // earth shadow hack
      // cutoffAngle = pi / 1.95;
      const float cutoffAngle = 1.6110731556870734;
      const float steepness = 1.5;
      const float EE = 1000.0;

      float sunIntensity( float zenithAngleCos ) {
        zenithAngleCos = clamp( zenithAngleCos, -1.0, 1.0 );
        return EE * max( 0.0, 1.0 - pow( e, -( ( cutoffAngle - acos( zenithAngleCos ) ) / steepness ) ) );
      }

      vec3 totalMie( float T ) {
        float c = ( 0.2 * T ) * 10E-18;
        return 0.434 * c * MieConst;
      }

      void main() {

        vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
        vWorldPosition = worldPosition.xyz;

        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        gl_Position.z = gl_Position.w; // set z to camera.far

        vSunDirection = normalize( sunPosition );

        vSunE = sunIntensity( dot( vSunDirection, up ) );

        vSunfade = 1.0 - clamp( 1.0 - exp( ( sunPosition.y / 450000.0 ) ), 0.0, 1.0 );

        float rayleighCoefficient = rayleigh - ( 1.0 * ( 1.0 - vSunfade ) );

      // extinction (absorbtion + out scattering)
      // rayleigh coefficients
        vBetaR = totalRayleigh * rayleighCoefficient;

      // mie coefficients
        vBetaM = totalMie( turbidity ) * mieCoefficient;

      }
    `,fragmentShader:`
      varying vec3 vWorldPosition;
      varying vec3 vSunDirection;
      varying float vSunfade;
      varying vec3 vBetaR;
      varying vec3 vBetaM;
      varying float vSunE;

      uniform float mieDirectionalG;
      uniform vec3 up;

      const vec3 cameraPos = vec3( 0.0, 0.0, 0.0 );

      // constants for atmospheric scattering
      const float pi = 3.141592653589793238462643383279502884197169;

      const float n = 1.0003; // refractive index of air
      const float N = 2.545E25; // number of molecules per unit volume for air at 288.15K and 1013mb (sea level -45 celsius)

      // optical length at zenith for molecules
      const float rayleighZenithLength = 8.4E3;
      const float mieZenithLength = 1.25E3;
      // 66 arc seconds -> degrees, and the cosine of that
      const float sunAngularDiameterCos = 0.999956676946448443553574619906976478926848692873900859324;

      // 3.0 / ( 16.0 * pi )
      const float THREE_OVER_SIXTEENPI = 0.05968310365946075;
      // 1.0 / ( 4.0 * pi )
      const float ONE_OVER_FOURPI = 0.07957747154594767;

      float rayleighPhase( float cosTheta ) {
        return THREE_OVER_SIXTEENPI * ( 1.0 + pow( cosTheta, 2.0 ) );
      }

      float hgPhase( float cosTheta, float g ) {
        float g2 = pow( g, 2.0 );
        float inverse = 1.0 / pow( 1.0 - 2.0 * g * cosTheta + g2, 1.5 );
        return ONE_OVER_FOURPI * ( ( 1.0 - g2 ) * inverse );
      }

      void main() {

        vec3 direction = normalize( vWorldPosition - cameraPos );

      // optical length
      // cutoff angle at 90 to avoid singularity in next formula.
        float zenithAngle = acos( max( 0.0, dot( up, direction ) ) );
        float inverse = 1.0 / ( cos( zenithAngle ) + 0.15 * pow( 93.885 - ( ( zenithAngle * 180.0 ) / pi ), -1.253 ) );
        float sR = rayleighZenithLength * inverse;
        float sM = mieZenithLength * inverse;

      // combined extinction factor
        vec3 Fex = exp( -( vBetaR * sR + vBetaM * sM ) );

      // in scattering
        float cosTheta = dot( direction, vSunDirection );

        float rPhase = rayleighPhase( cosTheta * 0.5 + 0.5 );
        vec3 betaRTheta = vBetaR * rPhase;

        float mPhase = hgPhase( cosTheta, mieDirectionalG );
        vec3 betaMTheta = vBetaM * mPhase;

        vec3 Lin = pow( vSunE * ( ( betaRTheta + betaMTheta ) / ( vBetaR + vBetaM ) ) * ( 1.0 - Fex ), vec3( 1.5 ) );
        Lin *= mix( vec3( 1.0 ), pow( vSunE * ( ( betaRTheta + betaMTheta ) / ( vBetaR + vBetaM ) ) * Fex, vec3( 1.0 / 2.0 ) ), clamp( pow( 1.0 - dot( up, vSunDirection ), 5.0 ), 0.0, 1.0 ) );

      // nightsky
        float theta = acos( direction.y ); // elevation --> y-axis, [-pi/2, pi/2]
        float phi = atan( direction.z, direction.x ); // azimuth --> x-axis [-pi/2, pi/2]
        vec2 uv = vec2( phi, theta ) / vec2( 2.0 * pi, pi ) + vec2( 0.5, 0.0 );
        vec3 L0 = vec3( 0.1 ) * Fex;

      // composition + solar disc
        float sundisk = smoothstep( sunAngularDiameterCos, sunAngularDiameterCos + 0.00002, cosTheta );
        L0 += ( vSunE * 19000.0 * Fex ) * sundisk;

        vec3 texColor = ( Lin + L0 ) * 0.04 + vec3( 0.0, 0.0003, 0.00075 );

        vec3 retColor = pow( texColor, vec3( 1.0 / ( 1.2 + ( 1.2 * vSunfade ) ) ) );

        gl_FragColor = vec4( retColor, 1.0 );

      #include <tonemapping_fragment>
      #include <${De>=154?"colorspace_fragment":"encodings_fragment"}>

      }
    `},o=new nt({name:"SkyShader",fragmentShader:s.fragmentShader,vertexShader:s.vertexShader,uniforms:Ce.clone(s.uniforms),side:wt,depthWrite:!1});class a extends L{constructor(){super(new ce(1,1,1),o)}}return Ne(a,"SkyShader",s),Ne(a,"material",o),a})();var Qt=Object.defineProperty,Vt=(s,o,a)=>o in s?Qt(s,o,{enumerable:!0,configurable:!0,writable:!0,value:a}):s[o]=a,d=(s,o,a)=>(Vt(s,typeof o!="symbol"?o+"":o,a),a);let Ut=class extends Se{constructor(o,a){super(),d(this,"isTransformControls",!0),d(this,"visible",!1),d(this,"domElement"),d(this,"raycaster",new vt),d(this,"gizmo"),d(this,"plane"),d(this,"tempVector",new P),d(this,"tempVector2",new P),d(this,"tempQuaternion",new J),d(this,"unit",{X:new P(1,0,0),Y:new P(0,1,0),Z:new P(0,0,1)}),d(this,"pointStart",new P),d(this,"pointEnd",new P),d(this,"offset",new P),d(this,"rotationAxis",new P),d(this,"startNorm",new P),d(this,"endNorm",new P),d(this,"rotationAngle",0),d(this,"cameraPosition",new P),d(this,"cameraQuaternion",new J),d(this,"cameraScale",new P),d(this,"parentPosition",new P),d(this,"parentQuaternion",new J),d(this,"parentQuaternionInv",new J),d(this,"parentScale",new P),d(this,"worldPositionStart",new P),d(this,"worldQuaternionStart",new J),d(this,"worldScaleStart",new P),d(this,"worldPosition",new P),d(this,"worldQuaternion",new J),d(this,"worldQuaternionInv",new J),d(this,"worldScale",new P),d(this,"eye",new P),d(this,"positionStart",new P),d(this,"quaternionStart",new J),d(this,"scaleStart",new P),d(this,"camera"),d(this,"object"),d(this,"enabled",!0),d(this,"axis",null),d(this,"mode","translate"),d(this,"translationSnap",null),d(this,"rotationSnap",null),d(this,"scaleSnap",null),d(this,"space","world"),d(this,"size",1),d(this,"dragging",!1),d(this,"showX",!0),d(this,"showY",!0),d(this,"showZ",!0),d(this,"changeEvent",{type:"change"}),d(this,"mouseDownEvent",{type:"mouseDown",mode:this.mode}),d(this,"mouseUpEvent",{type:"mouseUp",mode:this.mode}),d(this,"objectChangeEvent",{type:"objectChange"}),d(this,"intersectObjectWithRay",(t,n,c)=>{const i=n.intersectObject(t,!0);for(let l=0;l<i.length;l++)if(i[l].object.visible||c)return i[l];return!1}),d(this,"attach",t=>(this.object=t,this.visible=!0,this)),d(this,"detach",()=>(this.object=void 0,this.visible=!1,this.axis=null,this)),d(this,"reset",()=>this.enabled?(this.dragging&&this.object!==void 0&&(this.object.position.copy(this.positionStart),this.object.quaternion.copy(this.quaternionStart),this.object.scale.copy(this.scaleStart),this.dispatchEvent(this.changeEvent),this.dispatchEvent(this.objectChangeEvent),this.pointStart.copy(this.pointEnd)),this):this),d(this,"updateMatrixWorld",()=>{this.object!==void 0&&(this.object.updateMatrixWorld(),this.object.parent===null?console.error("TransformControls: The attached 3D object must be a part of the scene graph."):this.object.parent.matrixWorld.decompose(this.parentPosition,this.parentQuaternion,this.parentScale),this.object.matrixWorld.decompose(this.worldPosition,this.worldQuaternion,this.worldScale),this.parentQuaternionInv.copy(this.parentQuaternion).invert(),this.worldQuaternionInv.copy(this.worldQuaternion).invert()),this.camera.updateMatrixWorld(),this.camera.matrixWorld.decompose(this.cameraPosition,this.cameraQuaternion,this.cameraScale),this.eye.copy(this.cameraPosition).sub(this.worldPosition).normalize(),super.updateMatrixWorld()}),d(this,"pointerHover",t=>{if(this.object===void 0||this.dragging===!0)return;this.raycaster.setFromCamera(t,this.camera);const n=this.intersectObjectWithRay(this.gizmo.picker[this.mode],this.raycaster);n?this.axis=n.object.name:this.axis=null}),d(this,"pointerDown",t=>{if(!(this.object===void 0||this.dragging===!0||t.button!==0)&&this.axis!==null){this.raycaster.setFromCamera(t,this.camera);const n=this.intersectObjectWithRay(this.plane,this.raycaster,!0);if(n){let c=this.space;if(this.mode==="scale"?c="local":(this.axis==="E"||this.axis==="XYZE"||this.axis==="XYZ")&&(c="world"),c==="local"&&this.mode==="rotate"){const i=this.rotationSnap;this.axis==="X"&&i&&(this.object.rotation.x=Math.round(this.object.rotation.x/i)*i),this.axis==="Y"&&i&&(this.object.rotation.y=Math.round(this.object.rotation.y/i)*i),this.axis==="Z"&&i&&(this.object.rotation.z=Math.round(this.object.rotation.z/i)*i)}this.object.updateMatrixWorld(),this.object.parent&&this.object.parent.updateMatrixWorld(),this.positionStart.copy(this.object.position),this.quaternionStart.copy(this.object.quaternion),this.scaleStart.copy(this.object.scale),this.object.matrixWorld.decompose(this.worldPositionStart,this.worldQuaternionStart,this.worldScaleStart),this.pointStart.copy(n.point).sub(this.worldPositionStart)}this.dragging=!0,this.mouseDownEvent.mode=this.mode,this.dispatchEvent(this.mouseDownEvent)}}),d(this,"pointerMove",t=>{const n=this.axis,c=this.mode,i=this.object;let l=this.space;if(c==="scale"?l="local":(n==="E"||n==="XYZE"||n==="XYZ")&&(l="world"),i===void 0||n===null||this.dragging===!1||t.button!==-1)return;this.raycaster.setFromCamera(t,this.camera);const p=this.intersectObjectWithRay(this.plane,this.raycaster,!0);if(p){if(this.pointEnd.copy(p.point).sub(this.worldPositionStart),c==="translate")this.offset.copy(this.pointEnd).sub(this.pointStart),l==="local"&&n!=="XYZ"&&this.offset.applyQuaternion(this.worldQuaternionInv),n.indexOf("X")===-1&&(this.offset.x=0),n.indexOf("Y")===-1&&(this.offset.y=0),n.indexOf("Z")===-1&&(this.offset.z=0),l==="local"&&n!=="XYZ"?this.offset.applyQuaternion(this.quaternionStart).divide(this.parentScale):this.offset.applyQuaternion(this.parentQuaternionInv).divide(this.parentScale),i.position.copy(this.offset).add(this.positionStart),this.translationSnap&&(l==="local"&&(i.position.applyQuaternion(this.tempQuaternion.copy(this.quaternionStart).invert()),n.search("X")!==-1&&(i.position.x=Math.round(i.position.x/this.translationSnap)*this.translationSnap),n.search("Y")!==-1&&(i.position.y=Math.round(i.position.y/this.translationSnap)*this.translationSnap),n.search("Z")!==-1&&(i.position.z=Math.round(i.position.z/this.translationSnap)*this.translationSnap),i.position.applyQuaternion(this.quaternionStart)),l==="world"&&(i.parent&&i.position.add(this.tempVector.setFromMatrixPosition(i.parent.matrixWorld)),n.search("X")!==-1&&(i.position.x=Math.round(i.position.x/this.translationSnap)*this.translationSnap),n.search("Y")!==-1&&(i.position.y=Math.round(i.position.y/this.translationSnap)*this.translationSnap),n.search("Z")!==-1&&(i.position.z=Math.round(i.position.z/this.translationSnap)*this.translationSnap),i.parent&&i.position.sub(this.tempVector.setFromMatrixPosition(i.parent.matrixWorld))));else if(c==="scale"){if(n.search("XYZ")!==-1){let S=this.pointEnd.length()/this.pointStart.length();this.pointEnd.dot(this.pointStart)<0&&(S*=-1),this.tempVector2.set(S,S,S)}else this.tempVector.copy(this.pointStart),this.tempVector2.copy(this.pointEnd),this.tempVector.applyQuaternion(this.worldQuaternionInv),this.tempVector2.applyQuaternion(this.worldQuaternionInv),this.tempVector2.divide(this.tempVector),n.search("X")===-1&&(this.tempVector2.x=1),n.search("Y")===-1&&(this.tempVector2.y=1),n.search("Z")===-1&&(this.tempVector2.z=1);i.scale.copy(this.scaleStart).multiply(this.tempVector2),this.scaleSnap&&this.object&&(n.search("X")!==-1&&(this.object.scale.x=Math.round(i.scale.x/this.scaleSnap)*this.scaleSnap||this.scaleSnap),n.search("Y")!==-1&&(i.scale.y=Math.round(i.scale.y/this.scaleSnap)*this.scaleSnap||this.scaleSnap),n.search("Z")!==-1&&(i.scale.z=Math.round(i.scale.z/this.scaleSnap)*this.scaleSnap||this.scaleSnap))}else if(c==="rotate"){this.offset.copy(this.pointEnd).sub(this.pointStart);const S=20/this.worldPosition.distanceTo(this.tempVector.setFromMatrixPosition(this.camera.matrixWorld));n==="E"?(this.rotationAxis.copy(this.eye),this.rotationAngle=this.pointEnd.angleTo(this.pointStart),this.startNorm.copy(this.pointStart).normalize(),this.endNorm.copy(this.pointEnd).normalize(),this.rotationAngle*=this.endNorm.cross(this.startNorm).dot(this.eye)<0?1:-1):n==="XYZE"?(this.rotationAxis.copy(this.offset).cross(this.eye).normalize(),this.rotationAngle=this.offset.dot(this.tempVector.copy(this.rotationAxis).cross(this.eye))*S):(n==="X"||n==="Y"||n==="Z")&&(this.rotationAxis.copy(this.unit[n]),this.tempVector.copy(this.unit[n]),l==="local"&&this.tempVector.applyQuaternion(this.worldQuaternion),this.rotationAngle=this.offset.dot(this.tempVector.cross(this.eye).normalize())*S),this.rotationSnap&&(this.rotationAngle=Math.round(this.rotationAngle/this.rotationSnap)*this.rotationSnap),l==="local"&&n!=="E"&&n!=="XYZE"?(i.quaternion.copy(this.quaternionStart),i.quaternion.multiply(this.tempQuaternion.setFromAxisAngle(this.rotationAxis,this.rotationAngle)).normalize()):(this.rotationAxis.applyQuaternion(this.parentQuaternionInv),i.quaternion.copy(this.tempQuaternion.setFromAxisAngle(this.rotationAxis,this.rotationAngle)),i.quaternion.multiply(this.quaternionStart).normalize())}this.dispatchEvent(this.changeEvent),this.dispatchEvent(this.objectChangeEvent)}}),d(this,"pointerUp",t=>{t.button===0&&(this.dragging&&this.axis!==null&&(this.mouseUpEvent.mode=this.mode,this.dispatchEvent(this.mouseUpEvent)),this.dragging=!1,this.axis=null)}),d(this,"getPointer",t=>{var n;if(this.domElement&&((n=this.domElement.ownerDocument)!=null&&n.pointerLockElement))return{x:0,y:0,button:t.button};{const c=t.changedTouches?t.changedTouches[0]:t,i=this.domElement.getBoundingClientRect();return{x:(c.clientX-i.left)/i.width*2-1,y:-(c.clientY-i.top)/i.height*2+1,button:t.button}}}),d(this,"onPointerHover",t=>{if(this.enabled)switch(t.pointerType){case"mouse":case"pen":this.pointerHover(this.getPointer(t));break}}),d(this,"onPointerDown",t=>{!this.enabled||!this.domElement||(this.domElement.style.touchAction="none",this.domElement.ownerDocument.addEventListener("pointermove",this.onPointerMove),this.pointerHover(this.getPointer(t)),this.pointerDown(this.getPointer(t)))}),d(this,"onPointerMove",t=>{this.enabled&&this.pointerMove(this.getPointer(t))}),d(this,"onPointerUp",t=>{!this.enabled||!this.domElement||(this.domElement.style.touchAction="",this.domElement.ownerDocument.removeEventListener("pointermove",this.onPointerMove),this.pointerUp(this.getPointer(t)))}),d(this,"getMode",()=>this.mode),d(this,"setMode",t=>{this.mode=t}),d(this,"setTranslationSnap",t=>{this.translationSnap=t}),d(this,"setRotationSnap",t=>{this.rotationSnap=t}),d(this,"setScaleSnap",t=>{this.scaleSnap=t}),d(this,"setSize",t=>{this.size=t}),d(this,"setSpace",t=>{this.space=t}),d(this,"update",()=>{console.warn("THREE.TransformControls: update function has no more functionality and therefore has been deprecated.")}),d(this,"connect",t=>{t===document&&console.error('THREE.OrbitControls: "document" should not be used as the target "domElement". Please use "renderer.domElement" instead.'),this.domElement=t,this.domElement.addEventListener("pointerdown",this.onPointerDown),this.domElement.addEventListener("pointermove",this.onPointerHover),this.domElement.ownerDocument.addEventListener("pointerup",this.onPointerUp)}),d(this,"dispose",()=>{var t,n,c,i,l,p;(t=this.domElement)==null||t.removeEventListener("pointerdown",this.onPointerDown),(n=this.domElement)==null||n.removeEventListener("pointermove",this.onPointerHover),(i=(c=this.domElement)==null?void 0:c.ownerDocument)==null||i.removeEventListener("pointermove",this.onPointerMove),(p=(l=this.domElement)==null?void 0:l.ownerDocument)==null||p.removeEventListener("pointerup",this.onPointerUp),this.traverse(S=>{const f=S;f.geometry&&f.geometry.dispose(),f.material&&f.material.dispose()})}),this.domElement=a,this.camera=o,this.gizmo=new Bt,this.add(this.gizmo),this.plane=new Zt,this.add(this.plane);const r=(t,n)=>{let c=n;Object.defineProperty(this,t,{get:function(){return c!==void 0?c:n},set:function(i){c!==i&&(c=i,this.plane[t]=i,this.gizmo[t]=i,this.dispatchEvent({type:t+"-changed",value:i}),this.dispatchEvent(this.changeEvent))}}),this[t]=n,this.plane[t]=n,this.gizmo[t]=n};r("camera",this.camera),r("object",this.object),r("enabled",this.enabled),r("axis",this.axis),r("mode",this.mode),r("translationSnap",this.translationSnap),r("rotationSnap",this.rotationSnap),r("scaleSnap",this.scaleSnap),r("space",this.space),r("size",this.size),r("dragging",this.dragging),r("showX",this.showX),r("showY",this.showY),r("showZ",this.showZ),r("worldPosition",this.worldPosition),r("worldPositionStart",this.worldPositionStart),r("worldQuaternion",this.worldQuaternion),r("worldQuaternionStart",this.worldQuaternionStart),r("cameraPosition",this.cameraPosition),r("cameraQuaternion",this.cameraQuaternion),r("pointStart",this.pointStart),r("pointEnd",this.pointEnd),r("rotationAxis",this.rotationAxis),r("rotationAngle",this.rotationAngle),r("eye",this.eye),a!==void 0&&this.connect(a)}};class Bt extends Se{constructor(){super(),d(this,"isTransformControlsGizmo",!0),d(this,"type","TransformControlsGizmo"),d(this,"tempVector",new P(0,0,0)),d(this,"tempEuler",new St),d(this,"alignVector",new P(0,1,0)),d(this,"zeroVector",new P(0,0,0)),d(this,"lookAtMatrix",new Xe),d(this,"tempQuaternion",new J),d(this,"tempQuaternion2",new J),d(this,"identityQuaternion",new J),d(this,"unitX",new P(1,0,0)),d(this,"unitY",new P(0,1,0)),d(this,"unitZ",new P(0,0,1)),d(this,"gizmo"),d(this,"picker"),d(this,"helper"),d(this,"rotationAxis",new P),d(this,"cameraPosition",new P),d(this,"worldPositionStart",new P),d(this,"worldQuaternionStart",new J),d(this,"worldPosition",new P),d(this,"worldQuaternion",new J),d(this,"eye",new P),d(this,"camera",null),d(this,"enabled",!0),d(this,"axis",null),d(this,"mode","translate"),d(this,"space","world"),d(this,"size",1),d(this,"dragging",!1),d(this,"showX",!0),d(this,"showY",!0),d(this,"showZ",!0),d(this,"updateMatrixWorld",()=>{let T=this.space;this.mode==="scale"&&(T="local");const b=T==="local"?this.worldQuaternion:this.identityQuaternion;this.gizmo.translate.visible=this.mode==="translate",this.gizmo.rotate.visible=this.mode==="rotate",this.gizmo.scale.visible=this.mode==="scale",this.helper.translate.visible=this.mode==="translate",this.helper.rotate.visible=this.mode==="rotate",this.helper.scale.visible=this.mode==="scale";let O=[];O=O.concat(this.picker[this.mode].children),O=O.concat(this.gizmo[this.mode].children),O=O.concat(this.helper[this.mode].children);for(let z=0;z<O.length;z++){const h=O[z];h.visible=!0,h.rotation.set(0,0,0),h.position.copy(this.worldPosition);let F;if(this.camera.isOrthographicCamera?F=(this.camera.top-this.camera.bottom)/this.camera.zoom:F=this.worldPosition.distanceTo(this.cameraPosition)*Math.min(1.9*Math.tan(Math.PI*this.camera.fov/360)/this.camera.zoom,7),h.scale.set(1,1,1).multiplyScalar(F*this.size/7),h.tag==="helper"){h.visible=!1,h.name==="AXIS"?(h.position.copy(this.worldPositionStart),h.visible=!!this.axis,this.axis==="X"&&(this.tempQuaternion.setFromEuler(this.tempEuler.set(0,0,0)),h.quaternion.copy(b).multiply(this.tempQuaternion),Math.abs(this.alignVector.copy(this.unitX).applyQuaternion(b).dot(this.eye))>.9&&(h.visible=!1)),this.axis==="Y"&&(this.tempQuaternion.setFromEuler(this.tempEuler.set(0,0,Math.PI/2)),h.quaternion.copy(b).multiply(this.tempQuaternion),Math.abs(this.alignVector.copy(this.unitY).applyQuaternion(b).dot(this.eye))>.9&&(h.visible=!1)),this.axis==="Z"&&(this.tempQuaternion.setFromEuler(this.tempEuler.set(0,Math.PI/2,0)),h.quaternion.copy(b).multiply(this.tempQuaternion),Math.abs(this.alignVector.copy(this.unitZ).applyQuaternion(b).dot(this.eye))>.9&&(h.visible=!1)),this.axis==="XYZE"&&(this.tempQuaternion.setFromEuler(this.tempEuler.set(0,Math.PI/2,0)),this.alignVector.copy(this.rotationAxis),h.quaternion.setFromRotationMatrix(this.lookAtMatrix.lookAt(this.zeroVector,this.alignVector,this.unitY)),h.quaternion.multiply(this.tempQuaternion),h.visible=this.dragging),this.axis==="E"&&(h.visible=!1)):h.name==="START"?(h.position.copy(this.worldPositionStart),h.visible=this.dragging):h.name==="END"?(h.position.copy(this.worldPosition),h.visible=this.dragging):h.name==="DELTA"?(h.position.copy(this.worldPositionStart),h.quaternion.copy(this.worldQuaternionStart),this.tempVector.set(1e-10,1e-10,1e-10).add(this.worldPositionStart).sub(this.worldPosition).multiplyScalar(-1),this.tempVector.applyQuaternion(this.worldQuaternionStart.clone().invert()),h.scale.copy(this.tempVector),h.visible=this.dragging):(h.quaternion.copy(b),this.dragging?h.position.copy(this.worldPositionStart):h.position.copy(this.worldPosition),this.axis&&(h.visible=this.axis.search(h.name)!==-1));continue}h.quaternion.copy(b),this.mode==="translate"||this.mode==="scale"?((h.name==="X"||h.name==="XYZX")&&Math.abs(this.alignVector.copy(this.unitX).applyQuaternion(b).dot(this.eye))>.99&&(h.scale.set(1e-10,1e-10,1e-10),h.visible=!1),(h.name==="Y"||h.name==="XYZY")&&Math.abs(this.alignVector.copy(this.unitY).applyQuaternion(b).dot(this.eye))>.99&&(h.scale.set(1e-10,1e-10,1e-10),h.visible=!1),(h.name==="Z"||h.name==="XYZZ")&&Math.abs(this.alignVector.copy(this.unitZ).applyQuaternion(b).dot(this.eye))>.99&&(h.scale.set(1e-10,1e-10,1e-10),h.visible=!1),h.name==="XY"&&Math.abs(this.alignVector.copy(this.unitZ).applyQuaternion(b).dot(this.eye))<.2&&(h.scale.set(1e-10,1e-10,1e-10),h.visible=!1),h.name==="YZ"&&Math.abs(this.alignVector.copy(this.unitX).applyQuaternion(b).dot(this.eye))<.2&&(h.scale.set(1e-10,1e-10,1e-10),h.visible=!1),h.name==="XZ"&&Math.abs(this.alignVector.copy(this.unitY).applyQuaternion(b).dot(this.eye))<.2&&(h.scale.set(1e-10,1e-10,1e-10),h.visible=!1),h.name.search("X")!==-1&&(this.alignVector.copy(this.unitX).applyQuaternion(b).dot(this.eye)<0?h.tag==="fwd"?h.visible=!1:h.scale.x*=-1:h.tag==="bwd"&&(h.visible=!1)),h.name.search("Y")!==-1&&(this.alignVector.copy(this.unitY).applyQuaternion(b).dot(this.eye)<0?h.tag==="fwd"?h.visible=!1:h.scale.y*=-1:h.tag==="bwd"&&(h.visible=!1)),h.name.search("Z")!==-1&&(this.alignVector.copy(this.unitZ).applyQuaternion(b).dot(this.eye)<0?h.tag==="fwd"?h.visible=!1:h.scale.z*=-1:h.tag==="bwd"&&(h.visible=!1))):this.mode==="rotate"&&(this.tempQuaternion2.copy(b),this.alignVector.copy(this.eye).applyQuaternion(this.tempQuaternion.copy(b).invert()),h.name.search("E")!==-1&&h.quaternion.setFromRotationMatrix(this.lookAtMatrix.lookAt(this.eye,this.zeroVector,this.unitY)),h.name==="X"&&(this.tempQuaternion.setFromAxisAngle(this.unitX,Math.atan2(-this.alignVector.y,this.alignVector.z)),this.tempQuaternion.multiplyQuaternions(this.tempQuaternion2,this.tempQuaternion),h.quaternion.copy(this.tempQuaternion)),h.name==="Y"&&(this.tempQuaternion.setFromAxisAngle(this.unitY,Math.atan2(this.alignVector.x,this.alignVector.z)),this.tempQuaternion.multiplyQuaternions(this.tempQuaternion2,this.tempQuaternion),h.quaternion.copy(this.tempQuaternion)),h.name==="Z"&&(this.tempQuaternion.setFromAxisAngle(this.unitZ,Math.atan2(this.alignVector.y,this.alignVector.x)),this.tempQuaternion.multiplyQuaternions(this.tempQuaternion2,this.tempQuaternion),h.quaternion.copy(this.tempQuaternion))),h.visible=h.visible&&(h.name.indexOf("X")===-1||this.showX),h.visible=h.visible&&(h.name.indexOf("Y")===-1||this.showY),h.visible=h.visible&&(h.name.indexOf("Z")===-1||this.showZ),h.visible=h.visible&&(h.name.indexOf("E")===-1||this.showX&&this.showY&&this.showZ),h.material.tempOpacity=h.material.tempOpacity||h.material.opacity,h.material.tempColor=h.material.tempColor||h.material.color.clone(),h.material.color.copy(h.material.tempColor),h.material.opacity=h.material.tempOpacity,this.enabled?this.axis&&(h.name===this.axis?(h.material.opacity=1,h.material.color.lerp(new ye(1,1,1),.5)):this.axis.split("").some(function(H){return h.name===H})?(h.material.opacity=1,h.material.color.lerp(new ye(1,1,1),.5)):(h.material.opacity*=.25,h.material.color.lerp(new ye(1,1,1),.5))):(h.material.opacity*=.5,h.material.color.lerp(new ye(1,1,1),.5))}super.updateMatrixWorld()});const o=new ot({depthTest:!1,depthWrite:!1,transparent:!0,side:at,fog:!1,toneMapped:!1}),a=new bt({depthTest:!1,depthWrite:!1,transparent:!0,linewidth:1,fog:!1,toneMapped:!1}),r=o.clone();r.opacity=.15;const t=o.clone();t.opacity=.33;const n=o.clone();n.color.set(16711680);const c=o.clone();c.color.set(65280);const i=o.clone();i.color.set(255);const l=o.clone();l.opacity=.25;const p=l.clone();p.color.set(16776960);const S=l.clone();S.color.set(65535);const f=l.clone();f.color.set(16711935),o.clone().color.set(16776960);const w=a.clone();w.color.set(16711680);const M=a.clone();M.color.set(65280);const D=a.clone();D.color.set(255);const Z=a.clone();Z.color.set(65535);const B=a.clone();B.color.set(16711935);const G=a.clone();G.color.set(16776960);const _=a.clone();_.color.set(7895160);const R=G.clone();R.opacity=.25;const I=new se(0,.05,.2,12,1,!1),E=new ce(.125,.125,.125),j=new _e;j.setAttribute("position",new we([0,0,0,1,0,0],3));const U=(T,b)=>{const O=new _e,z=[];for(let h=0;h<=64*b;++h)z.push(0,Math.cos(h/32*Math.PI)*T,Math.sin(h/32*Math.PI)*T);return O.setAttribute("position",new we(z,3)),O},ne=()=>{const T=new _e;return T.setAttribute("position",new we([0,0,0,1,1,1],3)),T},ee={X:[[new L(I,n),[1,0,0],[0,0,-Math.PI/2],null,"fwd"],[new L(I,n),[1,0,0],[0,0,Math.PI/2],null,"bwd"],[new W(j,w)]],Y:[[new L(I,c),[0,1,0],null,null,"fwd"],[new L(I,c),[0,1,0],[Math.PI,0,0],null,"bwd"],[new W(j,M),null,[0,0,Math.PI/2]]],Z:[[new L(I,i),[0,0,1],[Math.PI/2,0,0],null,"fwd"],[new L(I,i),[0,0,1],[-Math.PI/2,0,0],null,"bwd"],[new W(j,D),null,[0,-Math.PI/2,0]]],XYZ:[[new L(new he(.1,0),l.clone()),[0,0,0],[0,0,0]]],XY:[[new L(new de(.295,.295),p.clone()),[.15,.15,0]],[new W(j,G),[.18,.3,0],null,[.125,1,1]],[new W(j,G),[.3,.18,0],[0,0,Math.PI/2],[.125,1,1]]],YZ:[[new L(new de(.295,.295),S.clone()),[0,.15,.15],[0,Math.PI/2,0]],[new W(j,Z),[0,.18,.3],[0,0,Math.PI/2],[.125,1,1]],[new W(j,Z),[0,.3,.18],[0,-Math.PI/2,0],[.125,1,1]]],XZ:[[new L(new de(.295,.295),f.clone()),[.15,0,.15],[-Math.PI/2,0,0]],[new W(j,B),[.18,0,.3],null,[.125,1,1]],[new W(j,B),[.3,0,.18],[0,-Math.PI/2,0],[.125,1,1]]]},C={X:[[new L(new se(.2,0,1,4,1,!1),r),[.6,0,0],[0,0,-Math.PI/2]]],Y:[[new L(new se(.2,0,1,4,1,!1),r),[0,.6,0]]],Z:[[new L(new se(.2,0,1,4,1,!1),r),[0,0,.6],[Math.PI/2,0,0]]],XYZ:[[new L(new he(.2,0),r)]],XY:[[new L(new de(.4,.4),r),[.2,.2,0]]],YZ:[[new L(new de(.4,.4),r),[0,.2,.2],[0,Math.PI/2,0]]],XZ:[[new L(new de(.4,.4),r),[.2,0,.2],[-Math.PI/2,0,0]]]},m={START:[[new L(new he(.01,2),t),null,null,null,"helper"]],END:[[new L(new he(.01,2),t),null,null,null,"helper"]],DELTA:[[new W(ne(),t),null,null,null,"helper"]],X:[[new W(j,t.clone()),[-1e3,0,0],null,[1e6,1,1],"helper"]],Y:[[new W(j,t.clone()),[0,-1e3,0],[0,0,Math.PI/2],[1e6,1,1],"helper"]],Z:[[new W(j,t.clone()),[0,0,-1e3],[0,-Math.PI/2,0],[1e6,1,1],"helper"]]},X={X:[[new W(U(1,.5),w)],[new L(new he(.04,0),n),[0,0,.99],null,[1,3,1]]],Y:[[new W(U(1,.5),M),null,[0,0,-Math.PI/2]],[new L(new he(.04,0),c),[0,0,.99],null,[3,1,1]]],Z:[[new W(U(1,.5),D),null,[0,Math.PI/2,0]],[new L(new he(.04,0),i),[.99,0,0],null,[1,3,1]]],E:[[new W(U(1.25,1),R),null,[0,Math.PI/2,0]],[new L(new se(.03,0,.15,4,1,!1),R),[1.17,0,0],[0,0,-Math.PI/2],[1,1,.001]],[new L(new se(.03,0,.15,4,1,!1),R),[-1.17,0,0],[0,0,Math.PI/2],[1,1,.001]],[new L(new se(.03,0,.15,4,1,!1),R),[0,-1.17,0],[Math.PI,0,0],[1,1,.001]],[new L(new se(.03,0,.15,4,1,!1),R),[0,1.17,0],[0,0,0],[1,1,.001]]],XYZE:[[new W(U(1,1),_),null,[0,Math.PI/2,0]]]},A={AXIS:[[new W(j,t.clone()),[-1e3,0,0],null,[1e6,1,1],"helper"]]},Y={X:[[new L(new Me(1,.1,4,24),r),[0,0,0],[0,-Math.PI/2,-Math.PI/2]]],Y:[[new L(new Me(1,.1,4,24),r),[0,0,0],[Math.PI/2,0,0]]],Z:[[new L(new Me(1,.1,4,24),r),[0,0,0],[0,0,-Math.PI/2]]],E:[[new L(new Me(1.25,.1,2,24),r)]],XYZE:[[new L(new Mt(.7,10,8),r)]]},V={X:[[new L(E,n),[.8,0,0],[0,0,-Math.PI/2]],[new W(j,w),null,null,[.8,1,1]]],Y:[[new L(E,c),[0,.8,0]],[new W(j,M),null,[0,0,Math.PI/2],[.8,1,1]]],Z:[[new L(E,i),[0,0,.8],[Math.PI/2,0,0]],[new W(j,D),null,[0,-Math.PI/2,0],[.8,1,1]]],XY:[[new L(E,p),[.85,.85,0],null,[2,2,.2]],[new W(j,G),[.855,.98,0],null,[.125,1,1]],[new W(j,G),[.98,.855,0],[0,0,Math.PI/2],[.125,1,1]]],YZ:[[new L(E,S),[0,.85,.85],null,[.2,2,2]],[new W(j,Z),[0,.855,.98],[0,0,Math.PI/2],[.125,1,1]],[new W(j,Z),[0,.98,.855],[0,-Math.PI/2,0],[.125,1,1]]],XZ:[[new L(E,f),[.85,0,.85],null,[2,.2,2]],[new W(j,B),[.855,0,.98],null,[.125,1,1]],[new W(j,B),[.98,0,.855],[0,-Math.PI/2,0],[.125,1,1]]],XYZX:[[new L(new ce(.125,.125,.125),l.clone()),[1.1,0,0]]],XYZY:[[new L(new ce(.125,.125,.125),l.clone()),[0,1.1,0]]],XYZZ:[[new L(new ce(.125,.125,.125),l.clone()),[0,0,1.1]]]},u={X:[[new L(new se(.2,0,.8,4,1,!1),r),[.5,0,0],[0,0,-Math.PI/2]]],Y:[[new L(new se(.2,0,.8,4,1,!1),r),[0,.5,0]]],Z:[[new L(new se(.2,0,.8,4,1,!1),r),[0,0,.5],[Math.PI/2,0,0]]],XY:[[new L(E,r),[.85,.85,0],null,[3,3,.2]]],YZ:[[new L(E,r),[0,.85,.85],null,[.2,3,3]]],XZ:[[new L(E,r),[.85,0,.85],null,[3,.2,3]]],XYZX:[[new L(new ce(.2,.2,.2),r),[1.1,0,0]]],XYZY:[[new L(new ce(.2,.2,.2),r),[0,1.1,0]]],XYZZ:[[new L(new ce(.2,.2,.2),r),[0,0,1.1]]]},g={X:[[new W(j,t.clone()),[-1e3,0,0],null,[1e6,1,1],"helper"]],Y:[[new W(j,t.clone()),[0,-1e3,0],[0,0,Math.PI/2],[1e6,1,1],"helper"]],Z:[[new W(j,t.clone()),[0,0,-1e3],[0,-Math.PI/2,0],[1e6,1,1],"helper"]]},Q=T=>{const b=new Se;for(let O in T)for(let z=T[O].length;z--;){const h=T[O][z][0].clone(),F=T[O][z][1],H=T[O][z][2],$=T[O][z][3],k=T[O][z][4];h.name=O,h.tag=k,F&&h.position.set(F[0],F[1],F[2]),H&&h.rotation.set(H[0],H[1],H[2]),$&&h.scale.set($[0],$[1],$[2]),h.updateMatrix();const He=h.geometry.clone();He.applyMatrix4(h.matrix),h.geometry=He,h.renderOrder=1/0,h.position.set(0,0,0),h.rotation.set(0,0,0),h.scale.set(1,1,1),b.add(h)}return b};this.gizmo={},this.picker={},this.helper={},this.add(this.gizmo.translate=Q(ee)),this.add(this.gizmo.rotate=Q(X)),this.add(this.gizmo.scale=Q(V)),this.add(this.picker.translate=Q(C)),this.add(this.picker.rotate=Q(Y)),this.add(this.picker.scale=Q(u)),this.add(this.helper.translate=Q(m)),this.add(this.helper.rotate=Q(A)),this.add(this.helper.scale=Q(g)),this.picker.translate.visible=!1,this.picker.rotate.visible=!1,this.picker.scale.visible=!1}}class Zt extends L{constructor(){super(new de(1e5,1e5,2,2),new ot({visible:!1,wireframe:!0,side:at,transparent:!0,opacity:.1,toneMapped:!1})),d(this,"isTransformControlsPlane",!0),d(this,"type","TransformControlsPlane"),d(this,"unitX",new P(1,0,0)),d(this,"unitY",new P(0,1,0)),d(this,"unitZ",new P(0,0,1)),d(this,"tempVector",new P),d(this,"dirVector",new P),d(this,"alignVector",new P),d(this,"tempMatrix",new Xe),d(this,"identityQuaternion",new J),d(this,"cameraQuaternion",new J),d(this,"worldPosition",new P),d(this,"worldQuaternion",new J),d(this,"eye",new P),d(this,"axis",null),d(this,"mode","translate"),d(this,"space","world"),d(this,"updateMatrixWorld",()=>{let o=this.space;switch(this.position.copy(this.worldPosition),this.mode==="scale"&&(o="local"),this.unitX.set(1,0,0).applyQuaternion(o==="local"?this.worldQuaternion:this.identityQuaternion),this.unitY.set(0,1,0).applyQuaternion(o==="local"?this.worldQuaternion:this.identityQuaternion),this.unitZ.set(0,0,1).applyQuaternion(o==="local"?this.worldQuaternion:this.identityQuaternion),this.alignVector.copy(this.unitY),this.mode){case"translate":case"scale":switch(this.axis){case"X":this.alignVector.copy(this.eye).cross(this.unitX),this.dirVector.copy(this.unitX).cross(this.alignVector);break;case"Y":this.alignVector.copy(this.eye).cross(this.unitY),this.dirVector.copy(this.unitY).cross(this.alignVector);break;case"Z":this.alignVector.copy(this.eye).cross(this.unitZ),this.dirVector.copy(this.unitZ).cross(this.alignVector);break;case"XY":this.dirVector.copy(this.unitZ);break;case"YZ":this.dirVector.copy(this.unitX);break;case"XZ":this.alignVector.copy(this.unitZ),this.dirVector.copy(this.unitY);break;case"XYZ":case"E":this.dirVector.set(0,0,0);break}break;case"rotate":default:this.dirVector.set(0,0,0)}this.dirVector.length()===0?this.quaternion.copy(this.cameraQuaternion):(this.tempMatrix.lookAt(this.tempVector.set(0,0,0),this.dirVector,this.alignVector),this.quaternion.setFromRotationMatrix(this.tempMatrix)),super.updateMatrixWorld()})}}const Ke=new Ye,je=new P;class Ze extends jt{constructor(){super(),this.isLineSegmentsGeometry=!0,this.type="LineSegmentsGeometry";const o=[-1,2,0,1,2,0,-1,1,0,1,1,0,-1,0,0,1,0,0,-1,-1,0,1,-1,0],a=[-1,2,1,2,-1,1,1,1,-1,-1,1,-1,-1,-2,1,-2],r=[0,2,1,2,3,1,2,4,3,4,5,3,4,6,5,6,7,5];this.setIndex(r),this.setAttribute("position",new we(o,3)),this.setAttribute("uv",new we(a,2))}applyMatrix4(o){const a=this.attributes.instanceStart,r=this.attributes.instanceEnd;return a!==void 0&&(a.applyMatrix4(o),r.applyMatrix4(o),a.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}setPositions(o){let a;o instanceof Float32Array?a=o:Array.isArray(o)&&(a=new Float32Array(o));const r=new Te(a,6,1);return this.setAttribute("instanceStart",new me(r,3,0)),this.setAttribute("instanceEnd",new me(r,3,3)),this.computeBoundingBox(),this.computeBoundingSphere(),this}setColors(o,a=3){let r;o instanceof Float32Array?r=o:Array.isArray(o)&&(r=new Float32Array(o));const t=new Te(r,a*2,1);return this.setAttribute("instanceColorStart",new me(t,a,0)),this.setAttribute("instanceColorEnd",new me(t,a,a)),this}fromWireframeGeometry(o){return this.setPositions(o.attributes.position.array),this}fromEdgesGeometry(o){return this.setPositions(o.attributes.position.array),this}fromMesh(o){return this.fromWireframeGeometry(new Et(o.geometry)),this}fromLineSegments(o){const a=o.geometry;return this.setPositions(a.attributes.position.array),this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new Ye);const o=this.attributes.instanceStart,a=this.attributes.instanceEnd;o!==void 0&&a!==void 0&&(this.boundingBox.setFromBufferAttribute(o),Ke.setFromBufferAttribute(a),this.boundingBox.union(Ke))}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new rt),this.boundingBox===null&&this.computeBoundingBox();const o=this.attributes.instanceStart,a=this.attributes.instanceEnd;if(o!==void 0&&a!==void 0){const r=this.boundingSphere.center;this.boundingBox.getCenter(r);let t=0;for(let n=0,c=o.count;n<c;n++)je.fromBufferAttribute(o,n),t=Math.max(t,r.distanceToSquared(je)),je.fromBufferAttribute(a,n),t=Math.max(t,r.distanceToSquared(je));this.boundingSphere.radius=Math.sqrt(t),isNaN(this.boundingSphere.radius)&&console.error("THREE.LineSegmentsGeometry.computeBoundingSphere(): Computed radius is NaN. The instanced position data is likely to have NaN values.",this)}}toJSON(){}applyMatrix(o){return console.warn("THREE.LineSegmentsGeometry: applyMatrix() has been renamed to applyMatrix4()."),this.applyMatrix4(o)}}class ft extends Ze{constructor(){super(),this.isLineGeometry=!0,this.type="LineGeometry"}setPositions(o){const a=o.length-3,r=new Float32Array(2*a);for(let t=0;t<a;t+=3)r[2*t]=o[t],r[2*t+1]=o[t+1],r[2*t+2]=o[t+2],r[2*t+3]=o[t+3],r[2*t+4]=o[t+4],r[2*t+5]=o[t+5];return super.setPositions(r),this}setColors(o,a=3){const r=o.length-a,t=new Float32Array(2*r);if(a===3)for(let n=0;n<r;n+=a)t[2*n]=o[n],t[2*n+1]=o[n+1],t[2*n+2]=o[n+2],t[2*n+3]=o[n+3],t[2*n+4]=o[n+4],t[2*n+5]=o[n+5];else for(let n=0;n<r;n+=a)t[2*n]=o[n],t[2*n+1]=o[n+1],t[2*n+2]=o[n+2],t[2*n+3]=o[n+3],t[2*n+4]=o[n+4],t[2*n+5]=o[n+5],t[2*n+6]=o[n+6],t[2*n+7]=o[n+7];return super.setColors(t,a),this}fromLine(o){const a=o.geometry;return this.setPositions(a.attributes.position.array),this}}class We extends nt{constructor(o){super({type:"LineMaterial",uniforms:Ce.clone(Ce.merge([$e.common,$e.fog,{worldUnits:{value:1},linewidth:{value:1},resolution:{value:new lt(1,1)},dashOffset:{value:0},dashScale:{value:1},dashSize:{value:1},gapSize:{value:1}}])),vertexShader:`
				#include <common>
				#include <fog_pars_vertex>
				#include <logdepthbuf_pars_vertex>
				#include <clipping_planes_pars_vertex>

				uniform float linewidth;
				uniform vec2 resolution;

				attribute vec3 instanceStart;
				attribute vec3 instanceEnd;

				#ifdef USE_COLOR
					#ifdef USE_LINE_COLOR_ALPHA
						varying vec4 vLineColor;
						attribute vec4 instanceColorStart;
						attribute vec4 instanceColorEnd;
					#else
						varying vec3 vLineColor;
						attribute vec3 instanceColorStart;
						attribute vec3 instanceColorEnd;
					#endif
				#endif

				#ifdef WORLD_UNITS

					varying vec4 worldPos;
					varying vec3 worldStart;
					varying vec3 worldEnd;

					#ifdef USE_DASH

						varying vec2 vUv;

					#endif

				#else

					varying vec2 vUv;

				#endif

				#ifdef USE_DASH

					uniform float dashScale;
					attribute float instanceDistanceStart;
					attribute float instanceDistanceEnd;
					varying float vLineDistance;

				#endif

				void trimSegment( const in vec4 start, inout vec4 end ) {

					// trim end segment so it terminates between the camera plane and the near plane

					// conservative estimate of the near plane
					float a = projectionMatrix[ 2 ][ 2 ]; // 3nd entry in 3th column
					float b = projectionMatrix[ 3 ][ 2 ]; // 3nd entry in 4th column
					float nearEstimate = - 0.5 * b / a;

					float alpha = ( nearEstimate - start.z ) / ( end.z - start.z );

					end.xyz = mix( start.xyz, end.xyz, alpha );

				}

				void main() {

					#ifdef USE_COLOR

						vLineColor = ( position.y < 0.5 ) ? instanceColorStart : instanceColorEnd;

					#endif

					#ifdef USE_DASH

						vLineDistance = ( position.y < 0.5 ) ? dashScale * instanceDistanceStart : dashScale * instanceDistanceEnd;
						vUv = uv;

					#endif

					float aspect = resolution.x / resolution.y;

					// camera space
					vec4 start = modelViewMatrix * vec4( instanceStart, 1.0 );
					vec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );

					#ifdef WORLD_UNITS

						worldStart = start.xyz;
						worldEnd = end.xyz;

					#else

						vUv = uv;

					#endif

					// special case for perspective projection, and segments that terminate either in, or behind, the camera plane
					// clearly the gpu firmware has a way of addressing this issue when projecting into ndc space
					// but we need to perform ndc-space calculations in the shader, so we must address this issue directly
					// perhaps there is a more elegant solution -- WestLangley

					bool perspective = ( projectionMatrix[ 2 ][ 3 ] == - 1.0 ); // 4th entry in the 3rd column

					if ( perspective ) {

						if ( start.z < 0.0 && end.z >= 0.0 ) {

							trimSegment( start, end );

						} else if ( end.z < 0.0 && start.z >= 0.0 ) {

							trimSegment( end, start );

						}

					}

					// clip space
					vec4 clipStart = projectionMatrix * start;
					vec4 clipEnd = projectionMatrix * end;

					// ndc space
					vec3 ndcStart = clipStart.xyz / clipStart.w;
					vec3 ndcEnd = clipEnd.xyz / clipEnd.w;

					// direction
					vec2 dir = ndcEnd.xy - ndcStart.xy;

					// account for clip-space aspect ratio
					dir.x *= aspect;
					dir = normalize( dir );

					#ifdef WORLD_UNITS

						// get the offset direction as perpendicular to the view vector
						vec3 worldDir = normalize( end.xyz - start.xyz );
						vec3 offset;
						if ( position.y < 0.5 ) {

							offset = normalize( cross( start.xyz, worldDir ) );

						} else {

							offset = normalize( cross( end.xyz, worldDir ) );

						}

						// sign flip
						if ( position.x < 0.0 ) offset *= - 1.0;

						float forwardOffset = dot( worldDir, vec3( 0.0, 0.0, 1.0 ) );

						// don't extend the line if we're rendering dashes because we
						// won't be rendering the endcaps
						#ifndef USE_DASH

							// extend the line bounds to encompass  endcaps
							start.xyz += - worldDir * linewidth * 0.5;
							end.xyz += worldDir * linewidth * 0.5;

							// shift the position of the quad so it hugs the forward edge of the line
							offset.xy -= dir * forwardOffset;
							offset.z += 0.5;

						#endif

						// endcaps
						if ( position.y > 1.0 || position.y < 0.0 ) {

							offset.xy += dir * 2.0 * forwardOffset;

						}

						// adjust for linewidth
						offset *= linewidth * 0.5;

						// set the world position
						worldPos = ( position.y < 0.5 ) ? start : end;
						worldPos.xyz += offset;

						// project the worldpos
						vec4 clip = projectionMatrix * worldPos;

						// shift the depth of the projected points so the line
						// segments overlap neatly
						vec3 clipPose = ( position.y < 0.5 ) ? ndcStart : ndcEnd;
						clip.z = clipPose.z * clip.w;

					#else

						vec2 offset = vec2( dir.y, - dir.x );
						// undo aspect ratio adjustment
						dir.x /= aspect;
						offset.x /= aspect;

						// sign flip
						if ( position.x < 0.0 ) offset *= - 1.0;

						// endcaps
						if ( position.y < 0.0 ) {

							offset += - dir;

						} else if ( position.y > 1.0 ) {

							offset += dir;

						}

						// adjust for linewidth
						offset *= linewidth;

						// adjust for clip-space to screen-space conversion // maybe resolution should be based on viewport ...
						offset /= resolution.y;

						// select end
						vec4 clip = ( position.y < 0.5 ) ? clipStart : clipEnd;

						// back to clip space
						offset *= clip.w;

						clip.xy += offset;

					#endif

					gl_Position = clip;

					vec4 mvPosition = ( position.y < 0.5 ) ? start : end; // this is an approximation

					#include <logdepthbuf_vertex>
					#include <clipping_planes_vertex>
					#include <fog_vertex>

				}
			`,fragmentShader:`
				uniform vec3 diffuse;
				uniform float opacity;
				uniform float linewidth;

				#ifdef USE_DASH

					uniform float dashOffset;
					uniform float dashSize;
					uniform float gapSize;

				#endif

				varying float vLineDistance;

				#ifdef WORLD_UNITS

					varying vec4 worldPos;
					varying vec3 worldStart;
					varying vec3 worldEnd;

					#ifdef USE_DASH

						varying vec2 vUv;

					#endif

				#else

					varying vec2 vUv;

				#endif

				#include <common>
				#include <fog_pars_fragment>
				#include <logdepthbuf_pars_fragment>
				#include <clipping_planes_pars_fragment>

				#ifdef USE_COLOR
					#ifdef USE_LINE_COLOR_ALPHA
						varying vec4 vLineColor;
					#else
						varying vec3 vLineColor;
					#endif
				#endif

				vec2 closestLineToLine(vec3 p1, vec3 p2, vec3 p3, vec3 p4) {

					float mua;
					float mub;

					vec3 p13 = p1 - p3;
					vec3 p43 = p4 - p3;

					vec3 p21 = p2 - p1;

					float d1343 = dot( p13, p43 );
					float d4321 = dot( p43, p21 );
					float d1321 = dot( p13, p21 );
					float d4343 = dot( p43, p43 );
					float d2121 = dot( p21, p21 );

					float denom = d2121 * d4343 - d4321 * d4321;

					float numer = d1343 * d4321 - d1321 * d4343;

					mua = numer / denom;
					mua = clamp( mua, 0.0, 1.0 );
					mub = ( d1343 + d4321 * ( mua ) ) / d4343;
					mub = clamp( mub, 0.0, 1.0 );

					return vec2( mua, mub );

				}

				void main() {

					#include <clipping_planes_fragment>

					#ifdef USE_DASH

						if ( vUv.y < - 1.0 || vUv.y > 1.0 ) discard; // discard endcaps

						if ( mod( vLineDistance + dashOffset, dashSize + gapSize ) > dashSize ) discard; // todo - FIX

					#endif

					float alpha = opacity;

					#ifdef WORLD_UNITS

						// Find the closest points on the view ray and the line segment
						vec3 rayEnd = normalize( worldPos.xyz ) * 1e5;
						vec3 lineDir = worldEnd - worldStart;
						vec2 params = closestLineToLine( worldStart, worldEnd, vec3( 0.0, 0.0, 0.0 ), rayEnd );

						vec3 p1 = worldStart + lineDir * params.x;
						vec3 p2 = rayEnd * params.y;
						vec3 delta = p1 - p2;
						float len = length( delta );
						float norm = len / linewidth;

						#ifndef USE_DASH

							#ifdef USE_ALPHA_TO_COVERAGE

								float dnorm = fwidth( norm );
								alpha = 1.0 - smoothstep( 0.5 - dnorm, 0.5 + dnorm, norm );

							#else

								if ( norm > 0.5 ) {

									discard;

								}

							#endif

						#endif

					#else

						#ifdef USE_ALPHA_TO_COVERAGE

							// artifacts appear on some hardware if a derivative is taken within a conditional
							float a = vUv.x;
							float b = ( vUv.y > 0.0 ) ? vUv.y - 1.0 : vUv.y + 1.0;
							float len2 = a * a + b * b;
							float dlen = fwidth( len2 );

							if ( abs( vUv.y ) > 1.0 ) {

								alpha = 1.0 - smoothstep( 1.0 - dlen, 1.0 + dlen, len2 );

							}

						#else

							if ( abs( vUv.y ) > 1.0 ) {

								float a = vUv.x;
								float b = ( vUv.y > 0.0 ) ? vUv.y - 1.0 : vUv.y + 1.0;
								float len2 = a * a + b * b;

								if ( len2 > 1.0 ) discard;

							}

						#endif

					#endif

					vec4 diffuseColor = vec4( diffuse, alpha );
					#ifdef USE_COLOR
						#ifdef USE_LINE_COLOR_ALPHA
							diffuseColor *= vLineColor;
						#else
							diffuseColor.rgb *= vLineColor;
						#endif
					#endif

					#include <logdepthbuf_fragment>

					gl_FragColor = diffuseColor;

					#include <tonemapping_fragment>
					#include <${De>=154?"colorspace_fragment":"encodings_fragment"}>
					#include <fog_fragment>
					#include <premultiplied_alpha_fragment>

				}
			`,clipping:!0}),this.isLineMaterial=!0,this.onBeforeCompile=function(){this.transparent?this.defines.USE_LINE_COLOR_ALPHA="1":delete this.defines.USE_LINE_COLOR_ALPHA},Object.defineProperties(this,{color:{enumerable:!0,get:function(){return this.uniforms.diffuse.value},set:function(a){this.uniforms.diffuse.value=a}},worldUnits:{enumerable:!0,get:function(){return"WORLD_UNITS"in this.defines},set:function(a){a===!0?this.defines.WORLD_UNITS="":delete this.defines.WORLD_UNITS}},linewidth:{enumerable:!0,get:function(){return this.uniforms.linewidth.value},set:function(a){this.uniforms.linewidth.value=a}},dashed:{enumerable:!0,get:function(){return"USE_DASH"in this.defines},set(a){!!a!="USE_DASH"in this.defines&&(this.needsUpdate=!0),a===!0?this.defines.USE_DASH="":delete this.defines.USE_DASH}},dashScale:{enumerable:!0,get:function(){return this.uniforms.dashScale.value},set:function(a){this.uniforms.dashScale.value=a}},dashSize:{enumerable:!0,get:function(){return this.uniforms.dashSize.value},set:function(a){this.uniforms.dashSize.value=a}},dashOffset:{enumerable:!0,get:function(){return this.uniforms.dashOffset.value},set:function(a){this.uniforms.dashOffset.value=a}},gapSize:{enumerable:!0,get:function(){return this.uniforms.gapSize.value},set:function(a){this.uniforms.gapSize.value=a}},opacity:{enumerable:!0,get:function(){return this.uniforms.opacity.value},set:function(a){this.uniforms.opacity.value=a}},resolution:{enumerable:!0,get:function(){return this.uniforms.resolution.value},set:function(a){this.uniforms.resolution.value.copy(a)}},alphaToCoverage:{enumerable:!0,get:function(){return"USE_ALPHA_TO_COVERAGE"in this.defines},set:function(a){!!a!="USE_ALPHA_TO_COVERAGE"in this.defines&&(this.needsUpdate=!0),a===!0?(this.defines.USE_ALPHA_TO_COVERAGE="",this.extensions.derivatives=!0):(delete this.defines.USE_ALPHA_TO_COVERAGE,this.extensions.derivatives=!1)}}}),this.setValues(o)}}const Le=new ge,Je=new P,et=new P,q=new ge,N=new ge,oe=new ge,Ae=new P,ze=new Xe,K=new Pt,tt=new P,Ee=new Ye,Pe=new rt,ae=new ge;let re,ue;function st(s,o,a){return ae.set(0,0,-o,1).applyMatrix4(s.projectionMatrix),ae.multiplyScalar(1/ae.w),ae.x=ue/a.width,ae.y=ue/a.height,ae.applyMatrix4(s.projectionMatrixInverse),ae.multiplyScalar(1/ae.w),Math.abs(Math.max(ae.x,ae.y))}function Wt(s,o){const a=s.matrixWorld,r=s.geometry,t=r.attributes.instanceStart,n=r.attributes.instanceEnd,c=Math.min(r.instanceCount,t.count);for(let i=0,l=c;i<l;i++){K.start.fromBufferAttribute(t,i),K.end.fromBufferAttribute(n,i),K.applyMatrix4(a);const p=new P,S=new P;re.distanceSqToSegment(K.start,K.end,S,p),S.distanceTo(p)<ue*.5&&o.push({point:S,pointOnLine:p,distance:re.origin.distanceTo(S),object:s,face:null,faceIndex:i,uv:null,[ut]:null})}}function Ft(s,o,a){const r=o.projectionMatrix,n=s.material.resolution,c=s.matrixWorld,i=s.geometry,l=i.attributes.instanceStart,p=i.attributes.instanceEnd,S=Math.min(i.instanceCount,l.count),f=-o.near;re.at(1,oe),oe.w=1,oe.applyMatrix4(o.matrixWorldInverse),oe.applyMatrix4(r),oe.multiplyScalar(1/oe.w),oe.x*=n.x/2,oe.y*=n.y/2,oe.z=0,Ae.copy(oe),ze.multiplyMatrices(o.matrixWorldInverse,c);for(let y=0,w=S;y<w;y++){if(q.fromBufferAttribute(l,y),N.fromBufferAttribute(p,y),q.w=1,N.w=1,q.applyMatrix4(ze),N.applyMatrix4(ze),q.z>f&&N.z>f)continue;if(q.z>f){const _=q.z-N.z,R=(q.z-f)/_;q.lerp(N,R)}else if(N.z>f){const _=N.z-q.z,R=(N.z-f)/_;N.lerp(q,R)}q.applyMatrix4(r),N.applyMatrix4(r),q.multiplyScalar(1/q.w),N.multiplyScalar(1/N.w),q.x*=n.x/2,q.y*=n.y/2,N.x*=n.x/2,N.y*=n.y/2,K.start.copy(q),K.start.z=0,K.end.copy(N),K.end.z=0;const D=K.closestPointToPointParameter(Ae,!0);K.at(D,tt);const Z=It.lerp(q.z,N.z,D),B=Z>=-1&&Z<=1,G=Ae.distanceTo(tt)<ue*.5;if(B&&G){K.start.fromBufferAttribute(l,y),K.end.fromBufferAttribute(p,y),K.start.applyMatrix4(c),K.end.applyMatrix4(c);const _=new P,R=new P;re.distanceSqToSegment(K.start,K.end,R,_),a.push({point:R,pointOnLine:_,distance:re.origin.distanceTo(R),object:s,face:null,faceIndex:y,uv:null,[ut]:null})}}}class mt extends L{constructor(o=new Ze,a=new We({color:Math.random()*16777215})){super(o,a),this.isLineSegments2=!0,this.type="LineSegments2"}computeLineDistances(){const o=this.geometry,a=o.attributes.instanceStart,r=o.attributes.instanceEnd,t=new Float32Array(2*a.count);for(let c=0,i=0,l=a.count;c<l;c++,i+=2)Je.fromBufferAttribute(a,c),et.fromBufferAttribute(r,c),t[i]=i===0?0:t[i-1],t[i+1]=t[i]+Je.distanceTo(et);const n=new Te(t,2,1);return o.setAttribute("instanceDistanceStart",new me(n,1,0)),o.setAttribute("instanceDistanceEnd",new me(n,1,1)),this}raycast(o,a){const r=this.material.worldUnits,t=o.camera;t===null&&!r&&console.error('LineSegments2: "Raycaster.camera" needs to be set in order to raycast against LineSegments2 while worldUnits is set to false.');const n=o.params.Line2!==void 0&&o.params.Line2.threshold||0;re=o.ray;const c=this.matrixWorld,i=this.geometry,l=this.material;ue=l.linewidth+n,i.boundingSphere===null&&i.computeBoundingSphere(),Pe.copy(i.boundingSphere).applyMatrix4(c);let p;if(r)p=ue*.5;else{const f=Math.max(t.near,Pe.distanceToPoint(re.origin));p=st(t,f,l.resolution)}if(Pe.radius+=p,re.intersectsSphere(Pe)===!1)return;i.boundingBox===null&&i.computeBoundingBox(),Ee.copy(i.boundingBox).applyMatrix4(c);let S;if(r)S=ue*.5;else{const f=Math.max(t.near,Ee.distanceToPoint(re.origin));S=st(t,f,l.resolution)}Ee.expandByScalar(S),re.intersectsBox(Ee)!==!1&&(r?Wt(this,a):Ft(this,t,a))}onBeforeRender(o){const a=this.material.uniforms;a&&a.resolution&&(o.getViewport(Le),this.material.uniforms.resolution.value.set(Le.z,Le.w))}}class kt extends mt{constructor(o=new ft,a=new We({color:Math.random()*16777215})){super(o,a),this.isLine2=!0,this.type="Line2"}}const Ht=v.forwardRef(function({points:o,color:a=16777215,vertexColors:r,linewidth:t,lineWidth:n,segments:c,dashed:i,...l},p){var S,f;const y=le(B=>B.size),w=v.useMemo(()=>c?new mt:new kt,[c]),[M]=v.useState(()=>new We),D=(r==null||(S=r[0])==null?void 0:S.length)===4?4:3,Z=v.useMemo(()=>{const B=c?new Ze:new ft,G=o.map(_=>{const R=Array.isArray(_);return _ instanceof P||_ instanceof ge?[_.x,_.y,_.z]:_ instanceof lt?[_.x,_.y,0]:R&&_.length===3?[_[0],_[1],_[2]]:R&&_.length===2?[_[0],_[1],0]:_});if(B.setPositions(G.flat()),r){a=16777215;const _=r.map(R=>R instanceof ye?R.toArray():R);B.setColors(_.flat(),D)}return B},[o,c,r,D]);return v.useLayoutEffect(()=>{w.computeLineDistances()},[o,w]),v.useLayoutEffect(()=>{i?M.defines.USE_DASH="":delete M.defines.USE_DASH,M.needsUpdate=!0},[i,M]),v.useEffect(()=>()=>{Z.dispose(),M.dispose()},[Z]),v.createElement("primitive",be({object:w,ref:p},l),v.createElement("primitive",{object:Z,attach:"geometry"}),v.createElement("primitive",be({object:M,attach:"material",color:a,vertexColors:!!r,resolution:[y.width,y.height],linewidth:(f=t??n)!==null&&f!==void 0?f:1,dashed:i,transparent:D===4},l)))}),pe=v.forwardRef(({threshold:s=15,geometry:o,...a},r)=>{const t=v.useRef(null);v.useImperativeHandle(r,()=>t.current,[]);const n=v.useMemo(()=>[0,0,0,1,0,0],[]),c=v.useRef(null),i=v.useRef(null);return v.useLayoutEffect(()=>{const l=t.current.parent,p=o??(l==null?void 0:l.geometry);if(!p||c.current===p&&i.current===s)return;c.current=p,i.current=s;const f=new _t(p,s).attributes.position.array;t.current.geometry.setPositions(f),t.current.geometry.attributes.instanceStart.needsUpdate=!0,t.current.geometry.attributes.instanceEnd.needsUpdate=!0,t.current.computeLineDistances()}),v.createElement(Ht,be({segments:!0,points:n,ref:t,raycast:()=>null},a))}),Ge=v.forwardRef(({children:s,domElement:o,onChange:a,onMouseDown:r,onMouseUp:t,onObjectChange:n,object:c,makeDefault:i,camera:l,enabled:p,axis:S,mode:f,translationSnap:y,rotationSnap:w,scaleSnap:M,space:D,size:Z,showX:B,showY:G,showZ:_,...R},I)=>{const E=le(b=>b.controls),j=le(b=>b.gl),U=le(b=>b.events),ne=le(b=>b.camera),ee=le(b=>b.invalidate),C=le(b=>b.get),m=le(b=>b.set),X=l||ne,A=o||U.connected||j.domElement,Y=v.useMemo(()=>new Ut(X,A),[X,A]),V=v.useRef(null);v.useLayoutEffect(()=>(c?Y.attach(c instanceof Se?c:c.current):V.current instanceof Se&&Y.attach(V.current),()=>void Y.detach()),[c,s,Y]),v.useEffect(()=>{if(E){const b=O=>E.enabled=!O.value;return Y.addEventListener("dragging-changed",b),()=>Y.removeEventListener("dragging-changed",b)}},[Y,E]);const u=v.useRef(void 0),g=v.useRef(void 0),Q=v.useRef(void 0),T=v.useRef(void 0);return v.useLayoutEffect(()=>void(u.current=a),[a]),v.useLayoutEffect(()=>void(g.current=r),[r]),v.useLayoutEffect(()=>void(Q.current=t),[t]),v.useLayoutEffect(()=>void(T.current=n),[n]),v.useEffect(()=>{const b=F=>{ee(),u.current==null||u.current(F)},O=F=>g.current==null?void 0:g.current(F),z=F=>Q.current==null?void 0:Q.current(F),h=F=>T.current==null?void 0:T.current(F);return Y.addEventListener("change",b),Y.addEventListener("mouseDown",O),Y.addEventListener("mouseUp",z),Y.addEventListener("objectChange",h),()=>{Y.removeEventListener("change",b),Y.removeEventListener("mouseDown",O),Y.removeEventListener("mouseUp",z),Y.removeEventListener("objectChange",h)}},[ee,Y]),v.useEffect(()=>{if(i){const b=C().controls;return m({controls:Y}),()=>m({controls:b})}},[i,Y]),v.createElement(v.Fragment,null,v.createElement("primitive",{ref:I,object:Y,enabled:p,axis:S,mode:f,translationSnap:y,rotationSnap:w,scaleSnap:M,space:D,size:Z,showX:B,showY:G,showZ:_}),v.createElement("group",be({ref:V},R),s))});function $t(s,o,a=new P){const r=Math.PI*(s-.5),t=2*Math.PI*(o-.5);return a.x=Math.cos(t),a.y=Math.sin(r),a.z=Math.sin(t),a}const qt=v.forwardRef(({inclination:s=.6,azimuth:o=.1,distance:a=1e3,mieCoefficient:r=.005,mieDirectionalG:t=.8,rayleigh:n=.5,turbidity:c=10,sunPosition:i=$t(s,o),...l},p)=>{const S=v.useMemo(()=>new P().setScalar(a),[a]),[f]=v.useState(()=>new Yt);return v.createElement("primitive",be({object:f,ref:p,"material-uniforms-mieCoefficient-value":r,"material-uniforms-mieDirectionalG-value":t,"material-uniforms-rayleigh-value":n,"material-uniforms-sunPosition-value":i,"material-uniforms-turbidity-value":c,scale:S},l))}),x=.12,te=10*x,fe=.06,rs={render:"#e9e4d8",paint:"#f3efe6",brick:"#b0715a",stone:"#c8c1b2",wood:"#a9805a",glass:"#bcd6e2",tile:"#dad8d0",marble:"#e5e1d8",concrete:"#aeb1b3",carpet:"#8a8790",terrazzo:"#d4d0c7",metal:"#87929a"},it={render:"#d9d4c9",paint:"#e4ded2",brick:"#b98d6f",stone:"#cfc8b8",wood:"#c9a97f",glass:"#d7e2e8",tile:"#ddd9cf",marble:"#e9e4da",concrete:"#bebfbd",carpet:"#85818b",terrazzo:"#d7d2c8",metal:"#b6bdc3"},xe=new Set(["garden","pool","circulation"]);function ls(s){const o=v.useRef(null),a=v.useRef(new Map),r=v.useRef(new Map),t=v.useRef(new Map),[n,c]=v.useState(null),[i,l]=v.useState(null),[p,S]=v.useState(null),f=v.useRef(null),{project:y,mode:w,selectedId:M,onSelectRoom:D,transformMode:Z="translate"}=s,B=s.roofVisible??!0,G=s.topDown??!1;v.useEffect(()=>{l(M?a.current.get(M)??null:null)},[M]);const _=v.useMemo(()=>y.floors.flatMap(m=>m.rooms),[y.floors]),R=v.useMemo(()=>{var X;const m=_.flatMap(A=>[{x:A.rect.x,y:A.rect.y},{x:A.rect.x+A.rect.w,y:A.rect.y+A.rect.h}]);for(const A of y.buildings??[])A.role!=="primary"&&m.push(...((X=A.footprint)==null?void 0:X.vertices)??[]);for(const A of s.ornaments??[]){const Y=(A.width??3)*A.scale,V=(A.length??3)*A.scale,u=Math.abs(Math.cos(A.rotation))*Y/2+Math.abs(Math.sin(A.rotation))*V/2,g=Math.abs(Math.sin(A.rotation))*Y/2+Math.abs(Math.cos(A.rotation))*V/2;m.push({x:A.x-u,y:A.y-g},{x:A.x+u,y:A.y+g})}return m.length?{minX:Math.min(0,...m.map(A=>A.x)),minY:Math.min(0,...m.map(A=>A.y)),maxX:Math.max(y.plot.width,...m.map(A=>A.x)),maxY:Math.max(y.plot.length,...m.map(A=>A.y))}:{minX:0,minY:0,maxX:y.plot.width,maxY:y.plot.length}},[_,y.buildings,y.plot.width,y.plot.length,s.ornaments]),I=v.useMemo(()=>[((R.minX+R.maxX)/2-y.plot.width/2)*x,.6,((R.minY+R.maxY)/2-y.plot.length/2)*x],[R,y.plot.width,y.plot.length]),E=Math.max(y.plot.width,R.maxX-R.minX),j=Math.max(y.plot.length,R.maxY-R.minY),U=_.find(m=>m.id===M)??null;v.useEffect(()=>{S(s.selectedItemId?r.current.get(s.selectedItemId)??null:null)},[s.selectedItemId,s.placed,w]),v.useEffect(()=>{c(s.selectedSiteId?t.current.get(s.selectedSiteId)??null:null)},[s.selectedSiteId,s.ornaments]);const ne=()=>{var X;const m=n;!m||!s.selectedSiteId||(X=s.onUpdateSiteLive)==null||X.call(s,s.selectedSiteId,m.position.x/x+y.plot.width/2,m.position.z/x+y.plot.length/2,Math.max(.35,Math.min(4,m.scale.x)))},ee=()=>{var X;const m=p;!m||!U||!s.selectedItemId||(X=s.onUpdatePlacedItem)==null||X.call(s,U.id,s.selectedItemId,{x:Math.max(-.45,Math.min(.45,m.position.x/Math.max(U.width*x,.1))),z:Math.max(-.45,Math.min(.45,m.position.z/Math.max(U.length*x,.1)))})},C=()=>{var Y,V;const m=i;if(!m||!U)return;const{width:X,length:A}=y.plot;if(Z==="translate"){const u=m.position.x/x+X/2-U.rect.w/2,g=m.position.z/x+A/2-U.rect.h/2;(Y=s.onMoveLive)==null||Y.call(s,U.id,Math.round(u*10)/10,Math.round(g*10)/10)}else{const u=f.current??{w:U.rect.w,h:U.rect.h},g=Math.max(4,Math.round(u.w*m.scale.x*10)/10),Q=Math.max(4,Math.round(u.h*m.scale.z*10)/10);m.scale.set(1,1,1),(V=s.onResizeLive)==null||V.call(s,U.id,g,Q)}};return e.jsxs(Lt,{shadows:!0,dpr:[1,1.75],camera:w==="interior"?{position:[0,.5,.01],fov:70}:{position:[I[0]+5.4,4.2,I[2]+6.4],fov:42},onPointerMissed:()=>{var m,X;D==null||D(null),(m=s.onSelectSite)==null||m.call(s,null),(X=s.onSelectItem)==null||X.call(s,null)},children:[e.jsx(Nt,{mode:w,topDown:G,target:I,plotWidth:E,plotLength:j,orbitRef:o}),w==="interior"?e.jsx(ns,{rooms:_,selected:U,floorFinish:y.preferences.interiorFinish,wallThicknesses:{exterior:y.preferences.exteriorWallThickness??(y.plot.units==="ft"?.75:.23),interior:y.preferences.interiorWallThickness??(y.plot.units==="ft"?.375:.12)},placed:s.placed??{},itemRefs:r,selectedItemId:s.selectedItemId??null,onSelectItem:s.onSelectItem,pendingItem:s.pendingItem??null,pendingAssetId:s.pendingAssetId??null,onPlaceInterior:s.onPlaceInterior}):e.jsx(Kt,{project:y,selectedId:M??null,onSelectRoom:D,meshRefs:a,itemRefs:r,siteRefs:t,selectedSiteId:s.selectedSiteId??null,onSelectSite:s.onSelectSite,ornaments:s.ornaments??[],placed:s.placed??{},selectedItemId:s.selectedItemId??null,onSelectItem:s.onSelectItem,roofVisible:B}),w==="exterior"&&i&&D?e.jsx(Ge,{object:i,mode:Z,showY:!1,size:.7,onMouseDown:()=>{var m;o.current&&(o.current.enabled=!1),f.current=U?{w:U.rect.w,h:U.rect.h}:null,(m=s.onEditBegin)==null||m.call(s)},onMouseUp:()=>{var m;o.current&&(o.current.enabled=!0),f.current=null,(m=s.onEditEnd)==null||m.call(s)},onObjectChange:C}):null,w==="exterior"&&n&&s.selectedSiteId?e.jsx(Ge,{object:n,mode:Z,showY:!1,size:.65,onMouseDown:()=>{var m;o.current&&(o.current.enabled=!1),(m=s.onEditBegin)==null||m.call(s)},onMouseUp:()=>{var m;o.current&&(o.current.enabled=!0),(m=s.onEditEnd)==null||m.call(s)},onObjectChange:ne}):null,(w==="interior"||w==="exterior"&&G)&&p&&U?e.jsx(Ge,{object:p,mode:"translate",showY:!1,size:.55,onMouseDown:()=>{var m;o.current&&(o.current.enabled=!1),(m=s.onEditBegin)==null||m.call(s)},onMouseUp:()=>{var m;o.current&&(o.current.enabled=!0),(m=s.onEditEnd)==null||m.call(s)},onObjectChange:ee}):null,e.jsx(At,{ref:o,enableDamping:!0,dampingFactor:.08,minDistance:w==="interior"?.01:2.5,maxDistance:w==="interior"?6:Math.max(16,Math.max(y.plot.width,y.plot.length)*x*2),maxPolarAngle:w==="interior"?Math.PI:Math.PI/2.05,target:w==="interior"?[0,.5,0]:I})]})}function Nt({mode:s,topDown:o,target:a,plotWidth:r,plotLength:t,orbitRef:n}){const{camera:c}=le(),i=v.useRef("");return v.useEffect(()=>{const l=`${s}:${s==="exterior"&&o?"top":"normal"}:${r}:${t}`;if(i.current!==l){if(i.current=l,s==="interior")c.up.set(0,1,0),c.position.set(0,.5,.01),c.lookAt(0,.5,0);else if(o){const p=Math.max(8,Math.min(48,Math.max(r,t)*x*1.35));c.up.set(0,0,-1),c.position.set(a[0],p,a[2]+.01),c.lookAt(a[0],0,a[2])}else c.up.set(0,1,0),c.position.set(a[0]+5.4,4.2,a[2]+6.4),c.lookAt(a[0],.6,a[2]);c.updateProjectionMatrix(),n.current&&(n.current.target.set(...s==="interior"?[0,.5,0]:a),n.current.update())}},[c,s,o,a,r,t,n]),null}function Kt({project:s,selectedId:o,onSelectRoom:a,meshRefs:r,itemRefs:t,siteRefs:n,selectedSiteId:c,onSelectSite:i,ornaments:l,placed:p,selectedItemId:S,onSelectItem:f,roofVisible:y}){var ne,ee,C,m,X,A,Y,V;const{width:w,length:M}=s.plot,D={exterior:s.preferences.exteriorWallThickness??(s.plot.units==="ft"?.75:.23),interior:s.preferences.interiorWallThickness??(s.plot.units==="ft"?.375:.12)},Z=v.useMemo(()=>yt(s.preferences.exteriorFinish,w*x,M*x),[s.preferences.exteriorFinish,w,M]),B=v.useMemo(()=>{var g,Q,T,b;const u=((Q=(g=s.site)==null?void 0:g.boundary)==null?void 0:Q.vertices)??[];return((b=(T=s.site)==null?void 0:T.boundary)==null?void 0:b.status)!=="unknown"&&u.length>=3?ts(u,w,M,x):null},[(ee=(ne=s.site)==null?void 0:ne.boundary)==null?void 0:ee.vertices,(m=(C=s.site)==null?void 0:C.boundary)==null?void 0:m.status,w,M]),G=(s.plot.shape==="square"||s.plot.shape==="rectangle")&&((A=(X=s.site)==null?void 0:X.boundary)==null?void 0:A.status)!=="unknown";v.useEffect(()=>()=>Z.dispose(),[Z]);const _=/\b(lagos|nigeria|ghana|benin|togo|cameroon|senegal|ivory coast)\b/i.test(s.location),R=_?[5.8,12,4.2]:[6.4,10.5,5.2],I=Math.max(...s.floors.map(u=>u.level),1),E=s.floors.flatMap(u=>u.rooms.filter(g=>!xe.has(g.category))),j=E.length?{minX:Math.min(...E.map(u=>u.rect.x)),minY:Math.min(...E.map(u=>u.rect.y)),maxX:Math.max(...E.map(u=>u.rect.x+u.rect.w)),maxY:Math.max(...E.map(u=>u.rect.y+u.rect.h))}:null,U=(u,g)=>[(u-w/2)*x,(g-M/2)*x];return e.jsxs(e.Fragment,{children:[e.jsx(qt,{distance:45e4,sunPosition:R,turbidity:_?7:5,rayleigh:1.8,mieCoefficient:.004,mieDirectionalG:.82}),e.jsx("hemisphereLight",{args:["#f5fbff",_?"#758361":"#a7afb8",1]}),e.jsx("directionalLight",{position:R,intensity:1.45,castShadow:!0}),e.jsx("directionalLight",{position:[-5,4,-6],intensity:.3}),e.jsxs("mesh",{rotation:[-Math.PI/2,0,0],position:[0,-.02,0],receiveShadow:!0,children:[e.jsx("planeGeometry",{args:[w*x+8,M*x+8]}),e.jsx("meshStandardMaterial",{color:"#dfe4e8"})]}),B||G?e.jsxs("mesh",{rotation:[-Math.PI/2,0,0],position:[0,-.005,0],receiveShadow:!0,children:[B?e.jsx("shapeGeometry",{args:[B]}):e.jsx("planeGeometry",{args:[w*x,M*x]}),e.jsx(ie,{materialId:ve.grass,repeat:Math.max(2,Math.min(16,Math.max(w,M)/7)),roughness:.96,color:"#ffffff"}),B?e.jsx(pe,{color:"#0f766e",threshold:1}):null]}):null,(((Y=s.site)==null?void 0:Y.routes)??[]).map(u=>{const g=zt(u,s.site,s.buildings??[],s.plot.units);if(!g||g.length<2)return null;const Q=Math.max(.1,u.width*Gt(u.units,s.plot.units));return e.jsx("group",{children:g.slice(0,-1).map((T,b)=>{const O=g[b+1],z=O.x-T.x,h=O.y-T.y,F=Math.hypot(z,h);if(F<=1e-6)return null;const H=(T.x+O.x)/2,$=(T.y+O.y)/2,k=Math.atan2(z,h);return e.jsxs("group",{position:[(H-w/2)*x,0,($-M/2)*x],rotation:[0,k,0],children:[e.jsxs("mesh",{position:[0,.015,0],receiveShadow:!0,children:[e.jsx("boxGeometry",{args:[Q*x,.025,F*x]}),e.jsx(ie,{materialId:u.kind==="road"?ve.asphalt:ve.paving,repeat:Math.max(1,F/3),roughness:.93,color:u.kind==="road"?"#ffffff":"#e7e4dd"})]}),u.kind==="road"?e.jsxs("mesh",{position:[0,.03,0],children:[e.jsx("boxGeometry",{args:[.025,.006,F*x*.72]}),e.jsx("meshStandardMaterial",{color:"#e6d89e"})]}):null]},`${u.id}:${b}`)})},u.id)}),(((V=s.site)==null?void 0:V.accessPoints)??[]).map(u=>{var $;const g=($=s.site)==null?void 0:$.boundary,Q=g==null?void 0:g.vertices.find(k=>k.id===u.fromVertexId),T=g==null?void 0:g.vertices.find(k=>k.id===u.toVertexId);if(!g||g.status==="unknown"||!Q||!T)return null;const b=Math.max(0,Math.min(1,u.fraction)),O=Q.x+(T.x-Q.x)*b,z=Q.y+(T.y-Q.y)*b,[h,F]=U(O,z),H=u.type==="vehicle"?"#1d4ed8":u.type==="pedestrian"?"#15803d":"#c2410c";return e.jsxs("group",{position:[h,.06,F],children:[e.jsxs("mesh",{rotation:[-Math.PI/2,0,0],children:[e.jsx("circleGeometry",{args:[.18,20]}),e.jsx("meshBasicMaterial",{color:H})]}),e.jsxs("mesh",{position:[0,.08,0],children:[e.jsx("cylinderGeometry",{args:[.045,.045,.16,8]}),e.jsx("meshStandardMaterial",{color:H})]})]},u.id)}),(s.buildings??[]).filter(u=>{var g;return u.role!=="primary"&&(((g=u.footprint)==null?void 0:g.vertices.length)??0)>=3}).map(u=>{var g;return e.jsx(Jt,{building:u,plotWidth:w,plotLength:M,siteBoundary:(g=s.site)==null?void 0:g.boundary,defaultRoof:s.roof,roofColor:s.preferences.roofColor,roofMaterialId:s.preferences.roofMaterial??Oe(u.roof??s.roof),roofVisible:y,wallTexture:Z,wallColor:s.preferences.exteriorColor??"#ffffff",exteriorFinish:s.preferences.exteriorFinish,wallThicknesses:D},u.id)}),s.floors.flatMap(u=>u.rooms.map(g=>{const Q=xe.has(g.category),[T,b]=U(g.rect.x+g.rect.w/2,g.rect.y+g.rect.h/2),O=(u.level-1)*(te+fe)+.012,z=g.id===o,h=Fe(g,x),F=g.finishColor??(g.category==="pool"?"#7fc4e8":g.category==="garden"?"#a9cf94":"#d8d5cd");return e.jsxs("mesh",{ref:H=>{H?r.current.set(g.id,H):r.current.delete(g.id)},position:[T,O,b],rotation:[-Math.PI/2,0,0],receiveShadow:!0,onClick:a?H=>{H.stopPropagation(),a(g.id===o?null:g.id)}:void 0,children:[e.jsx("shapeGeometry",{args:[h]}),e.jsx("meshStandardMaterial",{color:F,roughness:Q?.92:.78}),z?e.jsx(pe,{color:"#1a56f5"}):null]},`room-floor-${g.id}`)})),s.floors.flatMap(u=>{const g=Qe(u.rooms,u.walls,u.openings,D);return g.walls.map(Q=>e.jsx(pt,{wall:Q,openings:g.openings.filter(T=>T.wallId===Q.id),plotWidth:w,plotLength:M,wallTexture:Z,wallColor:s.preferences.exteriorColor??"#ffffff",exteriorFinish:s.preferences.exteriorFinish},Q.id))}),s.floors.flatMap(u=>u.rooms.filter(g=>!xe.has(g.category)).map(g=>{const Q=p[g.id]??g.items??[],[T,b]=U(g.rect.x+g.rect.w/2,g.rect.y+g.rect.h/2),O=(u.level-1)*(te+fe)+.03;return e.jsx("group",{position:[T,O,b],children:Q.map(z=>{const h=Ue(z.item,g.units),F=z.height??h.height,H=Ve.some($=>$.id===z.assetId&&$.placement==="ceiling");return e.jsxs("group",{ref:$=>{$?t.current.set(z.id,$):t.current.delete(z.id)},position:[z.x*g.rect.w*x,H?te-F*x:0,z.z*g.rect.h*x],rotation:[0,z.rotation,0],scale:z.scale,onClick:$=>{$.stopPropagation(),f==null||f(z.id)},children:[z.assetId?e.jsx(Ie,{assetId:z.assetId,targetWorldSize:[(z.width??h.width)*x,(z.height??h.height)*x,(z.depth??h.depth)*x]}):e.jsx(ke,{item:z.item,width:z.width??h.width,depth:z.depth??h.depth,height:z.height??h.height,color:z.color}),S===z.id?e.jsx(pe,{color:"#1a56f5"}):null]},z.id)})},`top-items-${g.id}`)})),l.map(u=>{var $;const[g,Q]=U(u.x,u.y),T=(u.width??3)*u.scale,b=(u.length??3)*u.scale,O=Math.abs(Math.cos(u.rotation))*T/2+Math.abs(Math.sin(u.rotation))*b/2,z=Math.abs(Math.sin(u.rotation))*T/2+Math.abs(Math.cos(u.rotation))*b/2,h=[{x:-O,y:-z},{x:O,y:-z},{x:O,y:z},{x:-O,y:z}].map(k=>({x:u.x+k.x,y:u.y+k.y})),F=($=s.site)!=null&&$.boundary&&s.site.boundary.status!=="unknown"?s.site.boundary.vertices:[],H=h.some(k=>k.x<0||k.y<0||k.x>w||k.y>M)||F.length>=3&&h.some(k=>!ct(k,F));return e.jsxs("group",{ref:k=>{k?n.current.set(u.id,k):n.current.delete(u.id)},position:[g,0,Q],rotation:[0,u.rotation,0],scale:u.scale,onClick:k=>{k.stopPropagation(),i==null||i(u.id)},children:[u.id===c?e.jsxs("mesh",{rotation:[-Math.PI/2,0,0],position:[0,.02,0],children:[e.jsx("ringGeometry",{args:[.28,.34,28]}),e.jsx("meshBasicMaterial",{color:"#1a56f5"})]}):null,e.jsx(ss,{kind:u.kind,assetId:u.assetId,sourceWorldScale:x*(s.plot.units==="ft"?3.28084:1),color:u.color,width:(u.width??3)*x,length:(u.length??3)*x}),H?e.jsxs("mesh",{position:[0,.05,0],children:[e.jsx("boxGeometry",{args:[(u.width??3)*x+.12,.06,(u.length??3)*x+.12]}),e.jsx("meshBasicMaterial",{color:"#dc2626",transparent:!0,opacity:0}),e.jsx(pe,{color:"#dc2626",threshold:2})]}):null]},u.id)}),j&&y?e.jsx("group",{position:[(j.minX+j.maxX-w)*x/2,0,(j.minY+j.maxY-M)*x/2],children:e.jsx(gt,{form:s.roof,y:I*(te+fe)+.08,width:(j.maxX-j.minX)*x*1.08,length:(j.maxY-j.minY)*x*1.08,color:s.preferences.roofColor,materialId:s.preferences.roofMaterial??Oe(s.roof)})}):null]})}function Jt({building:s,plotWidth:o,plotLength:a,siteBoundary:r,defaultRoof:t,roofColor:n,roofMaterialId:c,roofVisible:i,wallTexture:l,wallColor:p,exteriorFinish:S,wallThicknesses:f}){const y=s.footprint,w=Math.max(1,s.floors.length)*(te+fe),M=v.useMemo(()=>{const C=(y==null?void 0:y.vertices)??[];if(C.length<3)return null;const m=new Be;return C.forEach((X,A)=>{const Y=(X.x-o/2)*x,V=-(X.y-a/2)*x;A===0?m.moveTo(Y,V):m.lineTo(Y,V)}),m.closePath(),new Ot(m,{depth:w,bevelEnabled:!1,curveSegments:1})},[y,o,a,w]);if(v.useEffect(()=>()=>M==null?void 0:M.dispose(),[M]),!M)return null;const D=(y==null?void 0:y.vertices)??[],Z=r&&r.status!=="unknown"?r.vertices:[],B=D.some(C=>C.x<0||C.y<0||C.x>o||C.y>a)||Z.length>=3&&D.some(C=>!ct(C,Z)),G=B?"#fecaca":s.role==="service"?"#e6c59a":s.role==="other"?"#cbd5e1":"#b8c7e0",_=B?"#dc2626":s.role==="service"?"#9a5b16":"#425c82",R=Math.min(...D.map(C=>C.x)),I=Math.max(...D.map(C=>C.x)),E=Math.min(...D.map(C=>C.y)),j=Math.max(...D.map(C=>C.y)),U=(R+I)/2,ne=(E+j)/2,ee=s.floors.some(C=>C.rooms.some(m=>!xe.has(m.category)));return e.jsxs(e.Fragment,{children:[M?e.jsxs("mesh",{geometry:M,position:[0,.02,0],rotation:[-Math.PI/2,0,0],castShadow:!0,receiveShadow:!0,children:[e.jsx("meshStandardMaterial",{color:G,roughness:.82,transparent:ee,opacity:ee?.13:1,depthWrite:!ee}),e.jsx(pe,{color:_,threshold:8})]}):null,s.floors.flatMap(C=>C.rooms.filter(m=>!xe.has(m.category)).map(m=>{const X=(m.rect.x+m.rect.w/2-o/2)*x,A=(m.rect.y+m.rect.h/2-a/2)*x,Y=(C.level-1)*(te+fe)+.014,V=m.finishColor??"#d8d5cd";return e.jsxs("mesh",{position:[X,Y,A],rotation:[-Math.PI/2,0,0],receiveShadow:!0,children:[e.jsx("shapeGeometry",{args:[Fe(m,x)]}),e.jsx("meshStandardMaterial",{color:V,roughness:.82})]},`site-room-floor-${s.id}-${C.level}-${m.id}`)})),s.floors.flatMap(C=>C.rooms.filter(m=>{var X;return!xe.has(m.category)&&(((X=m.items)==null?void 0:X.length)??0)>0}).map(m=>{const X=(m.rect.x+m.rect.w/2-o/2)*x,A=(m.rect.y+m.rect.h/2-a/2)*x,Y=(C.level-1)*(te+fe)+.03;return e.jsx("group",{position:[X,Y,A],children:(m.items??[]).map(V=>{const u=Ue(V.item,m.units),g=V.width??u.width,Q=V.depth??u.depth,T=V.height??u.height,b=Ve.some(O=>O.id===V.assetId&&O.placement==="ceiling");return e.jsx("group",{position:[V.x*m.rect.w*x,b?te-T*x:0,V.z*m.rect.h*x],rotation:[0,V.rotation,0],scale:V.scale,children:V.assetId?e.jsx(Ie,{assetId:V.assetId,targetWorldSize:[g*x,T*x,Q*x]}):e.jsx(ke,{item:V.item,width:g,depth:Q,height:T,color:V.color})},V.id)})},`site-room-items-${s.id}-${C.level}-${m.id}`)})),s.floors.flatMap(C=>{const m=Qe(C.rooms,C.walls,C.openings,f);return m.walls.map(X=>e.jsx(pt,{wall:{...X,level:C.level},openings:m.openings.filter(A=>A.wallId===X.id),plotWidth:o,plotLength:a,wallTexture:l,wallColor:p,exteriorFinish:S},`site-wall-${s.id}-${C.level}-${X.id}`))}),(s.entrances??[]).map(C=>{const m=D.find(g=>g.id===C.fromVertexId),X=D.find(g=>g.id===C.toVertexId);if(!m||!X)return null;const A=Math.max(0,Math.min(1,C.fraction)),Y=m.x+(X.x-m.x)*A,V=m.y+(X.y-m.y)*A,u=C.type==="service"?"#c2410c":C.type==="pedestrian"?"#15803d":"#1d4ed8";return e.jsxs("mesh",{position:[(Y-o/2)*x,.11,(V-a/2)*x],children:[e.jsx("boxGeometry",{args:[.22,.12,.22]}),e.jsx("meshStandardMaterial",{color:u})]},C.id)}),i?e.jsx("group",{position:[(U-o/2)*x,0,(ne-a/2)*x],children:e.jsx(gt,{form:s.roof??t,y:w+.08,width:(I-R)*x*1.08,length:(j-E)*x*1.08,color:n,materialId:c})}):null]})}function pt({wall:s,openings:o,plotWidth:a,plotLength:r,wallTexture:t,wallColor:n,exteriorFinish:c}){const i=ht(s);if(i<=0)return null;const l=x,p=(s.start.x-a/2)*l,S=(s.start.y-r/2)*l,f=(s.end.x-a/2)*l,y=(s.end.y-r/2)*l,w=(p+f)/2,M=(S+y)/2,D=-Math.atan2(y-S,f-p),Z=(s.level-1)*(te+fe),B=Math.min(te,s.height*l),G=s.thickness*l,_=o.filter(E=>E.offset>=0&&E.width>0&&E.offset+E.width<=i&&E.sillHeight>=0&&E.sillHeight+E.height<=B/l).sort((E,j)=>E.offset-j.offset),R=s.kind==="exterior"?Re(c):null,I=dt({...s,height:B/l},_);return e.jsxs("group",{position:[w,Z,M],rotation:[0,D,0],children:[I.map((E,j)=>e.jsxs("mesh",{position:[(E.offsetStart+E.offsetEnd)*l/2-i*l/2,(E.elevationStart+E.elevationEnd)*l/2,0],castShadow:!0,receiveShadow:!0,children:[e.jsx("boxGeometry",{args:[(E.offsetEnd-E.offsetStart)*l,(E.elevationEnd-E.elevationStart)*l,G]}),R?e.jsx(ie,{materialId:R,repeat:2.4,color:n}):s.kind==="exterior"?e.jsx("meshStandardMaterial",{map:t,color:n,roughness:c==="metal"?.32:c==="glass"?.18:.82,metalness:c==="metal"?.48:0}):e.jsx("meshStandardMaterial",{color:"#e4e0d6",roughness:.86})]},`wall-${s.id}-${j}`)),_.map(E=>e.jsx(xt,{opening:E,wallThickness:G,wallLength:i},E.id))]})}function es({wall:s,openings:o,room:a,color:r}){const t=ht(s);if(t<=0)return null;const n=a.rect.x+a.rect.w/2,c=a.rect.y+a.rect.h/2,i=(s.start.x-n)*x,l=(s.start.y-c)*x,p=(s.end.x-n)*x,S=(s.end.y-c)*x,f=(i+p)/2,y=(l+S)/2,w=-Math.atan2(S-l,p-i),M=Math.min(te,s.height*x),D=Math.max(.035,s.thickness*x),Z=o.filter(G=>G.offset>=0&&G.width>0&&G.offset+G.width<=t&&G.sillHeight>=0&&G.sillHeight+G.height<=M/x).sort((G,_)=>G.offset-_.offset),B=dt({...s,height:M/x},Z);return e.jsxs("group",{position:[f,0,y],rotation:[0,w,0],children:[B.map((G,_)=>e.jsxs("mesh",{position:[(G.offsetStart+G.offsetEnd)*x/2-t*x/2,(G.elevationStart+G.elevationEnd)*x/2,0],receiveShadow:!0,children:[e.jsx("boxGeometry",{args:[(G.offsetEnd-G.offsetStart)*x,(G.elevationEnd-G.elevationStart)*x,D]}),e.jsx("meshStandardMaterial",{color:r,roughness:.86})]},_)),Z.map(G=>e.jsx(xt,{opening:G,wallThickness:D,wallLength:t},G.id))]})}function xt({opening:s,wallThickness:o,wallLength:a}){const r=x,t=s.width*r,n=s.height*r,c=s.type==="door"?0:s.sillHeight*r;if(s.type==="door"){const p=s.style==="double-hinged"||s.style==="sliding"||s.style==="folding",S=p?t/2:t,f=p?[-1,1]:[0];return e.jsx("group",{position:[(s.offset+s.width/2-a/2)*r,n/2,0],children:f.map(y=>e.jsxs("group",{position:[p?y*t/4:0,0,s.style==="sliding"?y*o*.2:0],children:[e.jsxs("mesh",{castShadow:!0,children:[e.jsx("boxGeometry",{args:[S-(p?.012:0),n,Math.max(.025,o*.55)]}),e.jsx("meshStandardMaterial",{color:s.color??"#8a6a48",roughness:.62})]}),p?e.jsxs("mesh",{position:[y*S*.38,0,o*.3],children:[e.jsx("sphereGeometry",{args:[.012,8,6]}),e.jsx("meshStandardMaterial",{color:"#d4b46c",metalness:.65,roughness:.28})]}):null]},y))})}const i=e.jsx("meshStandardMaterial",{color:s.color??"#9fd4ee",transparent:!0,opacity:.76,metalness:.12,roughness:.18}),l=e.jsx("meshStandardMaterial",{color:"#f5f4ee"});if(s.style==="bay"){const p=t*.38;return e.jsxs("group",{position:[(s.offset+s.width/2-a/2)*r,c+n/2,0],children:[e.jsxs("mesh",{children:[e.jsx("boxGeometry",{args:[p,n,o*.35]}),i]}),e.jsxs("mesh",{position:[-t*.32,0,-o*.25],rotation:[0,-.45,0],children:[e.jsx("boxGeometry",{args:[p,n,o*.3]}),i]}),e.jsxs("mesh",{position:[t*.32,0,-o*.25],rotation:[0,.45,0],children:[e.jsx("boxGeometry",{args:[p,n,o*.3]}),i]}),[-t*.18,t*.18].map(S=>e.jsxs("mesh",{position:[S,0,o*.3],children:[e.jsx("boxGeometry",{args:[.018,n,.012]}),l]},S))]})}return e.jsxs("group",{position:[(s.offset+s.width/2-a/2)*r,c+n/2,0],children:[e.jsxs("mesh",{children:[e.jsx("boxGeometry",{args:[t,n,Math.max(.025,o*.45)]}),i]}),[-1,1].map(p=>e.jsxs("mesh",{position:[p*(t/2-.009),0,o*.32],children:[e.jsx("boxGeometry",{args:[.018,n+.018,.016]}),l]},`jamb-${p}`)),e.jsxs("mesh",{position:[0,n/2-.009,o*.32],children:[e.jsx("boxGeometry",{args:[t,.018,.016]}),l]}),e.jsxs("mesh",{position:[0,-n/2+.009,o*.32],children:[e.jsx("boxGeometry",{args:[t,.018,.016]}),l]}),e.jsxs("mesh",{position:[0,-n/2-.024,o*.42],castShadow:!0,children:[e.jsx("boxGeometry",{args:[t+.09,.045,o*.8]}),l]}),s.style==="casement"||s.style==="sliding"?e.jsxs("mesh",{position:[0,0,o*.34],children:[e.jsx("boxGeometry",{args:[.018,n-.02,.016]}),l]}):null,s.style==="sliding"?e.jsxs("mesh",{position:[t*.24,0,o*.31],children:[e.jsx("boxGeometry",{args:[.012,n-.04,.012]}),e.jsx("meshStandardMaterial",{color:"#bdc5c7",metalness:.55,roughness:.34})]}):null,s.style==="casement"?e.jsxs("mesh",{position:[t*.37,0,o*.43],children:[e.jsx("boxGeometry",{args:[.016,.04,.018]}),e.jsx("meshStandardMaterial",{color:"#a6a9a5",metalness:.65,roughness:.32})]}):null]})}function ts(s,o,a,r){const t=s.map(c=>({x:(c.x-o/2)*r,y:(a/2-c.y)*r})),n=new Be;n.moveTo(t[0].x,t[0].y);for(const c of t.slice(1))n.lineTo(c.x,c.y);return n.closePath(),n}function Fe(s,o){const r=(s.outline&&s.outline.length>=3?s.outline:[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}]).map(n=>({x:(n.x-.5)*s.rect.w*o,y:(.5-n.y)*s.rect.h*o})),t=new Be;t.moveTo(r[0].x,r[0].y);for(const n of r.slice(1))t.lineTo(n.x,n.y);return t.closePath(),t}function ss({kind:s="palm",assetId:o,sourceWorldScale:a=1,color:r,width:t,length:n}){if(o)return e.jsx(Ie,{assetId:o,sourceWorldScale:a});if(s==="parking-bay")return e.jsxs("group",{children:[e.jsxs("mesh",{position:[0,.012,0],receiveShadow:!0,children:[e.jsx("boxGeometry",{args:[t,.022,n]}),e.jsx("meshStandardMaterial",{color:"#59616a",roughness:.95})]}),[-1,1].map(c=>e.jsxs("mesh",{position:[c*t*.44,.026,0],children:[e.jsx("boxGeometry",{args:[.025,.004,n*.94]}),e.jsx("meshStandardMaterial",{color:"#f1f1e9"})]},c))]});if(s==="road"||s==="path")return e.jsxs("group",{children:[e.jsxs("mesh",{position:[0,.012,0],receiveShadow:!0,children:[e.jsx("boxGeometry",{args:[t,.022,n]}),e.jsx(ie,{materialId:s==="road"?ve.asphalt:ve.paving,repeat:4,roughness:.92,color:s==="road"?"#ffffff":"#e7e4dd"})]}),s==="road"?e.jsxs("mesh",{position:[0,.025,0],children:[e.jsx("boxGeometry",{args:[.025,.004,n*.78]}),e.jsx("meshStandardMaterial",{color:"#e6d89e"})]}):null]});if(s==="fence"){const i=Math.max(2,Math.floor(n/.45));return e.jsxs("group",{children:[Array.from({length:i+1},(l,p)=>e.jsxs("mesh",{position:[0,.85/2,-n/2+n*p/i],castShadow:!0,children:[e.jsx("boxGeometry",{args:[Math.max(t,.035),.85,Math.max(t,.035)]}),e.jsx("meshStandardMaterial",{color:r,roughness:.8})]},`post-${p}`)),[.85*.32,.85*.78].map(l=>e.jsxs("mesh",{position:[0,l,0],castShadow:!0,children:[e.jsx("boxGeometry",{args:[Math.max(t,.04)*1.3,.07,n]}),e.jsx("meshStandardMaterial",{color:r,roughness:.8})]},l))]})}return s==="gate"?e.jsxs("group",{children:[[-1,1].map(c=>e.jsxs("mesh",{position:[c*t*.25,.48,0],castShadow:!0,children:[e.jsx("boxGeometry",{args:[t*.49,.9,Math.max(n,.06)]}),e.jsx("meshStandardMaterial",{color:r,metalness:.15,roughness:.55})]},c)),Array.from({length:8},(c,i)=>e.jsxs("mesh",{position:[-t*.48+t*i/7,.48,.01],children:[e.jsx("boxGeometry",{args:[.025,.82,Math.max(n,.065)]}),e.jsx("meshStandardMaterial",{color:"#d8d0c2",metalness:.45})]},`bar-${i}`))]}):s==="street-light"?e.jsxs("group",{children:[e.jsxs("mesh",{position:[0,.48,0],castShadow:!0,children:[e.jsx("cylinderGeometry",{args:[.018,.035,.96,8]}),e.jsx("meshStandardMaterial",{color:"#4c5561",metalness:.65,roughness:.35})]}),e.jsxs("mesh",{position:[t*.6,.96,0],rotation:[0,0,-.5],children:[e.jsx("boxGeometry",{args:[t*1.5,.035,.04]}),e.jsx("meshStandardMaterial",{color:"#59636f",metalness:.55})]}),e.jsxs("mesh",{position:[t*1.25,.91,0],children:[e.jsx("sphereGeometry",{args:[.055,10,8]}),e.jsx("meshStandardMaterial",{color:"#fff0a3",emissive:"#ffcf56",emissiveIntensity:.7})]})]}):s==="car"?e.jsxs("group",{children:[e.jsxs("mesh",{position:[0,.14,0],castShadow:!0,children:[e.jsx("boxGeometry",{args:[t,.26,n]}),e.jsx("meshStandardMaterial",{color:r,metalness:.18,roughness:.45})]}),e.jsxs("mesh",{position:[0,.29,-n*.03],castShadow:!0,children:[e.jsx("boxGeometry",{args:[t*.72,.19,n*.43]}),e.jsx("meshStandardMaterial",{color:"#8eb4c8",roughness:.25})]}),[-1,1].flatMap(c=>[-1,1].map(i=>e.jsxs("mesh",{position:[c*t*.48,.08,i*n*.32],rotation:[0,0,Math.PI/2],children:[e.jsx("cylinderGeometry",{args:[.055,.055,.04,12]}),e.jsx("meshStandardMaterial",{color:"#20252b"})]},`${c}-${i}`)))]}):e.jsx(is,{position:[0,0,0],kind:s,color:r})}function is({position:s,kind:o="palm",color:a="#4f8a3f"}){if(o==="car")return e.jsxs("group",{position:s,children:[e.jsxs("mesh",{position:[0,.16,0],castShadow:!0,children:[e.jsx("boxGeometry",{args:[.52,.18,.28]}),e.jsx("meshStandardMaterial",{color:a,metalness:.18,roughness:.45})]}),e.jsxs("mesh",{position:[0,.27,-.01],castShadow:!0,children:[e.jsx("boxGeometry",{args:[.28,.16,.24]}),e.jsx("meshStandardMaterial",{color:"#8eb4c8",roughness:.25})]}),[-1,1].flatMap(n=>[-1,1].map(c=>e.jsxs("mesh",{position:[n*.17,.07,c*.12],rotation:[0,0,Math.PI/2],children:[e.jsx("cylinderGeometry",{args:[.055,.055,.035,12]}),e.jsx("meshStandardMaterial",{color:"#20252b"})]},`${n}-${c}`)))]});if(o==="person")return e.jsxs("group",{position:s,children:[e.jsxs("mesh",{position:[0,.24,0],castShadow:!0,children:[e.jsx("capsuleGeometry",{args:[.055,.25,4,8]}),e.jsx("meshStandardMaterial",{color:a})]}),e.jsxs("mesh",{position:[0,.45,0],castShadow:!0,children:[e.jsx("sphereGeometry",{args:[.075,12,10]}),e.jsx("meshStandardMaterial",{color:"#c9926d"})]})]});const t=o==="palm"||o==="conifer"?.55:.18;return e.jsxs("group",{position:s,children:[e.jsxs("mesh",{position:[0,t/2,0],castShadow:!0,children:[e.jsx("cylinderGeometry",{args:[.035,.05,t,6]}),e.jsx("meshStandardMaterial",{color:"#8a6a48",roughness:.9})]}),o==="conifer"?e.jsxs("mesh",{position:[0,t+.28,0],castShadow:!0,children:[e.jsx("coneGeometry",{args:[.26,.62,8]}),e.jsx("meshStandardMaterial",{color:a,roughness:.85})]}):o==="shrub"||o==="flower"?e.jsxs("mesh",{position:[0,t+.08,0],castShadow:!0,children:[e.jsx("sphereGeometry",{args:[.14,12,10]}),e.jsx("meshStandardMaterial",{color:a,roughness:.9})]}):o==="hedge"?e.jsxs("mesh",{position:[0,t+.06,0],castShadow:!0,children:[e.jsx("boxGeometry",{args:[.5,.16,.16]}),e.jsx("meshStandardMaterial",{color:"#4f7a3c",roughness:.9})]}):e.jsxs("mesh",{position:[0,t+.16,0],castShadow:!0,children:[e.jsx("sphereGeometry",{args:[.26,14,12]}),e.jsx("meshStandardMaterial",{color:"#4f8a3f",roughness:.85})]})]})}function gt({form:s,y:o,width:a,length:r,color:t="#33415c",materialId:n}){const c=Math.min(a,r)*.32,i=n??Oe(s);if(s==="pitched-gable"){const l=Math.atan2(c,r/2),p=Math.sqrt(c*c+(r/2)**2)+.12;return e.jsxs("group",{position:[0,o,0],children:[e.jsxs("mesh",{position:[0,c/2,-r/4],rotation:[l,0,0],castShadow:!0,children:[e.jsx("boxGeometry",{args:[a+.24,.05,p]}),e.jsx(ie,{materialId:i,repeat:3,color:t,roughness:.78})]}),e.jsxs("mesh",{position:[0,c/2,r/4],rotation:[-l,0,0],castShadow:!0,children:[e.jsx("boxGeometry",{args:[a+.24,.05,p]}),e.jsx(ie,{materialId:i,repeat:3,color:t,roughness:.78})]})]})}return s==="hip"||s==="mansard"?e.jsxs("mesh",{position:[0,o+c/2+.08,0],rotation:[0,Math.PI/4,0],scale:[a*.72,1,r*.72],castShadow:!0,children:[e.jsx("coneGeometry",{args:[1,c,4]}),e.jsx(ie,{materialId:i,repeat:3,color:t,roughness:.78})]}):s==="shed"?e.jsxs("mesh",{position:[0,o+Math.sin(.28)*r/2+.08,0],rotation:[.28,0,0],castShadow:!0,children:[e.jsx("boxGeometry",{args:[a+.24,.06,r+.3]}),e.jsx(ie,{materialId:i,repeat:3,color:t,roughness:.78})]}):s==="dome"?e.jsxs("mesh",{position:[0,o,0],scale:[a*.55,c*1.1,r*.55],castShadow:!0,children:[e.jsx("sphereGeometry",{args:[1,28,18,0,Math.PI*2,0,Math.PI/2]}),e.jsx(ie,{materialId:i,repeat:3,color:t,roughness:.72})]}):e.jsxs("mesh",{position:[0,o+.04,0],castShadow:!0,children:[e.jsx("boxGeometry",{args:[a+.3,.09,r+.3]}),e.jsx(ie,{materialId:i,repeat:3,color:t,roughness:.82})]})}function ns({rooms:s,selected:o,floorFinish:a,wallThicknesses:r,placed:t,itemRefs:n,selectedItemId:c,onSelectItem:i,pendingItem:l,pendingAssetId:p,onPlaceInterior:S}){const f=v.useMemo(()=>{if(o)return o;const I=s.filter(j=>j.category==="living"||j.category==="bedroom");return(I.length>0?I:s).reduce((j,U)=>!j||U.width*U.length>j.width*j.length?U:j,null)},[s,o]),y=(f==null?void 0:f.finish)??a,w=((f==null?void 0:f.width)??0)*x,M=((f==null?void 0:f.length)??0)*x,D=v.useMemo(()=>Qe(s,void 0,void 0,r),[s,r]),Z=f?D.walls.filter(I=>I.roomIds.includes(f.id)):[],B=v.useMemo(()=>f?Fe(f,x):null,[f==null?void 0:f.id,f==null?void 0:f.rect.w,f==null?void 0:f.rect.h,f==null?void 0:f.outline]),G=v.useMemo(()=>f?yt(y,w,M):null,[f==null?void 0:f.id,y,w,M]);if(v.useEffect(()=>()=>G==null?void 0:G.dispose(),[G]),!f||!B)return null;const _=t[f.id]??f.items??[],R=_.some(I=>Ve.some(E=>E.id===I.assetId&&E.placement==="ceiling"));return e.jsxs(e.Fragment,{children:[e.jsx("color",{attach:"background",args:["#eef0f3"]}),e.jsx("hemisphereLight",{args:["#ffffff","#c9ccd2",.9]}),e.jsx("pointLight",{position:[0,te*.82,0],intensity:1.5,distance:7,color:"#fff4e0"}),e.jsx("directionalLight",{position:[2,3,2],intensity:.5}),e.jsxs("mesh",{rotation:[-Math.PI/2,0,0],position:[0,.004,0],receiveShadow:!0,onClick:I=>{l&&(I.stopPropagation(),S==null||S(l,p??void 0))},children:[e.jsx("shapeGeometry",{args:[B]}),Re(y)?e.jsx(ie,{materialId:Re(y),repeat:2.2,color:f.finishColor??"#ffffff"}):e.jsx("meshStandardMaterial",{map:G??void 0,color:f.finishColor??"#ffffff",roughness:y==="marble"||y==="glass"?.18:y==="tile"?.28:y==="carpet"?.96:.72,metalness:y==="metal"?.45:0})]}),R?null:e.jsxs("mesh",{rotation:[Math.PI/2,0,0],position:[0,te+.006,0],children:[e.jsx("shapeGeometry",{args:[B]}),e.jsx("meshStandardMaterial",{color:"#f4f1ea",roughness:.9,side:2})]}),Z.map(I=>e.jsx(es,{wall:I,openings:D.openings.filter(E=>E.wallId===I.id),room:f,color:f.finishColor??"#efece4"},I.id)),e.jsxs("mesh",{position:[0,.035,-M/2+.053],children:[e.jsx("boxGeometry",{args:[w-.1,.045,.025]}),e.jsx("meshStandardMaterial",{color:"#ffffff"})]}),_.map(I=>{const E=Ue(I.item,f.units);return e.jsxs("group",{ref:j=>{j?n.current.set(I.id,j):n.current.delete(I.id)},position:[I.x*w,0,I.z*M],rotation:[0,I.rotation,0],scale:I.scale,onClick:j=>{j.stopPropagation(),i==null||i(I.id)},children:[I.assetId?e.jsx(Ie,{assetId:I.assetId,targetWorldSize:[(I.width??E.width)*x,(I.height??E.height)*x,(I.depth??E.depth)*x]}):e.jsx(ke,{item:I.item,width:I.width??E.width,depth:I.depth??E.depth,height:I.height??E.height,color:I.color}),c===I.id?e.jsx(pe,{color:"#1a56f5"}):null]},I.id)})]})}function yt(s,o,a){const r=document.createElement("canvas");r.width=256,r.height=256;const t=r.getContext("2d"),n=it[s]??it.wood;if(t.fillStyle=n,t.fillRect(0,0,256,256),s==="wood")for(let i=0;i<8;i++){const l=i*32;t.fillStyle=i%2?"#c1a078":"#d2b58b",t.fillRect(0,l,256,31),t.strokeStyle="rgba(92,65,39,.23)",t.lineWidth=1,t.beginPath(),t.moveTo(0,l+31),t.lineTo(256,l+31),t.stroke();const p=i%2?0:64;for(let S=p;S<256;S+=128)t.beginPath(),t.moveTo(S,l),t.lineTo(S,l+31),t.stroke();for(let S=0;S<3;S++)t.strokeStyle="rgba(112,78,45,.08)",t.beginPath(),t.moveTo(8,l+5+S*8),t.lineTo(245,l+5+S*8),t.stroke()}else if(s==="stone"||s==="glass"||s==="tile"||s==="metal"){t.strokeStyle=s==="glass"?"rgba(81,126,151,.28)":"rgba(92,99,105,.24)",t.lineWidth=2;for(let i=0;i<=256;i+=64)t.beginPath(),t.moveTo(0,i),t.lineTo(256,i),t.stroke();for(let i=0;i<=256;i+=64)t.beginPath(),t.moveTo(i,0),t.lineTo(i,256),t.stroke();s==="glass"&&(t.fillStyle="rgba(255,255,255,.18)",t.fillRect(8,8,42,42))}else if(s==="marble")t.strokeStyle="rgba(104,117,128,.25)",t.lineWidth=2,t.beginPath(),t.moveTo(10,38),t.bezierCurveTo(70,72,110,15,246,65),t.stroke(),t.strokeStyle="rgba(255,255,255,.7)",t.lineWidth=4,t.beginPath(),t.moveTo(8,190),t.bezierCurveTo(90,130,150,230,250,175),t.stroke();else if(s==="terrazzo")for(let i=0;i<90;i++){const l=i*73%256,p=i*127%256;t.fillStyle=["#aeb3b1","#c98f73","#697985","#e6c796"][i%4],t.fillRect(l,p,3+i%4,2+i%3)}else if(s==="carpet")for(let i=0;i<256;i+=3)t.strokeStyle=`rgba(255,255,255,${i%7/70})`,t.beginPath(),t.moveTo(i,0),t.lineTo(i,256),t.stroke();else if(s==="brick"){t.strokeStyle="rgba(87,55,43,.3)",t.lineWidth=2;for(let i=0;i<=256;i+=32)t.beginPath(),t.moveTo(0,i),t.lineTo(256,i),t.stroke();for(let i=0;i<8;i++){const l=i%2?0:32;for(let p=l;p<=256;p+=64)t.beginPath(),t.moveTo(p,i*32),t.lineTo(p,i*32+32),t.stroke()}}else{t.strokeStyle="rgba(110,118,126,.12)",t.lineWidth=1;for(let i=0;i<90;i++){const l=i*73%256,p=i*127%256;t.fillStyle=i%2?"rgba(255,255,255,.12)":"rgba(70,75,80,.04)",t.fillRect(l,p,2,2)}}const c=new Ct(r);return c.colorSpace=Tt,c.wrapS=qe,c.wrapT=qe,c.repeat.set(Math.max(1,o*.75),Math.max(1,a*.75)),c.needsUpdate=!0,c}function ke({item:s,width:o,depth:a,height:r,color:t="#a9805a"}){const n=Rt(s),c=Math.max(.08,o*x),i=Math.max(.08,a*x),l=Math.max(.08,r*x),p=Math.max(.025,Math.min(c,i)*.08),S=Math.max(.035,l*.08),f=t,y=t;return n==="bed"||n==="king-bed"?e.jsxs("group",{children:[e.jsxs("mesh",{position:[0,l*.23,0],castShadow:!0,children:[e.jsx("boxGeometry",{args:[c,l*.28,i]}),e.jsx("meshStandardMaterial",{color:"#e8e2d6",roughness:.82})]}),e.jsxs("mesh",{position:[0,l*.48,-i*.47],castShadow:!0,children:[e.jsx("boxGeometry",{args:[c,l*.78,l*.08]}),e.jsx("meshStandardMaterial",{color:f,roughness:.65})]}),[-.24,.24].map(w=>e.jsxs("mesh",{position:[c*w,l*.42,-i*.29],children:[e.jsx("boxGeometry",{args:[c*.38,l*.16,i*.22]}),e.jsx("meshStandardMaterial",{color:"#fff",roughness:.95})]},w))]}):n==="sofa"||n==="armchair"?e.jsxs("group",{children:[e.jsxs("mesh",{position:[0,l*.28,i*.05],castShadow:!0,children:[e.jsx("boxGeometry",{args:[c,l*.48,i*.68]}),e.jsx("meshStandardMaterial",{color:y,roughness:.9})]}),e.jsxs("mesh",{position:[0,l*.62,-i*.28],castShadow:!0,children:[e.jsx("boxGeometry",{args:[c*.92,l*.55,i*.18]}),e.jsx("meshStandardMaterial",{color:y,roughness:.92})]}),[-1,1].map(w=>e.jsxs("mesh",{position:[w*c*.45,l*.38,i*.02],castShadow:!0,children:[e.jsx("boxGeometry",{args:[c*.1,l*.42,i*.72]}),e.jsx("meshStandardMaterial",{color:y,roughness:.9})]},w))]}):n==="dining"||n==="table"||n==="coffee-table"||n==="desk"||n==="sideboard"?e.jsxs("group",{children:[e.jsxs("mesh",{position:[0,l*.72,0],castShadow:!0,children:[e.jsx("boxGeometry",{args:[c,S,i]}),e.jsx("meshStandardMaterial",{color:f,roughness:.55})]}),[-1,1].flatMap(w=>[-1,1].map(M=>e.jsxs("mesh",{position:[w*(c/2-p),l*.36,M*(i/2-p)],castShadow:!0,children:[e.jsx("boxGeometry",{args:[p,l*.72,p]}),e.jsx("meshStandardMaterial",{color:f})]},`${w}:${M}`)))]}):n==="chair"?e.jsxs("group",{children:[e.jsxs("mesh",{position:[0,l*.42,0],castShadow:!0,children:[e.jsx("boxGeometry",{args:[c,l*.1,i]}),e.jsx("meshStandardMaterial",{color:f})]}),e.jsxs("mesh",{position:[0,l*.72,-i*.43],castShadow:!0,children:[e.jsx("boxGeometry",{args:[c,l*.55,p*1.4]}),e.jsx("meshStandardMaterial",{color:f})]}),[-1,1].flatMap(w=>[-1,1].map(M=>e.jsxs("mesh",{position:[w*c*.4,l*.2,M*i*.4],children:[e.jsx("boxGeometry",{args:[p,l*.4,p]}),e.jsx("meshStandardMaterial",{color:f})]},`${w}:${M}`)))]}):n==="fridge"?e.jsxs("group",{children:[e.jsxs("mesh",{position:[0,l/2,0],castShadow:!0,children:[e.jsx("boxGeometry",{args:[c,l,i]}),e.jsx("meshStandardMaterial",{color:t==="#a9805a"?"#c9ced4":t,metalness:.18,roughness:.36})]}),e.jsxs("mesh",{position:[c*.33,l*.55,i/2+.006],children:[e.jsx("boxGeometry",{args:[p*.35,l*.45,.012]}),e.jsx("meshStandardMaterial",{color:"#67717b",metalness:.5})]}),e.jsxs("mesh",{position:[0,l*.38,i/2+.008],children:[e.jsx("boxGeometry",{args:[c*.98,.018,.012]}),e.jsx("meshStandardMaterial",{color:"#87919a"})]})]}):n==="wardrobe"||n==="kitchen"||n==="cabinets"||n==="bookshelf"||n==="storage-rack"?e.jsxs("group",{children:[e.jsxs("mesh",{position:[0,l/2,0],castShadow:!0,children:[e.jsx("boxGeometry",{args:[c,l,i]}),e.jsx("meshStandardMaterial",{color:f,roughness:.65})]}),[.25,.5,.75].map(w=>e.jsxs("mesh",{position:[0,l*w,0],children:[e.jsx("boxGeometry",{args:[c*.94,.025,i*.96]}),e.jsx("meshStandardMaterial",{color:"#d7c8b5"})]},w)),e.jsxs("mesh",{position:[0,l/2,i/2+.006],children:[e.jsx("boxGeometry",{args:[.018,l*.9,.012]}),e.jsx("meshStandardMaterial",{color:"#6f5a43"})]})]}):n==="sink"||n==="washbasin"?e.jsxs("group",{children:[e.jsxs("mesh",{position:[0,l*.32,0],castShadow:!0,children:[e.jsx("boxGeometry",{args:[c,l*.12,i]}),e.jsx("meshStandardMaterial",{color:"#f8f8f4",roughness:.28})]}),e.jsxs("mesh",{position:[0,l*.44,0],children:[e.jsx("boxGeometry",{args:[c*.72,l*.08,i*.66]}),e.jsx("meshStandardMaterial",{color:"#fff",roughness:.25})]}),e.jsxs("mesh",{position:[0,l*.48,0],children:[e.jsx("cylinderGeometry",{args:[Math.min(c,i)*.05,Math.min(c,i)*.05,l*.12,10]}),e.jsx("meshStandardMaterial",{color:"#8798a3",metalness:.55,roughness:.25})]})]}):n==="cooker"?e.jsxs("group",{children:[e.jsxs("mesh",{position:[0,l*.45,0],castShadow:!0,children:[e.jsx("boxGeometry",{args:[c,l*.9,i]}),e.jsx("meshStandardMaterial",{color:"#c9ced4",metalness:.2,roughness:.34})]}),[[-.23,-.22],[.23,-.22],[-.23,.22],[.23,.22]].map(([w,M],D)=>e.jsxs("mesh",{position:[c*w,l*.91,i*M],children:[e.jsx("cylinderGeometry",{args:[Math.min(c,i)*.13,Math.min(c,i)*.13,.018,16]}),e.jsx("meshStandardMaterial",{color:"#33383e"})]},D))]}):n==="toilet"?e.jsxs("group",{children:[e.jsxs("mesh",{position:[0,l*.28,i*.08],castShadow:!0,scale:[1,.75,1],children:[e.jsx("sphereGeometry",{args:[1,20,14]}),e.jsx("meshStandardMaterial",{color:"#fafaf6",roughness:.25})]}),e.jsxs("mesh",{position:[0,l*.67,-i*.32],castShadow:!0,children:[e.jsx("boxGeometry",{args:[c*.76,l*.48,i*.32]}),e.jsx("meshStandardMaterial",{color:"#fff",roughness:.25})]}),e.jsxs("mesh",{position:[0,l*.51,i*.08],children:[e.jsx("torusGeometry",{args:[Math.min(c,i)*.29,Math.min(c,i)*.035,8,20]}),e.jsx("meshStandardMaterial",{color:"#dfe3e5"})]})]}):n==="shower"?e.jsxs("group",{children:[e.jsxs("mesh",{position:[0,l*.04,0],children:[e.jsx("boxGeometry",{args:[c,l*.08,i]}),e.jsx("meshStandardMaterial",{color:"#e8edf0"})]}),e.jsxs("mesh",{position:[-c*.45,l*.5,0],children:[e.jsx("boxGeometry",{args:[.018,l,i]}),e.jsx("meshStandardMaterial",{color:"#c4dbe6",transparent:!0,opacity:.38})]}),e.jsxs("mesh",{position:[0,l*.92,-i*.35],children:[e.jsx("cylinderGeometry",{args:[.025,.025,i*.25,8]}),e.jsx("meshStandardMaterial",{color:"#8997a1",metalness:.55})]})]}):n==="bath"?e.jsxs("group",{children:[e.jsxs("mesh",{position:[0,l*.28,0],castShadow:!0,children:[e.jsx("boxGeometry",{args:[c,l*.52,i]}),e.jsx("meshStandardMaterial",{color:"#f8f8f4",roughness:.25})]}),e.jsxs("mesh",{position:[0,l*.55,0],children:[e.jsx("boxGeometry",{args:[c*.78,l*.04,i*.72]}),e.jsx("meshStandardMaterial",{color:"#dceef4"})]})]}):n==="tv-unit"||n==="tv"?e.jsxs("group",{children:[e.jsxs("mesh",{position:[0,l*.18,0],castShadow:!0,children:[e.jsx("boxGeometry",{args:[c,l*.36,i]}),e.jsx("meshStandardMaterial",{color:f,roughness:.64})]}),e.jsxs("mesh",{position:[0,l*.76,0],children:[e.jsx("boxGeometry",{args:[c*.9,l*.48,Math.max(.025,i*.06)]}),e.jsx("meshStandardMaterial",{color:"#151a21",roughness:.3})]})]}):n==="washer"||n==="dryer"?e.jsxs("group",{children:[e.jsxs("mesh",{position:[0,l/2,0],castShadow:!0,children:[e.jsx("boxGeometry",{args:[c,l,i]}),e.jsx("meshStandardMaterial",{color:"#d9dfe3",metalness:.12,roughness:.35})]}),e.jsxs("mesh",{position:[0,l*.44,i/2+.006],children:[e.jsx("cylinderGeometry",{args:[Math.min(c,i)*.27,Math.min(c,i)*.27,.015,24]}),e.jsx("meshStandardMaterial",{color:"#53616d",metalness:.18,roughness:.25})]})]}):e.jsxs("mesh",{position:[0,l/2,0],castShadow:!0,children:[e.jsx("boxGeometry",{args:[c,l,i]}),e.jsx("meshStandardMaterial",{color:f,roughness:.7})]})}export{it as FLOOR_COLORS,rs as WALL_COLORS,ls as default};

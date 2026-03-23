import * as THREE from "three";

const loader = new THREE.TextureLoader();

const texture1 = loader.load('../assets/images/smoke.png');
const texture2 = loader.load('../assets/images/smoke_alpha.png');

export class ParticleBurst {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];

        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(10 * 3);

        geometry.setAttribute(
            'position',
            new THREE.BufferAttribute(positions, 3)
        );

        this.material = new THREE.PointsMaterial({
            size: 3.2, 
            transparent: true,
            opacity: 1,
            depthWrite: false,
            map: texture1,
            blending: THREE.AdditiveBlending
        });

        this.points = new THREE.Points(geometry, this.material);
        this.points.visible = false;

        scene.add(this.points);

        this.active = false;
    }

    reset() {
        this.particles.length = 0;
        this.active = false;
        this.points.visible = false;
        this.material.opacity = 1;
    }

    trigger(position) {
        this.reset();

        this.active = true;

        const positions = this.points.geometry.attributes.position.array;

        this.particles = [];

        for (let i = 0; i < 10; i++) {
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2,
            );

            this.particles.push({
                life: 1,
                velocity,
            });
            positions[i * 3] = position.x;
            positions[i * 3 + 1] = position.y;
            positions[i * 3 + 2] = position.z;
        }
        this.material.map = Math.random() > 0.5 ? texture1 : texture2;

        this.points.visible = true;
        this.points.geometry.attributes.position.needsUpdate = true;
    }
    update(delta) {
        if (!this.points.visible) return;

        const positions = this.points.geometry.attributes.position.array;

        let alive = false;

        this.particles.forEach((particle, i) => {
            if (particle.life <= 0) return;

            particle.life -= delta * 1.5;

            if (particle.life > 0) {
                alive = true;

                positions[i * 3] += particle.velocity.x * delta;
                positions[i * 3 + 1] += particle.velocity.y * delta;
                positions[i * 3 + 2] += particle.velocity.z * delta;
            }
        });

        if (!alive) {
            this.points.visible = false;
            this.material.opacity = 1;
        }

        this.material.opacity = Math.max(0, this.material.opacity - delta * 2);

        this.points.geometry.attributes.position.needsUpdate = true;
    }
}
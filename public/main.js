const config = {
    type: Phaser.AUTO,
    parent: "game-container",

    // ✅ RESPONSIVIDADE REAL (PC / MOBILE / TABLET)
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 800,
        height: 600
    },

    physics: {
        default: "arcade",
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },

    scene: {
        preload,
        create,
        update
    }
};

let dog;
let cursors;

// ✅ manter referência do game
const game = new Phaser.Game(config);

// ✅ resize ao girar tablet / mudar tela
window.addEventListener("resize", () => {
    if (game && game.scale) {
        game.scale.resize(window.innerWidth, window.innerHeight);
    }
});

function preload() {
    this.load.tilemapTiledJSON("city", "assets/city.json");
    this.load.image("urban_tiles", "assets/urban_tiles.png");
    this.load.spritesheet("dog", "assets/dog.png", {
        frameWidth: 16,
        frameHeight: 16
    });
    this.load.image("car", "assets/car.png");
}

function create() {

    //----------------------------------
    // MAPA
    //----------------------------------
    const map = this.make.tilemap({ key: "city" });
    const tileset = map.addTilesetImage("urban_tiles", "urban_tiles");

    const ground = map.createLayer("ground", tileset, 0, 0);
    const objects = map.createLayer("objects", tileset, 0, 0);

    ground.setCollisionByProperty({ collides: true });
    objects.setCollisionByProperty({ collides: true });

    //----------------------------------
    // DOG
    //----------------------------------
    dog = this.physics.add.sprite(200, 200, "dog");
    dog.setCollideWorldBounds(true);

    this.physics.add.collider(dog, ground);
    this.physics.add.collider(dog, objects);

    //----------------------------------
    // ANIMAÇÕES DO DOG
    //----------------------------------
    this.anims.create({
        key: "walk-down",
        frames: this.anims.generateFrameNumbers("dog", { start: 0, end: 3 }),
        frameRate: 8,
        repeat: -1
    });

    this.anims.create({
        key: "walk-left",
        frames: this.anims.generateFrameNumbers("dog", { start: 4, end: 8 }),
        frameRate: 8,
        repeat: -1
    });

    this.anims.create({
        key: "walk-right",
        frames: this.anims.generateFrameNumbers("dog", { start: 9, end: 11 }),
        frameRate: 8,
        repeat: -1
    });

    this.anims.create({
        key: "walk-up",
        frames: this.anims.generateFrameNumbers("dog", { start: 12, end: 15 }),
        frameRate: 8,
        repeat: -1
    });

    this.anims.create({ key: "idle-down", frames: [{ key: "dog", frame: 0 }] });
    this.anims.create({ key: "idle-left", frames: [{ key: "dog", frame: 4 }] });
    this.anims.create({ key: "idle-right", frames: [{ key: "dog", frame: 9 }] });
    this.anims.create({ key: "idle-up", frames: [{ key: "dog", frame: 12 }] });

    //----------------------------------
    // CÂMERA
    //----------------------------------
    this.cameras.main.startFollow(dog);
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

    //----------------------------------
    // TEXTURA INVISÍVEL (POSTES)
    //----------------------------------
    const graphics = this.make.graphics();
    graphics.fillStyle(0x000000, 0);
    graphics.fillRect(0, 0, 1, 1);
    graphics.generateTexture("invisible_texture", 1, 1);
    graphics.destroy();

    //----------------------------------
    // POSTES
    //----------------------------------
    const postLayer = map.getObjectLayer("posts");
    this.posts = this.physics.add.staticGroup();
    this.postList = [];

    postLayer.objects.forEach(obj => {
        const radiusProp = obj.properties?.find(p => p.name === "radius");
        const radius = radiusProp ? radiusProp.value * 0.5 : 20;

        const baseX = obj.x + (obj.width / 2 || radius);
        const baseY = obj.y + obj.height;
        const centerY = obj.y + (obj.height / 2);

        const p = this.posts.create(baseX, centerY, "invisible_texture");
        p.setAlpha(0);
        p.setVisible(false);
        p.setActive(true);

        p.setSize(radius * 2, radius * 2);
        p.setOffset(-radius, -radius);

        p.peeRadius = radius;
        p.hasPee = false;
        p.isPeeActive = false;
        p.circle = null;

        p.baseX = baseX;
        p.baseY = baseY;

        this.postList.push(p);
    });

    //----------------------------------
    // PRESTÍGIO / HUD
    //----------------------------------
    this.totalPosts = this.postList.length;
    this.activePees = 0;
    this.levelCompleted = false;

    this.prestigeBarBg = this.add.rectangle(100, 20, 200, 10, 0x333333)
        .setOrigin(0, 0)
        .setScrollFactor(0);

    this.prestigeBar = this.add.rectangle(100, 20, 0, 10, 0xffff00)
        .setOrigin(0, 0)
        .setScrollFactor(0);

    this.prestigeText = this.add.text(110, 35, "0/" + this.totalPosts, {
        fontSize: "14px",
        color: "#fff",
        fontStyle: "bold"
    }).setScrollFactor(0);

    //----------------------------------
    // OVERLAP POSTES
    //----------------------------------
    this.physics.add.overlap(dog, this.posts, (dog, post) => {
        if (!post.isPeeActive) startPee.call(this, post);
    });

    //----------------------------------
    // ROTAS DOS CARROS
    //----------------------------------
    const carRouteLayer = map.getObjectLayer("car-route");
    this.carPaths = [];

    carRouteLayer.objects.forEach(pathObj => {
        const points = pathObj.polyline.map(p => ({
            x: pathObj.x + p.x,
            y: pathObj.y + p.y
        }));
        this.carPaths.push(points);
    });

    //----------------------------------
    // CARROS
    //----------------------------------
    this.cars = this.physics.add.group({ allowGravity: false });

    const spawnCar = () => {
        const path = Phaser.Math.RND.pick(this.carPaths);
        const car = this.cars.create(path[0].x, path[0].y, "car");

        car.setScale(0.8);
        car.body.setSize(car.width * 0.5, car.height * 0.5);
        car.body.setOffset(car.width * 0.15, car.height * 0.15);

        let index = 1;
        let target = path[index];

        car.updatePath = () => {
            if (!target) return car.destroy();
            const angle = Phaser.Math.Angle.Between(car.x, car.y, target.x, target.y);
            const speed = 120;

            car.x += Math.cos(angle) * speed * (this.game.loop.delta / 1000);
            car.y += Math.sin(angle) * speed * (this.game.loop.delta / 1000);

            if (Phaser.Math.Distance.Between(car.x, car.y, target.x, target.y) < 5) {
                index++;
                target = path[index];
            }
        };
    };

    this.time.addEvent({ delay: 3000, callback: spawnCar, loop: true });

    this.physics.add.overlap(dog, this.cars, () => {
        if (!this.dogIsDead) dogHitCar.call(this);
    });

    cursors = this.input.keyboard.createCursorKeys();
    this.dogIsDead = false;
}

function update() {

    if (!this.dogIsDead) {
        dog.setVelocity(0);
        const speed = 120;
        let moving = false;

        const left = cursors.left.isDown || mobileInput.left;
        const right = cursors.right.isDown || mobileInput.right;
        const up = cursors.up.isDown || mobileInput.up;
        const down = cursors.down.isDown || mobileInput.down;

        if (left) { dog.setVelocityX(-speed); dog.anims.play("walk-left", true); moving = true; }
        else if (right) { dog.setVelocityX(speed); dog.anims.play("walk-right", true); moving = true; }

        if (up) { dog.setVelocityY(-speed); dog.anims.play("walk-up", true); moving = true; }
        else if (down) { dog.setVelocityY(speed); dog.anims.play("walk-down", true); moving = true; }

        if (!moving) {
            const a = dog.anims.currentAnim?.key || "walk-down";
            if (a.includes("left")) dog.anims.play("idle-left");
            else if (a.includes("right")) dog.anims.play("idle-right");
            else if (a.includes("up")) dog.anims.play("idle-up");
            else dog.anims.play("idle-down");
        }
    }

    this.cars.children.iterate(car => car?.updatePath?.());
    this.prestigeText.setText(this.activePees + "/" + this.totalPosts);

    if (this.activePees === this.totalPosts && !this.levelCompleted) {
        levelComplete.call(this);
    }
}

// ================= PRESTÍGIO =================

function startPee(post) {
    post.isPeeActive = true;
    this.activePees++;

    post.circle = this.add.circle(post.baseX, post.baseY, post.peeRadius, 0xffff00, 0.25);

    this.tweens.add({
        targets: post.circle,
        radius: 0,
        duration: 50000,
        onComplete: () => endPee.call(this, post)
    });
}

function endPee(post) {
    post.circle?.destroy();
    post.isPeeActive = false;
    this.activePees--;
}

function levelComplete() {
    this.levelCompleted = true;
    alert("Fase completa!");
}

// ================= GAME OVER =================

function dogHitCar() {
    this.dogIsDead = true;
    dog.setTint(0xff0000);
    this.physics.pause();
}

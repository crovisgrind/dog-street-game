const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
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

new Phaser.Game(config);

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
    const tileset = map.addTilesetImage("urban_tiles", "urban_tiles"); // â† CORRIGIDO AQUI

    const ground = map.createLayer("ground", tileset, 0, 0);
    const objects = map.createLayer("objects", tileset, 0, 0);

    ground.setCollisionByProperty({ collides: true });
    objects.setCollisionByProperty({ collides: true });

    //----------------------------------
    // DOG
    //----------------------------------
    dog = this.physics.add.sprite(200, 200, "dog");
    dog.setScale(1);
    dog.setCollideWorldBounds(true);

    this.physics.add.collider(dog, ground);
    this.physics.add.collider(dog, objects);

    // ANIMAÃ‡Ã•ES DO DOG â€" 4 frames por direÃ§Ã£o
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

// IDLE (parado) usando o primeiro frame de cada linha
this.anims.create({
    key: "idle-down",
    frames: [{ key: "dog", frame: 0 }]
});

this.anims.create({
    key: "idle-left",
    frames: [{ key: "dog", frame: 4 }]
});

this.anims.create({
    key: "idle-right",
    frames: [{ key: "dog", frame: 9 }]
});

this.anims.create({
    key: "idle-up",
    frames: [{ key: "dog", frame: 12 }]
});


    //----------------------------------
    // CÃ‚MERA
    //----------------------------------
    this.cameras.main.startFollow(dog);
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

    //----------------------------------
    // CRIAR TEXTURA INVISÃVEL PARA OS POSTES
    //----------------------------------
    const graphics = this.make.graphics();
    graphics.fillStyle(0x000000, 0);
    graphics.fillRect(0, 0, 1, 1);
    graphics.generateTexture('invisible_texture', 1, 1);
    graphics.destroy();

    //----------------------------------
// POSTES DO TILED (CORREÃ‡ÃƒO COMPLETA)
//----------------------------------
const postLayer = map.getObjectLayer("posts");
this.posts = this.physics.add.staticGroup();
this.postList = [];

postLayer.objects.forEach(obj => {
    const radiusProp = obj.properties?.find(p => p.name === "radius");
    const radius = radiusProp ? radiusProp.value * 0.5 : 20;

    // CORREÃ‡ÃƒO: NO TILED, obj.y Ã© o TOPO, nÃ£o a BASE!
    // obj.x = canto esquerdo
    // obj.y = TOPO do retÃ¢ngulo
    // BASE = obj.y + obj.height
    
    const baseX = obj.x + (obj.width / 2 || radius);  // Centro horizontal
    const baseY = obj.y + obj.height;                 // BASE REAL (parte inferior)
    const centerY = obj.y + (obj.height / 2);         // Centro vertical
    
    // Criar colisor no CENTRO do poste (nÃ£o na base)
    const p = this.posts.create(baseX, centerY, 'invisible_texture');
    
    // Torna invisÃ­vel
    p.setAlpha(0);
    p.setVisible(false);
    p.setActive(true);
    
    // Define colisor
    p.setSize(radius * 2, radius * 2);
    p.setOffset(-radius, -radius);

    // Propriedades
    p.peeRadius = radius;
    p.hasPee = false;
    p.isPeeActive = false;
    p.peeTimer = null;
    p.circle = null;
    
    // ARMAZENAR TODAS AS POSIÃ‡Ã•ES CORRETAS
    p.tiledLeft = obj.x;           // Esquerda no Tiled
    p.tiledTop = obj.y;            // Topo no Tiled
    p.tiledRight = obj.x + obj.width;  // Direita no Tiled
    p.tiledBottom = obj.y + obj.height; // Base REAL no Tiled
    p.tiledWidth = obj.width;
    p.tiledHeight = obj.height;
    
    p.baseX = baseX;               // Centro X (para cÃ­rculo)
    p.baseY = p.tiledBottom;       // BASE REAL (parte inferior)
    p.centerX = baseX;             // Centro X do colisor
    p.centerY = centerY;           // Centro Y do colisor

    this.postList.push(p);
});




    // DEBUG VISUAL - REMOVA DEPOIS DE AJUSTAR
   // this.postList.forEach(post => {
      //  this.add.circle(post.centerX, post.centerY, 4, 0xff0000, 1)
       //     .setDepth(100);
        
       // this.add.circle(post.baseX, post.baseY, 4, 0x0000ff, 1)
       //     .setDepth(100);
        
      //  this.add.circle(post.baseX, post.baseY, 6, 0x00ff00, 0.5)
       //     .setDepth(99);
    //});

    //----------------------------------
    // PRESTÃGIO
    //----------------------------------
    this.totalPosts = this.postList.length;
    this.activePees = 0;
    this.peeCount = 0;
    this.levelCompleted = false;

    this.prestigeBarBg = this.add.rectangle(100, 20, 200, 10, 0x333333)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(0);

    this.prestigeBar = this.add.rectangle(100, 20, 0, 10, 0xffff00)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(1);

    this.prestigeText = this.add.text(110, 35, "0/" + this.totalPosts, {
        fontSize: "14px",
        color: "#fff",
        fontStyle: "bold"
    }).setScrollFactor(0).setDepth(2);

    //----------------------------------
    // OVERLAP COM POSTES
    //----------------------------------
    this.physics.add.overlap(dog, this.posts, (dog, post) => {
        if (!post.isPeeActive) {
            startPee.call(this, post);
        }
    });

    //----------------------------------
    // ROTAS DOS CARROS (POLYLINE)
    //----------------------------------
    const carRouteLayer = map.getObjectLayer("car-route");
    this.carPaths = [];
    
    if (carRouteLayer && carRouteLayer.objects) {
        carRouteLayer.objects.forEach(pathObj => {
            const baseX = pathObj.x;
            const baseY = pathObj.y;

            const points = pathObj.polyline.map(p => ({
                x: baseX + p.x,
                y: baseY + p.y
            }));

            this.carPaths.push(points);
        });
        console.log("Rotas dos carros carregadas:", this.carPaths.length);
    } else {
        console.warn("Aviso: Camada 'car-route' nÃ£o encontrada ou sem objetos.");
    }

    //----------------------------------
    // GRUPO DE CARROS
    //----------------------------------
    this.cars = this.physics.add.group({
        allowGravity: false,
        immovable: true
    });

    const spawnCar = (scene) => {
        if (scene.carPaths.length === 0) return;

        const path = Phaser.Math.RND.pick(scene.carPaths);
        const car = scene.cars.create(path[0].x, path[0].y, "car");

        car.setScale(0.8);
        car.setDepth(10);

        const colors = [
        0x3498db, // Azul suave
        0x2ecc71, // Verde
        0xe74c3c, // Vermelho
        0xf39c12, // Laranja
        0x9b59b6, // Roxo
        0x1abc9c  // Turquesa
    ];
    
    car.setTint(Phaser.Math.RND.pick(colors));
        
        //car.body.setEnable(false);
         car.body.setSize(car.width * 0.5, car.height * 0.5); // Colisor menor que o sprite
    car.body.setOffset(car.width * 0.15, car.height * 0.15); // Centraliza

        let index = 1;
        let currentTarget = path[1] || path[0];
        
        car.updatePath = function() {
            if (!currentTarget) {
                car.destroy();
                return;
            }

            const angle = Phaser.Math.Angle.Between(car.x, car.y, currentTarget.x, currentTarget.y);
            const speed = 120;

            car.x += Math.cos(angle) * speed * (scene.game.loop.delta / 1000);
            car.y += Math.sin(angle) * speed * (scene.game.loop.delta / 1000);

            const dist = Phaser.Math.Distance.Between(car.x, car.y, currentTarget.x, currentTarget.y);
            if (dist < 5) {
                index++;
                currentTarget = path[index];
                if (!currentTarget) {
                    car.destroy();
                }
            }
        };
    };

    this.time.addEvent({
        delay: 3000,
        callback: () => spawnCar(this),
        loop: true
    });

    this.physics.add.overlap(dog, this.cars, () => {
        if (!this.dogIsDead) {
            dogHitCar.call(this);
        }
    });

    cursors = this.input.keyboard.createCursorKeys();
    this.dogIsDead = false;
}

function update() {

    //-----------------------------
    // MOVIMENTO DO DOG + ANIMAÃ‡ÃƒO
    //-----------------------------
    if (!this.dogIsDead) {

        dog.setVelocity(0);
        const speed = 120;
        let moving = false;

        // MUDANÇA MOBILE: Combinar teclado + botões mobile
        const leftPressed = cursors.left.isDown || mobileInput.left;
        const rightPressed = cursors.right.isDown || mobileInput.right;
        const upPressed = cursors.up.isDown || mobileInput.up;
        const downPressed = cursors.down.isDown || mobileInput.down;

        if (leftPressed) {
            dog.setVelocityX(-speed);
            dog.anims.play("walk-left", true);
            moving = true;
        }
        else if (rightPressed) {
            dog.setVelocityX(speed);
            dog.anims.play("walk-right", true);
            moving = true;
        }

        if (upPressed) {
            dog.setVelocityY(-speed);
            dog.anims.play("walk-up", true);
            moving = true;
        }
        else if (downPressed) {
            dog.setVelocityY(speed);
            dog.anims.play("walk-down", true);
            moving = true;
        }

        if (!moving) {
            const lastAnim = dog.anims.currentAnim?.key || "walk-down";

            if (lastAnim.includes("left")) dog.anims.play("idle-left");
            else if (lastAnim.includes("right")) dog.anims.play("idle-right");
            else if (lastAnim.includes("up")) dog.anims.play("idle-up");
            else dog.anims.play("idle-down");
        }
    }

    //-----------------------------
    // ATUALIZAÃ‡ÃƒO DOS CARROS
    //-----------------------------
    this.cars.children.iterate(car => {
        if (car && car.updatePath) car.updatePath();
    });

    //-----------------------------
    // HUD
    //-----------------------------
    if (this.prestigeText) {
        this.prestigeText.setText(this.activePees + "/" + this.totalPosts);
    }

    //-----------------------------
    // COMPLETAR FASE
    //-----------------------------
    if (
        this.activePees === this.totalPosts &&
        this.totalPosts > 0 &&
        !this.levelCompleted
    ) {
        levelComplete.call(this);
    }
}  
    //----------------------------


/////////////////////////////////////////
// FUNÃ‡Ã•ES DO SISTEMA DE PRESTÃGIO
/////////////////////////////////////////

function startPee(post) {
    if (post.isPeeActive) return;
    
    post.isPeeActive = true;
    this.activePees++;
    this.peeCount++;
    
    const startRadius = post.peeRadius;
    
    const baseY = post.baseY;
    
    post.circle = this.add.circle(
        post.baseX,
        baseY,
        startRadius,
        0xffff00,
        0.25
    ).setDepth(30);

    this.tweens.add({
        targets: post.circle,
        radius: 0,
        duration: 50000,
        ease: 'Linear',
        onUpdate: function() {
            if (post.circle) {
                post.circle.y = baseY;
            }
        },
        onComplete: () => {
            endPee.call(this, post);
        }
    });
    
    updatePrestigeBar.call(this);
}

function endPee(post) {
    if (post.circle) {
        post.circle.destroy();
        post.circle = null;
    }
    
    post.isPeeActive = false;
    post.hasPee = true;
    this.activePees--;
    
    updatePrestigeBar.call(this);
}

function updatePrestigeBar() {
    const percentage = this.activePees / this.totalPosts;
    const w = percentage * 200;
    
    this.tweens.add({
        targets: this.prestigeBar,
        width: w,
        duration: 300,
        ease: 'Power2'
    });
    
    let color = 0xffff00;
    
    if (percentage >= 1) {
        color = 0x00ff00;
    } else if (percentage <= 0) {
        color = 0xff0000;
    } else if (percentage >= 0.5) {
        color = 0xffaa00;
    }
    
    this.prestigeBar.fillColor = color;
}

function levelComplete() {
    if (this.levelCompleted) return;
    this.levelCompleted = true;
    
    this.postList.forEach(post => {
        if (post.circle) {
            this.tweens.killTweensOf(post.circle);
            post.circle.destroy();
            post.circle = null;
        }
        post.isPeeActive = false;
    });
    
    this.activePees = 0;
    updatePrestigeBar.call(this);
    
    // Determinar tamanho da fonte baseado na largura da tela
    const isMobile = window.innerWidth < 768;
    const fontSize = isMobile ? "32px" : "48px";
    
    const txt = this.add.text(
        this.cameras.main.centerX,
        this.cameras.main.centerY,
        "Fase completa!",
        {
            fontSize: fontSize,
            color: "#fff",
            backgroundColor: "#000",
            padding: { x: 30, y: 20 },
            align: "center",
            wordWrap: { width: window.innerWidth - 40 }
        }
    ).setOrigin(0.5).setScrollFactor(0);
    
    txt.setAlpha(0);
    this.tweens.add({
        targets: txt,
        alpha: 1,
        duration: 1000,
        ease: 'Power2'
    });
    
    this.tweens.add({
        targets: txt,
        scale: 1.1,
        duration: 500,
        yoyo: true,
        repeat: -1
    });
}

/////////////////////////////////////////
// GAME OVER â€" ATROPELADO
/////////////////////////////////////////

function dogHitCar() {
    this.dogIsDead = true;
    dog.setTint(0xff0000);
    dog.setVelocity(0);
    
    this.physics.pause();
    
    this.postList.forEach(post => {
        if (post.circle) {
            this.tweens.killTweensOf(post.circle);
        }
    });
    
    // Determinar tamanho da fonte baseado na largura da tela
    const isMobile = window.innerWidth < 768;
    const mainFontSize = isMobile ? "28px" : "42px";
    const btnFontSize = isMobile ? "16px" : "24px";
    const btnPadding = isMobile ? { x: 15, y: 8 } : { x: 20, y: 10 };

    const txt = this.add.text(
        this.cameras.main.centerX,
        this.cameras.main.centerY - 50,
        "Você foi atropelado!",
        {
            fontSize: mainFontSize,
            color: "#ff0000",
            backgroundColor: "#000",
            padding: { x: 20, y: 15 },
            align: "center",
            wordWrap: { width: window.innerWidth - 40 }
        }
    ).setOrigin(0.5).setScrollFactor(0);
    
    txt.setAlpha(0);
    this.tweens.add({
        targets: txt,
        alpha: 1,
        duration: 500
    });
    
    const restartBtn = this.add.text(
        this.cameras.main.centerX,
        this.cameras.main.centerY + 80,
        "Clique para recomeçar",
        {
            fontSize: btnFontSize,
            color: "#fff",
            backgroundColor: "#333",
            padding: btnPadding,
            align: "center",
            wordWrap: { width: window.innerWidth - 40 }
        }
    ).setOrigin(0.5).setScrollFactor(0);
    
    restartBtn.setInteractive();
    restartBtn.on('pointerdown', () => {
        this.scene.restart();
    });
}
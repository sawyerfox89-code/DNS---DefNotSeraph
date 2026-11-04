'use strict';

class Sprite {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }

    print(xCanvas, yCanvas) {
        if (context && img) {
            context.drawImage(img, this.x, this.y, this.width, this.height, xCanvas, yCanvas, this.width, this.height);
        }
    }
}

// Sprites
const background = new Sprite(0, 0, 1000, 600);
const elementSprite = new Sprite(1057, 141, 130, 130);
const pointBoard = new Sprite(1024, 377, 209, 196);
const playButton = new Sprite(1309, 18, 961, 522);
const lifeHeart = [
    new Sprite(1075, 106, 94, 26),
    new Sprite(1075, 81, 94, 26),
    new Sprite(1075, 56, 94, 26),
    new Sprite(1075, 31, 94, 26)
];

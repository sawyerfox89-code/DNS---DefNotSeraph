'use strict';

function debug(text) {
    console.log(text);
}

// SoundTracks
const soundIntro = document.getElementById("intro");
const soundBackground = document.getElementById("background");
const soundExplosion = document.getElementById("explosion");
const soundUp = document.getElementById("up");
const soundLose = document.getElementById("lose");

// Set initial volume
soundIntro.volume = 0.2;
soundBackground.volume = 0.2;

// Game Variables
var context;
var img;

let canvas, width, height;
let gameStatus = 0;
let record = 0;
let gravity = 2;
let life = 3;
let score = 0;
let quizElementSpawned = false;
let frames = 0;

// Language Config
const LANGUAGES = {
    PT: 'pt',
    EN: 'en'
};
let currentLanguage = LANGUAGES.PT;

const TEXTS = {
    pt: {
        record: "Recorde: ",
        welcome: "Ei! Neste jogo, você deve selecionar o elemento apresentado pelo gato (à esquerda da tela).\n\nVocê começa com três vidas. Se perder o elemento correto, perde uma vida. Para cada elemento correto, você ganha um ponto!\n\nDivirta-se! :)\n\n\nEste jogo foi desenvolvido por Allex Lima, Daniel Bispo, Paulo Moraes e Renan Barroncas (2015).\nAtualizado em 2025.",
        credits: "Desenvolvido por Allex Lima..."
    },
    en: {
        record: "Record: ",
        welcome: "Hey! In this game, you must select the element shown by the cat (on the left of the screen).\n\nYou start with three lives. If you miss the correct element, you lose a life. For each correct element selected, you get a point!\n\nHave fun! :)\n\n\nThis game was developed by Allex Lima, Daniel Bispo, Paulo Moraes and Renan Barroncas (2015).\nUpdated in 2025.",
        credits: "Developed by Allex Lima..."
    }
};

const quiz = {
    name: " ",
    symbol: null
};

const STATUS = {
    START: 0,
    PLAYING: 1,
};

const fallingElements = {
    items: [],
    spawnDelay: 0,
    baseLevel: 100,

    spawn: function() {
        if (!quizElementSpawned && (this.items.length > Math.floor(3 * Math.random()))) {
            this.items.push({
                width: 150,
                height: 150,
                gravity: gravity,
                velocity: 0,
                x: 300 + Math.floor(571 * Math.random()),
                y: Math.floor(50 * Math.random()),
                name: quiz.name, // Display name is set when picked
                symbol: quiz.symbol
            });
            quizElementSpawned = true;
        } else {
            const randomEl = PERIODIC_TABLE[Math.floor(PERIODIC_TABLE.length * Math.random())];
            const displayName = currentLanguage === LANGUAGES.PT ? randomEl.name : randomEl.nameEn;
            this.items.push({
                width: 150,
                height: 150,
                gravity: gravity,
                velocity: 0,
                x: 300 + Math.floor(571 * Math.random()),
                y: 0,
                name: displayName,
                symbol: randomEl.id
            });
        }
        this.spawnDelay = this.baseLevel + Math.floor(51 * Math.random());
    },

    update: function() {
        if (this.spawnDelay <= 0) {
            this.spawn();
            if (this.baseLevel >= 30)
                this.baseLevel--;
        } else {
            this.spawnDelay--;
        }

        for (let i = 0; i < this.items.length; i++) {
            let obs = this.items[i];
            obs.velocity += obs.gravity;
            obs.y = obs.velocity;
            const limit = height - obs.height / 2 - 110;

            if (obs.y >= limit) {
                this.items.splice(i, 1);
                i--;

                if (life > 0 && obs.symbol === quiz.symbol) {
                    pickRandomQuizElement();
                    life--;
                    soundExplosion.play();
                    quizElementSpawned = false;
                }

                if (life === 0) {
                    soundLose.play();
                }
            }
        }
    },

    draw: function() {
        for (let i = 0; i < this.items.length; i++) {
            let obs = this.items[i];
            elementSprite.print(obs.x, obs.y);

            context.fillStyle = "#890305";
            context.textAlign = "center";
            context.font = "25px Passion One, Arial";
            context.fillText(obs.symbol, (obs.x + obs.width / 2) - 10, (obs.y + obs.height / 2) - 5);
        }
    },

    handleClick: function(x, y) {
        for (let i = 0; i < this.items.length; i++) {
            let obs = this.items[i];

            if ((x >= obs.x) && (x <= (obs.x + obs.width)) && (y >= obs.y) && (y <= (obs.y + obs.height))) {
                this.items.splice(i, 1);
                i--;

                if (life > 0 && obs.symbol === quiz.symbol) {
                    score++;
                    fallingElements.items = [];
                    gravity += 0.1;
                    pickRandomQuizElement();
                    soundUp.play();
                    quizElementSpawned = false;
                } else {
                    if (life > 0)
                        life--;
                    soundExplosion.play();
                }

                if (life === 0)
                    soundLose.play();
            }
        }
    }
};

const panel = {
    quizElement: function() {
        context.fillStyle = "#fffc00";
        context.textAlign = "center";
        context.font = "25px Sigmar One, Arial";
        context.fillText(quiz.name, 127, 286);
    },
    pointsBoard: function() {
        pointBoard.print(41, 0);
        context.fillStyle = "#fff";
        context.textAlign = "center";
        context.font = "18px Arial";
        context.fillText(TEXTS[currentLanguage].record + record, 155, 67);
        context.font = "40px Arial";
        context.fillText(score, 153, 115);

        if (life > 0 && life <= 3) {
             if (lifeHeart[life]) {
                lifeHeart[life].print(103, 130);
             }
        }
    },
    splashScreen: function() {
        playButton.print(56, -50);
    },
    draw: function() {
        this.quizElement();
        this.pointsBoard();
    }
};

function pickRandomQuizElement() {
    const rand = Math.floor(PERIODIC_TABLE.length * Math.random());
    const el = PERIODIC_TABLE[rand];
    quiz.name = currentLanguage === LANGUAGES.PT ? el.name : el.nameEn;
    quiz.symbol = el.id;
}

function play() {
    frames++;

    background.print(0, 0);

    panel.draw();

    if (life === 0) {
        gameStatus = STATUS.START;
    }

    if (gameStatus === STATUS.START) {
        record = localStorage.getItem("record");
        if (record == null)
            record = 0;

        if (score > record)
            localStorage.setItem("record", score);

        panel.splashScreen();
        quiz.name = "";

        soundBackground.pause();
    } else if (gameStatus === STATUS.PLAYING) {
        fallingElements.draw();
        fallingElements.update();
        soundIntro.pause();
        soundBackground.play().catch(e => console.log("Audio play error: ", e));
    }

    window.requestAnimationFrame(play);
}

function onCanvasClick(event) {
    const rect = canvas.getBoundingClientRect();
    const pos = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
    };

    if (gameStatus === STATUS.START) {
        // Start Game
        score = 0;
        life = 3;
        fallingElements.items = [];
        quizElementSpawned = false;
        gravity = 2;
        pickRandomQuizElement();

        soundIntro.play().catch(e => console.log("Audio play error: ", e));

        gameStatus = STATUS.PLAYING;
    } else if (gameStatus === STATUS.PLAYING) {
        fallingElements.handleClick(pos.x, pos.y);
    }
}

function main() {
    height = window.innerHeight;
    width = window.innerWidth;

    canvas = document.createElement("canvas");
    canvas.width = 1000;
    canvas.height = 600;

    context = canvas.getContext("2d");
    document.body.appendChild(canvas);

    canvas.addEventListener('click', onCanvasClick);

    img = new Image();
    img.src = "sprites/images.png";

    // Check browser language or default to PT
    const userLang = navigator.language || navigator.userLanguage;
    if (userLang.startsWith('en')) {
        currentLanguage = LANGUAGES.EN;
    } else {
        currentLanguage = LANGUAGES.PT;
    }

    gameStatus = STATUS.START;
    play();
}

main();

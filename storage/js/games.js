// open in new tab setting
document.addEventListener('DOMContentLoaded', () => {
    function cookie(name, value = null, days = null) {
        if (value !== null) {
            let expires = "";
            if (days) {
                let date = new Date();
                date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
                expires = "; expires=" + date.toUTCString();
            }
            document.cookie = name + "=" + (value || "") + expires + "; path=/";
        } else {
            let cookieArr = document.cookie.split(';');
            for (let i = 0; i < cookieArr.length; i++) {
                let cookiePair = cookieArr[i].split('=');
                if (name === cookiePair[0].trim()) {
                    return decodeURIComponent(cookiePair[1]);
                }
            }
            return null;
        }
    }

    let openBlankCookie = cookie('open-blank');
    if (openBlankCookie === null) {
        openBlankCookie = 'true';
        cookie('open-blank', openBlankCookie, 365);
    }

    if (openBlankCookie === 'false') {
        let anchorTags = document.querySelectorAll('a[target="_blank"]');
        
        anchorTags.forEach(anchor => {
            anchor.removeAttribute('target');
        });
    }
});

// search, genre filter + sorting (combined so they work together)
const genreDropdown = document.getElementById('genreDropdown');
const sortDropdown = document.getElementById('sortDropdown');
const gameContainer = document.querySelector('.button-container');
const gameLinks = Array.from(gameContainer.querySelectorAll(':scope > a')).filter(a => a.querySelector('.button h2'));
gameLinks.forEach((a, i) => { a.dataset.order = i; });

function getPlayStats() {
    try { return JSON.parse(localStorage.getItem('gamePlayStats')) || {}; } catch (e) { return {}; }
}

gameLinks.forEach(a => {
    a.addEventListener('click', () => {
        const stats = getPlayStats();
        const key = a.getAttribute('href');
        const entry = stats[key] || { count: 0, last: 0 };
        entry.count += 1;
        entry.last = Date.now();
        stats[key] = entry;
        try { localStorage.setItem('gamePlayStats', JSON.stringify(stats)); } catch (e) {}
    });
});

function gameName(a) { return a.querySelector('.button h2').textContent.trim().toLowerCase(); }
function gameGenre(a) { return a.querySelector('.button').getAttribute('data-genre') || ''; }

function filterGames() {
    const search = document.getElementById('search').value.toLowerCase().trim();
    const genre = genreDropdown.value;
    const sort = sortDropdown ? sortDropdown.value : 'default';
    const stats = getPlayStats();

    const sorted = gameLinks.slice().sort((a, b) => {
        const sa = stats[a.getAttribute('href')] || { count: 0, last: 0 };
        const sb = stats[b.getAttribute('href')] || { count: 0, last: 0 };
        switch (sort) {
            case 'az': return gameName(a).localeCompare(gameName(b));
            case 'za': return gameName(b).localeCompare(gameName(a));
            case 'recent': return (sb.last - sa.last) || (a.dataset.order - b.dataset.order);
            case 'most': return (sb.count - sa.count) || (a.dataset.order - b.dataset.order);
            case 'genre': return gameGenre(a).localeCompare(gameGenre(b)) || gameName(a).localeCompare(gameName(b));
            case 'newest': return b.dataset.order - a.dataset.order;
            case 'random': return 0;
            default: return a.dataset.order - b.dataset.order;
        }
    });
    if (sort === 'random') {
        for (let i = sorted.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
        }
    }

    let shown = 0;
    sorted.forEach(a => {
        const visible = gameName(a).includes(search) && (genre === 'all' || gameGenre(a) === genre || (genre === 'opensource' && a.querySelector('.button').dataset.oss === 'true'));
        a.style.display = visible ? '' : 'none';
        a.querySelector('.button').style.display = '';
        if (visible) shown++;
        gameContainer.appendChild(a);
    });

    const counter = document.getElementById('gameCount');
    if (counter) counter.textContent = shown === gameLinks.length ? `${shown} games` : `${shown} of ${gameLinks.length} games`;
}

document.getElementById('search').addEventListener('input', filterGames);
genreDropdown.addEventListener('change', filterGames);
if (sortDropdown) {
    try { sortDropdown.value = localStorage.getItem('gameSort') || 'default'; } catch (e) {}
    sortDropdown.addEventListener('change', () => {
        try { localStorage.setItem('gameSort', sortDropdown.value); } catch (e) {}
        filterGames();
    });
}
genreDropdown.value = 'all';
filterGames();

// cool typing
const text = "games";
const typingDelay = 500; 
const initialDelay = 100; 
const cursor = document.getElementById("cursor");
const h1 = document.querySelector(".typewriter");

function type() {
setTimeout(() => {
    for (let i = 0; i < text.length; i++) {
    setTimeout(() => {
        h1.textContent += text[i];
        if (i === text.length - 1) {
        cursor.style.display = "none"; 
        }
    }, i * typingDelay);
    }
}, initialDelay);
}

type();

// open in blank tab
document.addEventListener('DOMContentLoaded', function() {
    var openBlankLink = document.getElementById('openBlankLink');

    openBlankLink.addEventListener('click', function(event) {
        event.preventDefault();

        var newTab = window.open('about:blank', '_blank');

        if (newTab) {
            var newTabBody = newTab.document.body;
            newTabBody.style.padding = '0';
            newTabBody.style.margin = '0';
            newTabBody.style.border = 'hidden';

            var iframe = document.createElement('iframe');
            iframe.src = window.location.href;
            iframe.style.width = '100%';
            iframe.style.height = '100%';
            iframe.style.border = 'hidden';

            iframe.onload = function() {
                var links = iframe.contentDocument.querySelectorAll('a[target="_blank"]');
                links.forEach(function(link) {
                    link.addEventListener('click', function(event) {
                        event.preventDefault();
                        iframe.contentWindow.location.href = link.href;
                    });
                });
            };

            newTab.document.body.appendChild(iframe);
        } else {
            alert("couldn't manage to open a new tab :(");
        }
    });
}); 

// favouritng games
document.addEventListener("DOMContentLoaded", function () {
    const pinButtons = document.querySelectorAll(".pin-button");
    const pinnedContainer = document.querySelector(".pinned-container");
    const pinnedHeader = document.querySelector(".pinned-header");
    const allGamesHeader = document.querySelector(".allgames-header")

    const pinnedGames = JSON.parse(localStorage.getItem("pinnedGames")) || [];

    function updatePinnedUI() {
        if (pinnedGames.length === 0) {
            pinnedContainer.style.display = "none";
            pinnedHeader.style.display = "none";
            allGamesHeader.style.display = "none";
        } else {
            pinnedContainer.style.display = "block";
            pinnedHeader.style.display = "block";
            allGamesHeader.style.display = "block"

            pinnedContainer.innerHTML = "";
            pinnedGames.forEach((game) => {
                const gameLink = document.createElement("a");
                gameLink.href = game.link;
                gameLink.target = "_blank";

                const gameButton = document.createElement("div");
                gameButton.classList.add("button");
                gameButton.style.backgroundImage = `url('${game.thumbnail}')`;
                gameButton.innerHTML = `<h2>${game.name}</h2>`;

                const pinButton = document.createElement("span");
                pinButton.classList.add("pin-button");

                const img = document.createElement("img");
                img.src = "/DNS---DefNotSeraph/images/other/cross.png";
                img.width = 25;
                img.height = 25;

                pinButton.appendChild(img);

                pinButton.addEventListener("click", (event) => {
                    event.preventDefault();
                    unpinGame(game.name);
                });

                gameButton.appendChild(pinButton);
                gameLink.appendChild(gameButton);
                pinnedContainer.appendChild(gameLink);
            });
        }
    }

    function pinGame(name, thumbnail, link) {
        const isAlreadyPinned = pinnedGames.some((game) => game.name === name);
        if (!isAlreadyPinned) {
            pinnedGames.push({ name, thumbnail, link });
            localStorage.setItem("pinnedGames", JSON.stringify(pinnedGames));
            updatePinnedUI();
        }
    }

    function unpinGame(name) {
        const index = pinnedGames.findIndex((game) => game.name === name);
        if (index !== -1) {
            pinnedGames.splice(index, 1);
            localStorage.setItem("pinnedGames", JSON.stringify(pinnedGames));
            updatePinnedUI();
        }
    }

    pinButtons.forEach((pinButton, index) => {
        pinButton.addEventListener("click", (event) => {
            event.preventDefault();
            const gameDiv = pinButton.closest(".button");
            const thumbnail = gameDiv.style.backgroundImage
                .replace('url("', '')
                .replace('")', '');
            const name = gameDiv.querySelector("h2").textContent;
            const link = gameDiv.parentElement.href; 
            pinGame(name, thumbnail, link);
        });
    });
    updatePinnedUI();
});

// downloading handler

const OFFLINE_MODE = [
    // offline mode page files
    '/DNS---DefNotSeraph/offline.html',
    '/DNS---DefNotSeraph/images/backgrounds/seraph/offlinebg.jpg',
    '/DNS---DefNotSeraph/images/ico.ico',
    '/DNS---DefNotSeraph/storage/fonts/ubuntu/Ubuntu.woff2',
    '/DNS---DefNotSeraph/storage/js/directories.json',

    // download ruffle
    '/DNS---DefNotSeraph/storage/ruffle/a29c1b01570ffecf6fae.wasm',
    '/DNS---DefNotSeraph/storage/ruffle/core.ruffle.1caf8a7231ccf85abb1d.js',
    '/DNS---DefNotSeraph/storage/ruffle/core.ruffle.1caf8a7231ccf85abb1d.js.map',
    '/DNS---DefNotSeraph/storage/ruffle/core.ruffle.78cc902cbabd4bc44008.js',
    '/DNS---DefNotSeraph/storage/ruffle/core.ruffle.78cc902cbabd4bc44008.js.map',
    '/DNS---DefNotSeraph/storage/ruffle/d6c752be1c7e690bf226.wasm',
    '/DNS---DefNotSeraph/storage/ruffle/package.json',
    '/DNS---DefNotSeraph/storage/ruffle/ruffle.js',
    '/DNS---DefNotSeraph/storage/ruffle/ruffle.js.map',

    // download cloaking
    '/DNS---DefNotSeraph/storage/js/cloak.js',
    '/images/icons/google.ico',
    '/images/icons/bing.ico',
    '/images/icons/gmail.ico',
    '/images/icons/desmos.ico',
    '/images/icons/googleclassroom.ico',
    '/images/icons/wikipedia.ico',
    '/images/icons/chromenewtab.ico',
    '/images/icons/googledrive.ico'
];

async function areEssentialFilesCached() {
    const cache = await caches.open('offlinemode-cache');
    const promises = OFFLINE_MODE.map(async (file) => {
        const response = await cache.match(file);
        return !!response;
    });
    const results = await Promise.all(promises);
    return results.every(result => result);
}

async function cacheEssentialFiles() {
    const cache = await caches.open('game-cache');
    await cache.addAll(OFFLINE_MODE);
}

async function ensureEssentialFiles(promptDiv) {
    const essentialFilesCached = await areEssentialFilesCached();
    if (!essentialFilesCached) {
        promptDiv.querySelector('p').textContent = `downloading offline mode files. speed of this may depend on your internet connection. `;
        await cacheEssentialFiles();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.download-button').forEach(button => {
        button.addEventListener('click', handleDownloadClick);
    });
});

function handleDownloadClick(event) {
    event.preventDefault(); 
    const gameButton = event.target.closest('.button');
    const gameName = gameButton.querySelector('h2').textContent;
    const gameDirectory = gameButton.closest('a').getAttribute('href');
    showConfirmationPrompt(gameName, gameDirectory, gameButton.style.backgroundImage);
}


function showConfirmationPrompt(gameName, gameDirectory) {
    const blackoutDiv = document.createElement('div');
    blackoutDiv.classList.add('blackout');
    
    const promptDiv = document.createElement('div');
    promptDiv.classList.add('confirmation-prompt');
    promptDiv.innerHTML = `
        <div class="prompt-content">
            <h2>download game</h2>
            <p>would you like to download ${gameName}? you'll be able to load this game when you don't have an internet connection.</p>
            <button id="confirm-yes">yes</button>
            <button id="confirm-no">no</button>
        </div>
    `;

    document.body.appendChild(blackoutDiv);
    document.body.appendChild(promptDiv);

    document.getElementById('confirm-yes').addEventListener('click', () => {
        promptDiv.querySelector('p').textContent = `preparing to download ${gameName}. please wait..`;
        promptDiv.querySelector('#confirm-yes').remove();
        promptDiv.querySelector('#confirm-no').remove();
        ensureEssentialFiles(promptDiv);

        promptDiv.querySelector('p').textContent = `downloading ${gameName}. speeds vary depending on the game size and your internet connection.`;

        downloadGameFiles(gameName, gameDirectory, promptDiv, blackoutDiv);
    });

    document.getElementById('confirm-no').addEventListener('click', () => {
        document.body.removeChild(blackoutDiv);
        document.body.removeChild(promptDiv);
    });

    centerDivOnScroll();
    window.addEventListener('scroll', centerDivOnScroll);
    window.addEventListener('resize', centerDivOnScroll);
}

function centerDivOnScroll() {
    const centerDiv = document.querySelector('.confirmation-prompt');
    const scrollY = window.scrollY || window.pageYOffset;
    const windowHeight = window.innerHeight;

    const newTopPosition = scrollY + (windowHeight / 2);
    centerDiv.style.top = `${newTopPosition}px`;
}
  
async function downloadGameFiles(gameName, gameDirectory, promptDiv, blackoutDiv) {
    try {
        const response = await fetch('/DNS---DefNotSeraph/storage/js/directories.json'); 
        if (!response.ok) {
            throw new Error('failed to fetch list');
        }

        const directoryList = await response.json();
        const gameData = directoryList[gameDirectory];
        if (!gameData || !gameData.files) {
            throw new Error('no files found for game.');
        }

        promptDiv.querySelector('p').textContent = `downloading ${gameName}. speeds vary depending on the game size and your internet connection.`;
        const files = gameData.files;
        const cache = await caches.open('game-cache');

        for (const file of files) {
            const fileResponse = await fetch(file);
            await cache.put(file, fileResponse.clone());
        }

        const thumbnailUrl = gameData.thumbnail;
        const thumbnailResponse = await fetch(thumbnailUrl);
        await cache.put(thumbnailUrl, thumbnailResponse.clone());

        saveGameToLocal({
            name: gameName,
            directory: gameDirectory,
            thumbnail: thumbnailUrl
        });

        promptDiv.querySelector('p').textContent = `${gameName} has finished downloading! you can now access this game locally by opening the site without an internet connection.`;
        const closeButton = document.createElement('button');
        closeButton.textContent = 'okay';
        closeButton.addEventListener('click', () => {
            document.body.removeChild(blackoutDiv);
            document.body.removeChild(promptDiv);
            window.removeEventListener('scroll', centerDivOnScroll);
            window.removeEventListener('resize', centerDivOnScroll);
        });
        promptDiv.appendChild(closeButton);
    } catch (error) {
        console.error('Error downloading game files:', error);
        promptDiv.querySelector('p').textContent = `there was an error trying to download ${gameName}. try again later, or report the issue to github/discord.`;
        const closeButton = document.createElement('button');
        closeButton.textContent = 'close';
        closeButton.addEventListener('click', () => {
            document.body.removeChild(blackoutDiv);
            document.body.removeChild(promptDiv);
            window.removeEventListener('scroll', centerDivOnScroll);
            window.removeEventListener('resize', centerDivOnScroll);
        });
        promptDiv.appendChild(closeButton);
    }
}

function saveGameToLocal(gameData) {
    const games = JSON.parse(localStorage.getItem('downloadedGames')) || [];
    games.push(gameData);
    localStorage.setItem('downloadedGames', JSON.stringify(games));
}